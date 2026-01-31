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
 * Normalize match history (last 40 fixtures)
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
        bookmakers: Array.from(groupedByBookmaker.values())
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

    if (smFixture.scores) {
        // Try to find CURRENT score first
        const current = smFixture.scores.find((s: any) => s.description === 'CURRENT');
        if (current && current.score) {
            homeScore = current.score.home;
            awayScore = current.score.away;
        } else if (smFixture.scores.length > 0) {
            // Fallback to first available score
            const s = smFixture.scores[0].score;
            if (s) {
                homeScore = s.home;
                awayScore = s.away;
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
