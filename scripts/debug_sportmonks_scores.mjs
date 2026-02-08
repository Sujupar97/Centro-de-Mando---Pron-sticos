#!/usr/bin/env node
/**
 * DEBUG: Check raw SportMonks fixture data to understand score structure
 */

const SPORTMONKS_API_KEY = 'hxvCLGIDJnRMiEgPlpOc0mXmH9AprcZZLLd6XJ3vqkEFy7bZCjb2OfDfDj6N';
const BASE_URL = 'https://api.sportmonks.com/v3/football';

async function checkScoreStructure() {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🔍 DEBUG: SportMonks Score Structure');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    // Get SC Cambuur's recent fixtures
    const teamId = 73; // SC Cambuur ID
    const url = `${BASE_URL}/fixtures/between/2025-10-01/2026-02-10?api_token=${SPORTMONKS_API_KEY}&include=participants;scores&filters=participantTeamIds:${teamId}&per_page=15`;

    console.log('Fetching fixtures for SC Cambuur...\n');

    const res = await fetch(url);
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
        console.log('No data returned');
        return;
    }

    console.log('Found', data.data.length, 'fixtures\n');

    // Show first 5 fixtures with full score structure
    data.data.slice(0, 8).forEach((fixture, i) => {
        console.log('─────────────────────────────────────────────────────────────────');
        console.log(`Fixture ${i + 1}: ID ${fixture.id}`);
        console.log(`Date: ${fixture.starting_at}`);
        console.log(`State: ${fixture.state?.short || fixture.state_id}`);

        // Participants
        const home = fixture.participants?.find(p => p.meta?.location === 'home');
        const away = fixture.participants?.find(p => p.meta?.location === 'away');
        console.log(`Teams: ${home?.name || 'HOME'} vs ${away?.name || 'AWAY'}`);

        // SCORES - Full structure
        console.log('\n📊 SCORES ARRAY:');
        console.log(JSON.stringify(fixture.scores, null, 2));

        // What we currently extract
        const homeScore = fixture.scores?.find(s => s.description === 'CURRENT')?.score?.participant === 'home'
            ? fixture.scores?.find(s => s.description === 'CURRENT')?.score?.goals
            : fixture.scores?.[0]?.score?.home || 0;
        const awayScore = fixture.scores?.find(s => s.description === 'CURRENT')?.score?.participant === 'away'
            ? fixture.scores?.find(s => s.description === 'CURRENT')?.score?.goals
            : fixture.scores?.[0]?.score?.away || 0;

        console.log(`\n🔴 OUR EXTRACTION: ${homeScore} - ${awayScore}`);
        console.log('');
    });
}

checkScoreStructure().catch(console.error);
