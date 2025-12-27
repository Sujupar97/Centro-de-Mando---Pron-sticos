
import { supabase } from './supabaseService';
import { APIFixture, APITeam } from '../types';

// Types for The Odds API response
export interface OddsEvent {
    id: string;
    sport_key: string;
    sport_title: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    bookmakers: {
        key: string;
        title: string;
        last_update: string;
        markets: {
            key: string;
            last_update: string;
            outcomes: {
                name: string;
                price: number;
                point?: number; // for spreads/totals
            }[];
        }[];
    }[];
}

export interface OddsMatch {
    fixtureId: number;
    oddsEvent: OddsEvent;
    source: 'The Odds API';
    confidence: number; // 0-1 matches confidence
}

/**
 * Normalizes team names for comparison
 * Removes accents, special chars, and standardizes common abbreviations
 */
const normalizeName = (name: string): string => {
    return name
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/fc|cf|sc|united|city|town|club|athletic|real|sporting|inter|ac|as/g, "") // remove common generic words
        .replace(/[^a-z0-9]/g, "") // remove non-alphanumeric
        .trim();
};

/**
 * Calculates simple similarity score (0 to 1) between two strings
 * Jaccard Index on character bigrams for robustness
 */
const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = normalizeName(str1);
    const s2 = normalizeName(str2);

    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9; // Substring match is strong indicator

    // Bigram Jaccard
    const bigrams1 = new Set<string>();
    for (let i = 0; i < s1.length - 1; i++) bigrams1.add(s1.substring(i, i + 2));

    const bigrams2 = new Set<string>();
    for (let i = 0; i < s2.length - 1; i++) bigrams2.add(s2.substring(i, i + 2));

    const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
    const union = new Set([...bigrams1, ...bigrams2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
};

/**
 * Fetches odds from the secure Edge Function
 */
export const fetchOddsFromEdge = async (
    sportKey: string = 'soccer_epl', // default
    region: string = 'eu',
    markets: string = 'h2h'
): Promise<OddsEvent[]> => {
    console.log(`Fetching odds for ${sportKey}...`);

    const { data, error } = await supabase.functions.invoke('fetch-odds', {
        body: { sport: sportKey, region, markets }
    });

    if (error) {
        console.error("Error invoking fetch-odds:", error);
        return [];
    }

    if (!data?.data) {
        console.warn("No data returned from fetch-odds");
        return [];
    }

    return data.data as OddsEvent[];
};

/**
 * Matches an API-Football fixture to an Odds API event
 */
export const findOddsForFixture = (
    fixture: { date: string; home: string; away: string },
    oddsEvents: OddsEvent[]
): OddsEvent | null => {
    const fixtureDate = new Date(fixture.date);

    // 1. Filter by Date (same day)
    const candidates = oddsEvents.filter(e => {
        const eventDate = new Date(e.commence_time);
        // Check if within 24 hours (timezone differences can be tricky)
        const diffHours = Math.abs(eventDate.getTime() - fixtureDate.getTime()) / 36e5;
        return diffHours < 30;
    });

    let bestMatch: OddsEvent | null = null;
    let highestScore = 0;

    for (const event of candidates) {
        // Calculate similarity for both Home and Away
        const homeSim = calculateSimilarity(fixture.home, event.home_team);
        const awaySim = calculateSimilarity(fixture.away, event.away_team);

        // Average score
        const totalScore = (homeSim + awaySim) / 2;

        if (totalScore > highestScore) {
            highestScore = totalScore;
            bestMatch = event;
        }
    }

    // Threshold for accepting a match
    return highestScore > 0.6 ? bestMatch : null; // 0.6 is a conservative threshold
};

/**
 * Orchestrator: Given a list of API-Football fixtures, tries to find odds for them.
 * Intelligent matching: groups by league to minimize API calls if possible (though Odds API structure is by sport).
 * 
 * @param fixtures List of fixtures with mapped 'sportKey' (The Odds API key format, e.g., 'soccer_epl')
 */
export const fastBatchOddsCheck = async (
    items: { fixtureId: number; sportKey: string; home: string; away: string; date: string }[]
): Promise<Map<number, OddsEvent>> => {

    const results = new Map<number, OddsEvent>();

    // Group by SportKey to minimize requests
    const bySport = new Map<string, typeof items>();
    items.forEach(i => {
        const key = i.sportKey || 'upcoming'; // 'upcoming' might be a generic fallback
        if (!bySport.has(key)) bySport.set(key, []);
        bySport.get(key)?.push(i);
    });

    // Fetch in parallel
    const promises = Array.from(bySport.entries()).map(async ([sportKey, fixtures]) => {
        // Fetch ALL odds for this sport/league (Winner + Goals + BTTS + Double Chance)
        const oddsEvents = await fetchOddsFromEdge(sportKey, 'eu', 'h2h,totals,btts,doublechance');

        // Match in memory
        fixtures.forEach(fixture => {
            const match = findOddsForFixture({
                date: fixture.date,
                home: fixture.home,
                away: fixture.away
            }, oddsEvents);

            if (match) {
                results.set(fixture.fixtureId, match);
            }
        });
    });

    await Promise.all(promises);
    return results;
};

/**
 * Maps common league names (API-Football) to The Odds API sport keys
 */
export const mapLeagueToSportKey = (leagueName: string): string => {
    const l = leagueName.toLowerCase();
    if (l.includes('premier league')) return 'soccer_epl';
    if (l.includes('la liga') || l.includes('primera division')) return 'soccer_spain_la_liga';
    if (l.includes('bundesliga')) return 'soccer_germany_bundesliga';
    if (l.includes('serie a')) return 'soccer_italy_serie_a';
    if (l.includes('ligue 1')) return 'soccer_france_ligue_one';
    if (l.includes('champions league')) return 'soccer_uefa_champs_league';
    if (l.includes('europa league')) return 'soccer_uefa_europa_league';
    if (l.includes('mls') || l.includes('major league soccer')) return 'soccer_usa_mls';
    if (l.includes('libertadores')) return 'soccer_conmebol_libertadores';
    if (l.includes('brasileiro') || l.includes('serie a')) return 'soccer_brazil_campeonato';

    return 'soccer_epl'; // Fallback
};

/**
 * Tries to find a price in the specific event for a given market/selection
 * Heuristic based matching.
 */
/**
 * Translates AI prediction language to API outcome language.
 * Core translation engine.
 */
const normalizePredictionRole = (
    selection: string,
    homeName: string,
    awayName: string
): 'HOME' | 'AWAY' | 'DRAW' | 'UNKNOWN' => {
    const s = normalizeName(selection);
    const h = normalizeName(homeName);
    const a = normalizeName(awayName);

    // Direct Name Match (Fuzzy)
    if (cacheSim(s, h) > 0.8) return 'HOME';
    if (cacheSim(s, a) > 0.8) return 'AWAY';

    // Role Match
    if (s.includes('local') || s.includes('anfitrion') || s.includes('casa') || s.includes('home') || s.includes('1')) return 'HOME';
    if (s.includes('visit') || s.includes('fuera') || s.includes('away') || s.includes('2')) return 'AWAY';
    if (s.includes('empate') || s.includes('iguadad') || s.includes('tablas') || s.includes('draw') || s.includes('x')) return 'DRAW';

    return 'UNKNOWN';
};

const cacheSim = (s1: string, s2: string) => calculateSimilarity(s1, s2); // Optimization wrapper if needed

/**
 * Intelligent Matching Engine v2.0
 * Translates natural language predictions into specific API market outcomes.
 */
export const findPriceInEvent = (event: OddsEvent, marketName: string, selectionName: string): number | null => {
    if (!event || !event.bookmakers || event.bookmakers.length === 0) return null;

    // Use best available bookmaker (e.g. Pinnacle, or first found)
    const bookmaker = event.bookmakers.find(b => b.key === 'pinnacle') || event.bookmakers[0];

    const mRaw = marketName.toLowerCase();
    const sRaw = selectionName.toLowerCase();

    // --- STRATEGY 1: MARKET CLASSIFICATION ---
    let targetMarketType: 'H2H' | 'TOTALS' | 'BTTS' | 'DOUBLE' | 'DNB' | 'UNKNOWN' = 'UNKNOWN';

    if (/ganador|winner|1x2|match result|resultado/.test(mRaw)) targetMarketType = 'H2H';
    else if (/doble|double|oportunidad/.test(mRaw)) targetMarketType = 'DOUBLE';
    else if (/empate.*apuesta.*no|draw.*no.*bet|dnb|sin.*empate/.test(mRaw)) targetMarketType = 'DNB';
    else if (/ambos|btts|both/.test(mRaw)) targetMarketType = 'BTTS';
    else if (/gol|goal|total|over|under|más|menos/.test(mRaw)) targetMarketType = 'TOTALS';

    // If ambiguous from market name, try selection
    if (targetMarketType === 'UNKNOWN') {
        if (/1x|x2|12/.test(sRaw)) targetMarketType = 'DOUBLE';
        if (/más|menos|over|under/.test(sRaw)) targetMarketType = 'TOTALS';
        if (/sí|no|yes/.test(sRaw) && /ambos|marcan/.test(sRaw)) targetMarketType = 'BTTS';
    }

    // --- STRATEGY 2: OUTCOME MATCHING ---

    // Case A: Head to Head (Winner)
    if (targetMarketType === 'H2H') {
        const market = bookmaker.markets.find(m => m.key === 'h2h');
        if (!market) return null;

        const role = normalizePredictionRole(sRaw, event.home_team, event.away_team);

        if (role === 'HOME') return market.outcomes.find(o => o.name === event.home_team)?.price || null;
        if (role === 'AWAY') return market.outcomes.find(o => o.name === event.away_team)?.price || null;
        if (role === 'DRAW') return market.outcomes.find(o => o.name === 'Draw')?.price || null;
    }

    // Case B: Totals
    if (targetMarketType === 'TOTALS') {
        const market = bookmaker.markets.find(m => m.key === 'totals');
        if (!market) return null;

        // Extract point
        const pointMatch = sRaw.replace(',', '.').match(/(\d+\.?\d*)/);
        const targetPoint = pointMatch ? parseFloat(pointMatch[1]) : 2.5;

        // Extract direction
        const isOver = /over|más|mas|\+|mayor/.test(sRaw);
        const apiName = isOver ? 'Over' : 'Under';

        return market.outcomes.find(o => o.name === apiName && Math.abs((o.point || 0) - targetPoint) < 0.1)?.price || null;
    }

    // Case C: BTTS
    if (targetMarketType === 'BTTS') {
        const market = bookmaker.markets.find(m => m.key === 'btts' || m.key === 'h2h_btts');
        if (!market) return null;

        const wantsYes = /sí|si|yes|ambos/.test(sRaw) && !/no/.test(sRaw); // Basic heuristic
        const apiName = wantsYes ? 'Yes' : 'No';

        return market.outcomes.find(o => o.name.toLowerCase() === apiName.toLowerCase())?.price || null;
    }

    // Case D: Double Chance
    if (targetMarketType === 'DOUBLE') {
        const market = bookmaker.markets.find(m => m.key === 'doublechance');
        if (!market) return null;

        // Map inputs like "1X", "Local/Empate", "Home or Draw"
        const role = normalizePredictionRole(sRaw, event.home_team, event.away_team);
        const wantsDraw = /empate|draw|x/.test(sRaw);

        // Construct API Outcome Name expectation
        // API usually formats like "Home/Draw", "Home/Away", "Draw/Away"
        // We check if outcome name CONTAINS the teams strictly

        return market.outcomes.find(o => {
            const oname = o.name; // e.g. "Man Utd/Draw"
            if (sRaw.includes('1x') || (role === 'HOME' && wantsDraw)) {
                return oname.includes(event.home_team) && oname.includes('Draw');
            }
            if (sRaw.includes('x2') || (role === 'AWAY' && wantsDraw)) {
                return oname.includes(event.away_team) && oname.includes('Draw');
            }
            if (sRaw.includes('12') || (role === 'HOME' && sRaw.includes('visit'))) { // 12 usually means no draw
                return oname.includes(event.home_team) && oname.includes(event.away_team);
            }
            return false;
        })?.price || null;
    }

    // Case E: Draw No Bet
    if (targetMarketType === 'DNB') {
        const market = bookmaker.markets.find(m => m.key === 'draw_no_bet'); // API key
        if (!market) return null; // Often DNB is implied from H2H+Draw probability, but API has specific key

        const role = normalizePredictionRole(sRaw, event.home_team, event.away_team);
        if (role === 'HOME') return market.outcomes.find(o => o.name === event.home_team)?.price || null;
        if (role === 'AWAY') return market.outcomes.find(o => o.name === event.away_team)?.price || null;
    }

    return null;
};
