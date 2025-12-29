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
        const { data: predictions, error: predError } = await supabase
            .from('predictions')
            .select('*')
            .eq('match_date', targetDate)
            .gte('confidence', MIN_CONFIDENCE)
            .is('is_won', null) // Solo pendientes
            .order('confidence', { ascending: false })
            .limit(10)

        if (predError) {
            throw new Error(`Error obteniendo predicciones: ${predError.message}`)
        }

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
                parlay_date: targetDate,
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const predictionsText = predictions.map((p, i) =>
        `${i + 1}. ${p.home_team} vs ${p.away_team} (${p.league_name})
    - Pronóstico: ${p.predicted_outcome}
    - Confianza: ${p.confidence}%
    - Tipo: ${p.prediction_type}`
    ).join('\n')

    const prompt = `
Eres un experto en apuestas deportivas. Con las siguientes predicciones, crea el MEJOR parlay posible.

PREDICCIONES DISPONIBLES:
${predictionsText}

REGLAS:
1. Selecciona 3-5 predicciones que combinen bien
2. Busca diversificar ligas cuando sea posible
3. Evita seleccionar muchos partidos de la misma liga
4. Prefiere predicciones con confianza > 65%
5. Calcula las cuotas estimadas y probabilidad combinada

Responde en JSON:
{
  "title": "Nombre atractivo del parlay",
  "strategy": "Explicación de la estrategia en 2-3 oraciones",
  "legs": [
    {
      "match": "Equipo1 vs Equipo2",
      "league": "Liga",
      "prediction": "Resultado predicho",
      "confidence": 70,
      "estimatedOdds": 1.75
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
        const topPredictions = predictions.slice(0, 3)
        return {
            title: 'Parlay del Día',
            strategy: 'Selección automática de las 3 mejores predicciones',
            legs: topPredictions.map(p => ({
                match: `${p.home_team} vs ${p.away_team}`,
                league: p.league_name,
                prediction: p.predicted_outcome,
                confidence: p.confidence,
                estimatedOdds: 1.7
            })),
            totalOdds: 4.9,
            winProbability: Math.round(topPredictions.reduce((acc, p) => acc * (p.confidence / 100), 1) * 100)
        }
    }
}
