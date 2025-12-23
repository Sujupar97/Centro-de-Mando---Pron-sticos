
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
        // Fetch ALL odds for this sport/league (Winner + Goals)
        const oddsEvents = await fetchOddsFromEdge(sportKey, 'eu', 'h2h,totals');

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
export const findPriceInEvent = (event: OddsEvent, marketName: string, selectionName: string): number | null => {
    if (!event || !event.bookmakers || event.bookmakers.length === 0) return null;

    // Use the first bookmaker (usually the best odds if we sort, but default is fine)
    // Or iterate to find average/best. Let's pick 'pinnacle' or just the first.
    const bookmaker = event.bookmakers[0];

    const mLower = marketName.toLowerCase();
    const sLower = selectionName.toLowerCase();

    // console.log(`[OddsMatch] Checking ${marketName} / ${selectionName} against Event: ${event.home_team} vs ${event.away_team}`);

    // 1. Winner / 1X2 / Moneyline
    if (mLower.includes('ganador') || mLower.includes('winner') || mLower.includes('1x2') || mLower.includes('match result')) {
        const market = bookmaker.markets.find(m => m.key === 'h2h');
        if (market) {
            // Determine which team from selectionName
            // Matches "Home", "Away" or Team Name
            // If selection is "Over", ignore (bad classification)
            if (sLower.includes(event.home_team.toLowerCase())) return market.outcomes.find(o => o.name === event.home_team)?.price || null;
            if (sLower.includes(event.away_team.toLowerCase())) return market.outcomes.find(o => o.name === event.away_team)?.price || null;
            if (sLower.includes('draw') || sLower.includes('empate') || sLower.includes('x')) return market.outcomes.find(o => o.name === 'Draw')?.price || null;
        }
    }

    // 1.1 Double Chance (Requires 'doublechance' market usually, or we skip)
    if (mLower.includes('doble') || mLower.includes('double')) {
        // The Odds API often separates this. If we only catch 'h2h,totals', we might miss DC. 
        // We will fallback to null for now unless we add 'doublechance' to fetch.
        // Let's rely on standard markets first.
    }

    // 2. Totals (Over/Under)
    if (mLower.includes('goles') || mLower.includes('goals') || mLower.includes('total') || sLower.includes('over') || sLower.includes('under')) {
        const market = bookmaker.markets.find(m => m.key === 'totals');
        if (market) {
            // console.log('[OddsMatch] Found totals market:', market.outcomes);
            // Extract point from selection text (e.g. "Over 2.5" or "Más de 2.5")
            // Handle comma or dot decimals
            const pointMatch = sLower.replace(',', '.').match(/(\d+\.?\d*)/);
            const targetPoint = pointMatch ? parseFloat(pointMatch[1]) : 2.5;

            const isOver = sLower.includes('over') || sLower.includes('más') || sLower.includes('+') || sLower.includes('more');
            const outcomeName = isOver ? 'Over' : 'Under';

            const outcome = market.outcomes.find(o => o.name === outcomeName && Math.abs(o.point! - targetPoint) < 0.1);
            if (outcome) {
                // console.log(`[OddsMatch] MATCHED! ${outcomeName} ${targetPoint} @ ${outcome.price}`);
                return outcome.price;
            }

            // Approximate: If we don't find exact 2.5, try to return nearest? No, unsafe.
            // Check alt totals? The API usually returns main line.
        } else {
            // console.warn('[OddsMatch] No totals market found in event');
        }
    }

    return null;
};

