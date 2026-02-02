
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

        const [h2h, standings, lastHome, lastAway] = await Promise.all([
            getH2H(homeTeamId, awayTeamId),
            seasonId ? getStandings(seasonId) : Promise.resolve([]),
            getTeamFixtures(homeTeamId, 5),
            getTeamFixtures(awayTeamId, 5)
        ]);

        // 3. Normalize to GameDetails format
        // Re-use ListGame normalizer for the base 'fixture', 'league', 'teams', 'goals'
        const baseGame = normalizeSportMonksToListGame(fixtureData);

        const dossier: any = {
            fixture: baseGame.fixture,
            league: baseGame.league,
            teams: baseGame.teams,
            goals: baseGame.goals,
            events: normalizeLegacyEvents(fixtureData),
            lineups: normalizeLegacyLineups(fixtureData, homeTeamId, awayTeamId),
            statistics: normalizeLegacyStatistics(fixtureData, homeTeamId, awayTeamId),
            h2h: h2h.map(normalizeSportMonksToListGame),
            standings: normalizeLegacyStandings(standings),
            teamStats: { home: null, away: null }, // TODO: Fetch team season stats if critical (expensive call usually)
            lastMatches: {
                home: lastHome.map(normalizeSportMonksToListGame),
                away: lastAway.map(normalizeSportMonksToListGame)
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
