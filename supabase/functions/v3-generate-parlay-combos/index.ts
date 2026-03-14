// supabase/functions/v3-generate-parlay-combos/index.ts
// Genera combinaciones de 3 picks de partidos diferentes usando parlay_picks_v2
// Lógica combinatoria pura — NO usa Gemini

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

interface Combo {
    picks: any[];
    combined_odds: number;
    combined_probability: number;
    expected_value: number;
    risk_tier: string;
}

/**
 * ML V3 Calibration for Parlays — Positive-only reranking
 * - NO-OP when no ML data exists
 * - Boosts combos from well-performing tiers, markets, and leagues
 * - NEVER penalizes (no blacklist, no -EV adjustments)
 * - Weighted by sample size (more data = more trust)
 */
function applyParlayCalibrationV3(
    combos: Combo[],
    parlayCalib: any[] | null,
    boostPatterns: any[] | null,
    log: (msg: string) => void
): void {
    if ((!parlayCalib || parlayCalib.length === 0) && (!boostPatterns || boostPatterns.length === 0)) {
        log('[PARLAY-COMBOS] ML V3: No calibration data yet — operating without adjustments');
        return;
    }

    let boostCount = 0;

    // 1. Boost by risk_tier with good performance
    const tierBoosts = new Map<string, number>();
    if (parlayCalib) {
        for (const pc of parlayCalib) {
            if (pc.sample_size < 8) continue;
            const weight = Math.min(1.0, pc.sample_size / 30);

            if (pc.roi > 0) {
                const boost = Math.min(0.15, (pc.roi / 100) * 0.5) * weight;
                tierBoosts.set(pc.risk_level, 1 + boost);
            } else if (pc.actual_wr >= 45) {
                const boost = Math.min(0.05, ((pc.actual_wr - 40) / 100) * 0.3) * weight;
                tierBoosts.set(pc.risk_level, 1 + boost);
            }
        }
    }

    // 2. Boost by well-performing markets/leagues (boost patterns only)
    const marketBoosts = new Map<string, number>();
    const leagueBoosts = new Map<string, number>();

    if (boostPatterns) {
        for (const bp of boostPatterns) {
            if (bp.based_on_sample < 5) continue;
            if (!bp.based_on_wr || bp.based_on_wr < 55) continue;

            const weight = Math.min(1.0, bp.based_on_sample / 20);
            const boost = Math.min(0.10, ((bp.based_on_wr - 50) / 100) * 0.4) * weight;

            if (bp.scope === 'market') {
                marketBoosts.set(bp.scope_key.toLowerCase(), 1 + boost);
            } else if (bp.scope === 'league') {
                leagueBoosts.set(bp.scope_key.toLowerCase(), 1 + boost);
            }
        }
    }

    // 3. Apply boosts to combos
    for (const combo of combos) {
        let multiplier = 1.0;

        const tierFactor = tierBoosts.get(combo.risk_tier);
        if (tierFactor && tierFactor > 1.0) multiplier *= tierFactor;

        for (const pick of combo.picks) {
            const market = (pick.market || '').toLowerCase();
            const league = (pick.league || '').toLowerCase();

            const mBoost = marketBoosts.get(market);
            if (mBoost && mBoost > 1.0) multiplier *= mBoost;

            const lBoost = leagueBoosts.get(league);
            if (lBoost && lBoost > 1.0) multiplier *= lBoost;
        }

        if (multiplier > 1.0) {
            combo.expected_value *= multiplier;
            boostCount++;
        }
    }

    // 4. Transparent logging
    const tierInfo = Array.from(tierBoosts.entries())
        .filter(([_, v]) => v > 1.0)
        .map(([k, v]) => `${k}: +${Math.round((v - 1) * 100)}%`)
        .join(', ');

    const patternInfo = [
        ...Array.from(marketBoosts.entries()).filter(([_, v]) => v > 1.0).map(([k, v]) => `market:${k} +${Math.round((v - 1) * 100)}%`),
        ...Array.from(leagueBoosts.entries()).filter(([_, v]) => v > 1.0).map(([k, v]) => `league:${k} +${Math.round((v - 1) * 100)}%`)
    ].join(', ');

    if (boostCount > 0) {
        log(`[PARLAY-COMBOS] ML V3: Boosted ${boostCount}/${combos.length} combos`);
        if (tierInfo) log(`[PARLAY-COMBOS] ML V3 tier boosts: ${tierInfo}`);
        if (patternInfo) log(`[PARLAY-COMBOS] ML V3 pattern boosts: ${patternInfo}`);
    } else {
        log(`[PARLAY-COMBOS] ML V3: Data loaded but no combos qualified for boost`);
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        const { date } = await req.json();
        const targetDate = date || new Date().toISOString().split('T')[0];

        log(`[PARLAY-COMBOS] Generating combos for date: ${targetDate}`);

        // 1. Get fixture IDs for today
        const { data: dailyMatches, error: matchErr } = await supabase
            .from('daily_matches')
            .select('api_fixture_id')
            .eq('match_date', targetDate);

        if (matchErr) throw matchErr;

        // Also find fixture IDs from parlay jobs created today (in case daily_matches is incomplete)
        const { data: parlayJobs } = await supabase
            .from('analysis_jobs_v2')
            .select('fixture_id')
            .eq('analysis_type', 'parlay')
            .eq('status', 'done')
            .gte('created_at', `${targetDate}T00:00:00`)
            .lt('created_at', `${targetDate}T23:59:59+05:00`);

        const fixtureIds = new Set<number>();
        dailyMatches?.forEach(m => fixtureIds.add(m.api_fixture_id));
        parlayJobs?.forEach(j => fixtureIds.add(j.fixture_id));

        const allIds = Array.from(fixtureIds);
        log(`[PARLAY-COMBOS] Found ${allIds.length} fixture IDs (${dailyMatches?.length || 0} from daily_matches, ${parlayJobs?.length || 0} from jobs)`);

        if (allIds.length === 0) {
            return new Response(JSON.stringify({
                success: false, message: 'No hay partidos para esta fecha.', logs
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 2. Get all parlay picks for these fixtures
        const { data: picks, error: pickErr } = await supabase
            .from('parlay_picks_v2')
            .select('*')
            .in('fixture_id', allIds)
            .gte('p_model', 0.45) // Include picks with >= 45% probability
            .order('p_model', { ascending: false });

        if (pickErr) throw pickErr;

        log(`[PARLAY-COMBOS] Found ${picks?.length || 0} parlay picks from DEDICATED system (parlay_picks_v2)`);

        // FALLBACK: If parlay_picks_v2 has insufficient picks, complement with value_picks_v2
        let allPicks = [...(picks || [])];
        let usedFallback = false;

        if (allPicks.length < 3 || new Set(allPicks.map(p => p.fixture_id)).size < 3) {
            log(`[PARLAY-COMBOS] Insufficient parlay picks (${allPicks.length}), falling back to value_picks_v2`);

            const { data: valuePicks, error: vpErr } = await supabase
                .from('value_picks_v2')
                .select('*')
                .in('fixture_id', allIds)
                .gte('p_model', 0.50);

            if (!vpErr && valuePicks && valuePicks.length > 0) {
                // Get team info from daily_matches for enrichment
                const { data: matchInfo } = await supabase
                    .from('daily_matches')
                    .select('api_fixture_id, home_team, away_team, league_name')
                    .in('api_fixture_id', allIds);

                const matchMap = new Map<number, any>();
                matchInfo?.forEach(m => matchMap.set(m.api_fixture_id, m));

                const existingKeys = new Set(allPicks.map(p => `${p.fixture_id}|${p.market}|${p.selection}`));

                for (const vp of valuePicks) {
                    const key = `${vp.fixture_id}|${vp.market}|${vp.selection}`;
                    if (existingKeys.has(key)) continue;

                    const match = matchMap.get(vp.fixture_id);
                    allPicks.push({
                        fixture_id: vp.fixture_id,
                        market: vp.market,
                        selection: vp.selection,
                        odds: vp.odds || 1.80,
                        p_model: vp.p_model,
                        home_team: match?.home_team || 'Local',
                        away_team: match?.away_team || 'Visitante',
                        league_name: match?.league_name || '',
                        reasoning: '',
                        risk_level: vp.p_model >= 0.70 ? 'bajo' : vp.p_model >= 0.55 ? 'medio' : 'alto',
                        market_category: vp.market || '',
                    });
                }

                usedFallback = true;
                log(`[PARLAY-COMBOS] ⚠️ FALLBACK ACTIVE: ${allPicks.length} total picks (${valuePicks.length} from value_picks_v2)`);
            }
        }

        if (allPicks.length < 3) {
            return new Response(JSON.stringify({
                success: false,
                message: `Solo hay ${allPicks.length} picks disponibles. Se necesitan al menos 3 de diferentes partidos.`,
                logs
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 3. Group picks by fixture_id
        const picksByFixture = new Map<number, typeof allPicks>();
        allPicks.forEach(p => {
            if (!picksByFixture.has(p.fixture_id)) picksByFixture.set(p.fixture_id, []);
            picksByFixture.get(p.fixture_id)!.push(p);
        });

        let fixtureGroups = Array.from(picksByFixture.entries());
        log(`[PARLAY-COMBOS] Picks distributed across ${fixtureGroups.length} different fixtures`);

        // Cap fixture groups to top 20 by avg p_model to prevent combinatorial explosion
        // C(20,3) × 8 = 9,120 combos — safe within 150s Supabase limit
        // Without this cap: C(100,3) × 8 = 1.3M+ combos → timeout (error 546)
        if (fixtureGroups.length > 20) {
            const originalCount = fixtureGroups.length;
            fixtureGroups.sort((a, b) => {
                const avgA = a[1].reduce((s, p) => s + p.p_model, 0) / a[1].length;
                const avgB = b[1].reduce((s, p) => s + p.p_model, 0) / b[1].length;
                return avgB - avgA;
            });
            fixtureGroups = fixtureGroups.slice(0, 20);
            log(`[PARLAY-COMBOS] Capped to top 20 fixtures by avg probability (was ${originalCount})`);
        }

        if (fixtureGroups.length < 3) {
            return new Response(JSON.stringify({
                success: false,
                message: `Picks de solo ${fixtureGroups.length} partidos diferentes. Se necesitan al menos 3.`,
                logs
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 4. Generate all valid combinations of 3 picks from 3 different fixtures
        const combos: Combo[] = [];

        for (let i = 0; i < fixtureGroups.length; i++) {
            for (let j = i + 1; j < fixtureGroups.length; j++) {
                for (let k = j + 1; k < fixtureGroups.length; k++) {
                    // For each fixture trio, try the top picks from each
                    const picksA = fixtureGroups[i][1].slice(0, 2); // Top 2 from fixture A
                    const picksB = fixtureGroups[j][1].slice(0, 2);
                    const picksC = fixtureGroups[k][1].slice(0, 2);

                    for (const pA of picksA) {
                        for (const pB of picksB) {
                            for (const pC of picksC) {
                                const oddsA = pA.odds || 1.80;
                                const oddsB = pB.odds || 1.80;
                                const oddsC = pC.odds || 1.80;
                                const combinedOdds = oddsA * oddsB * oddsC;
                                const combinedProb = pA.p_model * pB.p_model * pC.p_model;

                                // Filter: combined odds between 3.0 and 25.0
                                if (combinedOdds >= 3.0 && combinedOdds <= 25.0) {
                                    const ev = combinedOdds * combinedProb;
                                    combos.push({
                                        picks: [pA, pB, pC].map(p => ({
                                            fixture_id: p.fixture_id,
                                            market: p.market,
                                            selection: p.selection,
                                            odds: p.odds || 1.80,
                                            p_model: p.p_model,
                                            home_team: p.home_team,
                                            away_team: p.away_team,
                                            league: p.league_name,
                                            reasoning: p.reasoning?.substring(0, 200) || ''
                                        })),
                                        combined_odds: Math.round(combinedOdds * 100) / 100,
                                        combined_probability: combinedProb,
                                        expected_value: ev,
                                        risk_tier: combinedOdds > 10 ? 'aggressive' : combinedOdds > 5 ? 'balanced' : 'conservative'
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        log(`[PARLAY-COMBOS] Generated ${combos.length} valid combinations`);

        // 4.5 ML CALIBRATION V3: Positive-only reranking using learned performance data
        try {
            const { data: parlayCalib } = await supabase
                .from('ml_parlay_calibration')
                .select('*')
                .eq('legs_count', 3)
                .eq('status', 'active');

            const { data: boostPatterns } = await supabase
                .from('ml_learned_patterns')
                .select('scope, scope_key, based_on_wr, based_on_sample')
                .eq('pattern_type', 'boost')
                .eq('active', true);

            applyParlayCalibrationV3(combos, parlayCalib, boostPatterns, log);
        } catch (mlErr: any) {
            log(`[PARLAY-COMBOS] ML V3 calibration failed (non-blocking): ${mlErr.message}`);
        }

        // 5. Sort by EV and select with GREEDY EXCLUSION (no pick repeated across parlays)
        // Rule: each individual pick can only appear in ONE parlay.
        // If a pick fails, only 1 parlay is affected instead of all of them.
        combos.sort((a, b) => b.expected_value - a.expected_value);

        const topCombos: Combo[] = [];
        const usedPicks = new Set<string>(); // "fixture_id|market|selection"

        for (const combo of combos) {
            if (topCombos.length >= 5) break;

            // Check if ANY pick in this combo was already used in a selected parlay
            const pickKeys = combo.picks.map(p => `${p.fixture_id}|${p.market}|${p.selection}`);
            const hasConflict = pickKeys.some(k => usedPicks.has(k));

            if (!hasConflict) {
                topCombos.push(combo);
                pickKeys.forEach(k => usedPicks.add(k));
            }
        }

        const source = usedFallback ? 'FALLBACK (value_picks_v2)' : 'DEDICATED (parlay_picks_v2)';
        log(`[PARLAY-COMBOS] Source: ${source}`);
        log(`[PARLAY-COMBOS] Selected ${topCombos.length} parlays with unique picks (from ${combos.length} candidates)`);

        if (topCombos.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                message: 'No se generaron combinaciones con cuotas válidas (3.0-25.0).',
                logs
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 6. Clean old combos for this date and save new ones
        await supabase.from('parlay_combos_v2').delete().eq('date', targetDate);

        const insertPayload = topCombos.map(c => ({
            date: targetDate,
            picks: c.picks,
            combined_odds: c.combined_odds,
            combined_probability: c.combined_probability,
            pick_count: 3,
            risk_tier: c.risk_tier,
            status: 'pending'
        }));

        const { error: insertErr } = await supabase.from('parlay_combos_v2').insert(insertPayload);
        if (insertErr) throw insertErr;

        log(`[PARLAY-COMBOS] Saved ${topCombos.length} combos for ${targetDate}`);

        return new Response(JSON.stringify({
            success: true,
            date: targetDate,
            source,
            stats: {
                total_picks: allPicks.length,
                fixtures_with_picks: fixtureGroups.length,
                combinations_evaluated: combos.length,
                combos_saved: topCombos.length
            },
            combos: topCombos.map(c => ({ risk_tier: c.risk_tier, combined_odds: c.combined_odds, pick_count: c.picks.length })),
            logs
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        log(`[PARLAY-COMBOS] Error: ${e.message}`);
        return new Response(JSON.stringify({ success: false, error: e.message, logs }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
