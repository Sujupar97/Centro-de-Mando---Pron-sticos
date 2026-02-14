
// supabase/functions/v2-generate-parlays/index.ts
// OPPORTUNITIES ENGINE V7: HIGH PROBABILITY SINGLES WITH REAL ODDS
// Trigger: Manual (botón) o Automático
// Description: Retorna proyecciones individuales con probabilidad >= 80% y cuota real de API.
// FIX V7: Matching por nombre de equipos (daily_matches usa SportMonks IDs, reports usa API-Football IDs)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        const { date } = await req.json();
        if (!date) throw new Error('date is required (YYYY-MM-DD)');

        log(`[OPPORTUNITIES-V7] Fetching picks >=80% for date: ${date}`);

        // 1. Obtener Matches del día (daily_matches - SportMonks IDs)
        const { data: dailyMatches, error: matchesError } = await supabase
            .from('daily_matches')
            .select('api_fixture_id, home_team, away_team, league_name, match_time, home_team_logo, away_team_logo')
            .gte('match_time', `${date}T00:00:00`)
            .lt('match_time', `${date}T23:59:59`);

        if (matchesError) throw matchesError;

        if (!dailyMatches || dailyMatches.length === 0) {
            log(`[OPPORTUNITIES-V7] No matches found for date ${date}`);
            return new Response(JSON.stringify({ success: true, message: 'No hay partidos programados.', parlays: [], singles: [], stats: { matches: 0, reports: 0, picks_found: 0 } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        log(`[OPPORTUNITIES-V7] Found ${dailyMatches.length} daily matches`);

        // 2. Obtener Jobs de análisis completados hoy (usan API-Football IDs)
        const { data: jobs, error: jobsError } = await supabase
            .from('analysis_jobs_v2')
            .select('id, fixture_id, etl_context')
            .eq('status', 'done')
            .gte('created_at', `${date}T00:00:00`)
            .order('created_at', { ascending: false });

        if (jobsError) throw jobsError;

        if (!jobs || jobs.length === 0) {
            log(`[OPPORTUNITIES-V7] No completed analysis jobs for ${date}`);
            return new Response(JSON.stringify({
                success: true,
                message: 'No hay análisis completados para esta fecha. Ejecuta el análisis primero.',
                parlays: [], singles: [],
                stats: { matches: dailyMatches.length, reports: 0, picks_found: 0 },
                debug_logs: logs
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        log(`[OPPORTUNITIES-V7] Found ${jobs.length} completed jobs. Matching by team names...`);

        // 3. Deduplicar jobs (quedarse con el más reciente por fixture_id)
        const uniqueJobs = new Map<number, any>();
        for (const job of jobs) {
            if (!uniqueJobs.has(job.fixture_id)) {
                uniqueJobs.set(job.fixture_id, job);
            }
        }

        // 4. Fuzzy match: Jobs → daily_matches por nombre de equipos
        const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

        const matchedJobIds: string[] = [];
        const jobToDaily = new Map<string, any>(); // job_id → daily_match

        for (const [, job] of uniqueJobs) {
            const ctx = job.etl_context;
            const teams = ctx?.match?.teams;
            if (!teams) continue;

            const jobHome = normalize(teams.home?.name || '');
            const jobAway = normalize(teams.away?.name || '');
            if (!jobHome || !jobAway) continue;

            // Buscar match en daily_matches por nombre fuzzy
            const dailyMatch = dailyMatches.find((dm: any) => {
                const dmHome = normalize(dm.home_team || '');
                const dmAway = normalize(dm.away_team || '');
                return (dmHome.includes(jobHome) || jobHome.includes(dmHome)) &&
                       (dmAway.includes(jobAway) || jobAway.includes(dmAway));
            });

            if (dailyMatch) {
                matchedJobIds.push(job.id);
                jobToDaily.set(job.id, dailyMatch);
            }
        }

        log(`[OPPORTUNITIES-V7] Matched ${matchedJobIds.length}/${uniqueJobs.size} jobs to daily matches`);

        if (matchedJobIds.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No se pudieron vincular los análisis con los partidos del día.',
                parlays: [], singles: [],
                stats: { matches: dailyMatches.length, reports: 0, picks_found: 0 },
                debug_logs: logs
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 5. Obtener reportes para los jobs matcheados
        const { data: reports, error: reportsError } = await supabase
            .from('reports_v2')
            .select('job_id, fixture_id, report_packet')
            .in('job_id', matchedJobIds);

        if (reportsError) throw reportsError;

        if (!reports || reports.length === 0) {
            log(`[OPPORTUNITIES-V7] No reports found for matched jobs`);
            return new Response(JSON.stringify({
                success: true,
                message: 'Análisis encontrados pero sin reportes generados.',
                parlays: [], singles: [],
                stats: { matches: dailyMatches.length, reports: 0, picks_found: 0 },
                debug_logs: logs
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        log(`[OPPORTUNITIES-V7] Found ${reports.length} reports. Extracting picks >=80% with real odds...`);

        // 6. Extraer picks >= 80% con cuota real
        const highProbPicks: any[] = [];

        for (const report of reports) {
            const dailyMatch = jobToDaily.get(report.job_id);
            if (!dailyMatch) continue;

            const packet = typeof report.report_packet === 'string'
                ? JSON.parse(report.report_packet)
                : report.report_packet;

            const pronosticos = packet.pronosticos
                || packet.predicciones_finales?.detalle
                || [];
            if (!Array.isArray(pronosticos)) continue;

            pronosticos.forEach((p: any) => {
                const probRaw = p.probabilidad_calculada_porcentaje
                    || p.probabilidad_estimado_porcentaje
                    || p.probabilidad_derbix
                    || p.probabilidad
                    || p.probability
                    || p.confidence_score
                    || 0;
                let prob = typeof probRaw === 'string' ? parseFloat(probRaw) : probRaw;

                if (prob < 1 && prob > 0) prob = prob * 100; // Auto-detect decimal format

                // STRICT FILTER >= 80%
                if (prob >= 80) {
                    const rawOdds = p.cuota_actual || p.cuota || p.odds || p.odd || p.price || null;
                    const odds = rawOdds ? (typeof rawOdds === 'string' ? parseFloat(rawOdds) : rawOdds) : null;

                    // Skip picks sin cuota real de API
                    if (!odds || isNaN(odds) || odds <= 1.0) return;

                    highProbPicks.push({
                        id: `${report.job_id}_${p.mercado}_${p.seleccion}`,
                        job_id: report.job_id,
                        fixture_id: report.fixture_id,
                        market: p.mercado,
                        selection: p.seleccion,
                        p_model: prob / 100,
                        decision: "ALTA",
                        home_team: dailyMatch.home_team,
                        away_team: dailyMatch.away_team,
                        league: dailyMatch.league_name,
                        odds: odds,
                        logo_home: dailyMatch.home_team_logo,
                        logo_away: dailyMatch.away_team_logo,
                        tesis: packet?.razonamiento_central?.tesis_principal || packet?.analisis_profundo?.factor_psicologico || "Análisis estadístico estándar.",
                        tactica: packet?.analisis_profundo?.matchup_clave || "No especificado."
                    });
                }
            });
        }

        if (highProbPicks.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: "Se analizaron partidos pero no se encontraron picks >= 80% con cuota real.",
                parlays: [],
                singles: [],
                stats: { matches: dailyMatches.length, reports: reports.length, picks_found: 0 },
                debug_logs: logs
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Sort by Probability Descending
        highProbPicks.sort((a, b) => b.p_model - a.p_model);

        log(`[OPPORTUNITIES-V7] SUCCESS: ${highProbPicks.length} picks found`);

        return new Response(JSON.stringify({
            success: true,
            parlays: [],
            singles: highProbPicks,
            stats: {
                matches: dailyMatches.length,
                reports: reports.length,
                picks_found: highProbPicks.length
            },
            debug_logs: logs
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (e: any) {
        log(`Error: ${e.message}`);
        return new Response(JSON.stringify({
            success: false,
            error: e.message || "Unknown error",
            parlays: [],
            singles: [],
            debug_logs: [e.message, ...logs]
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
