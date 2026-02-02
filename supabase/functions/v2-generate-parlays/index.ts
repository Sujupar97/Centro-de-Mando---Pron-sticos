// supabase/functions/v2-generate-parlays/index.ts
// SMART PARLAYS ENGINE: Genera combinaciones de picks de diferentes partidos
// Trigger: Manual (botón) o Automático (post-batch de análisis)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

const ENGINE_VERSION = '2.5.0-STRICT-PAIRS';

// Configuración de parlays - V2.5 STRICT 2-LEG (80%+ ONLY)
// USER REQUEST: Solo parlays de EXACTAMENTE 2 picks, con probabilidad >= 80%
// Cada pick solo puede aparecer en UN parlay (sin repeticiones)
const CONFIG = {
    SECTION_LIMIT: 20,
    MIN_PICKS: 2,
    MAX_PICKS: 2,               // STRICT: Exactamente 2 picks por parlay
    MIN_INDIVIDUAL_PROB: 0.80,  // STRICT: Solo picks con 80%+ probabilidad
    TARGET_TOTAL_ODDS: 1.60,    // Objetivo de cuota para 2 picks de alta prob
    MIN_TOTAL_PROB: 0.60,       // Prob combinada mínima (80% * 80% = 64%)
    MAX_ATTEMPTS: 500
};

interface PickData {
    fixture_id: number;
    job_id: string;
    market: string;
    selection: string;
    p_model: number;
    home_team: string;
    away_team: string;
    league: string;
    odds_implied: number;
    type: 'VALUE' | 'ANCHOR';
}

interface ParlayCombo {
    picks: PickData[];
    combined_probability: number;
    implied_odds: number;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    const startTime = Date.now();

    try {
        const logs: string[] = [];
        const log = (msg: string) => { console.log(msg); logs.push(msg); };

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        const { date, force_regenerate } = await req.json();
        if (!date) throw new Error('date is required (YYYY-MM-DD)');

        log(`[SMART-PARLAYS] Request for date: ${date} (Force: ${force_regenerate})`);

        // ═══════════════════════════════════════════════════════════════
        // PASO 0: CACHE CHECK
        // ═══════════════════════════════════════════════════════════════
        if (!force_regenerate) {
            const { data: cachedParlays, error: cacheError } = await supabase
                .from('smart_parlays_v2')
                .select('*')
                .eq('date', date)
                .order('combined_probability', { ascending: false });

            if (!cacheError && cachedParlays && cachedParlays.length > 0) {
                log(`[SMART-PARLAYS] Returning ${cachedParlays.length} cached parlays`);
                return new Response(JSON.stringify({
                    success: true,
                    date,
                    source: 'cache',
                    stats: { total_generated: cachedParlays.length },
                    parlays: cachedParlays,
                    debug_logs: logs,
                    execution_time_ms: Date.now() - startTime
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            log(`[SMART-PARLAYS] No cache found or empty. Generating...`);
        }


        // ═══════════════════════════════════════════════════════════════
        // PASO 1: Obtener picks de Alta Probabilidad
        // ═══════════════════════════════════════════════════════════════

        // 1. Fetch Jobs
        const { data: jobs, error: jobsError } = await supabase
            .from('analysis_jobs_v2')
            .select('id, fixture_id, created_at')
            .gte('created_at', `${date}T00:00:00`)
            .lt('created_at', `${date}T23:59:59`)
            .eq('status', 'done');

        if (jobsError || !jobs?.length) {
            log(`No jobs found for date ${date}`);
            return new Response(JSON.stringify({ success: true, message: 'No jobs found', parlays_generated: 0, debug_logs: logs }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        log(`Found ${jobs.length} completed jobs`);

        // Deduplicate jobs (latest per fixture)
        const latestJobByFixture = new Map<number, any>();
        for (const job of jobs) {
            const existing = latestJobByFixture.get(job.fixture_id);
            if (!existing || new Date(job.created_at) > new Date(existing.created_at)) {
                latestJobByFixture.set(job.fixture_id, job);
            }
        }
        const latestJobIds = Array.from(latestJobByFixture.values()).map(j => j.id);

        // 2. Fetch Picks - SOLO 80%+ PROB
        const { data: picks, error: picksError } = await supabase
            .from('value_picks_v2')
            .select('*')
            .in('job_id', latestJobIds)
            .eq('decision', 'BET')
            .gte('p_model', 0.80) // STRICT: Solo picks con 80%+ probabilidad
            .order('p_model', { ascending: false });

        if (picksError) throw picksError;

        log(`Fetched ${picks?.length || 0} picks from DB`);

        // 3. Enqueue and Classify
        const jobToFixture = new Map<string, number>();
        jobs.forEach(j => jobToFixture.set(j.id, j.fixture_id));

        const fixtureIds = [...new Set(picks?.map(p => jobToFixture.get(p.job_id)).filter(Boolean))];
        const { data: matches } = await supabase
            .from('daily_matches')
            .select('api_fixture_id, home_team, away_team, league_name')
            .in('api_fixture_id', fixtureIds);

        const matchData = new Map<number, any>();
        (matches || []).forEach(m => matchData.set(m.api_fixture_id, m));

        let pool: PickData[] = [];

        // Markets considered "High Value" (boosters)
        const valueMarkers = ['over_2.5', 'over_3.5', 'btts_yes', '1x2', 'corners'];

        for (const pick of (picks || [])) {
            const fixtureId = jobToFixture.get(pick.job_id);
            if (!fixtureId || !matchData.has(fixtureId)) {
                log(`Skipped pick (no match data): ${pick.market} (job: ${pick.job_id})`);
                continue;
            }
            const match = matchData.get(fixtureId);

            // CLASSIFICATION: Pure statistical heuristic
            // (AI tags stored in `predictions` table, not `value_picks_v2`)
            let type: 'VALUE' | 'ANCHOR' = 'VALUE';

            // If prob is low (<0.78), only accept if it's a known "value" market
            const isValueLike = valueMarkers.some(vm => pick.market.includes(vm));

            if (pick.p_model < CONFIG.MIN_INDIVIDUAL_PROB) {
                // Lower prob picks only accepted if they are known value-generating markets
                if (!isValueLike) {
                    // log(`Skipped low prob: ${pick.market} (${pick.p_model})`);
                    continue;
                }
            }

            // High probability non-value markets = ANCHOR (safe bets)
            const isHighProb = pick.p_model > 0.85;
            if (!isValueLike && isHighProb) type = 'ANCHOR';
            else type = 'VALUE';

            pool.push({
                fixture_id: fixtureId,
                job_id: pick.job_id,
                market: pick.market,
                selection: pick.selection,
                p_model: pick.p_model,
                home_team: match.home_team,
                away_team: match.away_team,
                league: match.league_name,
                odds_implied: 1 / pick.p_model,
                type: type
            });
        }

        log(`Pool prepared. Size: ${pool.length}. Anchors: ${pool.filter(p => p.type === 'ANCHOR').length}, Value: ${pool.filter(p => p.type === 'VALUE').length}`);

        if (pool.length < CONFIG.MIN_PICKS) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No hay suficientes picks en el pool.',
                parlays_generated: 0,
                debug_logs: logs
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ═══════════════════════════════════════════════════════════════
        // PASO 2: Construction Loop (Mix Strategy)
        // ═══════════════════════════════════════════════════════════════

        const finalParlays: ParlayCombo[] = [];
        const usedPicks = new Set<string>();
        const getPickKey = (p: PickData) => `${p.fixture_id}-${p.market}`;

        // Priorities:
        // 1. Use Highest Probability "VALUE" picks as seeds (Best odds + Best prob).
        // 2. Mix with Anchors to stabilize.

        const valuePicks = pool.filter(p => p.type === 'VALUE').sort((a, b) => b.p_model - a.p_model);

        // Backup: If we run out of Value seeds, we can try Anchors as seeds if they are super high confident
        const anchorPicks = pool.filter(p => p.type === 'ANCHOR').sort((a, b) => b.p_model - a.p_model);

        // Single unified sorted pool for secondary selection
        const generalPool = [...pool].sort((a, b) => b.p_model - a.p_model);

        let attempts = 0;

        // STRATEGY A: Seed with VALUE picks (High Yield Markets)
        log(`Strategy A: Attempting with ${valuePicks.length} Value seeds`);
        for (const seed of valuePicks) {
            if (usedPicks.has(getPickKey(seed))) continue;
            if (attempts++ > CONFIG.MAX_ATTEMPTS) break;

            const parlay = [seed];
            usedPicks.add(getPickKey(seed));

            let currentOdds = seed.odds_implied;
            let currentProb = seed.p_model; // Combined product

            // Try to add legs
            // First look for a "Helper" (Anchor or Value) from general pool
            for (const candidate of generalPool) {
                if (parlay.length >= CONFIG.MAX_PICKS) break;
                if (usedPicks.has(getPickKey(candidate))) continue;
                if (parlay.some(p => p.fixture_id === candidate.fixture_id)) continue;

                parlay.push(candidate);
                usedPicks.add(getPickKey(candidate));

                currentOdds *= candidate.odds_implied;
                currentProb *= candidate.p_model;

                // Stop if we hit target odds and min size
                if (parlay.length >= CONFIG.MIN_PICKS && currentOdds >= CONFIG.TARGET_TOTAL_ODDS) break;
            }

            // Validate
            // Relax odds target slightly if prob is super high
            const adjustedTargetOdds = currentProb > 0.60 ? CONFIG.TARGET_TOTAL_ODDS - 0.2 : CONFIG.TARGET_TOTAL_ODDS;

            if (parlay.length >= CONFIG.MIN_PICKS && currentOdds >= 1.80) { // Hard floor 1.80
                finalParlays.push({
                    picks: parlay,
                    combined_probability: currentProb,
                    implied_odds: currentOdds
                });
                log(`Success (Strategy A): Parlay with odds ${currentOdds.toFixed(2)}`);
            } else {
                log(`Failed (Strategy A): ${parlay.length} picks, Odds ${currentOdds.toFixed(2)} < 1.80`);
                // Failed. In strict mode we burn picks.
                // To avoid burning the seed for nothing, we could backtrack, but for now we accept the loss to ensure diversity next run.
            }
        }

        // STRATEGY B: Remaining Anchors
        // If we have unused Anchors after Strategy A, try to bundle them
        // Needs likely 3-4 anchors to hit odds target
        log(`Strategy B: Attempting with ${anchorPicks.filter(p => !usedPicks.has(getPickKey(p))).length} remaining Anchors`);
        for (const seed of anchorPicks) {
            if (usedPicks.has(getPickKey(seed))) continue;
            if (attempts++ > CONFIG.MAX_ATTEMPTS) break;

            const parlay = [seed];
            usedPicks.add(getPickKey(seed));
            let currentOdds = seed.odds_implied;
            let currentProb = seed.p_model;

            for (const candidate of anchorPicks) { // Only look at other anchors/remaining pool
                if (parlay.length >= CONFIG.MAX_PICKS) break;
                if (usedPicks.has(getPickKey(candidate))) continue;
                if (parlay.some(p => p.fixture_id === candidate.fixture_id)) continue;

                parlay.push(candidate);
                usedPicks.add(getPickKey(candidate));

                currentOdds *= candidate.odds_implied;
                currentProb *= candidate.p_model;

                if (parlay.length >= CONFIG.MIN_PICKS && currentOdds >= CONFIG.TARGET_TOTAL_ODDS) break;
            }

            if (parlay.length >= CONFIG.MIN_PICKS && currentOdds >= 1.80) {
                finalParlays.push({
                    picks: parlay,
                    combined_probability: currentProb,
                    implied_odds: currentOdds
                });
                log(`Success (Strategy B): Parlay with odds ${currentOdds.toFixed(2)}`);
            } else {
                log(`Failed (Strategy B): ${parlay.length} picks, Odds ${currentOdds.toFixed(2)} < 1.80`);
            }
        }

        log(`Generated ${finalParlays.length} exclusive parlays.`);

        // ═══════════════════════════════════════════════════════════════
        // PASO 3: Guardar en DB
        // ═══════════════════════════════════════════════════════════════

        await supabase.from('smart_parlays_v2').delete().eq('date', date);

        const parlaysToInsert = finalParlays.map((parlay, index) => {
            // Calculating "Average Confidence" for UI display as requested previously
            const avgProb = parlay.picks.reduce((a, b) => a + b.p_model, 0) / parlay.picks.length;
            const confidenceTier = avgProb >= 0.85 ? 'ultra_safe'
                : avgProb >= 0.75 ? 'safe'
                    : 'balanced';

            return {
                date,
                name: `Smart Parlay #${index + 1}`,
                picks: parlay.picks.map(p => ({
                    fixture_id: p.fixture_id,
                    market: p.market,
                    selection: p.selection,
                    p_model: p.p_model,
                    home_team: p.home_team,
                    away_team: p.away_team,
                    league: p.league
                })),
                combined_probability: avgProb,
                implied_odds: Math.round(parlay.implied_odds * 100) / 100,
                pick_count: parlay.picks.length,
                confidence_tier: confidenceTier,
                status: 'pending'
            };
        });

        if (parlaysToInsert.length > 0) {
            await supabase.from('smart_parlays_v2').insert(parlaysToInsert);
        }

        // ═══════════════════════════════════════════════════════════════
        // PASO 4: Prepare Response & Singles Fallback
        // ═══════════════════════════════════════════════════════════════

        let singles: PickData[] = [];
        if (parlaysToInsert.length === 0) {
            // Extract High Value Singles (Odds >= 1.50, Prob >= 80%) logic from pool
            // Note: Pool already filtered by Prob >= 80% (MIN_INDIVIDUAL_PROB)
            singles = pool
                .filter(p => p.odds_implied >= 1.50)
                .sort((a, b) => b.p_model - a.p_model);

            log(`[SMART-PARLAYS] No parlays generated. Returning ${singles.length} singles.`);
        }

        const executionTime = Date.now() - startTime;

        return new Response(JSON.stringify({
            success: true,
            date,
            stats: {
                total_generated: parlaysToInsert.length,
                singles_found: singles.length
            },
            parlays: parlaysToInsert,
            singles: singles, // Return singles for frontend fallback
            debug_logs: logs,
            execution_time_ms: executionTime
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[SMART-PARLAYS] Error:', e);
        return new Response(JSON.stringify({
            success: false,
            error: e.message,
            debug_logs: [] // In case of early error before logs are initialized, or if logs are not relevant to the error context
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
