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

        // Obtener fecha objetivo
        let targetDate: string;
        try {
            const body = await req.json();
            targetDate = body.date || new Date(Date.now() - 86400000).toISOString().split('T')[0];
        } catch {
            targetDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        }

        console.log(`[SYNC] Syncing daily_matches for date: ${targetDate}`)

        // 1. Obtener jobs 'done' que tienen runs con match_date = targetDate
        const { data: runsWithJobs, error: runsError } = await supabase
            .from('analysis_runs')
            .select('job_id, match_date, report_pre_jsonb')
            .eq('match_date', targetDate)

        if (runsError) throw runsError

        console.log(`[SYNC] Found ${runsWithJobs?.length || 0} runs for match_date ${targetDate}`)

        let synced = 0
        let failed = 0

        for (const run of runsWithJobs || []) {
            // Obtener datos del job
            const { data: job } = await supabase
                .from('analysis_jobs')
                .select('api_fixture_id')
                .eq('id', run.job_id)
                .single()

            if (!job) continue

            // Extraer datos del reporte JSON
            const report = run.report_pre_jsonb
            if (!report?.header_partido) continue

            const teams = report.header_partido.titulo?.split(' vs ') || []
            const homeTeam = teams[0] || 'Local'
            const awayTeam = teams[1] || 'Visitante'

            // Extraer fecha/hora del partido del JSON si existe
            const matchTime = report.header_partido.fecha || `${targetDate}T12:00:00`

            const payload = {
                api_fixture_id: job.api_fixture_id,
                league_id: report.header_partido.league_id || 0,
                league_name: report.header_partido.subtitulo?.split(' - ')[0] || 'Liga',
                home_team: homeTeam,
                home_team_logo: '',
                away_team: awayTeam,
                away_team_logo: '',
                match_time: matchTime,
                match_status: 'NS',
                home_score: null,
                away_score: null,
                match_date: targetDate,
                scan_date: new Date().toISOString().split('T')[0]
            }

            const { error: upsertError } = await supabase
                .from('daily_matches')
                .upsert(payload, { onConflict: 'api_fixture_id' })

            if (upsertError) {
                console.error(`[SYNC] Failed for fixture ${job.api_fixture_id}:`, upsertError)
                failed++
            } else {
                synced++
            }
        }

        console.log(`[SYNC] Complete: ${synced} synced, ${failed} failed`)

        return new Response(JSON.stringify({
            success: true,
            date: targetDate,
            runsFound: runsWithJobs?.length || 0,
            synced,
            failed
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (e: any) {
        console.error('[SYNC] Error:', e)
        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
