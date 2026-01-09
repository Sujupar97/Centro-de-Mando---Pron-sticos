import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(sbUrl, sbKey)

        // Obtener fecha objetivo del request (default: ayer)
        let targetDate: string;
        try {
            const body = await req.json();
            targetDate = body.date || new Date(Date.now() - 86400000).toISOString().split('T')[0];
        } catch {
            targetDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        }

        console.log(`[REPAIR] Starting repair for date: ${targetDate}`)

        // 1. Obtener analysis_runs con predictions en JSON pero sin entries en predictions table
        // Buscar runs del rango de fecha
        const { data: runs, error: runsError } = await supabase
            .from('analysis_runs')
            .select('id, job_id, report_pre_jsonb, match_date, created_at')
            .gte('created_at', `${targetDate}T00:00:00`)
            .lt('created_at', `${new Date(new Date(targetDate).getTime() + 86400000).toISOString().split('T')[0]}T00:00:00`)

        if (runsError) throw runsError

        console.log(`[REPAIR] Found ${runs?.length || 0} analysis_runs for ${targetDate}`)

        let totalInserted = 0
        let totalSkipped = 0
        let errors: string[] = []

        for (const run of runs || []) {
            const jsonData = run.report_pre_jsonb
            if (!jsonData) {
                console.log(`[REPAIR] Run ${run.id} has no JSON data, skipping`)
                totalSkipped++
                continue
            }

            const preds = jsonData.predicciones_finales?.detalle || []
            if (preds.length === 0) {
                console.log(`[REPAIR] Run ${run.id} has no predictions in JSON, skipping`)
                totalSkipped++
                continue
            }

            // Verificar si ya existen predictions para este run
            const { count: existingCount } = await supabase
                .from('predictions')
                .select('*', { count: 'exact', head: true })
                .eq('analysis_run_id', run.id)

            if (existingCount && existingCount > 0) {
                console.log(`[REPAIR] Run ${run.id} already has ${existingCount} predictions, skipping`)
                totalSkipped++
                continue
            }

            // Obtener api_fixture_id del job
            const { data: jobData } = await supabase
                .from('analysis_jobs')
                .select('api_fixture_id')
                .eq('id', run.job_id)
                .single()

            const apiFixtureId = jobData?.api_fixture_id || 0

            // Extraer nombres de equipos del header
            const teams = jsonData.header_partido?.titulo?.split(' vs ') || []
            const homeTeam = teams[0] || 'Local'
            const awayTeam = teams[1] || 'Visitante'

            // Preparar predictions - SOLO columnas que EXISTEN en el schema
            // Schema real: analysis_run_id, fixture_id, market, selection, probability, confidence, reasoning, model_version
            const predictionsToInsert = preds.map((p: any) => ({
                analysis_run_id: run.id,
                fixture_id: apiFixtureId,
                market: p.mercado || 'Mercado',
                selection: p.seleccion || 'Selección',
                probability: p.probabilidad_estimado_porcentaje || 50,
                confidence: (p.probabilidad_estimado_porcentaje || 50) >= 70 ? 'Alta' :
                    (p.probabilidad_estimado_porcentaje || 50) >= 50 ? 'Media' : 'Baja',
                reasoning: p.justificacion_detallada?.conclusion || '',
                model_version: 'v1-stable'
            }))

            // Insertar
            const { error: insertError } = await supabase
                .from('predictions')
                .insert(predictionsToInsert)

            if (insertError) {
                console.error(`[REPAIR] Error inserting for run ${run.id}:`, insertError)
                errors.push(`Run ${run.id}: ${insertError.message}`)
            } else {
                console.log(`[REPAIR] Inserted ${predictionsToInsert.length} predictions for run ${run.id} (fixture ${apiFixtureId})`)
                totalInserted += predictionsToInsert.length
            }
        }

        // 2. Reparar daily_matches si faltan
        const { data: jobsToSync } = await supabase
            .from('analysis_jobs')
            .select('api_fixture_id')
            .eq('status', 'done')
            .gte('created_at', `${targetDate}T00:00:00`)
            .lt('created_at', `${new Date(new Date(targetDate).getTime() + 86400000).toISOString().split('T')[0]}T00:00:00`)

        console.log(`[REPAIR] Found ${jobsToSync?.length || 0} done jobs to check for daily_matches sync`)

        return new Response(JSON.stringify({
            success: true,
            date: targetDate,
            runsProcessed: runs?.length || 0,
            predictionsInserted: totalInserted,
            skipped: totalSkipped,
            errors: errors.length > 0 ? errors : undefined
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (e: any) {
        console.error('[REPAIR] Error:', e)
        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
