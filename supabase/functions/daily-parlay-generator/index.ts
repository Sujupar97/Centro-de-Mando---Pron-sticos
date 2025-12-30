// supabase/functions/daily-parlay-generator/index.ts
// Edge Function para generar parlays automáticos con los mejores pronósticos
// Ejecuta: 3:00 AM Colombia (8:00 AM UTC)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuración
const MIN_PREDICTIONS_FOR_PARLAY = 3
const MAX_LEGS_PER_PARLAY = 5
const MIN_CONFIDENCE = 60

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const genAI = new GoogleGenerativeAI(geminiApiKey)

        const today = new Date().toISOString().split('T')[0]

        // Fecha objetivo: mañana (los partidos que se analizaron hoy)
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const targetDate = tomorrow.toISOString().split('T')[0]

        console.log(`[ParlayGen] Generando parlays para: ${targetDate}`)

        // 1. Iniciar log
        const { data: jobId } = await supabase.rpc('start_automation_job', {
            p_job_type: 'parlay_generator',
            p_execution_date: today
        })

        // 2. Obtener mejores predicciones del día
        // NOTA: No filtramos por confidence en SQL porque la columna puede ser texto ('Alta', 'Media')
        const { data: rawPredictions, error: predError } = await supabase
            .from('predictions')
            .select('*, analysis_runs(report_pre_jsonb)')
            .gte('created_at', `${today}T00:00:00`)
            .lt('created_at', `${today}T23:59:59`)
            .is('is_won', null)
            .limit(1000) // Traemos MUCHAS para filtrar en memoria

        if (predError) {
            throw new Error(`Error obteniendo predicciones: ${predError.message}`)
        }

        // Helper para normalizar confianza
        const getConfidenceScore = (val: any): number => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const lower = val.toLowerCase();
                if (lower.includes('alta')) return 85;
                if (lower.includes('media')) return 65;
                if (lower.includes('baja')) return 40;
                const parsed = parseInt(val);
                return !isNaN(parsed) ? parsed : 50;
            }
            return 50;
        };

        // 2.1 VERIFICACIÓN DE FECHA REAL Y CONFIANZA
        const fixtureIds = rawPredictions?.map(p => p.fixture_id) || [];
        let validFixtureIds = new Set<number>();

        if (fixtureIds.length > 0) {
            const { data: validMatches, error: matchError } = await supabase
                .from('daily_matches')
                .select('api_fixture_id')
                .in('api_fixture_id', fixtureIds)
                .eq('match_date', targetDate); // CRÍTICO: Debe coincidir con la fecha objetivo

            if (!matchError && validMatches) {
                validMatches.forEach(m => validFixtureIds.add(m.api_fixture_id));
            }
        }

        // Filtrar y Ordenar
        const predictions = rawPredictions
            ?.map(p => ({ ...p, confidenceScore: getConfidenceScore(p.confidence) }))
            .filter(p => validFixtureIds.has(p.fixture_id)) // Solo fecha correcta
            .filter(p => p.confidenceScore >= MIN_CONFIDENCE) // Confianza mínima
            .sort((a, b) => b.confidenceScore - a.confidenceScore) // Mejores primero
            .slice(0, 10); // Top 10



        if (!predictions || predictions.length < MIN_PREDICTIONS_FOR_PARLAY) {
            console.log(`[ParlayGen] Insuficientes predicciones: ${predictions?.length || 0}`)

            await supabase.rpc('complete_automation_job', {
                p_job_id: jobId,
                p_status: 'success',
                p_processed: 0,
                p_details: { message: 'Insufficient predictions for parlay' }
            })

            return new Response(
                JSON.stringify({ success: true, parlays: 0, reason: 'Not enough predictions' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`[ParlayGen] Predicciones disponibles: ${predictions.length}`)

        // 3. Generar parlay con Gemini
        const parlay = await generateParlayWithAI(genAI, predictions)

        // 4. Guardar parlay
        const { data: savedParlay, error: saveError } = await supabase
            .from('daily_auto_parlays')
            .insert({
                parlay_date: targetDate, // Fecha para la que es el parlay
                title: parlay.title,
                total_odds: parlay.totalOdds,
                win_probability: parlay.winProbability,
                strategy: parlay.strategy,
                legs: parlay.legs,
                is_featured: true,
                status: 'pending'
            })
            .select()
            .single()

        if (saveError) {
            throw new Error(`Error guardando parlay: ${saveError.message}`)
        }

        // 5. Completar log
        await supabase.rpc('complete_automation_job', {
            p_job_id: jobId,
            p_status: 'success',
            p_processed: 1,
            p_success: 1,
            p_details: {
                parlay_id: savedParlay.id,
                legs_count: parlay.legs.length,
                total_odds: parlay.totalOdds
            }
        })

        console.log(`[ParlayGen] Parlay generado con ${parlay.legs.length} pronósticos`)

        return new Response(
            JSON.stringify({
                success: true,
                parlay: {
                    id: savedParlay.id,
                    title: parlay.title,
                    legs: parlay.legs.length,
                    totalOdds: parlay.totalOdds
                }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('[ParlayGen] Error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})

// Función helper: Generar parlay con IA
async function generateParlayWithAI(genAI: GoogleGenerativeAI, predictions: any[]) {
    // Preparar texto de predicciones con nombres extraídos de analysis_runs o fallbacks
    const predictionsWithNames = predictions.map((p: any) => {
        const report = p.analysis_runs?.report_pre_jsonb || {};
        const titulo = report.header_partido?.titulo || 'Equipo 1 vs Equipo 2';
        return {
            ...p,
            match_title: titulo,
            league_name: 'Fútbol' // Simplificación o extraer si está disponible
        };
    });

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const predictionsText = predictionsWithNames.map((p: any, i: number) =>
        `${i + 1}. ${p.match_title}
    - Mercado: ${p.market}
    - Selección: ${p.selection}
    - Confianza: ${p.confidence}%`
    ).join('\n')


    const prompt = `
Eres un experto en apuestas deportivas. Con las siguientes predicciones, crea el MEJOR parlay posible.

PREDICCIONES DISPONIBLES:
${predictionsText}

REGLAS:
1. Selecciona 3 predicciones que combinen bien
2. Calcula las cuotas estimadas y probabilidad combinada

Responde en JSON:
{
  "title": "Nombre atractivo del parlay",
  "strategy": "Explicación de la estrategia",
  "legs": [
    {
      "match": "Equipo1 vs Equipo2",
      "league": "Liga",
      "market": "Mercado",
      "prediction": "Selección",
      "confidence": 70,
      "estimatedOdds": 1.75,
      "reasoning": "Breve razón"
    }
  ],
  "totalOdds": 4.5,
  "winProbability": 35
}

IMPORTANTE: Solo JSON válido, sin markdown.
`

    try {
        const result = await model.generateContent(prompt)
        const text = result.response.text()
        const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        return JSON.parse(cleanJson)
    } catch (error) {
        console.error('Error parsing parlay:', error)

        // Fallback: crear parlay manual con top 3
        const topPredictions = predictionsWithNames.slice(0, 3)
        return {
            title: 'Parlay del Día (Automático)',
            strategy: 'Selección automática de las 3 mejores predicciones según confianza del modelo.',
            legs: topPredictions.map((p: any) => {
                const [home, away] = p.match_title.split(' vs ');
                return {
                    match: p.match_title,
                    home: home || 'Local',
                    away: away || 'Visitante',
                    league: 'Fútbol',
                    market: p.market,
                    prediction: p.selection,
                    selection: p.selection,
                    confidence: p.confidence,
                    estimatedOdds: 1.7,
                    reasoning: `Alta confianza del modelo (${p.confidence}%)`
                };
            }),
            totalOdds: 4.9,
            winProbability: Math.round(topPredictions.reduce((acc: number, p: any) => acc * (p.confidence / 100), 1) * 100)
        }
    }
}
