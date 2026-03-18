
// supabase/functions/v2-get-fixture-details-sportmonks/index.ts
// Obtiene detalles completos de un partido desde SportMonks y los normaliza al formato Legacy

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import {
    getFixtureComplete,
    getH2H,
    getStandings,
    getTeamFixtures
} from '../_shared/sportmonks-client.ts'
import {
    normalizeSportMonksToListGame,
    normalizeLegacyEvents,
    normalizeLegacyLineups,
    normalizeLegacyStatistics,
    normalizeLegacyStandings
} from '../_shared/sportmonks-normalizer.ts'

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { fixtureId, debug } = await req.json();

        if (!fixtureId) {
            throw new Error('fixtureId is required');
        }

        console.log(`[v2-get-fixture-details-sportmonks] Fetching details for: ${fixtureId}`);

        // 1. Fetch Basic Fixture Data (with stats, lineups, events)
        const fixtureData = await getFixtureComplete(fixtureId);
        if (!fixtureData) {
            throw new Error(`Fixture ${fixtureId} not found`);
        }

        if (debug) {
            return new Response(JSON.stringify(fixtureData), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 2. Fetch Additional Context (H2H, Standings, Recent Form)
        const homeTeamId = fixtureData.participants?.find((p: any) => p.meta?.location === 'home')?.id;
        const awayTeamId = fixtureData.participants?.find((p: any) => p.meta?.location === 'away')?.id;
        const leagueId = fixtureData.league_id;
        const seasonId = fixtureData.season_id;

        if (!homeTeamId || !awayTeamId) {
            throw new Error('Teams not found in fixture data');
        }

        console.log(`[v2-get-fixture-details-sportmonks] Context: Teams ${homeTeamId}-${awayTeamId}, League ${leagueId}`);

        // Fetch additional context — each wrapped in try/catch so partial failures don't crash the whole response
        const safeCall = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
            try { return await fn(); }
            catch (e: any) { console.warn(`[v2-get-fixture-details-sportmonks] ${label} failed: ${e.message}`); return fallback; }
        };

        const [h2h, standings, lastHome, lastAway] = await Promise.all([
            safeCall('H2H', () => getH2H(homeTeamId, awayTeamId), []),
            safeCall('Standings', () => seasonId ? getStandings(seasonId) : Promise.resolve([]), []),
            safeCall('LastHome', () => getTeamFixtures(homeTeamId, 5), []),
            safeCall('LastAway', () => getTeamFixtures(awayTeamId, 5), [])
        ]);

        // 3. Normalize to GameDetails format
        const baseGame = normalizeSportMonksToListGame(fixtureData);

        // Safe normalization — each section independent
        let events = null;
        let lineups = null;
        let statistics = null;
        let normalizedH2h: any[] = [];
        let normalizedStandings = null;

        try { events = normalizeLegacyEvents(fixtureData); } catch (e: any) { console.warn(`[v2-get-fixture-details-sportmonks] Events normalization failed: ${e.message}`); }
        try { lineups = normalizeLegacyLineups(fixtureData, homeTeamId, awayTeamId); } catch (e: any) { console.warn(`[v2-get-fixture-details-sportmonks] Lineups normalization failed: ${e.message}`); }
        try { statistics = normalizeLegacyStatistics(fixtureData, homeTeamId, awayTeamId); } catch (e: any) { console.warn(`[v2-get-fixture-details-sportmonks] Statistics normalization failed: ${e.message}`); }
        try { normalizedH2h = h2h.map(normalizeSportMonksToListGame); } catch (e: any) { console.warn(`[v2-get-fixture-details-sportmonks] H2H normalization failed: ${e.message}`); }
        try { normalizedStandings = normalizeLegacyStandings(standings); } catch (e: any) { console.warn(`[v2-get-fixture-details-sportmonks] Standings normalization failed: ${e.message}`); }

        const dossier: any = {
            fixture: baseGame.fixture,
            league: baseGame.league,
            teams: baseGame.teams,
            goals: baseGame.goals,
            events,
            lineups,
            statistics,
            h2h: normalizedH2h,
            standings: normalizedStandings,
            teamStats: { home: null, away: null },
            lastMatches: {
                home: lastHome.map((m: any) => { try { return normalizeSportMonksToListGame(m); } catch { return null; } }).filter(Boolean),
                away: lastAway.map((m: any) => { try { return normalizeSportMonksToListGame(m); } catch { return null; } }).filter(Boolean)
            }
        };

        return new Response(JSON.stringify(dossier), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[v2-get-fixture-details-sportmonks] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
