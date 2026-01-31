
// Script to check data directly from SportMonks
// const { getFixturesByDate } = require('./supabase/functions/_shared/sportmonks-client.ts'); 
// REMOVED dependency. Using manual fetch.

// Better Plan: Use the existing 'v2-create-job-sportmonks' logic but logging to console via a new temporary script 
// OR just fetch directly from SportMonks API using fetch in this script, replicating the critical 'includes'.

const API_KEY = 'RhgNCasAS67wuJtawFoMrkokCP51r89L7dMKQIpXoGVv67BKfnWOcKHcjEG5';
const FIXTURE_ID = 19427690;

async function checkFixtureData() {
    console.log(`Checking data for fixture ${FIXTURE_ID}...`);

    // Includes from v2-create-job-sportmonks/index.ts
    const includes = [
        'participants',
        'lineups',
        'statistics',
        'events',
        'scores',
        'venue',
        'referees',
        'formations',
        'coaches',
        'sidelined',
        'odds', // CRITICAL
        'weatherReport',
        'league',
        'season',
        'round'
    ];

    const url = new URL(`https://api.sportmonks.com/v3/football/fixtures/${FIXTURE_ID}`);
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('include', includes.join(';'));

    try {
        const res = await fetch(url.toString());
        const json = await res.json();
        const data = json.data;

        console.log('--- DATA CHECK ---');
        console.log(`Fixture: ${data.name}`);
        console.log(`Has Statistics? ${data.statistics && data.statistics.length > 0}`);
        console.log(`Has Odds? ${data.odds && data.odds.length > 0}`);

        if (data.odds && data.odds.length > 0) {
            console.log(`Odds count: ${data.odds.length}`);
            console.log('First Odd:', JSON.stringify(data.odds[0], null, 2));
        } else {
            console.log('❌ NO ODDS FOUND');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

checkFixtureData();
