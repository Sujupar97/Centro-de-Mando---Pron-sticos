// supabase/functions/daily-parlay-generator/index.ts
// Edge Function para generar parlays automáticos
// UNIFICADO: Usa EXACTAMENTE la misma lógica que manual-parlay-generator
// La única diferencia es que se ejecuta automáticamente (cron) en vez de manualmente

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
            console.log('[AutoParlayGen] ⏹️ Auto-parlay disabled by system_settings');
            return new Response(JSON.stringify({ success: true, message: 'Disabled' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 1. Determinar fecha objetivo (HOY - los partidos de hoy)
        const today = new Date().toISOString().split('T')[0]
        console.log(`[AutoParlayGen] Generando parlays para: ${today}`)

        // 2. Obtener Organization ID
        const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
        const orgId = orgs?.[0]?.id;

        if (!orgId) {
            console.error('[AutoParlayGen] ❌ No organization found');
            return new Response(JSON.stringify({ success: false, error: 'No organizations' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 3. MISMA LÓGICA QUE MANUAL: Buscar análisis por match_date
        // ✅ CRÍTICO: Filtramos por fecha del PARTIDO, no por fecha de creación
        const { data: runs, error } = await supabase
            .from('analysis_runs')
            .select('*, predictions(*)')
            .eq('match_date', today)  // ✅ FILTRO POR FECHA DEL PARTIDO

        if (error) throw error

        console.log(`[AutoParlayGen] Found ${runs?.length || 0} analysis runs for ${today}`)

        const matches = runs
            ?.filter(r => r.predictions && r.predictions.length > 0)
            .map(r => ({
                dashboardData: r.report_pre_jsonb,
                analysisRun: r
            })) || []

        if (matches.length < 2) {
            console.log(`[AutoParlayGen] Insuficientes análisis: ${matches.length}`)
            return new Response(
                JSON.stringify({ success: true, parlays: 0, reason: 'Not enough analyses' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`[AutoParlayGen] ${matches.length} matches with predictions`)

        // 4. MISMA LÓGICA QUE MANUAL: Construir prompt
        const matchesSummary = matches.map((m, idx) => {
            const d = m.dashboardData
            if (!d) return null

            const fixtureId = m.analysisRun?.fixture_id || "Unknown"
            const homeName = d.header_partido?.titulo?.split(' vs ')?.[0] || "Local"
            const awayName = d.header_partido?.titulo?.split(' vs ')?.[1] || "Visitante"

            const preds = d.predicciones_finales?.detalle?.map(p =>
                `   > ${p.mercado}: ${p.seleccion} (${p.probabilidad_estimado_porcentaje}%)`
            ).join('\n') || "   > Sin predicciones"

            return `=== PARTIDO #${idx + 1} (ID: ${fixtureId}) ===
EQUIPOS: ${homeName} vs ${awayName}
COMPETICIÓN: ${d.header_partido?.subtitulo || 'N/A'}
PREDICCIONES:
${preds}
`
        }).filter(Boolean).join('\n\n')

        // 5. MISMA LÓGICA QUE MANUAL: Llamar a Gemini
        const prompt = `
FECHA: ${today}
GENERA 2 PARLAYS PROFESIONALES basados en estos análisis.
PRIORIDAD: MERCADOS ALTERNATIVOS (Goles, Córners, Tarjetas)

DATOS:
${matchesSummary}

JSON REQUERIDO:
[
  {
    "parlayTitle": "Parlay 'Seguro'",
    "overallStrategy": "...",
    "finalOdds": 0.0,
    "winProbability": 75,
    "legs": [
      {
        "fixtureId": 12345,
        "game": "Equipo A vs B",
        "market": "Total Goles",
        "prediction": "Más de 2.5",
        "odds": 0,
        "reasoning": "..."
      }
    ]
  }
]
`

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.5
            }
        })

        const result = await model.generateContent(prompt)
        const text = result.response.text()
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim()
        let parlays = JSON.parse(clean)

        if (!Array.isArray(parlays)) {
            parlays = [parlays]
        }

        console.log(`[AutoParlayGen] Generated ${parlays.length} parlays`)

        // 6. Guardar parlays en DB (eliminar anteriores del mismo día)
        await supabase.from('parlays').delete().eq('date', today).eq('organization_id', orgId);

        for (const parlay of parlays) {
            const { error: saveError } = await supabase
                .from('parlays')
                .insert({
                    organization_id: orgId,
                    date: today,
                    title: parlay.parlayTitle || parlay.title,
                    total_odds: parlay.finalOdds || 0,
                    win_probability: parlay.winProbability || 0,
                    strategy: parlay.overallStrategy || parlay.strategy || '',
                    legs: parlay.legs,
                    status: 'pending'
                })

            if (saveError) {
                console.error('[AutoParlayGen] Save error:', saveError)
            }
        }

        console.log(`[AutoParlayGen] ✅ ${parlays.length} parlays guardados para ${today}`)

        return new Response(
            JSON.stringify({
                success: true,
                parlays: parlays.length,
                matchesAnalyzed: matches.length,
                date: today
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('[AutoParlayGen] Error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
