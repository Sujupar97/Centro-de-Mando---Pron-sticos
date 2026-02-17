
// supabase/functions/v2-generate-parlays/index.ts
// OPPORTUNITIES ENGINE V8.1: DIRECT DATA ACCESS (no job status dependency)
// Bypasses analysis_jobs_v2 status entirely - queries reports_v2 + value_picks_v2 directly
// This fixes the issue where the analyzer fails to update job status to 'done'

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

        log(`[OPP-V8.1] Fetching picks >=80% for date: ${date}`);

        // ═══════════════════════════════════════════════════════════════
        // STEP 1: Get daily matches for the date (use match_date for reliability)
        // ═══════════════════════════════════════════════════════════════
        const { data: dailyMatches, error: matchesError } = await supabase
            .from('daily_matches')
            .select('api_fixture_id, home_team, away_team, league_name, match_time, home_team_logo, away_team_logo')
            .eq('match_date', date);

        if (matchesError) throw matchesError;

        if (!dailyMatches || dailyMatches.length === 0) {
            log(`[OPP-V8.1] No matches found for date ${date}`);
            return jsonResponse({ success: true, message: 'No hay partidos programados.', parlays: [], singles: [], stats: { matches: 0 }, debug_logs: logs });
        }

        const fixtureIds = dailyMatches.map((m: any) => m.api_fixture_id);
        const dailyByFixture = new Map<number, any>();
        dailyMatches.forEach((m: any) => dailyByFixture.set(m.api_fixture_id, m));

        log(`[OPP-V8.1] ${dailyMatches.length} daily matches, fixture_ids: [${fixtureIds.slice(0, 5).join(',')}${fixtureIds.length > 5 ? '...' : ''}]`);

        // ═══════════════════════════════════════════════════════════════
        // STEP 2: DIRECT DATA ACCESS - Skip jobs table entirely
        // Query reports_v2 and value_picks_v2 directly by fixture_id
        // This is immune to job status issues (analyzing/done/failed)
        // ═══════════════════════════════════════════════════════════════

        // 2A: Get reports directly by fixture_id (ordered by newest first)
        let reports: any[] | null = null;
        const { data: reportsDirect, error: reportsError } = await supabase
            .from('reports_v2')
            .select('job_id, fixture_id, report_packet, created_at')
            .in('fixture_id', fixtureIds)
            .order('created_at', { ascending: false });

        if (reportsError) log(`[OPP-V8.1] reports_v2 error: ${reportsError.message}`);

        // Deduplicate: keep only the LATEST report per fixture_id
        if (reportsDirect && reportsDirect.length > 0) {
            const seenFixtures = new Set<number>();
            reports = reportsDirect.filter((r: any) => {
                if (seenFixtures.has(r.fixture_id)) return false;
                seenFixtures.add(r.fixture_id);
                return true;
            });
            if (reports.length < reportsDirect.length) {
                log(`[OPP-V8.1] Deduplicated: ${reportsDirect.length} -> ${reports.length} reports (removed stale duplicates)`);
            }
        } else {
            reports = reportsDirect;
        }

        // 2B: Get value_picks directly by fixture_id
        const { data: valuePicks, error: vpError } = await supabase
            .from('value_picks_v2')
            .select('job_id, fixture_id, market, selection, p_model, odds, decision, confidence')
            .in('fixture_id', fixtureIds)
            .gte('p_model', 0.50);

        if (vpError) log(`[OPP-V8.1] value_picks_v2 error: ${vpError.message}`);

        // 2C: Check for jobs (status info + fallback source)
        const { data: jobs } = await supabase
            .from('analysis_jobs_v2')
            .select('id, fixture_id, status')
            .in('fixture_id', fixtureIds)
            .order('created_at', { ascending: false });

        // 2D: FALLBACK - If no reports found by fixture_id, try via job_id
        // This covers historical reports saved with the original (unresolved) fixture_id
        if ((!reports || reports.length === 0) && jobs && jobs.length > 0) {
            // Only use the LATEST job per fixture to avoid stale data
            const latestJobPerFixture = new Map<number, string>();
            jobs.forEach((j: any) => {
                if (!latestJobPerFixture.has(j.fixture_id)) latestJobPerFixture.set(j.fixture_id, j.id);
            });
            const jobIds = Array.from(latestJobPerFixture.values());
            log(`[OPP-V8.1] No reports by fixture_id. Trying fallback via ${jobIds.length} latest job_ids...`);
            const { data: reportsByJob } = await supabase
                .from('reports_v2')
                .select('job_id, fixture_id, report_packet, created_at')
                .in('job_id', jobIds)
                .order('created_at', { ascending: false });
            if (reportsByJob && reportsByJob.length > 0) {
                reports = reportsByJob;
                log(`[OPP-V8.1] Fallback SUCCESS: found ${reports.length} reports via job_id`);
            }
        }

        const jobsByFixture = new Map<number, any>();
        (jobs || []).forEach((j: any) => {
            if (!jobsByFixture.has(j.fixture_id)) jobsByFixture.set(j.fixture_id, j);
        });

        const doneCount = (jobs || []).filter((j: any) => j.status === 'done').length;
        const analyzingCount = (jobs || []).filter((j: any) => j.status === 'analyzing' || j.status === 'interpret').length;

        log(`[OPP-V8.1] Query results: ${reports?.length || 0} reports, ${valuePicks?.length || 0} value_picks, jobs: ${doneCount} done + ${analyzingCount} analyzing`);

        // ═══════════════════════════════════════════════════════════════
        // STEP 3: Extract picks >= 80% from ALL sources
        // ═══════════════════════════════════════════════════════════════
        const highProbPicks: any[] = [];
        const seenPickKeys = new Set<string>();

        // Build job_id -> fixture_id mapping for fallback resolution
        const jobToFixture = new Map<string, number>();
        (jobs || []).forEach((j: any) => jobToFixture.set(j.id, j.fixture_id));

        // SOURCE A: Extract from report_packet.pronosticos
        if (reports && reports.length > 0) {
            for (const report of reports) {
                // Try direct lookup, then fallback via job's fixture_id
                let dailyMatch = dailyByFixture.get(report.fixture_id);
                let resolvedFixtureId = report.fixture_id;
                if (!dailyMatch && report.job_id) {
                    const jobFixtureId = jobToFixture.get(report.job_id);
                    if (jobFixtureId) {
                        dailyMatch = dailyByFixture.get(jobFixtureId);
                        if (dailyMatch) resolvedFixtureId = jobFixtureId;
                    }
                }
                if (!dailyMatch) {
                    log(`[OPP-V8.1] Report fixture_id ${report.fixture_id} not found in daily_matches`);
                    continue;
                }

                let packet: any;
                try {
                    packet = typeof report.report_packet === 'string'
                        ? JSON.parse(report.report_packet)
                        : report.report_packet;
                } catch (parseErr) {
                    log(`[OPP-V8.1] Failed to parse report_packet for fixture ${report.fixture_id}`);
                    continue;
                }

                if (!packet) continue;

                // Try multiple paths for pronosticos
                const pronosticos = packet.pronosticos
                    || packet.predicciones_finales?.detalle
                    || [];

                if (!Array.isArray(pronosticos)) {
                    log(`[OPP-V8.1] pronosticos not array for fixture ${report.fixture_id}, type: ${typeof pronosticos}`);
                    continue;
                }

                log(`[OPP-V8.1] Fixture ${resolvedFixtureId} (${dailyMatch.home_team} vs ${dailyMatch.away_team}): ${pronosticos.length} pronosticos found`);

                pronosticos.forEach((p: any, idx: number) => {
                    // Extract probability from any possible field name
                    const probRaw = p.probabilidad_calculada_porcentaje
                        || p.probabilidad_estimado_porcentaje
                        || p.probabilidad_derbix
                        || p.probabilidad
                        || p.probability
                        || p.confidence_score
                        || p.confianza
                        || 0;
                    let prob = typeof probRaw === 'string' ? parseFloat(probRaw.replace('%', '').replace('+', '')) : probRaw;

                    // Auto-detect decimal format (0.85 → 85)
                    if (prob > 0 && prob < 1) prob = prob * 100;

                    // Extract odds from any possible field name
                    const rawOdds = p.cuota_actual || p.cuota || p.odds || p.odd || p.price || null;
                    const odds = rawOdds ? (typeof rawOdds === 'string' ? parseFloat(rawOdds) : rawOdds) : null;
                    const validOdds = odds && !isNaN(odds) && odds > 1.0 ? odds : null;

                    // Log every pick for debugging
                    if (idx < 5) {
                        log(`[OPP-V8.1]   Pick[${idx}]: ${p.mercado} | ${p.seleccion} | prob=${prob.toFixed(1)}% | odds=${validOdds || 'null'}`);
                    }

                    // FILTER >= 80%
                    if (prob >= 80) {
                        const pickKey = `${resolvedFixtureId}_${p.mercado}_${p.seleccion}`;
                        if (seenPickKeys.has(pickKey)) return;
                        seenPickKeys.add(pickKey);

                        highProbPicks.push({
                            id: `${report.job_id}_${p.mercado}_${p.seleccion}`,
                            job_id: report.job_id,
                            fixture_id: resolvedFixtureId,
                            market: p.mercado || 'Mercado',
                            selection: p.seleccion || 'Seleccion',
                            p_model: prob / 100,
                            decision: "ALTA",
                            home_team: dailyMatch.home_team,
                            away_team: dailyMatch.away_team,
                            league: dailyMatch.league_name,
                            odds: validOdds,
                            logo_home: dailyMatch.home_team_logo,
                            logo_away: dailyMatch.away_team_logo,
                            tesis: packet?.analisis_profundo?.razonamiento_central || packet?.analisis_profundo?.factor_psicologico || "Análisis IA V8.",
                            tactica: packet?.analisis_profundo?.matchup_tactico || "Ver reporte completo.",
                            stake: p.stake_recomendado || null
                        });
                    }
                });
            }
        }

        // SOURCE B: Complement with value_picks_v2
        if (valuePicks && valuePicks.length > 0) {
            log(`[OPP-V8.1] Checking ${valuePicks.length} value_picks_v2 entries...`);
            for (const vp of valuePicks) {
                let prob = vp.p_model;
                // Normalize: if stored as decimal (0.85), convert to percentage (85)
                if (prob > 0 && prob < 1) prob = prob * 100;
                // If stored as percentage already (85), keep as is
                if (prob < 80) continue;

                const pickKey = `${vp.fixture_id}_${vp.market}_${vp.selection}`;
                if (seenPickKeys.has(pickKey)) continue;
                seenPickKeys.add(pickKey);

                const dailyMatch = dailyByFixture.get(vp.fixture_id);
                if (!dailyMatch) continue;

                const validOdds = vp.odds && vp.odds > 1.0 ? vp.odds : null;

                highProbPicks.push({
                    id: `vp_${vp.job_id}_${vp.market}_${vp.selection}`,
                    job_id: vp.job_id,
                    fixture_id: vp.fixture_id,
                    market: vp.market,
                    selection: vp.selection,
                    p_model: prob >= 1 ? prob / 100 : prob,
                    decision: vp.decision || "ALTA",
                    home_team: dailyMatch.home_team,
                    away_team: dailyMatch.away_team,
                    league: dailyMatch.league_name,
                    odds: validOdds,
                    logo_home: dailyMatch.home_team_logo,
                    logo_away: dailyMatch.away_team_logo,
                    tesis: "Análisis IA V8.",
                    tactica: "Ver reporte completo."
                });
            }
        }

        // SOURCE C: Fallback - Extract from 'analisis' table (dashboardData.predicciones_finales)
        // This covers cases where reports_v2 was cleaned up but analisis still has the data
        if (highProbPicks.length === 0 || (reports?.length || 0) < dailyMatches.length / 2) {
            const { data: analisisRows } = await supabase
                .from('analisis')
                .select('partido_id, resultado_analisis')
                .in('partido_id', fixtureIds);

            if (analisisRows && analisisRows.length > 0) {
                log(`[OPP-V8.1] SOURCE C: Checking ${analisisRows.length} analisis entries...`);
                for (const row of analisisRows) {
                    const dailyMatch = dailyByFixture.get(row.partido_id);
                    if (!dailyMatch) continue;

                    const result = row.resultado_analisis;
                    if (!result) continue;

                    // Extract pronosticos from dashboardData
                    const dashboard = result.dashboardData || result;
                    const preds = dashboard?.predicciones_finales?.detalle
                        || dashboard?.pronosticos
                        || [];

                    if (!Array.isArray(preds)) continue;

                    for (const p of preds) {
                        const probRaw = p.probabilidad_estimado_porcentaje
                            || p.probabilidad_calculada_porcentaje
                            || p.probabilidad_derbix
                            || p.probabilidad
                            || 0;
                        let prob = typeof probRaw === 'string' ? parseFloat(probRaw.replace('%', '')) : probRaw;
                        if (prob > 0 && prob < 1) prob = prob * 100;
                        if (prob < 80) continue;

                        const pickKey = `${row.partido_id}_${p.mercado}_${p.seleccion}`;
                        if (seenPickKeys.has(pickKey)) continue;
                        seenPickKeys.add(pickKey);

                        highProbPicks.push({
                            id: `analisis_${row.partido_id}_${p.mercado}_${p.seleccion}`,
                            job_id: null,
                            fixture_id: row.partido_id,
                            market: p.mercado || 'Mercado',
                            selection: p.seleccion || 'Seleccion',
                            p_model: prob / 100,
                            decision: "ALTA",
                            home_team: dailyMatch.home_team,
                            away_team: dailyMatch.away_team,
                            league: dailyMatch.league_name,
                            odds: p.odds || null,
                            logo_home: dailyMatch.home_team_logo,
                            logo_away: dailyMatch.away_team_logo,
                            tesis: "Análisis IA V8.",
                            tactica: "Ver reporte completo."
                        });
                    }
                }
                log(`[OPP-V8.1] SOURCE C: Total picks after analisis fallback: ${highProbPicks.length}`);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 4: Return results
        // ═══════════════════════════════════════════════════════════════
        if (highProbPicks.length === 0) {
            const hasAnalysis = (reports?.length || 0) > 0 || (valuePicks?.length || 0) > 0;
            const hasOnlyInProgress = !hasAnalysis && analyzingCount > 0;

            let message = '';
            if (hasOnlyInProgress) {
                message = `Hay ${analyzingCount} análisis en progreso. Espera unos segundos y vuelve a intentar.`;
            } else if (hasAnalysis) {
                // We found reports but no picks >= 80%
                const allProbs = (valuePicks || []).map((vp: any) => {
                    const p = vp.p_model > 0 && vp.p_model < 1 ? vp.p_model * 100 : vp.p_model;
                    return p;
                }).sort((a: number, b: number) => b - a);
                const maxProb = allProbs.length > 0 ? allProbs[0].toFixed(1) : '?';
                message = `Se analizaron ${reports?.length || 0} partidos. Máxima probabilidad encontrada: ${maxProb}%. No hay picks >= 80%.`;
            } else {
                message = 'No hay análisis completados para esta fecha. Ejecuta el análisis primero.';
            }

            return jsonResponse({
                success: true,
                message,
                parlays: [],
                singles: [],
                stats: {
                    matches: dailyMatches.length,
                    reports: reports?.length || 0,
                    value_picks: valuePicks?.length || 0,
                    picks_found: 0,
                    jobs_done: doneCount,
                    jobs_analyzing: analyzingCount,
                    in_progress: hasOnlyInProgress ? analyzingCount : 0
                },
                debug_logs: logs
            });
        }

        // Sort by Probability Descending
        highProbPicks.sort((a, b) => b.p_model - a.p_model);

        log(`[OPP-V8.1] SUCCESS: ${highProbPicks.length} picks found (${highProbPicks.filter((p: any) => p.odds).length} with odds)`);

        // Register in profitability tracking (non-blocking)
        try {
            const picksWithOdds = highProbPicks.filter((p: any) => p.odds);
            if (picksWithOdds.length > 0) {
                const profitRes = await fetch(`${sbUrl}/functions/v1/v2-track-profitability`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sbKey}` },
                    body: JSON.stringify({ action: 'register', date, picks: picksWithOdds })
                });
                const profitData = await profitRes.json();
                if (profitData.success) log(`[OPP-V8.1] Registered ${profitData.picks_registered} picks in profitability`);
            }
        } catch (profitErr: any) {
            log(`[OPP-V8.1] Profitability tracking failed (non-blocking): ${profitErr.message}`);
        }

        return jsonResponse({
            success: true,
            parlays: [],
            singles: highProbPicks,
            stats: {
                matches: dailyMatches.length,
                reports: reports?.length || 0,
                value_picks: valuePicks?.length || 0,
                picks_found: highProbPicks.length,
                picks_with_odds: highProbPicks.filter((p: any) => p.odds).length,
                jobs_done: doneCount,
                jobs_analyzing: analyzingCount,
                in_progress: analyzingCount
            },
            debug_logs: logs
        });

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

function jsonResponse(body: any) {
    return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
