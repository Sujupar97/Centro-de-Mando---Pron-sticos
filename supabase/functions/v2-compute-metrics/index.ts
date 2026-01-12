// supabase/functions/v2-compute-metrics/index.ts
// MOTOR B: Features / Métricas Derivadas
// Propósito: Calcular métricas, promedios, dispersión, tendencias, y flags de calidad

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

const ENGINE_VERSION = '2.0.0';

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const startTime = Date.now();

    try {
        const { job_id, payload } = await req.json();
        if (!job_id || !payload) throw new Error('job_id and payload are required');

        console.log(`[V2-METRICS] Computing metrics for job: ${job_id}`);

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        // Update job status
        await supabase
            .from('analysis_jobs_v2')
            .update({ status: 'features', current_motor: 'B' })
            .eq('id', job_id);

        // ═══════════════════════════════════════════════════════════════
        // HELPER FUNCTIONS
        // ═══════════════════════════════════════════════════════════════
        const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const std = (arr: number[]) => {
            if (arr.length < 2) return 0;
            const m = avg(arr);
            return Math.sqrt(arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / arr.length);
        };

        const parseNumeric = (val: any): number => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const num = parseFloat(val.replace('%', ''));
                return isNaN(num) ? 0 : num;
            }
            return 0;
        };

        // ═══════════════════════════════════════════════════════════════
        // EXTRACT DATA FROM PAYLOAD
        // ═══════════════════════════════════════════════════════════════
        const { match, datasets } = payload;
        const homeId = match.teams.home.id;
        const awayId = match.teams.away.id;

        // Comparables with stats (enriched)
        const homeComparables = datasets.comparables?.home_as_home || [];
        const awayComparables = datasets.comparables?.away_as_away || [];

        // Last 40 (non-enriched)
        const homeLast40 = datasets.home_team_last40?.all || [];
        const awayLast40 = datasets.away_team_last40?.all || [];
        const homeAsHome = datasets.home_team_last40?.as_home || [];
        const awayAsAway = datasets.away_team_last40?.as_away || [];

        // ═══════════════════════════════════════════════════════════════
        // GOALS METRICS
        // ═══════════════════════════════════════════════════════════════
        const extractGoals = (matches: any[], teamId: number, isHome: boolean) => {
            return matches.map(m => {
                const scored = isHome ? m.score_home : m.score_away;
                const conceded = isHome ? m.score_away : m.score_home;
                return { scored, conceded, total: (scored || 0) + (conceded || 0) };
            });
        };

        const homeGoalsAsHome = extractGoals(homeAsHome, homeId, true);
        const awayGoalsAsAway = extractGoals(awayAsAway, awayId, false);

        const goalsMetrics = {
            home: {
                as_home: {
                    scored_avg: avg(homeGoalsAsHome.map(g => g.scored || 0)),
                    scored_std: std(homeGoalsAsHome.map(g => g.scored || 0)),
                    conceded_avg: avg(homeGoalsAsHome.map(g => g.conceded || 0)),
                    conceded_std: std(homeGoalsAsHome.map(g => g.conceded || 0)),
                    total_avg: avg(homeGoalsAsHome.map(g => g.total)),
                    last5_scored_avg: avg(homeGoalsAsHome.slice(0, 5).map(g => g.scored || 0)),
                    last5_total_avg: avg(homeGoalsAsHome.slice(0, 5).map(g => g.total)),
                    sample_size: homeGoalsAsHome.length
                }
            },
            away: {
                as_away: {
                    scored_avg: avg(awayGoalsAsAway.map(g => g.scored || 0)),
                    scored_std: std(awayGoalsAsAway.map(g => g.scored || 0)),
                    conceded_avg: avg(awayGoalsAsAway.map(g => g.conceded || 0)),
                    conceded_std: std(awayGoalsAsAway.map(g => g.conceded || 0)),
                    total_avg: avg(awayGoalsAsAway.map(g => g.total)),
                    last5_scored_avg: avg(awayGoalsAsAway.slice(0, 5).map(g => g.scored || 0)),
                    last5_total_avg: avg(awayGoalsAsAway.slice(0, 5).map(g => g.total)),
                    sample_size: awayGoalsAsAway.length
                }
            },
            combined: {
                expected_total: 0, // Will be calculated
                over_2_5_rate: 0
            }
        };

        // Combined expected goals
        goalsMetrics.combined.expected_total =
            goalsMetrics.home.as_home.scored_avg + goalsMetrics.away.as_away.scored_avg;

        // Over 2.5 historical rate
        const allHomeGames = homeGoalsAsHome.filter(g => g.total > 2.5).length / Math.max(homeGoalsAsHome.length, 1);
        const allAwayGames = awayGoalsAsAway.filter(g => g.total > 2.5).length / Math.max(awayGoalsAsAway.length, 1);
        goalsMetrics.combined.over_2_5_rate = (allHomeGames + allAwayGames) / 2;

        // ═══════════════════════════════════════════════════════════════
        // CORNERS METRICS (from enriched comparables)
        // ═══════════════════════════════════════════════════════════════
        const extractCorners = (comparables: any[], isHome: boolean) => {
            return comparables
                .filter(m => m.stats)
                .map(m => {
                    const teamStats = isHome ? m.stats.home : m.stats.away;
                    return parseNumeric(teamStats?.['Corner Kicks'] || 0);
                });
        };

        const homeCorners = extractCorners(homeComparables, true);
        const awayCorners = extractCorners(awayComparables, false);

        const cornersMetrics = {
            home: {
                avg: avg(homeCorners),
                std: std(homeCorners),
                sample_size: homeCorners.length
            },
            away: {
                avg: avg(awayCorners),
                std: std(awayCorners),
                sample_size: awayCorners.length
            },
            combined: {
                expected_total: avg(homeCorners) + avg(awayCorners)
            }
        };

        // ═══════════════════════════════════════════════════════════════
        // CARDS METRICS (from enriched comparables + referee)
        // ═══════════════════════════════════════════════════════════════
        const extractCards = (comparables: any[], isHome: boolean) => {
            return comparables
                .filter(m => m.stats)
                .map(m => {
                    const teamStats = isHome ? m.stats.home : m.stats.away;
                    const yellow = parseNumeric(teamStats?.['Yellow Cards'] || 0);
                    const red = parseNumeric(teamStats?.['Red Cards'] || 0);
                    return { yellow, red, total: yellow + red };
                });
        };

        const homeCards = extractCards(homeComparables, true);
        const awayCards = extractCards(awayComparables, false);

        // Referee factor calculation would need actual referee stats processing
        // For now, use a default
        const refereeCardAvg = datasets.referee?.recent_matches?.length > 0 ? 4.0 : 3.5;

        const cardsMetrics = {
            home: {
                yellow_avg: avg(homeCards.map(c => c.yellow)),
                total_avg: avg(homeCards.map(c => c.total)),
                sample_size: homeCards.length
            },
            away: {
                yellow_avg: avg(awayCards.map(c => c.yellow)),
                total_avg: avg(awayCards.map(c => c.total)),
                sample_size: awayCards.length
            },
            referee_factor: refereeCardAvg / 3.5, // Normalized (1.0 = neutral)
            combined: {
                expected_total: (avg(homeCards.map(c => c.total)) + avg(awayCards.map(c => c.total))) * (refereeCardAvg / 3.5)
            }
        };

        // ═══════════════════════════════════════════════════════════════
        // BTTS & CLEAN SHEET RATES
        // ═══════════════════════════════════════════════════════════════
        const bttsRate = {
            home: homeGoalsAsHome.filter(g => g.scored > 0 && g.conceded > 0).length / Math.max(homeGoalsAsHome.length, 1),
            away: awayGoalsAsAway.filter(g => g.scored > 0 && g.conceded > 0).length / Math.max(awayGoalsAsAway.length, 1)
        };

        const cleanSheetRate = {
            home: homeGoalsAsHome.filter(g => g.conceded === 0).length / Math.max(homeGoalsAsHome.length, 1),
            away: awayGoalsAsAway.filter(g => g.conceded === 0).length / Math.max(awayGoalsAsAway.length, 1)
        };

        const scoredRate = {
            home: homeGoalsAsHome.filter(g => g.scored > 0).length / Math.max(homeGoalsAsHome.length, 1),
            away: awayGoalsAsAway.filter(g => g.scored > 0).length / Math.max(awayGoalsAsAway.length, 1)
        };

        // ═══════════════════════════════════════════════════════════════
        // FORM & TRENDS
        // ═══════════════════════════════════════════════════════════════
        const parseForm = (form: string) => {
            if (!form) return { wins: 0, draws: 0, losses: 0, points: 0 };
            const chars = form.toUpperCase().split('').slice(-5);
            return {
                wins: chars.filter(c => c === 'W').length,
                draws: chars.filter(c => c === 'D').length,
                losses: chars.filter(c => c === 'L').length,
                points: chars.reduce((acc, c) => acc + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0)
            };
        };

        const formMetrics = {
            home: {
                ...parseForm(datasets.standings?.home_context?.form || ''),
                position: datasets.standings?.home_context?.position || null,
                goal_diff: datasets.standings?.home_context?.gd || null
            },
            away: {
                ...parseForm(datasets.standings?.away_context?.form || ''),
                position: datasets.standings?.away_context?.position || null,
                goal_diff: datasets.standings?.away_context?.gd || null
            }
        };

        // ═══════════════════════════════════════════════════════════════
        // QUALITY FLAGS
        // ═══════════════════════════════════════════════════════════════
        const qualityFlags = {
            high_variance_goals: goalsMetrics.home.as_home.scored_std > 1.5 || goalsMetrics.away.as_away.scored_std > 1.5,
            low_coverage_corners: cornersMetrics.home.sample_size < 5 || cornersMetrics.away.sample_size < 5,
            low_coverage_cards: cardsMetrics.home.sample_size < 5 || cardsMetrics.away.sample_size < 5,
            missing_lineup: !datasets.lineups?.home && !datasets.lineups?.away,
            referee_unknown: !datasets.referee?.name,
            small_sample: homeGoalsAsHome.length < 5 || awayGoalsAsAway.length < 5,
            odds_missing: !datasets.odds?.markets?.length
        };

        // ═══════════════════════════════════════════════════════════════
        // ASSEMBLE FINAL METRICS
        // ═══════════════════════════════════════════════════════════════
        const derivedMetrics = {
            goals: goalsMetrics,
            corners: cornersMetrics,
            cards: cardsMetrics,
            btts: {
                home_scores_rate: scoredRate.home,
                away_scores_rate: scoredRate.away,
                btts_rate_home_games: bttsRate.home,
                btts_rate_away_games: bttsRate.away,
                combined_btts_probability: scoredRate.home * (1 - cleanSheetRate.away) * 0.5 +
                    scoredRate.away * (1 - cleanSheetRate.home) * 0.5
            },
            clean_sheet: cleanSheetRate,
            form: formMetrics,
            injuries: {
                home_count: datasets.injuries?.home?.length || 0,
                away_count: datasets.injuries?.away?.length || 0
            }
        };

        // ═══════════════════════════════════════════════════════════════
        // SAVE TO DATABASE
        // ═══════════════════════════════════════════════════════════════
        const { error: saveError } = await supabase
            .from('derived_metrics_v2')
            .insert({
                job_id,
                fixture_id: match.fixture_id,
                metrics: derivedMetrics,
                quality_flags: qualityFlags,
                input_summary: {
                    home_comparables_count: homeComparables.length,
                    away_comparables_count: awayComparables.length,
                    home_last40_count: homeLast40.length,
                    away_last40_count: awayLast40.length
                },
                engine_version: ENGINE_VERSION
            });

        if (saveError) throw saveError;

        // Update job status
        await supabase
            .from('analysis_jobs_v2')
            .update({ status: 'models', current_motor: 'B' })
            .eq('id', job_id);

        const executionTime = Date.now() - startTime;
        console.log(`[V2-METRICS] ✅ Completed in ${executionTime}ms`);

        return new Response(JSON.stringify({
            success: true,
            job_id,
            fixture_id: match.fixture_id,
            metrics: derivedMetrics,
            quality_flags: qualityFlags,
            execution_time_ms: executionTime
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[V2-METRICS] Error:', e);
        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
