// supabase/functions/v3-generate-parlay-combos/index.ts
// Genera combinaciones de 3 picks de partidos diferentes usando parlay_picks_v2
// Lógica combinatoria pura — NO usa Gemini

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

        log(`[PARLAY-COMBOS] Found ${picks?.length || 0} parlay picks`);

        // FALLBACK: If parlay_picks_v2 has insufficient picks, complement with value_picks_v2
        let allPicks = [...(picks || [])];

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

                log(`[PARLAY-COMBOS] After fallback: ${allPicks.length} total picks (${valuePicks.length} from value_picks_v2)`);
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

        const fixtureGroups = Array.from(picksByFixture.entries());
        log(`[PARLAY-COMBOS] Picks distributed across ${fixtureGroups.length} different fixtures`);

        if (fixtureGroups.length < 3) {
            return new Response(JSON.stringify({
                success: false,
                message: `Picks de solo ${fixtureGroups.length} partidos diferentes. Se necesitan al menos 3.`,
                logs
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 4. Generate all valid combinations of 3 picks from 3 different fixtures
        interface Combo {
            picks: any[];
            combined_odds: number;
            combined_probability: number;
            expected_value: number;
            risk_tier: string;
        }

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
            stats: {
                total_picks: allPicks.length,
                fixtures_with_picks: fixtureGroups.length,
                combinations_evaluated: combos.length,
                combos_saved: topCombos.length
            },
            combos: topCombos,
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
