// supabase/functions/daily-parlay-generator/index.ts
// Edge Function para generar parlays automáticos con los mejores pronósticos
// Ejecuta: 3:00 AM Colombia (8:00 AM UTC) o on-demand

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuración
// Configuración
const MIN_PREDICTIONS_FOR_PARLAY = 2
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

        // 0. CHECK SYSTEM SETTINGS
        const { data: settings } = await supabase
            .from('system_settings')
            .select('key, value')
            .eq('key', 'auto_parlay_enabled')
            .single();

        const enabled = settings?.value ?? true;

        if (!enabled) {
            console.log('[ParlayGen] ⏹️ Parlay generation disabled by system_settings');
            return new Response(JSON.stringify({ success: true, message: 'Disabled' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const today = new Date().toISOString().split('T')[0]

        // Fecha objetivo: mañana (los partidos que se analizaron hoy)
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const targetDate = tomorrow.toISOString().split('T')[0]

        console.log(`[ParlayGen] Generando parlays para: ${targetDate}`)

        // 1. Obtener Organization ID (Requerido por tabla parlays)
        // Intentamos obtener la primera organización disponible
        const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
        const orgId = orgs?.[0]?.id;

        if (!orgId) {
            console.error('[ParlayGen] ❌ No organization found. Cannot save parlay.');
            return new Response(JSON.stringify({ success: false, error: 'No organizations found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 2. Start Automation Log (Optional, if rpc exists)
        let jobId = null;
        try {
            const { data } = await supabase.rpc('start_automation_job', {
                p_job_type: 'parlay_generator',
                p_execution_date: today
            })
            jobId = data;
        } catch (e) { console.log('RPC start_automation_job not found, skipping log'); }


        // 3. Obtener mejores predicciones
        // FIX: Ampliar rango a ayer para cubrir Timezone differences (UTC vs Local)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const sinceDate = yesterday.toISOString().split('T')[0];

        const { data: rawPredictions, error: predError } = await supabase
            .from('predictions')
            .select('*, analysis_runs(report_pre_jsonb)')
            .gte('created_at', `${sinceDate}T00:00:00`) // Recientes (48h window)
            .limit(1000)

        if (predError) throw new Error(`Error obteniendo predicciones: ${predError.message}`)

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

        // 3.1 Filtros y Sort
        // Filtramos por fecha del partido (de predictions o runs) si es posible, o usamos todas las recientes.
        // Asumimos que created_at reciente implica partido próximo.

        const predictions = rawPredictions
            ?.map(p => ({ ...p, confidenceScore: getConfidenceScore(p.confidence) }))
            .filter(p => p.confidenceScore >= MIN_CONFIDENCE)
            .sort((a, b) => b.confidenceScore - a.confidenceScore)
            .slice(0, 10); // Top 10

        if (!predictions || predictions.length < MIN_PREDICTIONS_FOR_PARLAY) {
            console.log(`[ParlayGen] Insuficientes predicciones: ${predictions?.length || 0}`)
            return new Response(
                JSON.stringify({ success: true, parlays: 0, reason: 'Not enough predictions' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`[ParlayGen] Predicciones candidatas: ${predictions.length}`)

        // 4. Generar parlay con Gemini
        const parlay = await generateParlayWithAI(genAI, predictions)

        console.log('[ParlayGen] Parlay generado:', parlay.title);

        // 5. Guardar parlay en TABLA PRINCIPAL (parlays)
        // Limpiamos anterior para evitar loops
        await supabase.from('parlays').delete().eq('date', targetDate).eq('organization_id', orgId);

        const { data: savedParlay, error: saveError } = await supabase
            .from('parlays')
            .insert({
                organization_id: orgId,
                date: targetDate,
                title: parlay.title,
                total_odds: parlay.totalOdds,
                win_probability: parlay.winProbability,
                strategy: parlay.strategy,
                legs: parlay.legs, // JSONB structure
                status: 'pending' // Default statua
            })
            .select()
            .single()

        if (saveError) {
            console.error('[ParlayGen] Save Error:', saveError);
            throw new Error(`Error guardando parlay: ${saveError.message}`)
        }

        console.log(`[ParlayGen] ✅ Parlay guardado en DB (ID: ${savedParlay.id})`)

        return new Response(
            JSON.stringify({
                success: true,
                parlay: {
                    id: savedParlay.id,
                    title: parlay.title,
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
    const predictionsWithNames = predictions.map((p: any) => {
        const report = p.analysis_runs?.report_pre_jsonb || {};
        const titulo = report.header_partido?.titulo || 'Equipo 1 vs Equipo 2';
        return {
            ...p,
            match_title: titulo,
        };
    });

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const predictionsText = predictionsWithNames.map((p: any, i: number) =>
        `${i + 1}. ${p.match_title} (Fixture ID: ${p.fixture_id})
    - Mercado: ${p.market}
    - Selección: ${p.selection}
    - Confianza: ${p.confidence}%
    - Odds Estimados: ${p.odds || 'N/A'}`
    ).join('\n')


    const prompt = `
Eres un experto en apuestas deportivas. Crea el MEJOR parlay (combinada) de 3 a 5 selecciones.

CANDIDATOS:
${predictionsText}

SALIDA JSON (Estricto):
{
  "title": "Título corto y atractivo",
  "strategy": "Explicación breve",
  "legs": [
    {
      "fixtureId": 12345, // USAR ID DEL FIXTURE PROVIDO
      "match": "Equipo1 vs Equipo2",
      "market": "Mercado",
      "prediction": "Selección",
      "status": "pending"
    }
  ],
  "totalOdds": 4.5, // Calcúlalo multiplicando odds estimados (usa 1.5 si no hay)
  "winProbability": 35
}

SOLO JSON.
`

    try {
        const result = await model.generateContent(prompt)
        const text = result.response.text()
        const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        let parsed = JSON.parse(cleanJson);

        // Post-procesamiento para asegurar estructura
        if (!parsed.legs) parsed.legs = [];
        // Asegurar fixtureId correcto (match por nombre o index si la IA falla)
        parsed.legs = parsed.legs.map((leg: any) => {
            // Intentar recuperar fixtureId si falta
            if (!leg.fixtureId) {
                const original = predictionsWithNames.find((p: any) => p.match_title === leg.match);
                if (original) leg.fixtureId = original.fixture_id;
            }
            return leg;
        });

        return parsed;

    } catch (error) {
        console.error('Error parsing parlay from AI:', error)
        // Fallback básico
        const top3 = predictionsWithNames.slice(0, 3);
        const odds = top3.reduce((acc: number, val: any) => acc * 1.5, 1);

        return {
            title: 'Parlay Automático (Fallback)',
            strategy: 'Selección por alta confianza',
            legs: top3.map((p: any) => ({
                fixtureId: p.fixture_id,
                match: p.match_title,
                market: p.market,
                prediction: p.selection,
                status: 'pending'
            })),
            totalOdds: Math.round(odds * 100) / 100,
            winProbability: 40
        }
    }
}
