
// Script para reconstruir el PAYLOAD de entrada de un job específico
// Replícando la lógica de v2-create-job-sportmonks
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
    fetchSportMonks,
    getFixtureComplete,
    getTeamFixtures,
    getH2H,
    getStandings,
    getPredictions,
    getValueBets
} from '../supabase/functions/_shared/sportmonks-client.ts';
import { buildNormalizedPayload } from '../supabase/functions/_shared/sportmonks-normalizer.ts';

const FIXTURE_ID = 19450567; // York City vs Solihull

async function reconstruct() {
    console.log(`Reconstructing payload for fixture ${FIXTURE_ID}...`);

    // Stage 1
    const fixtureData = await getFixtureComplete(FIXTURE_ID);
    if (!fixtureData) throw new Error("Fixture not found");

    const homeTeam = fixtureData.participants?.find((p: any) => p.meta?.location === 'home');
    const awayTeam = fixtureData.participants?.find((p: any) => p.meta?.location === 'away');

    if (!homeTeam || !awayTeam) throw new Error("Teams not found");

    console.log(`Match: ${homeTeam.name} vs ${awayTeam.name}`);

    // Stage 2
    const homeTeamId = homeTeam.id;
    const awayTeamId = awayTeam.id;
    const seasonId = fixtureData.season_id;

    const [
        homeHistory,
        awayHistory,
        h2h,
        standings,
        predictions,
        valueBets
    ] = await Promise.all([
        getTeamFixtures(homeTeamId, 10), // Limit to 10 for speed
        getTeamFixtures(awayTeamId, 10),
        getH2H(homeTeamId, awayTeamId),
        seasonId ? getStandings(seasonId) : Promise.resolve([]),
        getPredictions(FIXTURE_ID),
        getValueBets(FIXTURE_ID)
    ]);

    // Stage 3
    const normalizedPayload = buildNormalizedPayload(
        fixtureData,
        homeHistory,
        awayHistory,
        h2h,
        standings,
        predictions,
        valueBets,
        homeTeamId,
        awayTeamId
    );

    console.log("Payload verified.");
    console.log(`- Odds Bookmakers: ${normalizedPayload.odds?.bookmakers?.length || 0}`);
    console.log(`- Standings: ${normalizedPayload.datasets.standings.table.length}`);
    console.log(`- H2H: ${normalizedPayload.datasets.h2h.length}`);

    // Output to file
    const fs = await import('node:fs');
    fs.writeFileSync('debug_input_payload.json', JSON.stringify(normalizedPayload, null, 2));
    console.log("Saved to debug_input_payload.json");
}

reconstruct();
