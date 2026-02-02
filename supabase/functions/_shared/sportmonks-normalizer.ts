// supabase/functions/_shared/sportmonks-normalizer.ts
// Normaliza datos de SportMonks al formato esperado por v3-ai-analyzer

export interface NormalizedPayload {
    match: {
        fixture_id: number;
        date_time_utc: string;
        referee: string | null;
        venue: {
            name: string | null;
            city: string | null;
        };
        competition: {
            id: number;
            name: string;
            country: string;
            round: string | null;
            season_id: number;
        };
        teams: {
            home: { id: number; name: string; logo: string };
            away: { id: number; name: string; logo: string };
        };
        weather?: {
            type: string;
            temperature: number;
        };
    };
    datasets: {
        home_team_last40: { all: any[] };
        away_team_last40: { all: any[] };
        h2h: any[];
        standings: {
            table: any[];
            home_context: any;
            away_context: any;
        };
        injuries: {
            home: any[];
            away: any[];
        };
    };
    odds: any;
    predictions: any;
    value_bets: any[];
    xg: any;
    lineups: any;
}

/**
 * Normalize SportMonks fixture to internal format
 */
export function normalizeFixture(fixture: any): NormalizedPayload['match'] {
    const home = fixture.participants?.find((p: any) => p.meta?.location === 'home');
    const away = fixture.participants?.find((p: any) => p.meta?.location === 'away');

    return {
        fixture_id: fixture.id,
        date_time_utc: fixture.starting_at,
        referee: fixture.referees?.[0]?.common_name || null,
        venue: {
            name: fixture.venue?.name || null,
            city: fixture.venue?.city_name || null
        },
        competition: {
            id: fixture.league?.id || 0,
            name: fixture.league?.name || 'Unknown League',
            country: fixture.league?.country?.name || '',
            round: fixture.round?.name || null,
            season_id: fixture.season_id || 0
        },
        teams: {
            home: {
                id: home?.id || 0,
                name: home?.name || 'Home Team',
                logo: home?.image_path || ''
            },
            away: {
                id: away?.id || 0,
                name: away?.name || 'Away Team',
                logo: away?.image_path || ''
            }
        },
        weather: fixture.weatherReport ? {
            type: fixture.weatherReport.type?.code || 'unknown',
            temperature: fixture.weatherReport.temperature?.temp || 20
        } : undefined
    };
}

/**
 * Normalize match history (last N fixtures)
 */
export function normalizeMatchHistory(fixtures: any[], teamId: number): any[] {
    return fixtures.map((f: any) => {
        const home = f.participants?.find((p: any) => p.meta?.location === 'home');
        const away = f.participants?.find((p: any) => p.meta?.location === 'away');
        const homeScore = f.scores?.find((s: any) => s.description === 'CURRENT')?.score?.participant === 'home'
            ? f.scores?.find((s: any) => s.description === 'CURRENT')?.score?.goals
            : f.scores?.[0]?.score?.home || 0;
        const awayScore = f.scores?.find((s: any) => s.description === 'CURRENT')?.score?.participant === 'away'
            ? f.scores?.find((s: any) => s.description === 'CURRENT')?.score?.goals
            : f.scores?.[0]?.score?.away || 0;

        return {
            fixture_id: f.id,
            date: f.starting_at?.split('T')[0] || '',
            home_team: home?.name || 'Home',
            away_team: away?.name || 'Away',
            home_id: home?.id || 0,
            away_id: away?.id || 0,
            score_home: homeScore,
            score_away: awayScore,
            venue: f.venue?.name || null,
            league: f.league?.name || ''
        };
    });
}

/**
 * Normalize DEEP match history for V4 Mastermind Engine
 * Extracts detailed stats like possession, shots, corners, formations
 */
export function normalizeDetailedMatchHistory(fixtures: any[], teamId: number): any[] {
    return fixtures.map((f: any) => {
        // Basic Info
        const basic = normalizeMatchHistory([f], teamId)[0];
        const isHome = f.participants?.find((p: any) => p.id === teamId)?.meta?.location === 'home';

        // Extract Formations
        const myFormation = f.formations?.find((lm: any) => lm.participant_id === teamId)?.formation || 'Unknown';
        const opponentFormation = f.formations?.find((lm: any) => lm.participant_id !== teamId)?.formation || 'Unknown';

        // Extract Stats (Possession, Shots, Corners, Fouls, Cards)
        const findStat = (typeId: number, team: number) => {
            const stat = f.statistics?.find((s: any) => s.participant_id === team && s.type_id === typeId);
            return stat?.data?.value || 0;
        };

        // SportMonks Type IDs (approximate common ones, check docs if needed)
        // 45=Possession, 57=YellowCards, 83=Cornes, 56=Fouls, 42=ShotsTotal, 86=ShotsOnTarget

        return {
            ...basic,
            details: {
                formation_used: myFormation,
                opponent_formation: opponentFormation,
                possession: findStat(45, teamId),
                shots_total: findStat(42, teamId),
                shots_on_target: findStat(86, teamId),
                corners: findStat(83, teamId),
                yellow_cards: findStat(57, teamId),
                red_cards: f.statistics?.find((s: any) => s.participant_id === teamId && s.type_id === 58)?.data?.value || 0, // 58=RedCaard
                fouls: findStat(56, teamId)
            }
        };
    });
}

/**
 * Normalize H2H fixtures
 */
export function normalizeH2H(fixtures: any[]): any[] {
    return fixtures.map((f: any) => {
        const home = f.participants?.find((p: any) => p.meta?.location === 'home');
        const away = f.participants?.find((p: any) => p.meta?.location === 'away');

        // Extract scores
        let homeScore = 0, awayScore = 0;
        if (f.scores) {
            const currentScore = f.scores.find((s: any) => s.description === 'CURRENT');
            if (currentScore) {
                homeScore = currentScore.score?.home || 0;
                awayScore = currentScore.score?.away || 0;
            }
        }

        return {
            fixture_id: f.id,
            date: f.starting_at?.split('T')[0] || '',
            home_team: home?.name || 'Home',
            away_team: away?.name || 'Away',
            score_home: homeScore,
            score_away: awayScore
        };
    });
}

/**
 * Normalize standings
 */
export function normalizeStandings(standings: any[], homeTeamId: number, awayTeamId: number): {
    table: any[];
    home_context: any;
    away_context: any;
} {
    const table = standings.map((s: any) => ({
        position: s.position,
        team_id: s.participant?.id,
        team_name: s.participant?.name,
        points: s.points,
        played: s.details?.find((d: any) => d.type_id === 129)?.value || 0, // Games played
        win: s.details?.find((d: any) => d.type_id === 130)?.value || 0,    // Wins
        draw: s.details?.find((d: any) => d.type_id === 131)?.value || 0,   // Draws
        lose: s.details?.find((d: any) => d.type_id === 132)?.value || 0,   // Losses
        goals_for: s.details?.find((d: any) => d.type_id === 133)?.value || 0,
        goals_against: s.details?.find((d: any) => d.type_id === 134)?.value || 0,
        gd: s.details?.find((d: any) => d.type_id === 179)?.value || 0,     // Goal difference
        form: s.form || 'N/A'
    }));

    const homeContext = table.find(t => t.team_id === homeTeamId) || null;
    const awayContext = table.find(t => t.team_id === awayTeamId) || null;

    return {
        table: table.slice(0, 10),
        home_context: homeContext,
        away_context: awayContext
    };
}

/**
 * Normalize sidelined/injuries
 */
export function normalizeSidelined(sidelined: any[], homeTeamId: number, awayTeamId: number): {
    home: any[];
    away: any[];
} {
    const home = sidelined
        .filter((s: any) => s.team_id === homeTeamId)
        .map((s: any) => ({
            player: {
                name: s.player?.display_name || s.player?.common_name || 'Unknown',
                reason: s.type?.name || 'Unavailable'
            }
        }));

    const away = sidelined
        .filter((s: any) => s.team_id === awayTeamId)
        .map((s: any) => ({
            player: {
                name: s.player?.display_name || s.player?.common_name || 'Unknown',
                reason: s.type?.name || 'Unavailable'
            }
        }));

    return { home, away };
}

/**
 * Normalize odds
 */
export function normalizeOdds(odds: any[]): any {
    if (!odds || odds.length === 0) return null;

    const bookmakers: any[] = [];
    const groupedByBookmaker = new Map<number, any>();

    for (const odd of odds) {
        const bkId = odd.bookmaker?.id;
        const bkName = odd.bookmaker?.name || 'Unknown';

        if (!groupedByBookmaker.has(bkId)) {
            groupedByBookmaker.set(bkId, {
                id: bkId,
                title: bkName,
                markets: []
            });
        }

        const bk = groupedByBookmaker.get(bkId);
        const existingMarket = bk.markets.find((m: any) => m.key === odd.market?.name);

        if (!existingMarket) {
            bk.markets.push({
                key: odd.market?.name || 'unknown',
                outcomes: [{
                    name: odd.label || odd.name,
                    price: odd.value,
                    point: odd.handicap || null
                }]
            });
        } else {
            existingMarket.outcomes.push({
                name: odd.label || odd.name,
                price: odd.value,
                point: odd.handicap || null
            });
        }
    }

    return {
        bookmakers: Array.from(groupedByBookmaker.values()).sort((a: any, b: any) => {
            const priority = ['Bet365', 'Pinnacle', '1xBet', 'Unibet', 'Bwin', 'William Hill'];
            const scoreA = priority.indexOf(a.title);
            const scoreB = priority.indexOf(b.title);

            // If both are priority, sort by index (lower is better)
            if (scoreA !== -1 && scoreB !== -1) return scoreA - scoreB;
            // If only A is priority, A comes first
            if (scoreA !== -1) return -1;
            // If only B is priority, B comes first
            if (scoreB !== -1) return 1;

            // Fallback: Sort by number of markets (more markets = better data usually)
            return b.markets.length - a.markets.length;
        })
    };
}

/**
 * Normalize predictions
 */
export function normalizePredictions(predictions: any): any {
    if (!predictions) return null;

    return {
        home_win: predictions.predictions?.home || null,
        draw: predictions.predictions?.draw || null,
        away_win: predictions.predictions?.away || null,
        over_2_5: predictions.predictions?.over_2_5 || null,
        under_2_5: predictions.predictions?.under_2_5 || null,
        btts_yes: predictions.predictions?.btts || null,
        btts_no: predictions.predictions?.btts_no || null,
        correct_score: predictions.predictions?.correct_score || null
    };
}

/**
 * Normalize xG data
 */
export function normalizeXG(xgData: any): any {
    if (!xgData) return null;

    return {
        home_xg: xgData.home || null,
        away_xg: xgData.away || null,
        total_xg: (xgData.home || 0) + (xgData.away || 0)
    };
}

/**
 * Normalize value bets
 */
export function normalizeValueBets(valueBets: any[]): any[] {
    if (!valueBets) return [];

    return valueBets.map((vb: any) => ({
        market: vb.market?.name || 'Unknown',
        selection: vb.label || vb.name,
        probability: vb.probability,
        odds: vb.value,
        fair_odds: vb.fair_odds,
        edge: vb.value_index || 0
    }));
}

/**
 * Build complete normalized payload for v3-ai-analyzer
 */
export function buildNormalizedPayload(
    fixture: any,
    homeHistory: any[],
    awayHistory: any[],
    h2h: any[],
    standings: any[],
    predictions: any,
    valueBets: any[],
    homeTeamId: number,
    awayTeamId: number
): NormalizedPayload {
    const match = normalizeFixture(fixture);

    return {
        match,
        datasets: {
            home_team_last40: { all: normalizeMatchHistory(homeHistory, homeTeamId) },
            away_team_last40: { all: normalizeMatchHistory(awayHistory, awayTeamId) },
            h2h: normalizeH2H(h2h),
            standings: normalizeStandings(standings, homeTeamId, awayTeamId),
            injuries: normalizeSidelined(fixture.sidelined || [], homeTeamId, awayTeamId)
        },
        odds: normalizeOdds(fixture.odds || []),
        predictions: normalizePredictions(predictions),
        value_bets: normalizeValueBets(valueBets),
        xg: normalizeXG(fixture.xGFixture),
        lineups: {
            home: fixture.lineups?.filter((l: any) => l.team_id === homeTeamId) || [],
            away: fixture.lineups?.filter((l: any) => l.team_id === awayTeamId) || []
        }
    };
}

/**
 * Normalize SportMonks fixture to Frontend Game interface
 * Used for listing fixtures in the dashboard
 */
export function normalizeSportMonksToListGame(smFixture: any): any {
    const home = smFixture.participants?.find((p: any) => p.meta?.location === 'home');
    const away = smFixture.participants?.find((p: any) => p.meta?.location === 'away');

    let homeScore = null;
    let awayScore = null;

    if (smFixture.scores && Array.isArray(smFixture.scores)) {
        // Priority list for descriptions - try to find the most relevant score
        const priorities = ['CURRENT', '2ND_HALF', '1ST_HALF', 'ET', 'PEN', 'FT'];

        const homeId = home?.id;
        const awayId = away?.id;

        for (const desc of priorities) {
            // Find scores matching this description
            const scoresForDesc = smFixture.scores.filter((s: any) => s.description === desc);

            if (scoresForDesc.length > 0) {
                // Try to find home and away values
                const homeS = scoresForDesc.find((s: any) =>
                    (s.score?.participant === 'home') ||
                    (homeId && s.participant_id === homeId)
                );
                const awayS = scoresForDesc.find((s: any) =>
                    (s.score?.participant === 'away') ||
                    (awayId && s.participant_id === awayId)
                );

                if (homeS) homeScore = homeS.score?.goals;
                if (awayS) awayScore = awayS.score?.goals;

                if (homeScore !== null || awayScore !== null) break;
            }
        }
    }

    return {
        fixture: {
            id: smFixture.id,
            date: smFixture.starting_at,
            status: {
                short: smFixture.state?.short_name || 'NS',
                long: smFixture.state?.name || '',
                elapsed: null
            },
            venue: {
                id: smFixture.venue_id,
                name: smFixture.venue?.name || '',
                city: smFixture.venue?.city_name || ''
            },
            referee: null,
            period: { first: null, second: null },
            timestamp: new Date(smFixture.starting_at).getTime() / 1000,
            timezone: 'UTC'
        },
        league: {
            id: smFixture.league?.id || 0,
            name: smFixture.league?.name || 'Unknown',
            country: smFixture.league?.country?.name || 'World',
            logo: smFixture.league?.image_path || '',
            flag: smFixture.league?.country?.image_path || '',
            season: smFixture.season_id,
            round: smFixture.round?.name || ''
        },
        teams: {
            home: {
                id: home?.id || 0,
                name: home?.name || 'Home',
                logo: home?.image_path || '',
                winner: null
            },
            away: {
                id: away?.id || 0,
                name: away?.name || 'Away',
                logo: away?.image_path || '',
                winner: null
            }
        },
        goals: { home: homeScore, away: awayScore },
        score: {
            halftime: { home: null, away: null },
            fulltime: { home: null, away: null },
            extratime: { home: null, away: null },
            penalty: { home: null, away: null }
        }
    };
}

// --- LEGACY NORMALIZERS (API-FOOTBALL FORMAT COMPATIBILITY) ---

/**
 * Normalize SportMonks stats to API-Football format
 * API-Football expects: { team: { id, name, logo }, statistics: [ { type: string, value: any } ] }
 */
export function normalizeLegacyStatistics(fixture: any, homeTeamId: number, awayTeamId: number): any[] | null {
    if (!fixture.statistics || fixture.statistics.length === 0) return null;

    const translateType = (typeId: number): string => {
        // Map common SportMonks Type IDs to API-Football keys
        const map: Record<number, string> = {
            42: 'Shots on Goal', // Total? No, 42 is usually total
            86: 'Shots on Goal', // On target
            87: 'Shots off Goal',
            45: 'Ball Possession',
            83: 'Corner Kicks',
            58: 'Red Cards',
            57: 'Yellow Cards',
            56: 'Fouls',
            34: 'Goalkeeper Saves',
            80: 'Total passes', // approx
            // Add more as needed
        };
        // SportMonks v3 uses 'type.name' usually if included, simplified here if we only assume specific ID logic
        // But better reliance is on the 'type' object if included
        return map[typeId] || 'Unknown';
    };

    // Helper to build stat array for a team
    const buildStats = (teamId: number) => {
        const teamStats = fixture.statistics.filter((s: any) => s.participant_id === teamId);
        if (teamStats.length === 0) return [];

        return teamStats.map((s: any) => ({
            type: s.type?.name || translateType(s.type_id),
            value: s.data?.value || 0
        }));
    };

    const home = fixture.participants?.find((p: any) => p.id === homeTeamId);
    const away = fixture.participants?.find((p: any) => p.id === awayTeamId);

    return [
        {
            team: { id: home?.id, name: home?.name, logo: home?.image_path },
            statistics: buildStats(homeTeamId)
        },
        {
            team: { id: away?.id, name: away?.name, logo: away?.image_path },
            statistics: buildStats(awayTeamId)
        }
    ];
}

/**
 * Normalize SportMonks events to API-Football format
 */
export function normalizeLegacyEvents(fixture: any): any[] | null {
    if (!fixture.events || fixture.events.length === 0) return null;

    return fixture.events.map((e: any) => ({
        time: {
            elapsed: e.minute,
            extra: e.extra_minute || null
        },
        team: {
            id: e.participant_id,
            name: '', // We might catch this from participants lookup if critical
            logo: ''
        },
        player: {
            id: e.player_id,
            name: e.player_name || 'Player'
        },
        assist: {
            id: e.related_player_id,
            name: e.related_player_name || null
        },
        type: e.type?.name || 'Goal', // Simplified mapping needed?
        detail: e.sub_type_name || e.type?.name || '',
        comments: null
    })).sort((a: any, b: any) => (a.time.elapsed + (a.time.extra || 0)) - (b.time.elapsed + (b.time.extra || 0)));
}

/**
 * Normalize SportMonks lineups to API-Football format
 */
export function normalizeLegacyLineups(fixture: any, homeTeamId: number, awayTeamId: number): any[] | null {
    if (!fixture.lineups || fixture.lineups.length === 0) return null;

    const buildLineup = (teamId: number) => {
        const teamLineup = fixture.lineups.filter((l: any) => l.team_id === teamId);
        const formation = fixture.formations?.find((f: any) => f.participant_id === teamId)?.formation || 'Unknown';

        // Separate starting XI and subs
        const startXI = teamLineup.filter((l: any) => l.type_id === 11 || l.type?.code === 'starting-xi' || !l.type_id) // Assuming start if no type? Warning.
            .map((l: any) => ({
                player: {
                    id: l.player_id,
                    name: l.player_name || l.player?.common_name || 'Unknown',
                    number: l.jersey_number,
                    pos: l.position?.code || 'P',
                    grid: null
                }
            }));

        const substitutes = teamLineup.filter((l: any) => l.type_id === 12 || l.type?.code === 'bench')
            .map((l: any) => ({
                player: {
                    id: l.player_id,
                    name: l.player_name || l.player?.common_name || 'Unknown',
                    number: l.jersey_number,
                    pos: l.position?.code || 'S',
                    grid: null
                }
            }));

        const team = fixture.participants?.find((p: any) => p.id === teamId);

        return {
            team: {
                id: team?.id,
                name: team?.name,
                logo: team?.image_path,
                colors: null
            },
            coach: { id: 0, name: 'Unknown', photo: null }, // SportMonks puts coaches elsewhere usually
            formation: formation,
            startXI: startXI,
            substitutes: substitutes
        };
    };

    return [buildLineup(homeTeamId), buildLineup(awayTeamId)];
}

// ... existing exports ...

/**
 * Get Canonical Market ID for semantic unification
 * Maps semantically identical markets to a single ID
 */
function getCanonicalMarketId(marketId: number, label: string): string {
    const l = label.toLowerCase();

    // 1x2
    if (marketId === 1) return `1x2_${l}`;

    // Double Chance (usually market 10 or similar, but let's rely on label if ID varies)
    if (l.includes('double chance') || l.includes('doble oportunidad')) return `dc_${l.replace(/\s/g, '_')}`;

    // Goals Over/Under (Market 12 usually)
    // "Over 2.5" -> "goals_over_2.5"
    if (marketId === 12 || l.includes('over ') || l.includes('under ')) {
        const type = l.includes('over') ? 'over' : 'under';
        const val = l.match(/[\d\.]+/)?.[0];
        if (val) return `goals_${type}_${val}`;
    }

    // BTTS (Market 13 usually)
    if (l.includes('both teams to score')) {
        return l.includes('yes') ? 'btts_yes' : 'btts_no';
    }

    // Exact Score
    if (marketId === 3) return `exact_score_${l.replace(/\s|:/g, '-')}`;

    // TEAM PROPS (The critical part for deduplication)
    // "Away Team Score" vs "Away Over 0.5"
    if (l.includes('team to score') || l.includes('anota')) {
        const team = l.includes('home') || l.includes('local') ? 'home' : 'away';
        return `${team}_team_score_yes`; // Canonical "Team Valid Goal"
    }

    // Handle specific mappings for known duplicates
    // If market is "Away Team Total" and line is 0.5, it maps to team_score_yes

    return `market_${marketId}_${l.replace(/[^a-z0-9]/g, '_')}`;
}

/**
 * Organize Odds for AI Processing
 * Groups flat market list into structured categories to prevent hallucinations
 */
export function organizeOddsForAI(odds: any[]): any {
    if (!odds || odds.length === 0) return { info: "No odds available" };

    const structured = {
        MAIN: [] as any[],    // 1x2, DC, DNB
        GOALS: [] as any[],   // Over/Under, Exact Goals
        TEAMS: [] as any[],   // BTTS, Team to Score, Team Totals
        HALVES: [] as any[],  // HT Results, HT Goals
        CORNERS: [] as any[],
        OTHERS: [] as any[]
    };

    // Helper to format output odd
    const fmt = (o: any) => ({
        m_id: o.market_id,
        b_id: o.bookmaker_id,
        lbl: o.label,
        val: o.value,
        canon: getCanonicalMarketId(o.market_id, o.label)
    });

    // Valid market IDs (approximate whitelist for categorization, but we accept ALL)
    for (const o of odds) {
        const mid = o.market_id;
        const label = (o.label || '').toLowerCase();

        // Categorization Logic
        if (mid === 1 || mid === 2 || mid === 10) { // 1x2, Double Chance
            structured.MAIN.push(fmt(o));
        } else if (label.includes('double chance') || label.includes('draw no bet') || label.includes(' or ')) {
            structured.MAIN.push(fmt(o));
        } else if (mid === 12 || label.includes('over') || label.includes('under')) {
            // Distinguish Team Overs vs Match Overs
            if (label.includes('team') || label.includes('home') || label.includes('away')) {
                structured.TEAMS.push(fmt(o));
            } else {
                structured.GOALS.push(fmt(o));
            }
        } else if (mid === 6 || mid === 13 || mid === 37 || label.includes('both teams') || label.includes('btts')) {
            structured.TEAMS.push(fmt(o));
        } else if (label.includes('corner')) {
            structured.CORNERS.push(fmt(o));
        } else if (label.includes('1st half') || label.includes('2nd half') || label.includes('half time')) {
            structured.HALVES.push(fmt(o));
        } else {
            structured.OTHERS.push(fmt(o));
        }
    }

    // Optional: Deduplicate within categories?
    // User asked "prompt can determine which represents greater opportunity"
    // So we basically pass them all but grouped.

    return structured;
}

