
const API_KEY = 'RhgNCasAS67wuJtawFoMrkokCP51r89L7dMKQIpXoGVv67BKfnWOcKHcjEG5';
const FIXTURE_ID = 19431963; // Fixture reported in 500 error screenshot

async function diagnoseFixture() {
    console.log(`Diagnosing SportMonks API for fixture ${FIXTURE_ID}...`);

    // Includes matching v2-create-job-sportmonks
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
        'odds',
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
        if (!res.ok) {
            console.error(`Status: ${res.status}`);
            console.error(await res.text());
            return;
        }

        const json = await res.json();
        const data = json.data;

        if (!data) {
            console.error("❌ Data is null/undefined");
            return;
        }

        console.log(`\n--- REPORT FOR FIXTURE ${FIXTURE_ID} ---`);
        console.log(`Match: ${data.name}`);
        console.log(`Status: ${data.state?.state} (${data.state?.name})`);

        // Critical Data
        const stats = data.statistics || [];
        const lineups = data.lineups || [];

        console.log(`\n[CRITICAL DATA CHECKS]`);
        console.log(`Statistics Count: ${stats.length} ${stats.length === 0 ? '❌ FAIL' : '✅ OK'}`);
        console.log(`Lineups Count:    ${lineups.length} ${lineups.length === 0 ? '❌ FAIL' : '✅ OK'}`);

        if (stats.length === 0 && lineups.length === 0) {
            console.log("\n🚨 CONCLUSION: This match HAS NO DATA. The 'Fail-Fast' logic was CORRECT to trigger.");
            console.log("Reason: SportMonks has not provided stats or lineups for this match.");
        } else {
            console.log("\n❓ CONCLUSION: Data EXISTS. The 'Fail-Fast' logic should NOT have triggered.");
            console.log("Investigate parsing logic.");
        }

    } catch (e) {
        console.error("Fetch error:", e);
    }
}

diagnoseFixture();
