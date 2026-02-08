
const API_KEY = 'RhgNCasAS67wuJtawFoMrkokCP51r89L7dMKQIpXoGVv67BKfnWOcKHcjEG5';
const FIXTURE_ID = 19427701; // Leeds vs Nottingham

async function fetchSM(endpoint, includes = [], params = {}) {
    const url = new URL(`https://api.sportmonks.com/v3/football${endpoint}`);
    url.searchParams.set('api_token', API_KEY);
    if (includes.length) url.searchParams.set('include', includes.join(';'));
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    console.log(`fetching ${url.toString()}...`);
    const res = await fetch(url.toString());
    const json = await res.json();
    return json.data;
}

async function main() {
    console.log('1. Fetching Fixture Details...');
    const fixture = await fetchSM(`/fixtures/${FIXTURE_ID}`, ['participants']);

    if (!fixture) {
        console.error('Fixture not found');
        return;
    }

    const home = fixture.participants.find(p => p.meta.location === 'home');
    const away = fixture.participants.find(p => p.meta.location === 'away');

    console.log(`Match: ${home.name} (ID: ${home.id}) vs ${away.name} (ID: ${away.id})`);

    console.log('\n2. Fetching Home Team History (Last 5, Desc)...');
    // Using EXACT includes from v2-create-job-sportmonks
    // const deepIncludes = ['participants', 'scores', 'venue', 'league', 'statistics', 'lineups', 'events', 'formations'];
    const includes = ['participants', 'scores', 'venue', 'league', 'statistics', 'lineups', 'events', 'formations'];

    // Test 1: fixtures/between/{start}/{end}/{team_id}
    console.log('\n--- Test 1: fixtures/between/2024-08-01/2025-05-30/71 ---');
    try {
        const h1 = await fetchSM('/fixtures/between/2024-08-01/2025-05-30/71', includes);
        console.log(`Test 1 Result: ${h1 ? h1.length : 0} matches`);
    } catch (e) { console.log('Test 1 Failed'); }

    // Test 2: fixtures/team/{team_id}
    console.log('\n--- Test 2: fixtures/team/71 ---');
    try {
        const h2 = await fetchSM('/fixtures/team/71', includes); // Hypothetical
        console.log(`Test 2 Result: ${h2 ? h2.length : 0} matches`);
    } catch (e) { console.log('Test 2 Failed: ' + e.message); }

    // Test 3: fixtures?team_id=71
    console.log('\n--- Test 3: fixtures?team_id=71 ---');
    try {
        const h3 = await fetchSM('/fixtures', includes, { 'team_id': '71' });
        console.log(`Test 3 Result: ${h3 ? h3.length : 0} matches`);
        if (h3 && h3.length > 0) {
            console.log(`Sample: ${h3[0].name}`);
            // Print sample to see if it's Leeds
        }
    } catch (e) { console.log('Test 3 Failed'); }

    return; // Stop here for probing
    /* sentinal */

    console.log(`Found ${history.length} matches. Inspecting Scores...`);
    history.forEach((m, i) => {
        const h = m.participants.find(p => p.meta.location === 'home');
        const a = m.participants.find(p => p.meta.location === 'away');
        const score = m.scores ? m.scores.find(s => s.description === 'CURRENT') : null; // CURRENT usually means FT score for finished
        const ftScore = m.scores ? m.scores.find(s => s.description === '2ND_HALF') : null; // Often used as FT

        console.log(`[${i}] ${m.name}`);
        console.log(`    Date: ${m.starting_at}`);
        console.log(`    State: ${m.state_id}`); // ID check
        console.log(`    Scores Raw: len=${m.scores?.length}`);
        if (m.scores) {
            m.scores.forEach(s => console.log(`       - ${s.description}: ${s.score?.goals} goals (part: ${s.participant_id})`));
        }
    });

}

main();
