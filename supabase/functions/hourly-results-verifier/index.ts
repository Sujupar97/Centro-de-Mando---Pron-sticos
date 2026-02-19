// supabase/functions/hourly-results-verifier/index.ts
// Hourly Results Verification Engine V1
// CRON: Every hour (0 * * * *) — verifies picks and parlays using SportMonks API
// Falls back to Gemini for complex markets (corners, cards, handicaps, combined markets)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'
import { getFixtureComplete } from '../_shared/sportmonks-client.ts'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface VerificationResult {
    pickId: string;
    result: 'WON' | 'LOST' | 'VOID' | 'PUSH' | null;
    actualScore: string;
    method: 'rule-based' | 'gemini' | 'skip';
}

// ═══════════════════════════════════════════════════════════════
// STAKING MODEL — Flat percentages
// Oportunidades: 4% del bankroll | Parlays: 1% del bankroll
// ═══════════════════════════════════════════════════════════════
function calculateStake(pickType: 'oportunidad' | 'parlay'): { percentage: number; tier: string } {
    return pickType === 'parlay'
        ? { percentage: 1, tier: 'parlay-flat' }
        : { percentage: 4, tier: 'oportunidad-flat' };
}

// ═══════════════════════════════════════════════════════════════
// SCORE EXTRACTION FROM SPORTMONKS
// ═══════════════════════════════════════════════════════════════
function extractScores(fixture: any): { homeScore: number | null; awayScore: number | null; status: string } {
    const home = fixture.participants?.find((p: any) => p.meta?.location === 'home');
    const away = fixture.participants?.find((p: any) => p.meta?.location === 'away');

    // Extract CURRENT scores
    const homeScoreEntry = fixture.scores?.find((s: any) =>
        s.description === 'CURRENT' && s.score?.participant === 'home'
    );
    const awayScoreEntry = fixture.scores?.find((s: any) =>
        s.description === 'CURRENT' && s.score?.participant === 'away'
    );

    const homeScore = homeScoreEntry?.score?.goals ?? null;
    const awayScore = awayScoreEntry?.score?.goals ?? null;

    // Get match status from state
    const status = fixture.state?.short_name || 'NS';

    return { homeScore, awayScore, status };
}

// Extract stats from SportMonks fixture (type_ids from docs)
function extractStats(fixture: any): {
    homeCorners: number | null; awayCorners: number | null;
    homeYellowCards: number | null; awayYellowCards: number | null;
    homeRedCards: number | null; awayRedCards: number | null;
    homeShotsOnTarget: number | null; awayShotsOnTarget: number | null;
} {
    const home = fixture.participants?.find((p: any) => p.meta?.location === 'home');
    const away = fixture.participants?.find((p: any) => p.meta?.location === 'away');
    const homeId = home?.id;
    const awayId = away?.id;

    const findStat = (typeId: number, teamId: number): number | null => {
        const stat = fixture.statistics?.find((s: any) => s.participant_id === teamId && s.type_id === typeId);
        return stat?.data?.value ?? null;
    };

    return {
        homeCorners: findStat(34, homeId),       // Corners
        awayCorners: findStat(34, awayId),
        homeYellowCards: findStat(84, homeId),   // Yellow Cards
        awayYellowCards: findStat(84, awayId),
        homeRedCards: findStat(83, homeId),       // Red Cards
        awayRedCards: findStat(83, awayId),
        homeShotsOnTarget: findStat(86, homeId), // Shots On Target
        awayShotsOnTarget: findStat(86, awayId),
    };
}

// ═══════════════════════════════════════════════════════════════
// SUB-CONDITION EVALUATOR (for combined/combo markets)
// ═══════════════════════════════════════════════════════════════
function evaluateSubCondition(
    part: string,
    homeScore: number,
    awayScore: number,
    homeWin: boolean,
    awayWin: boolean,
    draw: boolean,
    totalGoals: number,
    cleanHT: string,
    cleanAT: string,
    stats: ReturnType<typeof extractStats>
): boolean | null {
    const p = part.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // Over/Under check
    const ouMatch = p.match(/(mas|menos|over|under|más|\+|\-)\s*(de\s+)?(\d+(\.\d+)?)/i);
    if (ouMatch) {
        const type = ouMatch[1].toLowerCase();
        const line = parseFloat(ouMatch[3]);
        const isOver = ['mas', 'over', '+', 'más'].some(t => type.includes(t));
        return isOver ? totalGoals > line : totalGoals < line;
    }

    // BTTS
    if (p.includes('ambos') || p.includes('btts') || p.includes('both teams')) {
        const both = homeScore > 0 && awayScore > 0;
        if (p.includes('no')) return !both;
        return both;
    }

    // Draw / Empate
    if (p === 'empate' || p === 'draw' || p === 'x') return draw;

    // Double chance patterns
    if (p.includes('1x') || (p.includes('local') && p.includes('empate'))) return homeWin || draw;
    if (p.includes('x2') || (p.includes('visita') && p.includes('empate')) || (p.includes('visitante') && p.includes('empate'))) return awayWin || draw;

    // Team win (gana + team name)
    if (p.includes('gana') || p.includes('win')) {
        if (cleanHT && p.includes(cleanHT)) return homeWin;
        if (cleanAT && p.includes(cleanAT)) return awayWin;
    }

    // Double Chance via "/" separator: "TeamA/Draw", "Home/Draw", "Local/Empate", etc.
    if (p.includes('/')) {
        const slashParts = p.split('/').map(sp => sp.trim());
        if (slashParts.length === 2) {
            const subResults: boolean[] = [];
            for (const sp of slashParts) {
                if (sp === 'empate' || sp === 'draw' || sp === 'x') {
                    subResults.push(draw);
                } else if (sp === 'local' || sp === 'home') {
                    subResults.push(homeWin);
                } else if (sp === 'visitante' || sp === 'visita' || sp === 'away') {
                    subResults.push(awayWin);
                } else if (cleanHT && sp.includes(cleanHT)) {
                    subResults.push(homeWin);
                } else if (cleanAT && sp.includes(cleanAT)) {
                    subResults.push(awayWin);
                } else {
                    return null; // Can't determine → Gemini fallback
                }
            }
            return subResults.some(r => r === true); // OR logic for double chance
        }
    }

    // Team name alone = team wins
    if (cleanHT && p.includes(cleanHT)) return homeWin;
    if (cleanAT && p.includes(cleanAT)) return awayWin;

    // Portería a cero / Clean sheet
    if (p.includes('porteria a cero') || p.includes('clean sheet')) {
        if (p.includes('no') || p.includes('no marcara')) {
            // "Team NO marcará" = other team clean sheet
            if (cleanHT && p.includes(cleanHT)) return awayScore === 0;
            if (cleanAT && p.includes(cleanAT)) return homeScore === 0;
        }
        if (cleanHT && p.includes(cleanHT)) return awayScore === 0;
        if (cleanAT && p.includes(cleanAT)) return homeScore === 0;
    }

    // Can't determine
    return null;
}

// ═══════════════════════════════════════════════════════════════
// RULE-BASED EVALUATION ENGINE
// ═══════════════════════════════════════════════════════════════
function evaluatePickResult(
    market: string,
    selection: string,
    homeScore: number,
    awayScore: number,
    homeTeam: string,
    awayTeam: string,
    stats: ReturnType<typeof extractStats>
): boolean | null {
    const m = (market || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const s = (selection || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanHT = (homeTeam || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanAT = (awayTeam || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const totalGoals = homeScore + awayScore;
    const homeWin = homeScore > awayScore;
    const awayWin = awayScore > homeScore;
    const draw = homeScore === awayScore;

    // ═══ COMBINED/COMBO MARKETS (must be checked FIRST) ═══
    // Detect combined markets: "Team Win & Over X.5", "BTTS & Over X.5", "1X & Over X.5", etc.
    const isCombined = m.includes('combinado') || m.includes('combo') || m.includes('combined') ||
        (s.includes('&') || s.includes(' y ') || s.includes(' and '));

    if (isCombined) {
        // Split selection into parts by & / y / and
        const parts = s.split(/\s*[&]\s*|\s+y\s+|\s+and\s+/i).map(p => p.trim());
        if (parts.length >= 2) {
            const results: (boolean | null)[] = [];
            for (const part of parts) {
                // Evaluate each sub-condition independently
                const subResult = evaluateSubCondition(part, homeScore, awayScore, homeWin, awayWin, draw, totalGoals, cleanHT, cleanAT, stats);
                if (subResult === null) return null; // Can't evaluate → Gemini fallback
                results.push(subResult);
            }
            // Combined = ALL conditions must be true
            return results.every(r => r === true);
        }
        // Fallthrough if we couldn't split properly
    }

    // ═══ BTTS (Both Teams To Score) ═══
    if (m.includes('ambos') || m.includes('btts') || m.includes('marcan') || m.includes('both teams')) {
        const both = homeScore > 0 && awayScore > 0;
        if (s.includes('no') || s.includes('no')) return !both;
        return both;
    }

    // ═══ Over/Under Goals ═══
    const ouMatch = s.match(/(mas|menos|over|under|más|\+|\-)\s*(de\s+)?(\d+(\.\d+)?)/i);
    if (ouMatch) {
        const type = ouMatch[1].toLowerCase();
        const line = parseFloat(ouMatch[3]);

        // Check if it's about corners
        if (m.includes('corner') || m.includes('esquina')) {
            const totalCorners = (stats.homeCorners ?? 0) + (stats.awayCorners ?? 0);
            if (stats.homeCorners === null && stats.awayCorners === null) return null; // No data

            // Check team-specific corners
            if (m.includes('local') || m.includes('home') || s.includes(cleanHT)) {
                if (stats.homeCorners === null) return null;
                return ['mas', 'over', '+', 'más'].some(t => type.includes(t)) ? stats.homeCorners > line : stats.homeCorners < line;
            }
            if (m.includes('visita') || m.includes('away') || s.includes(cleanAT)) {
                if (stats.awayCorners === null) return null;
                return ['mas', 'over', '+', 'más'].some(t => type.includes(t)) ? stats.awayCorners > line : stats.awayCorners < line;
            }

            // Total corners
            if (['mas', 'over', '+', 'más'].some(t => type.includes(t))) return totalCorners > line;
            if (['menos', 'under', '-'].some(t => type.includes(t))) return totalCorners < line;
        }

        // Check if it's about cards
        if (m.includes('tarjeta') || m.includes('card')) {
            const totalCards = (stats.homeYellowCards ?? 0) + (stats.awayYellowCards ?? 0) +
                             (stats.homeRedCards ?? 0) + (stats.awayRedCards ?? 0);
            if (stats.homeYellowCards === null && stats.awayYellowCards === null) return null;

            if (['mas', 'over', '+', 'más'].some(t => type.includes(t))) return totalCards > line;
            if (['menos', 'under', '-'].some(t => type.includes(t))) return totalCards < line;
        }

        // Check if it's Team Total Goals
        const isTeamTotal = m.includes('equipo') || m.includes('team total') ||
            m.includes('goles del') || m.includes('totales del') ||
            m.includes('team goals') || m.includes('local anota') || m.includes('visita anota') ||
            m.includes('home over') || m.includes('away over');

        if (isTeamTotal) {
            const isHome = m.includes('local') || m.includes('home') || m.includes('casa') ||
                (cleanHT && (m.includes(cleanHT) || s.includes(cleanHT)));
            const isAway = m.includes('visita') || m.includes('away') || m.includes('visitante') ||
                (cleanAT && (m.includes(cleanAT) || s.includes(cleanAT)));

            const teamGoals = isHome ? homeScore : (isAway ? awayScore : null);
            if (teamGoals === null) return null;

            if (['mas', 'over', '+', 'más'].some(t => type.includes(t))) return teamGoals > line;
            if (['menos', 'under', '-'].some(t => type.includes(t))) return teamGoals < line;
        }

        // Standard total goals Over/Under
        if (['mas', 'over', '+', 'más'].some(t => type.includes(t))) return totalGoals > line;
        if (['menos', 'under', '-'].some(t => type.includes(t))) return totalGoals < line;
    }

    // ═══ Simple Over/Under by market name (e.g., "over_2.5_goals") ═══
    const marketOU = m.match(/(over|under)_(\d+(\.\d+)?)_(goals|goles)/);
    if (marketOU) {
        const overUnder = marketOU[1];
        const line = parseFloat(marketOU[2]);
        return overUnder === 'over' ? totalGoals > line : totalGoals < line;
    }

    // ═══ Home/Away Over 0.5 (Team Scores) ═══
    if (m === 'home_over_0.5' || m.includes('local anota')) return homeScore > 0;
    if (m === 'away_over_0.5' || m.includes('visita anota')) return awayScore > 0;

    // ═══ 1X2 / Double Chance ═══
    // Double chance first (more specific)
    if (m.includes('double_chance') || m.includes('doble oportunidad') || m.includes('doble chance')) {
        if (s.includes('1x') || (s.includes('local') && s.includes('empate'))) return homeWin || draw;
        if (s.includes('x2') || (s.includes('visita') && s.includes('empate')) || (s.includes('visitante') && s.includes('empate'))) return awayWin || draw;
        if (s.includes('12')) return homeWin || awayWin;
    }

    // 1X2 via selection
    if (s.includes('1x') || (s.includes('local') && s.includes('empate'))) return homeWin || draw;
    if (s.includes('x2') || (s.includes('visita') && s.includes('empate')) || (s.includes('visitante') && s.includes('empate'))) return awayWin || draw;
    if (s.includes('12') && !s.includes('1.2')) return homeWin || awayWin;

    // Simple 1X2
    if (m.includes('home_win') || m === '1x2') {
        if (s.includes('local') || s.includes('home') || s === '1' || s.includes('gana local')) return homeWin;
        if (s.includes('visita') || s.includes('away') || s === '2' || s.includes('gana visita')) return awayWin;
        if (s.includes('empate') || s.includes('draw') || s === 'x') return draw;
    }
    if (m === 'home_win') return homeWin;
    if (m === 'away_win') return awayWin;
    if (m === 'draw') return draw;

    // Generic 1X2 detection
    if (s === 'local' || s === 'home' || s === '1' || s.includes('gana local')) return homeWin;
    if (s === 'visitante' || s === 'visita' || s === 'away' || s === '2' || s.includes('gana visita')) return awayWin;
    if (s === 'empate' || s === 'draw' || s === 'x') return draw;

    // ═══ Draw No Bet ═══
    if (m.includes('draw no bet') || m.includes('empate no accion') || m.includes('empate no apuesta')) {
        // Draw = VOID (money back). Team wins = WON. Other team wins = LOST.
        if (draw) return null; // VOID — will be handled by caller
        if (cleanHT && s.includes(cleanHT)) return homeWin;
        if (cleanAT && s.includes(cleanAT)) return awayWin;
        if (s.includes('local') || s.includes('home')) return homeWin;
        if (s.includes('visita') || s.includes('away') || s.includes('visitante')) return awayWin;
    }

    // ═══ Clean Sheet / Portería a Cero ═══
    if (m.includes('porteria a cero') || m.includes('clean sheet') || m.includes('porteria')) {
        if (s.includes('no')) {
            // "TeamX NO marcará" = opponent clean sheet
            if (cleanHT && s.includes(cleanHT)) return awayScore === 0;
            if (cleanAT && s.includes(cleanAT)) return homeScore === 0;
        }
        if (cleanHT && s.includes(cleanHT)) return awayScore === 0;
        if (cleanAT && s.includes(cleanAT)) return homeScore === 0;
    }

    // ═══ Ganador del Partido (1X2 with team name in market) ═══
    if (m.includes('ganador') || m.includes('1x2') || m.includes('winner') ||
        m.includes('resultado') || m.includes('match result')) {
        if (cleanHT && s.includes(cleanHT)) return homeWin;
        if (cleanAT && s.includes(cleanAT)) return awayWin;
        if (s.includes('empate') || s.includes('draw') || s === 'x') return draw;
    }

    // Team name matching for 1X2 (last resort for simple team picks)
    if (cleanHT && s.includes(cleanHT)) return homeWin;
    if (cleanAT && s.includes(cleanAT)) return awayWin;

    // ═══ Cannot determine → return null for Gemini fallback ═══
    return null;
}

// ═══════════════════════════════════════════════════════════════
// GEMINI FALLBACK FOR COMPLEX MARKETS
// ═══════════════════════════════════════════════════════════════
async function evaluateWithGemini(
    market: string,
    selection: string,
    homeTeam: string,
    awayTeam: string,
    homeScore: number,
    awayScore: number,
    stats: ReturnType<typeof extractStats>
): Promise<boolean | null> {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
        console.warn('[Verifier] No GEMINI_API_KEY, skipping Gemini fallback');
        return null;
    }

    const prompt = `You are a sports betting verification system. Determine if the following prediction was WON or LOST based on the actual match result.

PREDICTION:
- Market: ${market}
- Selection: ${selection}
- Home Team: ${homeTeam}
- Away Team: ${awayTeam}

ACTUAL RESULT:
- Final Score: ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}
- Home Corners: ${stats.homeCorners ?? 'N/A'}
- Away Corners: ${stats.awayCorners ?? 'N/A'}
- Home Yellow Cards: ${stats.homeYellowCards ?? 'N/A'}
- Away Yellow Cards: ${stats.awayYellowCards ?? 'N/A'}
- Home Red Cards: ${stats.homeRedCards ?? 'N/A'}
- Away Red Cards: ${stats.awayRedCards ?? 'N/A'}

Answer ONLY with one word: WON, LOST, or VOID (if the bet is cancelled/pushed).`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0, maxOutputTokens: 10 }
                }),
                signal: controller.signal
            }
        );

        clearTimeout(timeout);

        if (!response.ok) {
            console.error(`[Verifier] Gemini API error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const answer = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toUpperCase();

        if (answer.includes('WON') || answer.includes('WIN')) return true;
        if (answer.includes('LOST') || answer.includes('LOSE')) return false;
        if (answer.includes('VOID') || answer.includes('PUSH')) return null; // Will be treated as VOID

        console.warn(`[Verifier] Gemini unclear answer: "${answer}"`);
        return null;
    } catch (err: any) {
        console.error(`[Verifier] Gemini fallback error: ${err.message}`);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        // Parse optional date from request body
        let reqBody: any = {};
        try { reqBody = await req.json().catch(() => ({})); } catch { /* ignore */ }

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
        const datesToCheck = reqBody?.date
            ? (Array.isArray(reqBody.date) ? reqBody.date : [reqBody.date])
            : [today, yesterday, twoDaysAgo];

        log(`[Verifier] Starting verification for dates: ${datesToCheck.join(', ')}`);

        // Create verification run log
        const { data: runData } = await supabase
            .from('verification_runs')
            .insert({ run_date: today, status: 'running' })
            .select('id')
            .single();
        const runId = runData?.id;

        let totalFixturesChecked = 0;
        let totalPicksVerified = 0;
        let totalParlaysVerified = 0;
        let totalGeminiCalls = 0;
        const MAX_GEMINI_CALLS = 5;

        for (const checkDate of datesToCheck) {
            log(`[Verifier] ═══ Processing date: ${checkDate} ═══`);

            // ───────────────────────────────────────────────────────────
            // STEP 1: Find pending value_picks_v2 for this date range
            // ───────────────────────────────────────────────────────────
            // Get fixture_ids from daily_matches for this date
            const { data: dailyMatches } = await supabase
                .from('daily_matches')
                .select('api_fixture_id, home_team, away_team, league_name, match_status, home_score, away_score')
                .eq('match_date', checkDate);

            if (!dailyMatches || dailyMatches.length === 0) {
                log(`[Verifier] No matches found for ${checkDate}`);
                continue;
            }

            const fixtureIds = dailyMatches.map(m => m.api_fixture_id);
            const matchMap = new Map<number, any>();
            dailyMatches.forEach(m => matchMap.set(m.api_fixture_id, m));

            // Get pending picks for these fixtures
            const { data: pendingPicks } = await supabase
                .from('value_picks_v2')
                .select('id, job_id, fixture_id, market, selection, p_model, odds, confidence')
                .in('fixture_id', fixtureIds)
                .eq('result', 'PENDING');

            if (!pendingPicks || pendingPicks.length === 0) {
                log(`[Verifier] No pending picks for ${checkDate} (${dailyMatches.length} matches)`);
                continue;
            }

            log(`[Verifier] ${pendingPicks.length} pending picks across ${dailyMatches.length} matches`);

            // ───────────────────────────────────────────────────────────
            // STEP 2: Get unique fixture IDs that need score checking
            // ───────────────────────────────────────────────────────────
            const uniqueFixtureIds = [...new Set(pendingPicks.map(p => p.fixture_id))];
            const finishedStatuses = ['FT', 'AET', 'PEN', 'POSTP', 'POST', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

            // Get current bankroll ONCE before processing fixtures
            const { data: lastBankroll } = await supabase
                .from('profitability_tracking')
                .select('bankroll_after')
                .not('bankroll_after', 'is', null)
                .neq('result', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            let runningBankroll = lastBankroll?.bankroll_after || 100;

            for (const fixtureId of uniqueFixtureIds) {
                const match = matchMap.get(fixtureId);
                if (!match) continue;

                let homeScore = match.home_score;
                let awayScore = match.away_score;
                let matchStatus = match.match_status;
                let fixtureData: any = null;

                // If match not yet finished in our DB, fetch from SportMonks
                if (!finishedStatuses.includes(matchStatus)) {
                    log(`[Verifier] Fetching fixture ${fixtureId} from SportMonks (status: ${matchStatus})`);
                    fixtureData = await getFixtureComplete(fixtureId);

                    if (!fixtureData) {
                        log(`[Verifier] Could not fetch fixture ${fixtureId}, skipping`);
                        continue;
                    }

                    const extracted = extractScores(fixtureData);
                    matchStatus = extracted.status;

                    // Update daily_matches with latest scores
                    if (extracted.homeScore !== null && extracted.awayScore !== null) {
                        homeScore = extracted.homeScore;
                        awayScore = extracted.awayScore;

                        await supabase
                            .from('daily_matches')
                            .update({
                                home_score: homeScore,
                                away_score: awayScore,
                                match_status: matchStatus
                            })
                            .eq('api_fixture_id', fixtureId)
                            .eq('match_date', checkDate);

                        log(`[Verifier] Updated daily_matches: ${match.home_team} ${homeScore}-${awayScore} ${match.away_team} (${matchStatus})`);
                    }

                    totalFixturesChecked++;

                    // Rate limit: 100ms between SportMonks calls
                    await new Promise(r => setTimeout(r, 100));
                }

                // VOID picks for postponed/cancelled/abandoned matches
                const voidStatuses = ['POSTP', 'POST', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];
                if (voidStatuses.includes(matchStatus)) {
                    const voidPicks = pendingPicks.filter(p => p.fixture_id === fixtureId);
                    for (const pick of voidPicks) {
                        await supabase.from('value_picks_v2')
                            .update({ result: 'VOID', verified_at: new Date().toISOString(), actual_score: matchStatus })
                            .eq('id', pick.id);
                        await supabase.from('pick_results_v2')
                            .upsert({ pick_id: pick.id, fixture_id: fixtureId, result: 'VOID', actual_score: matchStatus,
                                league_name: match.league_name, home_team: match.home_team, away_team: match.away_team,
                                verified_at: new Date().toISOString() }, { onConflict: 'pick_id' });
                        totalPicksVerified++;
                        log(`[Verifier] VOID (${matchStatus}): ${match.home_team} vs ${match.away_team} | ${pick.market}`);
                    }
                    continue;
                }

                // Skip if match not finished yet (still playing or not started)
                if (!['FT', 'AET', 'PEN'].includes(matchStatus)) {
                    continue;
                }

                if (homeScore === null || awayScore === null) continue;

                // ───────────────────────────────────────────────────────────
                // STEP 3: Evaluate each pending pick for this fixture
                // ───────────────────────────────────────────────────────────
                const fixturePicks = pendingPicks.filter(p => p.fixture_id === fixtureId);
                const actualScore = `${homeScore}-${awayScore}`;

                // Extract stats if we fetched the fixture
                let matchStats = {
                    homeCorners: null as number | null, awayCorners: null as number | null,
                    homeYellowCards: null as number | null, awayYellowCards: null as number | null,
                    homeRedCards: null as number | null, awayRedCards: null as number | null,
                    homeShotsOnTarget: null as number | null, awayShotsOnTarget: null as number | null,
                };

                if (fixtureData) {
                    matchStats = extractStats(fixtureData);
                } else {
                    // If we didn't fetch (match already finished in DB), fetch now for stats
                    const fullData = await getFixtureComplete(fixtureId);
                    if (fullData) {
                        matchStats = extractStats(fullData);
                        totalFixturesChecked++;
                        await new Promise(r => setTimeout(r, 100));
                    }
                }

                for (const pick of fixturePicks) {
                    // Try rule-based evaluation first
                    let isWon = evaluatePickResult(
                        pick.market,
                        pick.selection,
                        homeScore,
                        awayScore,
                        match.home_team,
                        match.away_team,
                        matchStats
                    );

                    let method: 'rule-based' | 'gemini' | 'skip' = 'rule-based';

                    // Gemini fallback for complex markets
                    if (isWon === null && totalGeminiCalls < MAX_GEMINI_CALLS) {
                        log(`[Verifier] Gemini fallback for: ${pick.market} | ${pick.selection}`);
                        isWon = await evaluateWithGemini(
                            pick.market,
                            pick.selection,
                            match.home_team,
                            match.away_team,
                            homeScore,
                            awayScore,
                            matchStats
                        );
                        totalGeminiCalls++;
                        method = 'gemini';
                    }

                    if (isWon === null) {
                        log(`[Verifier] SKIP: Cannot evaluate ${pick.market} | ${pick.selection}`);
                        // Mark as VOID if we truly can't determine
                        await supabase
                            .from('value_picks_v2')
                            .update({
                                result: 'VOID',
                                verified_at: new Date().toISOString(),
                                actual_score: actualScore
                            })
                            .eq('id', pick.id);
                        continue;
                    }

                    const result = isWon ? 'WON' : 'LOST';

                    // Update value_picks_v2
                    await supabase
                        .from('value_picks_v2')
                        .update({
                            result,
                            verified_at: new Date().toISOString(),
                            actual_score: actualScore
                        })
                        .eq('id', pick.id);

                    // Insert/update pick_results_v2
                    await supabase
                        .from('pick_results_v2')
                        .upsert({
                            pick_id: pick.id,
                            fixture_id: fixtureId,
                            result,
                            actual_score: actualScore,
                            league_name: match.league_name,
                            home_team: match.home_team,
                            away_team: match.away_team,
                            verified_at: new Date().toISOString()
                        }, { onConflict: 'pick_id' });

                    // ───────────────────────────────────────────────────────
                    // STEP 4: Update profitability_tracking
                    // ONLY for Oportunidades: p_model >= 0.80 AND odds >= 1.40
                    // ───────────────────────────────────────────────────────
                    try {
                        const pickProb = pick.p_model > 1 ? pick.p_model / 100 : pick.p_model;
                        const isOportunidad = pickProb >= 0.80 && pick.odds && pick.odds >= 1.40;

                        if (isOportunidad) {
                            const pickIdentifier = `${pick.job_id}_${pick.market}_${pick.selection}`;

                            // Check if ALREADY exists in profitability_tracking (any result)
                            const { data: existingAny } = await supabase
                                .from('profitability_tracking')
                                .select('id, result, stake_amount, odds')
                                .eq('fixture_id', fixtureId)
                                .or(`pick_id.eq.${pickIdentifier},pick_id.eq.vp_${pickIdentifier}`)
                                .limit(1)
                                .maybeSingle();

                            if (existingAny) {
                                // Already tracked — update only if still pending
                                if (existingAny.result === 'pending') {
                                    const profitLoss = isWon
                                        ? existingAny.stake_amount * ((existingAny.odds || 1) - 1)
                                        : -existingAny.stake_amount;
                                    runningBankroll += profitLoss;

                                    await supabase
                                        .from('profitability_tracking')
                                        .update({
                                            result: result.toLowerCase(),
                                            profit_loss: profitLoss,
                                            bankroll_after: runningBankroll,
                                            verified_at: new Date().toISOString()
                                        })
                                        .eq('id', existingAny.id);
                                }
                                // If already verified (won/lost), skip entirely — prevents duplicates
                            } else {
                                // Register + verify in one shot with FLAT staking
                                const { percentage, tier } = calculateStake('oportunidad');
                                const stakeAmount = (runningBankroll * percentage) / 100;
                                const profitLoss = isWon ? stakeAmount * (pick.odds - 1) : -stakeAmount;
                                runningBankroll += profitLoss;

                                await supabase
                                    .from('profitability_tracking')
                                    .insert({
                                        date: checkDate,
                                        pick_id: pickIdentifier,
                                        job_id: pick.job_id,
                                        fixture_id: fixtureId,
                                        home_team: match.home_team,
                                        away_team: match.away_team,
                                        market: pick.market,
                                        selection: pick.selection,
                                        odds: pick.odds,
                                        probability: pickProb * 100,
                                        confidence_tier: tier,
                                        stake_percentage: percentage,
                                        stake_amount: stakeAmount,
                                        result: result.toLowerCase(),
                                        profit_loss: profitLoss,
                                        bankroll_after: runningBankroll,
                                        pick_type: 'oportunidad',
                                        verified_at: new Date().toISOString()
                                    });
                            }
                        }
                    } catch (profitErr: any) {
                        log(`[Verifier] Profitability update failed (non-blocking): ${profitErr.message}`);
                    }

                    totalPicksVerified++;
                    log(`[Verifier] ${result} (${method}): ${match.home_team} vs ${match.away_team} | ${pick.market} → ${pick.selection} | Score: ${actualScore}`);
                }
            }

            // ───────────────────────────────────────────────────────────
            // STEP 5: Verify pending parlays
            // ───────────────────────────────────────────────────────────
            const { data: pendingParlays } = await supabase
                .from('parlay_combos_v2')
                .select('id, picks, status')
                .eq('date', checkDate)
                .eq('status', 'pending');

            if (pendingParlays && pendingParlays.length > 0) {
                for (const parlay of pendingParlays) {
                    const picks = parlay.picks as any[];
                    if (!picks || !Array.isArray(picks)) continue;

                    let won = 0, lost = 0, pending = 0, voided = 0;
                    const updatedPicks = [];

                    for (const leg of picks) {
                        // Check if this pick has been verified in value_picks_v2
                        const { data: vpResult } = await supabase
                            .from('value_picks_v2')
                            .select('result')
                            .eq('fixture_id', leg.fixture_id)
                            .eq('market', leg.market)
                            .eq('selection', leg.selection)
                            .neq('result', 'PENDING')
                            .limit(1)
                            .maybeSingle();

                        if (vpResult) {
                            const legResult = vpResult.result;
                            updatedPicks.push({ ...leg, result: legResult });
                            if (legResult === 'WON') won++;
                            else if (legResult === 'LOST') lost++;
                            else if (legResult === 'VOID' || legResult === 'PUSH') voided++;
                            else pending++;
                        } else {
                            updatedPicks.push({ ...leg, result: 'PENDING' });
                            pending++;
                        }
                    }

                    let parlayStatus = 'pending';
                    if (lost > 0) parlayStatus = 'lost';
                    else if (pending === 0 && won + voided === picks.length) parlayStatus = 'won';
                    else if (pending === 0) parlayStatus = 'partial';

                    if (parlayStatus !== 'pending') {
                        await supabase
                            .from('parlay_combos_v2')
                            .update({
                                status: parlayStatus,
                                picks: updatedPicks,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', parlay.id);

                        totalParlaysVerified++;
                        log(`[Verifier] Parlay ${parlay.id.substring(0, 8)}: ${parlayStatus.toUpperCase()} (${won}W/${lost}L/${pending}P/${voided}V)`);
                    }
                }
            }
        }

        // ───────────────────────────────────────────────────────────
        // STEP 6: Update verification run log
        // ───────────────────────────────────────────────────────────
        const finalStatus = totalPicksVerified > 0 || totalParlaysVerified > 0 ? 'success' : 'partial';

        if (runId) {
            await supabase
                .from('verification_runs')
                .update({
                    completed_at: new Date().toISOString(),
                    fixtures_checked: totalFixturesChecked,
                    picks_verified: totalPicksVerified,
                    parlays_verified: totalParlaysVerified,
                    gemini_calls: totalGeminiCalls,
                    status: finalStatus,
                    details: { dates: datesToCheck, logs: logs.slice(-20) }
                })
                .eq('id', runId);
        }

        log(`[Verifier] ═══ DONE: ${totalFixturesChecked} fixtures checked, ${totalPicksVerified} picks verified, ${totalParlaysVerified} parlays verified, ${totalGeminiCalls} Gemini calls ═══`);

        return new Response(JSON.stringify({
            success: true,
            fixtures_checked: totalFixturesChecked,
            picks_verified: totalPicksVerified,
            parlays_verified: totalParlaysVerified,
            gemini_calls: totalGeminiCalls,
            dates: datesToCheck,
            debug_logs: logs
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (e: any) {
        log(`[Verifier] FATAL ERROR: ${e.message}`);
        return new Response(JSON.stringify({
            success: false,
            error: e.message,
            debug_logs: logs
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
