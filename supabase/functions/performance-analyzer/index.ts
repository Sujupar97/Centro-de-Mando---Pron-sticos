// supabase/functions/performance-analyzer/index.ts
// Read-only analysis function: takes a date range and produces a 7-dimension performance report
// Used by the manual optimization cycle: user verifies picks → this function analyzes patterns

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

interface PickRow {
    id: string;
    fixture_id: number;
    market: string;
    selection: string;
    p_model: number;
    odds: number;
    result: string;
    confidence: number;
    engine_version: string;
    verified_at: string;
}

interface MatchRow {
    api_fixture_id: number;
    league_name: string;
    match_date: string;
}

// Helper: classify odds into ranges
function getOddsRange(odds: number): string {
    if (odds < 1.40) return '<1.40';
    if (odds < 1.70) return '1.40-1.69';
    if (odds < 2.00) return '1.70-1.99';
    if (odds < 2.50) return '2.00-2.49';
    return '2.50+';
}

// Helper: classify probability into bands
function getProbBand(pModel: number): string {
    const pct = pModel > 1 ? pModel : pModel * 100;
    if (pct < 80) return '<80%';
    if (pct < 83) return '80-82%';
    if (pct < 86) return '83-85%';
    if (pct < 90) return '86-89%';
    return '90%+';
}

// Helper: confidence number to label
function getConfidenceLabel(conf: number): string {
    if (conf >= 9) return '9 (MUY ALTA)';
    if (conf >= 8) return '8 (ALTA)';
    if (conf >= 6) return '6 (MEDIA)';
    return '5 (DEFAULT)';
}

// Helper: calculate ROI for a set of picks (flat 4% staking on 100-unit bankroll)
function calculateROI(won: number, lost: number, avgOdds: number): number {
    if (won + lost === 0) return 0;
    const stakePerPick = 4; // 4 units per pick
    const totalStaked = (won + lost) * stakePerPick;
    const totalProfit = (won * stakePerPick * (avgOdds - 1)) - (lost * stakePerPick);
    return totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { startDate, endDate } = await req.json();

        if (!startDate || !endDate) {
            throw new Error('startDate and endDate are required (YYYY-MM-DD)');
        }

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        console.log(`[performance-analyzer] Analyzing ${startDate} to ${endDate}`);

        // 1. Get matches in date range
        const { data: matches, error: matchErr } = await supabase
            .from('daily_matches')
            .select('api_fixture_id, league_name, match_date')
            .gte('match_date', startDate)
            .lte('match_date', endDate);

        if (matchErr) throw matchErr;

        const matchMap = new Map<number, MatchRow>();
        const fixtureIds: number[] = [];
        for (const m of (matches || [])) {
            matchMap.set(m.api_fixture_id, m);
            fixtureIds.push(m.api_fixture_id);
        }

        if (fixtureIds.length === 0) {
            return new Response(JSON.stringify({
                error: null,
                message: 'No matches found in date range',
                period: { startDate, endDate },
                total_picks: 0,
            }), { headers: corsHeaders });
        }

        // 2. Get verified Oportunidades (p_model >= 0.80, odds >= 1.40, result WON or LOST)
        const { data: picks, error: picksErr } = await supabase
            .from('value_picks_v2')
            .select('id, fixture_id, market, selection, p_model, odds, result, confidence, engine_version, verified_at')
            .in('fixture_id', fixtureIds)
            .gte('p_model', 0.80)
            .gte('odds', 1.40)
            .in('result', ['WON', 'LOST'])
            .order('verified_at', { ascending: true });

        if (picksErr) throw picksErr;

        const allPicks = (picks || []) as PickRow[];
        const totalWon = allPicks.filter(p => p.result === 'WON').length;
        const totalLost = allPicks.filter(p => p.result === 'LOST').length;

        // Also count PENDING picks
        const { count: pendingCount } = await supabase
            .from('value_picks_v2')
            .select('id', { count: 'exact', head: true })
            .in('fixture_id', fixtureIds)
            .gte('p_model', 0.80)
            .gte('odds', 1.40)
            .eq('result', 'PENDING');

        // ═══════════════════════════════════════════════════════════════
        // DIMENSION 1: By Market
        // ═══════════════════════════════════════════════════════════════
        const byMarket: Record<string, { won: number; lost: number; winRate: number; roi: number; avgOdds: number; avgProb: number; totalOdds: number; totalProb: number }> = {};
        for (const p of allPicks) {
            const market = p.market || 'unknown';
            if (!byMarket[market]) byMarket[market] = { won: 0, lost: 0, winRate: 0, roi: 0, avgOdds: 0, avgProb: 0, totalOdds: 0, totalProb: 0 };
            if (p.result === 'WON') byMarket[market].won++;
            else byMarket[market].lost++;
            byMarket[market].totalOdds += p.odds || 0;
            byMarket[market].totalProb += (p.p_model > 1 ? p.p_model : p.p_model * 100);
        }
        for (const key of Object.keys(byMarket)) {
            const m = byMarket[key];
            const total = m.won + m.lost;
            m.winRate = total > 0 ? Math.round((m.won / total) * 100 * 10) / 10 : 0;
            m.avgOdds = total > 0 ? Math.round((m.totalOdds / total) * 100) / 100 : 0;
            m.avgProb = total > 0 ? Math.round((m.totalProb / total) * 10) / 10 : 0;
            m.roi = calculateROI(m.won, m.lost, m.avgOdds);
            m.roi = Math.round(m.roi * 10) / 10;
            delete (m as any).totalOdds;
            delete (m as any).totalProb;
        }

        // ═══════════════════════════════════════════════════════════════
        // DIMENSION 2: By League
        // ═══════════════════════════════════════════════════════════════
        const byLeague: Record<string, { won: number; lost: number; winRate: number; roi: number; avgOdds: number; totalOdds: number }> = {};
        for (const p of allPicks) {
            const match = matchMap.get(p.fixture_id);
            const league = match?.league_name || 'Desconocida';
            if (!byLeague[league]) byLeague[league] = { won: 0, lost: 0, winRate: 0, roi: 0, avgOdds: 0, totalOdds: 0 };
            if (p.result === 'WON') byLeague[league].won++;
            else byLeague[league].lost++;
            byLeague[league].totalOdds += p.odds || 0;
        }
        for (const key of Object.keys(byLeague)) {
            const l = byLeague[key];
            const total = l.won + l.lost;
            l.winRate = total > 0 ? Math.round((l.won / total) * 100 * 10) / 10 : 0;
            l.avgOdds = total > 0 ? Math.round((l.totalOdds / total) * 100) / 100 : 0;
            l.roi = calculateROI(l.won, l.lost, l.avgOdds);
            l.roi = Math.round(l.roi * 10) / 10;
            delete (l as any).totalOdds;
        }

        // ═══════════════════════════════════════════════════════════════
        // DIMENSION 3: By Odds Range
        // ═══════════════════════════════════════════════════════════════
        const byOddsRange: Record<string, { won: number; lost: number; winRate: number; roi: number; avgOdds: number; totalOdds: number }> = {};
        for (const p of allPicks) {
            const range = getOddsRange(p.odds);
            if (!byOddsRange[range]) byOddsRange[range] = { won: 0, lost: 0, winRate: 0, roi: 0, avgOdds: 0, totalOdds: 0 };
            if (p.result === 'WON') byOddsRange[range].won++;
            else byOddsRange[range].lost++;
            byOddsRange[range].totalOdds += p.odds || 0;
        }
        for (const key of Object.keys(byOddsRange)) {
            const r = byOddsRange[key];
            const total = r.won + r.lost;
            r.winRate = total > 0 ? Math.round((r.won / total) * 100 * 10) / 10 : 0;
            r.avgOdds = total > 0 ? Math.round((r.totalOdds / total) * 100) / 100 : 0;
            r.roi = calculateROI(r.won, r.lost, r.avgOdds);
            r.roi = Math.round(r.roi * 10) / 10;
            delete (r as any).totalOdds;
        }

        // ═══════════════════════════════════════════════════════════════
        // DIMENSION 4: By Probability Band
        // ═══════════════════════════════════════════════════════════════
        const byProbBand: Record<string, { won: number; lost: number; winRate: number; predictedWinRate: number; gap: number; totalProb: number }> = {};
        for (const p of allPicks) {
            const band = getProbBand(p.p_model);
            if (!byProbBand[band]) byProbBand[band] = { won: 0, lost: 0, winRate: 0, predictedWinRate: 0, gap: 0, totalProb: 0 };
            if (p.result === 'WON') byProbBand[band].won++;
            else byProbBand[band].lost++;
            byProbBand[band].totalProb += (p.p_model > 1 ? p.p_model : p.p_model * 100);
        }
        for (const key of Object.keys(byProbBand)) {
            const b = byProbBand[key];
            const total = b.won + b.lost;
            b.winRate = total > 0 ? Math.round((b.won / total) * 100 * 10) / 10 : 0;
            b.predictedWinRate = total > 0 ? Math.round((b.totalProb / total) * 10) / 10 : 0;
            b.gap = Math.round((b.predictedWinRate - b.winRate) * 10) / 10;
            delete (b as any).totalProb;
        }

        // ═══════════════════════════════════════════════════════════════
        // DIMENSION 5: By Confidence Level
        // ═══════════════════════════════════════════════════════════════
        const byConfidence: Record<string, { won: number; lost: number; winRate: number }> = {};
        for (const p of allPicks) {
            const label = getConfidenceLabel(p.confidence || 5);
            if (!byConfidence[label]) byConfidence[label] = { won: 0, lost: 0, winRate: 0 };
            if (p.result === 'WON') byConfidence[label].won++;
            else byConfidence[label].lost++;
        }
        for (const key of Object.keys(byConfidence)) {
            const c = byConfidence[key];
            const total = c.won + c.lost;
            c.winRate = total > 0 ? Math.round((c.won / total) * 100 * 10) / 10 : 0;
        }

        // ═══════════════════════════════════════════════════════════════
        // DIMENSION 6: Calibration (overall predicted vs actual)
        // ═══════════════════════════════════════════════════════════════
        let totalPredictedProb = 0;
        for (const p of allPicks) {
            totalPredictedProb += (p.p_model > 1 ? p.p_model : p.p_model * 100);
        }
        const avgPredicted = allPicks.length > 0 ? Math.round((totalPredictedProb / allPicks.length) * 10) / 10 : 0;
        const actualWinRate = (totalWon + totalLost) > 0 ? Math.round((totalWon / (totalWon + totalLost)) * 100 * 10) / 10 : 0;
        const overconfidenceGap = Math.round((avgPredicted - actualWinRate) * 10) / 10;

        const calibration = {
            avgPredictedProb: avgPredicted,
            actualWinRate,
            overconfidenceGap,
            message: overconfidenceGap > 15
                ? `ALERTA: El AI predice ${avgPredicted}% pero gana ${actualWinRate}% — sobreconfianza de ${overconfidenceGap} puntos. Requiere recalibración urgente.`
                : overconfidenceGap > 5
                ? `PRECAUCIÓN: Sobreconfianza moderada (${overconfidenceGap} puntos). Considerar ajustar tiers.`
                : `OK: Calibración aceptable (gap de ${overconfidenceGap} puntos).`,
        };

        // ═══════════════════════════════════════════════════════════════
        // DIMENSION 7: Losing Patterns (market × league, market × odds)
        // ═══════════════════════════════════════════════════════════════
        const patternStats: Record<string, { won: number; lost: number }> = {};
        for (const p of allPicks) {
            const match = matchMap.get(p.fixture_id);
            const league = match?.league_name || 'Desconocida';
            const market = p.market || 'unknown';
            const oddsRange = getOddsRange(p.odds);

            // market × league
            const key1 = `${market} en ${league}`;
            if (!patternStats[key1]) patternStats[key1] = { won: 0, lost: 0 };
            if (p.result === 'WON') patternStats[key1].won++;
            else patternStats[key1].lost++;

            // market × odds range
            const key2 = `${market} con odds ${oddsRange}`;
            if (!patternStats[key2]) patternStats[key2] = { won: 0, lost: 0 };
            if (p.result === 'WON') patternStats[key2].won++;
            else patternStats[key2].lost++;
        }

        // Filter: only patterns with >=3 total picks and winRate < 40%
        const losingPatterns = Object.entries(patternStats)
            .map(([pattern, stats]) => ({
                pattern,
                won: stats.won,
                lost: stats.lost,
                total: stats.won + stats.lost,
                winRate: Math.round((stats.won / (stats.won + stats.lost)) * 100 * 10) / 10,
            }))
            .filter(p => p.total >= 3 && p.winRate < 40)
            .sort((a, b) => a.winRate - b.winRate)
            .slice(0, 10);

        // ═══════════════════════════════════════════════════════════════
        // BONUS: By Engine Version
        // ═══════════════════════════════════════════════════════════════
        const byEngineVersion: Record<string, { won: number; lost: number; winRate: number }> = {};
        for (const p of allPicks) {
            const ver = p.engine_version || 'unknown';
            if (!byEngineVersion[ver]) byEngineVersion[ver] = { won: 0, lost: 0, winRate: 0 };
            if (p.result === 'WON') byEngineVersion[ver].won++;
            else byEngineVersion[ver].lost++;
        }
        for (const key of Object.keys(byEngineVersion)) {
            const v = byEngineVersion[key];
            const total = v.won + v.lost;
            v.winRate = total > 0 ? Math.round((v.won / total) * 100 * 10) / 10 : 0;
        }

        // Financial summary
        const avgOdds = allPicks.length > 0
            ? allPicks.reduce((sum, p) => sum + (p.odds || 0), 0) / allPicks.length
            : 0;
        const overallROI = calculateROI(totalWon, totalLost, avgOdds);

        const result = {
            period: { startDate, endDate },
            summary: {
                total_picks: allPicks.length,
                pending_picks: pendingCount || 0,
                won: totalWon,
                lost: totalLost,
                winRate: actualWinRate,
                roi: Math.round(overallROI * 10) / 10,
                avgOdds: Math.round(avgOdds * 100) / 100,
                avgPredictedProb: avgPredicted,
            },
            by_market: byMarket,
            by_league: byLeague,
            by_odds_range: byOddsRange,
            by_probability_band: byProbBand,
            by_confidence: byConfidence,
            calibration,
            losing_patterns: losingPatterns,
            by_engine_version: byEngineVersion,
        };

        console.log(`[performance-analyzer] Done: ${allPicks.length} picks analyzed (${totalWon}W/${totalLost}L = ${actualWinRate}%)`);

        return new Response(JSON.stringify(result, null, 2), { headers: corsHeaders });

    } catch (error: any) {
        console.error('[performance-analyzer] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: corsHeaders,
        });
    }
});
