// services/resultsService.ts
// Frontend service for fetching verification results and analytics data

import { supabase } from './supabaseService';
import type { PublicResultsData, AdvancedAnalyticsData, AdvancedAnalyticsFilters, PickResult } from '../types';

// Fecha de inicio del sistema de verificación
const SYSTEM_START_DATE = '2026-02-17';

/**
 * Get public results data for the Resultados tab (accessible to all users)
 * Filters by match_date from daily_matches — NOT by verified_at timestamp
 */
export async function getPublicResults(startDate: string, endDate: string): Promise<PublicResultsData> {
    // Step 1: Get fixture IDs for matches in the requested date range
    const { data: dateMatches, error: matchError } = await supabase
        .from('daily_matches')
        .select('api_fixture_id, home_team, away_team, league_name, match_date')
        .gte('match_date', startDate)
        .lte('match_date', endDate);

    if (matchError) {
        console.error('[ResultsService] Error fetching daily_matches:', matchError);
        throw matchError;
    }

    const matchMap = new Map<number, any>();
    const fixtureIdsInRange: number[] = [];
    (dateMatches || []).forEach(m => {
        matchMap.set(m.api_fixture_id, m);
        fixtureIdsInRange.push(m.api_fixture_id);
    });

    if (fixtureIdsInRange.length === 0) {
        // No matches in date range — still show cumulative bankroll
        const baseBankroll = await fetchBaseBankroll();
        const { totalProfit } = await calculateProfitFromPicks(baseBankroll, SYSTEM_START_DATE, new Date().toISOString().split('T')[0]);
        return emptyResults(baseBankroll, baseBankroll + totalProfit, totalProfit);
    }

    // Step 2: Get verified picks for those fixtures — ONLY Oportunidades
    const { data: picks, error } = await supabase
        .from('value_picks_v2')
        .select('id, fixture_id, market, selection, p_model, odds, result, verified_at, actual_score')
        .in('result', ['WON', 'LOST'])
        .gte('p_model', 0.83)
        .gte('odds', 1.40)
        .in('fixture_id', fixtureIdsInRange)
        .order('verified_at', { ascending: false });

    if (error) {
        console.error('[ResultsService] Error fetching results:', error);
        throw error;
    }

    const results = picks || [];
    const won = results.filter(p => p.result === 'WON');
    const lost = results.filter(p => p.result === 'LOST');

    // Last 7 days stats (always calculated globally, not just for the selected period)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const { data: last7Matches } = await supabase
        .from('daily_matches')
        .select('api_fixture_id')
        .gte('match_date', sevenDaysStr)
        .lte('match_date', todayStr);

    const last7FixtureIds = (last7Matches || []).map(m => m.api_fixture_id);
    const last7 = last7FixtureIds.length > 0
        ? results.filter(p => last7FixtureIds.includes(p.fixture_id))
        : [];
    const last7Wins = last7.filter(p => p.result === 'WON').length;
    const last7Losses = last7.filter(p => p.result === 'LOST').length;

    // Current streak (from all recent results, not just this period)
    let streakType: 'win' | 'loss' = 'win';
    let streakCount = 0;
    for (const pick of results) {
        if (streakCount === 0) {
            streakType = pick.result === 'WON' ? 'win' : 'loss';
            streakCount = 1;
        } else if ((pick.result === 'WON' && streakType === 'win') || (pick.result === 'LOST' && streakType === 'loss')) {
            streakCount++;
        } else {
            break;
        }
    }

    // Enrich with team names + match_date
    const recentResults = results.map(p => {
        const match = matchMap.get(p.fixture_id);
        return {
            id: p.id,
            home_team: match?.home_team || 'Equipo A',
            away_team: match?.away_team || 'Equipo B',
            market: p.market,
            selection: p.selection,
            result: p.result as PickResult,
            odds: p.odds,
            p_model: p.p_model,
            actual_score: p.actual_score,
            verified_at: p.verified_at,
            league: match?.league_name,
            match_date: match?.match_date,
        };
    });

    const totalVerified = won.length + lost.length;

    // Bankroll — calculado desde value_picks_v2 (misma fuente de verdad que Analítica)
    const baseBankroll = await fetchBaseBankroll();
    const { totalProfit: cumulativeProfit } = await calculateProfitFromPicks(baseBankroll, SYSTEM_START_DATE, new Date().toISOString().split('T')[0]);
    const { totalProfit: periodProfit } = await calculateProfitFromPicks(baseBankroll, startDate, endDate);

    return {
        winRate: totalVerified > 0 ? (won.length / totalVerified) * 100 : 0,
        totalVerified,
        totalPending: 0,
        won: won.length,
        lost: lost.length,
        last7Days: { wins: last7Wins, losses: last7Losses, total: last7.length },
        currentStreak: { type: streakType, count: streakCount },
        recentResults,
        bankroll: {
            base: baseBankroll,
            current: baseBankroll + cumulativeProfit,
            profit: cumulativeProfit,
            roi: baseBankroll > 0 ? (cumulativeProfit / baseBankroll) * 100 : 0,
            periodProfit,
        },
    };
}

async function fetchBaseBankroll(): Promise<number> {
    const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'display_bankroll')
        .maybeSingle();
    return data?.value || 100;
}

/**
 * Calculate profit directly from value_picks_v2 using flat staking (4%).
 * This is the single source of truth for financial calculations,
 * used by BOTH Resultados and Analítica Avanzada.
 */
async function calculateProfitFromPicks(baseBankroll: number, startDate: string, endDate: string) {
    // Get fixture IDs for the date range
    const { data: matches } = await supabase
        .from('daily_matches')
        .select('api_fixture_id')
        .gte('match_date', startDate)
        .lte('match_date', endDate);

    const fixtureIds = (matches || []).map(m => m.api_fixture_id);
    if (fixtureIds.length === 0) return { totalProfit: 0, totalStaked: 0 };

    // Get verified Oportunidades
    const { data: picks } = await supabase
        .from('value_picks_v2')
        .select('result, odds')
        .in('fixture_id', fixtureIds)
        .gte('p_model', 0.83)
        .gte('odds', 1.40)
        .in('result', ['WON', 'LOST']);

    const stakeAmount = baseBankroll * 0.04;
    let totalProfit = 0;
    let totalStaked = 0;

    for (const pick of (picks || [])) {
        totalStaked += stakeAmount;
        totalProfit += pick.result === 'WON'
            ? stakeAmount * ((pick.odds || 1) - 1)
            : -stakeAmount;
    }

    return { totalProfit, totalStaked };
}

function emptyResults(baseBankroll: number, current: number, profit: number): PublicResultsData {
    return {
        winRate: 0,
        totalVerified: 0,
        totalPending: 0,
        won: 0,
        lost: 0,
        last7Days: { wins: 0, losses: 0, total: 0 },
        currentStreak: { type: 'win', count: 0 },
        recentResults: [],
        bankroll: {
            base: baseBankroll,
            current,
            profit,
            roi: baseBankroll > 0 ? (profit / baseBankroll) * 100 : 0,
        },
    };
}

/**
 * Get/set display bankroll (admin only)
 */
export async function getDisplayBankroll(): Promise<number> {
    const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'display_bankroll')
        .maybeSingle();
    return data?.value || 100;
}

export async function setDisplayBankroll(amount: number): Promise<void> {
    await supabase
        .from('system_settings')
        .update({ value: amount, updated_at: new Date().toISOString() })
        .eq('key', 'display_bankroll');
}

/**
 * Manual override: Admin sets a pick as WON or LOST
 *
 * The pickId from HighProbPicks can be:
 * - A real UUID from value_picks_v2
 * - A composite ID like "jobId_market_selection" (from reports_v2 source)
 * - A composite ID like "vp_jobId_market_selection" (from value_picks source)
 * - A composite ID like "analisis_fixtureId_market_selection" (from analisis source)
 *
 * This function resolves the pick regardless of ID format, creates it in
 * value_picks_v2 if it doesn't exist, and updates profitability_tracking.
 */
export async function manualOverridePick(
    pickId: string,
    newResult: 'WON' | 'LOST' | 'VOID',
    pickMeta?: { fixture_id: number; market: string; selection: string; p_model: number; odds: number | null; job_id?: string }
): Promise<void> {
    const now = new Date().toISOString();

    // Step 1: Try to find the pick in value_picks_v2
    let pick: any = null;

    // 1A: Try direct UUID lookup
    const { data: directPick } = await supabase
        .from('value_picks_v2')
        .select('id, fixture_id, market, selection, p_model, odds, result, job_id')
        .eq('id', pickId)
        .maybeSingle();

    if (directPick) {
        pick = directPick;
    }

    // 1B: If not found by UUID, try by fixture_id + market + selection from metadata
    if (!pick && pickMeta) {
        const { data: metaPick } = await supabase
            .from('value_picks_v2')
            .select('id, fixture_id, market, selection, p_model, odds, result, job_id')
            .eq('fixture_id', pickMeta.fixture_id)
            .eq('market', pickMeta.market)
            .eq('selection', pickMeta.selection)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (metaPick) {
            pick = metaPick;
        }
    }

    // 1C: If STILL not found, create the pick in value_picks_v2
    if (!pick && pickMeta) {
        const prob = pickMeta.p_model > 1 ? pickMeta.p_model / 100 : pickMeta.p_model;
        const insertPayload = {
            job_id: pickMeta.job_id || null,
            fixture_id: pickMeta.fixture_id,
            market: pickMeta.market,
            selection: pickMeta.selection,
            p_model: prob,
            odds: pickMeta.odds,
            decision: 'BET',
            confidence: 8,
            engine_version: 'MANUAL',
            result: newResult,
            verified_at: now,
            actual_score: `Manual: ${newResult}`,
            created_at: now,
        };

        const { data: newPick, error: insertErr } = await supabase
            .from('value_picks_v2')
            .insert(insertPayload)
            .select('id, fixture_id, market, selection, p_model, odds, result, job_id')
            .single();

        if (insertErr) throw new Error(`Error creando pick: ${insertErr.message}`);
        pick = newPick;
    }

    if (!pick) throw new Error('Pick no encontrado y no se proporcionaron datos suficientes para crearlo');

    // Step 2: Update value_picks_v2 (if pick already existed)
    if (pick.result !== newResult || !pick.result || pick.result === 'PENDING') {
        await supabase
            .from('value_picks_v2')
            .update({
                result: newResult,
                verified_at: now,
                actual_score: `Manual: ${newResult}`,
            })
            .eq('id', pick.id);
    }

    // Step 3: Update profitability_tracking (only for Oportunidades, skip VOID)
    if (newResult === 'VOID') return; // VOID = no profit/loss impact
    const prob = pick.p_model > 1 ? pick.p_model / 100 : pick.p_model;
    const isOportunidad = prob >= 0.83 && pick.odds && pick.odds >= 1.40;
    if (!isOportunidad) return;

    const baseBankroll = await fetchBaseBankroll();
    const stakePercent = 4;
    const stakeAmount = baseBankroll * (stakePercent / 100);
    const profitLoss = newResult === 'WON'
        ? stakeAmount * (pick.odds - 1)
        : -stakeAmount;

    const { data: matchData } = await supabase
        .from('daily_matches')
        .select('match_date, home_team, away_team, league_name')
        .eq('api_fixture_id', pick.fixture_id)
        .maybeSingle();

    const matchDate = matchData?.match_date || new Date().toISOString().split('T')[0];

    // Check by fixture_id + market + selection (not by the composite pickId)
    const { data: existing } = await supabase
        .from('profitability_tracking')
        .select('id')
        .eq('fixture_id', pick.fixture_id)
        .eq('market', pick.market)
        .eq('selection', pick.selection)
        .maybeSingle();

    if (existing) {
        await supabase
            .from('profitability_tracking')
            .update({
                result: newResult.toLowerCase(),
                profit_loss: profitLoss,
                stake_amount: stakeAmount,
                verified_at: now,
            })
            .eq('id', existing.id);
    } else {
        await supabase
            .from('profitability_tracking')
            .insert({
                pick_id: pick.id,
                fixture_id: pick.fixture_id,
                market: pick.market,
                selection: pick.selection,
                odds: pick.odds,
                probability: Math.round(prob * 100),
                result: newResult.toLowerCase(),
                stake_percentage: stakePercent,
                stake_amount: stakeAmount,
                profit_loss: profitLoss,
                date: matchDate,
                pick_type: 'oportunidad',
                home_team: matchData?.home_team || '',
                away_team: matchData?.away_team || '',
                league_name: matchData?.league_name || '',
                verified_at: now,
            });
    }
}

/**
 * Recalculate results: Reset picks to PENDING, clear profitability_tracking,
 * then invoke hourly-results-verifier to re-process with corrected logic.
 */
export async function recalculateResults(startDate: string, endDate: string): Promise<{ message: string; resetCount: number }> {
    // 1. Get fixture IDs for the date range
    const { data: matches } = await supabase
        .from('daily_matches')
        .select('api_fixture_id')
        .gte('match_date', startDate)
        .lte('match_date', endDate);

    const fixtureIds = (matches || []).map(m => m.api_fixture_id);

    if (fixtureIds.length === 0) {
        return { message: 'No hay partidos en ese rango de fechas', resetCount: 0 };
    }

    // 2. Reset value_picks_v2 results to PENDING for those fixtures (only Oportunidades)
    const { data: resetPicks, error: resetErr } = await supabase
        .from('value_picks_v2')
        .update({ result: 'PENDING', verified_at: null, actual_score: null })
        .in('fixture_id', fixtureIds)
        .gte('p_model', 0.83)
        .gte('odds', 1.40)
        .in('result', ['WON', 'LOST', 'VOID'])
        .select('id');

    if (resetErr) throw new Error(`Error reseteando picks: ${resetErr.message}`);

    const resetCount = resetPicks?.length || 0;

    // 3. Delete profitability_tracking entries for those dates
    await supabase
        .from('profitability_tracking')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate);

    // 4. Generate date array for the verifier
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }

    // 5. Invoke hourly-results-verifier with the date range
    const { error: invokeErr } = await supabase.functions.invoke('hourly-results-verifier', {
        body: { date: dates }
    });

    if (invokeErr) throw new Error(`Error invocando verificador: ${invokeErr.message}`);

    return { message: `${resetCount} picks reseteados y re-verificación lanzada para ${dates.join(', ')}`, resetCount };
}

/**
 * Get advanced analytics data for superadmin (AnaliticaAvanzada)
 * Uses value_picks_v2 as source of truth for Oportunidades,
 * profitability_tracking only for Parlays.
 */
export async function getAdvancedAnalytics(filters: AdvancedAnalyticsFilters): Promise<AdvancedAnalyticsData> {
    if (filters.pickType === 'parlay') {
        return getAdvancedAnalyticsForParlays(filters);
    }

    // ═══ OPORTUNIDADES: value_picks_v2 is the source of truth ═══

    // Step 1: Get fixture IDs from daily_matches for the date range
    const { data: dateMatches, error: matchError } = await supabase
        .from('daily_matches')
        .select('api_fixture_id, home_team, away_team, league_name, match_date')
        .gte('match_date', filters.startDate)
        .lte('match_date', filters.endDate);

    if (matchError) throw matchError;

    const matchMap = new Map<number, any>();
    const fixtureIds: number[] = [];
    (dateMatches || []).forEach(m => {
        matchMap.set(m.api_fixture_id, m);
        fixtureIds.push(m.api_fixture_id);
    });

    if (fixtureIds.length === 0) {
        return emptyAnalytics(filters.startingBankroll);
    }

    // Step 2: Get verified picks (Oportunidades: p_model >= 0.83, odds >= 1.40)
    let query = supabase
        .from('value_picks_v2')
        .select('id, fixture_id, market, selection, p_model, odds, result, verified_at, actual_score, created_at')
        .in('fixture_id', fixtureIds)
        .gte('p_model', 0.83)
        .gte('odds', 1.40)
        .in('result', ['WON', 'LOST', 'VOID'])
        .order('verified_at', { ascending: true });

    if (filters.market && filters.market !== 'all') {
        query = query.eq('market', filters.market);
    }

    const { data: verifiedPicks, error: picksErr } = await query;
    if (picksErr) throw picksErr;

    // Pending count
    const { count: pendingCount } = await supabase
        .from('value_picks_v2')
        .select('id', { count: 'exact', head: true })
        .in('fixture_id', fixtureIds)
        .gte('p_model', 0.83)
        .gte('odds', 1.40)
        .eq('result', 'PENDING');

    const verified = verifiedPicks || [];
    const won = verified.filter(p => p.result === 'WON');
    const lost = verified.filter(p => p.result === 'LOST');
    const voided = verified.filter(p => p.result === 'VOID');

    // Financial simulation (flat staking: 4% of bankroll)
    const baseBankroll = filters.startingBankroll;
    const stakeAmount = baseBankroll * 0.04;

    let bankroll = baseBankroll;
    const bankrollHistory: Array<{ date: string; bankroll: number; profit: number }> = [];
    let totalStaked = 0;
    let totalProfit = 0;
    let maxWinStreak = 0, maxLossStreak = 0, currentWinStreak = 0, currentLossStreak = 0;

    for (const pick of verified) {
        if (pick.result === 'VOID') continue;

        const profitLoss = pick.result === 'WON'
            ? stakeAmount * ((pick.odds || 1) - 1)
            : -stakeAmount;

        totalStaked += stakeAmount;
        totalProfit += profitLoss;
        bankroll += profitLoss;

        const match = matchMap.get(pick.fixture_id);
        bankrollHistory.push({
            date: match?.match_date || pick.verified_at?.split('T')[0] || '',
            bankroll,
            profit: profitLoss,
        });

        if (pick.result === 'WON') {
            currentWinStreak++;
            currentLossStreak = 0;
            if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
        } else {
            currentLossStreak++;
            currentWinStreak = 0;
            if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
        }
    }

    // By market
    const byMarket: Record<string, { won: number; lost: number; profit: number; staked: number; accuracy: number }> = {};
    for (const pick of verified) {
        if (pick.result === 'VOID') continue;
        const market = pick.market || 'unknown';
        if (!byMarket[market]) byMarket[market] = { won: 0, lost: 0, profit: 0, staked: 0, accuracy: 0 };

        const profitLoss = pick.result === 'WON'
            ? stakeAmount * ((pick.odds || 1) - 1)
            : -stakeAmount;

        byMarket[market].staked += stakeAmount;
        byMarket[market].profit += profitLoss;
        if (pick.result === 'WON') byMarket[market].won++;
        if (pick.result === 'LOST') byMarket[market].lost++;
    }
    for (const key of Object.keys(byMarket)) {
        const total = byMarket[key].won + byMarket[key].lost;
        byMarket[key].accuracy = total > 0 ? (byMarket[key].won / total) * 100 : 0;
    }

    // By league
    const byLeague: Record<string, { won: number; lost: number; accuracy: number }> = {};
    for (const pick of verified) {
        if (pick.result === 'VOID') continue;
        const match = matchMap.get(pick.fixture_id);
        const league = match?.league_name || 'Desconocida';
        if (!byLeague[league]) byLeague[league] = { won: 0, lost: 0, accuracy: 0 };
        if (pick.result === 'WON') byLeague[league].won++;
        if (pick.result === 'LOST') byLeague[league].lost++;
    }
    for (const key of Object.keys(byLeague)) {
        const total = byLeague[key].won + byLeague[key].lost;
        byLeague[key].accuracy = total > 0 ? (byLeague[key].won / total) * 100 : 0;
    }

    const currentStreak = currentWinStreak > 0
        ? { type: 'win' as const, count: currentWinStreak }
        : { type: 'loss' as const, count: currentLossStreak };

    // ROI = profit / capital inicial (misma fórmula que Resultados)
    const roi = baseBankroll > 0 ? (totalProfit / baseBankroll) * 100 : 0;

    return {
        summary: {
            total_picks: verified.length + (pendingCount || 0),
            verified_picks: verified.length,
            pending_picks: pendingCount || 0,
            won: won.length,
            lost: lost.length,
            voided: voided.length,
            accuracy: (won.length + lost.length) > 0 ? (won.length / (won.length + lost.length)) * 100 : 0,
            total_staked: totalStaked,
            total_profit: totalProfit,
            roi,
            yield: totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0,
            current_bankroll: bankroll,
            max_drawdown: 0,
            max_win_streak: maxWinStreak,
            max_loss_streak: maxLossStreak,
            current_streak: currentStreak,
        },
        by_market: byMarket,
        by_league: byLeague,
        bankroll_history: bankrollHistory,
        picks: verified.map(p => {
            const match = matchMap.get(p.fixture_id);
            const profitLoss = p.result === 'WON'
                ? stakeAmount * ((p.odds || 1) - 1)
                : p.result === 'LOST' ? -stakeAmount : 0;
            return {
                id: p.id,
                home_team: match?.home_team || '',
                away_team: match?.away_team || '',
                market: p.market || '',
                selection: p.selection || '',
                result: p.result as PickResult,
                odds: p.odds || 0,
                p_model: p.p_model,
                actual_score: p.actual_score,
                verified_at: p.verified_at || p.created_at,
                profit_loss: profitLoss,
                league: match?.league_name,
            };
        }),
    };
}

function emptyAnalytics(startingBankroll: number): AdvancedAnalyticsData {
    return {
        summary: {
            total_picks: 0, verified_picks: 0, pending_picks: 0,
            won: 0, lost: 0, voided: 0, accuracy: 0,
            total_staked: 0, total_profit: 0, roi: 0, yield: 0,
            current_bankroll: startingBankroll, max_drawdown: 0,
            max_win_streak: 0, max_loss_streak: 0,
            current_streak: { type: 'win', count: 0 },
        },
        by_market: {},
        by_league: {},
        bankroll_history: [],
        picks: [],
    };
}

/**
 * Parlays analytics — uses profitability_tracking since parlay data lives there
 */
async function getAdvancedAnalyticsForParlays(filters: AdvancedAnalyticsFilters): Promise<AdvancedAnalyticsData> {
    let query = supabase
        .from('profitability_tracking')
        .select('*')
        .gte('date', filters.startDate)
        .lte('date', filters.endDate)
        .eq('pick_type', 'parlay')
        .order('created_at', { ascending: true });

    if (filters.market && filters.market !== 'all') query = query.eq('market', filters.market);

    const { data: entries, error } = await query;
    if (error) throw error;

    const all = entries || [];
    const verified = all.filter(e => e.result !== 'pending');
    const won = verified.filter(e => e.result === 'won');
    const lost = verified.filter(e => e.result === 'lost');
    const voided = verified.filter(e => e.result === 'void' || e.result === 'push');
    const pending = all.filter(e => e.result === 'pending');

    const totalStaked = verified.reduce((sum, e) => sum + (e.stake_amount || 0), 0);
    const totalProfit = verified.reduce((sum, e) => sum + (e.profit_loss || 0), 0);
    const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

    let bankroll = filters.startingBankroll;
    const bankrollHistory: Array<{ date: string; bankroll: number; profit: number }> = [];
    let maxWinStreak = 0, maxLossStreak = 0, currentWinStreak = 0, currentLossStreak = 0;

    for (const e of verified) {
        bankroll += e.profit_loss || 0;
        bankrollHistory.push({ date: e.date, bankroll, profit: e.profit_loss || 0 });

        if (e.result === 'won') {
            currentWinStreak++; currentLossStreak = 0;
            if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
        } else if (e.result === 'lost') {
            currentLossStreak++; currentWinStreak = 0;
            if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
        }
    }

    const byMarket: Record<string, { won: number; lost: number; profit: number; staked: number; accuracy: number }> = {};
    for (const e of verified) {
        const market = e.market || 'parlay';
        if (!byMarket[market]) byMarket[market] = { won: 0, lost: 0, profit: 0, staked: 0, accuracy: 0 };
        byMarket[market].staked += e.stake_amount || 0;
        byMarket[market].profit += e.profit_loss || 0;
        if (e.result === 'won') byMarket[market].won++;
        if (e.result === 'lost') byMarket[market].lost++;
    }
    for (const key of Object.keys(byMarket)) {
        const total = byMarket[key].won + byMarket[key].lost;
        byMarket[key].accuracy = total > 0 ? (byMarket[key].won / total) * 100 : 0;
    }

    const currentStreak = currentWinStreak > 0
        ? { type: 'win' as const, count: currentWinStreak }
        : { type: 'loss' as const, count: currentLossStreak };

    return {
        summary: {
            total_picks: all.length, verified_picks: verified.length, pending_picks: pending.length,
            won: won.length, lost: lost.length, voided: voided.length,
            accuracy: (won.length + lost.length) > 0 ? (won.length / (won.length + lost.length)) * 100 : 0,
            total_staked: totalStaked, total_profit: totalProfit, roi, yield: roi,
            current_bankroll: bankroll, max_drawdown: 0,
            max_win_streak: maxWinStreak, max_loss_streak: maxLossStreak,
            current_streak: currentStreak,
        },
        by_market: byMarket,
        by_league: {},
        bankroll_history: bankrollHistory,
        picks: verified.map(e => ({
            id: e.id, home_team: e.home_team || '', away_team: e.away_team || '',
            market: e.market || '', selection: e.selection || '',
            result: (e.result || 'PENDING').toUpperCase() as PickResult,
            odds: e.odds || 0, p_model: (e.probability || 0) / 100,
            actual_score: null, verified_at: e.verified_at || e.created_at,
            profit_loss: e.profit_loss || 0,
        })),
    };
}
