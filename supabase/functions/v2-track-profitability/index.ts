// supabase/functions/v2-track-profitability/index.ts
// Profitability Tracking Engine
// Actions: 'register' (new picks), 'verify' (update results), 'stats' (get dashboard data)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

// Fractional Kelly Staking Model
function calculateStake(probability: number, odds: number, isLowOdds: boolean): { percentage: number; tier: string } {
    const prob = probability > 1 ? probability : probability * 100;

    // Confidence tiers
    let tier: string;
    let baseStake: number;

    if (prob >= 90) {
        tier = '90+';
        baseStake = isLowOdds ? 4 : 5;
    } else if (prob >= 85) {
        tier = '85-89';
        baseStake = isLowOdds ? 3 : 4;
    } else {
        tier = '80-84';
        baseStake = isLowOdds ? 2 : 3;
    }

    return { percentage: baseStake, tier };
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        const body = await req.json();
        const action = body.action;

        // ═══════════════════════════════════════════════════════════════
        // ACTION: REGISTER - Record new picks with calculated stakes
        // ═══════════════════════════════════════════════════════════════
        if (action === 'register') {
            const { picks, date, bankroll = 100 } = body;
            if (!picks || !Array.isArray(picks) || picks.length === 0) {
                throw new Error('picks array is required');
            }

            // Get current bankroll (last recorded or default)
            const { data: lastEntry } = await supabase
                .from('profitability_tracking')
                .select('bankroll_after')
                .not('bankroll_after', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const currentBankroll = lastEntry?.bankroll_after || bankroll;

            const records = picks.map((pick: any) => {
                const prob = pick.p_model > 1 ? pick.p_model : pick.p_model * 100;
                const isLowOdds = (pick.odds || 0) < 1.40;
                const { percentage, tier } = calculateStake(prob, pick.odds, isLowOdds);
                const stakeAmount = (currentBankroll * percentage) / 100;

                return {
                    date: date || new Date().toISOString().split('T')[0],
                    pick_id: pick.id || `${pick.job_id}_${pick.market}_${pick.selection}`,
                    job_id: pick.job_id || null,
                    fixture_id: pick.fixture_id || null,
                    home_team: pick.home_team || null,
                    away_team: pick.away_team || null,
                    market: pick.market,
                    selection: pick.selection,
                    odds: pick.odds,
                    probability: prob,
                    confidence_tier: tier,
                    stake_percentage: percentage,
                    stake_amount: stakeAmount,
                    result: 'pending'
                };
            });

            // Upsert (avoid duplicates by pick_id + date)
            const { error: insertError } = await supabase
                .from('profitability_tracking')
                .insert(records);

            if (insertError) throw insertError;

            return new Response(JSON.stringify({
                success: true,
                action: 'register',
                picks_registered: records.length,
                current_bankroll: currentBankroll
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ═══════════════════════════════════════════════════════════════
        // ACTION: VERIFY - Update pick results and calculate P/L
        // ═══════════════════════════════════════════════════════════════
        if (action === 'verify') {
            const { pick_id, result, fixture_id } = body; // result: 'won', 'lost', 'void', 'push'

            if (!result || !['won', 'lost', 'void', 'push'].includes(result)) {
                throw new Error('Valid result required: won, lost, void, push');
            }

            // Find the tracking entry
            let query = supabase.from('profitability_tracking').select('*').eq('result', 'pending');
            if (pick_id) query = query.eq('pick_id', pick_id);
            else if (fixture_id) query = query.eq('fixture_id', fixture_id);
            else throw new Error('pick_id or fixture_id required');

            const { data: entries, error: findError } = await query;
            if (findError) throw findError;
            if (!entries || entries.length === 0) {
                return new Response(JSON.stringify({
                    success: true,
                    action: 'verify',
                    message: 'No pending entries found for this pick/fixture'
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // Get current bankroll
            const { data: lastBankroll } = await supabase
                .from('profitability_tracking')
                .select('bankroll_after')
                .not('bankroll_after', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            let runningBankroll = lastBankroll?.bankroll_after || 100;

            for (const entry of entries) {
                let profitLoss = 0;
                if (result === 'won') {
                    profitLoss = entry.stake_amount * (entry.odds - 1);
                } else if (result === 'lost') {
                    profitLoss = -entry.stake_amount;
                }
                // void/push = 0 profit/loss

                runningBankroll += profitLoss;

                await supabase
                    .from('profitability_tracking')
                    .update({
                        result,
                        profit_loss: profitLoss,
                        bankroll_after: runningBankroll,
                        verified_at: new Date().toISOString()
                    })
                    .eq('id', entry.id);
            }

            return new Response(JSON.stringify({
                success: true,
                action: 'verify',
                entries_updated: entries.length,
                bankroll_after: runningBankroll
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ═══════════════════════════════════════════════════════════════
        // ACTION: STATS - Get profitability dashboard data
        // ═══════════════════════════════════════════════════════════════
        if (action === 'stats') {
            const { period } = body; // 'today', 'week', 'month', 'all'

            let dateFilter = '';
            const now = new Date();
            if (period === 'today') {
                dateFilter = now.toISOString().split('T')[0];
            } else if (period === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 86400000);
                dateFilter = weekAgo.toISOString().split('T')[0];
            } else if (period === 'month') {
                const monthAgo = new Date(now.getTime() - 30 * 86400000);
                dateFilter = monthAgo.toISOString().split('T')[0];
            }

            let query = supabase.from('profitability_tracking').select('*');
            if (dateFilter) {
                query = query.gte('date', dateFilter);
            }

            const { data: entries, error: statsError } = await query.order('created_at', { ascending: false });
            if (statsError) throw statsError;

            const all = entries || [];
            const verified = all.filter(e => e.result !== 'pending');
            const won = verified.filter(e => e.result === 'won');
            const lost = verified.filter(e => e.result === 'lost');
            const pending = all.filter(e => e.result === 'pending');

            const totalStaked = verified.reduce((sum, e) => sum + (e.stake_amount || 0), 0);
            const totalProfit = verified.reduce((sum, e) => sum + (e.profit_loss || 0), 0);
            const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
            const yield_pct = verified.length > 0 ? (totalProfit / totalStaked) * 100 : 0;

            // Accuracy by market
            const marketStats: Record<string, { won: number; lost: number; profit: number; staked: number }> = {};
            for (const e of verified) {
                const market = e.market || 'unknown';
                if (!marketStats[market]) marketStats[market] = { won: 0, lost: 0, profit: 0, staked: 0 };
                marketStats[market].staked += e.stake_amount || 0;
                marketStats[market].profit += e.profit_loss || 0;
                if (e.result === 'won') marketStats[market].won++;
                if (e.result === 'lost') marketStats[market].lost++;
            }

            // Get bankroll evolution (last 30 entries with bankroll_after)
            const bankrollHistory = verified
                .filter(e => e.bankroll_after !== null)
                .slice(0, 30)
                .reverse()
                .map(e => ({
                    date: e.date,
                    bankroll: e.bankroll_after,
                    profit: e.profit_loss
                }));

            return new Response(JSON.stringify({
                success: true,
                action: 'stats',
                period: period || 'all',
                summary: {
                    total_picks: all.length,
                    verified_picks: verified.length,
                    pending_picks: pending.length,
                    won: won.length,
                    lost: lost.length,
                    accuracy: verified.length > 0 ? (won.length / verified.length) * 100 : 0,
                    total_staked: totalStaked,
                    total_profit: totalProfit,
                    roi: roi,
                    yield: yield_pct,
                    current_bankroll: bankrollHistory.length > 0 ? bankrollHistory[bankrollHistory.length - 1].bankroll : 100
                },
                by_market: marketStats,
                bankroll_history: bankrollHistory
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        throw new Error(`Unknown action: ${action}. Valid: register, verify, stats`);

    } catch (e: any) {
        console.error('[Profitability] Error:', e);
        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
