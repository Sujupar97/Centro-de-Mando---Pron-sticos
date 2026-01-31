
// scripts/diagnose_list_scores.js
// using native fetch (Node 18+)

const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
// Using anon key if public, but for function invocation usually need Authorization header with Bearer ANON_KEY
// Assuming the user environment has one, or I will try to invoke without auth first (often protected).
// Wait, I can use the same token I used for deployment if I want to simulate an authenticated user?
// Or better, I will assume the function is callable with the ANON KEY which I saw in .env earlier.
// Wait, I saw ANON KEY in .env in a previous turn?
// Ah, step 2233 showed .env. Let's use that key.
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.x1icf0Wbkp1xb6h1500HeTvyNykBAAnlqz1udv2AaX4'; // This looks like service role key from step 2233 line 3 says SERVICE_ROLE_KEY.
// Wait, line 3 says SERVICE_ROLE_KEY. Usually I should use ANON key for client simulation.
// But SERVICE_ROLE_KEY will definitely work.

async function run() {
    const dateToCheck = '2025-01-31'; // Today/Yesterday depending on timezone. User screenshot says "31 DE ENE".

    console.log(`Checking fixtures for ${dateToCheck}...`);

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/v2-list-fixtures-sportmonks`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ANON_KEY}`, // Using Service Role is fine for diagnosis
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ date: dateToCheck, debug: true })
        });

        if (!response.ok) {
            console.error('Error fetching:', response.status, await response.text());
            return;
        }

        const data = await response.json();
        console.log(`Found ${data.length} fixtures.`);

        // Filter finished matches (HANDLE RAW STRUCTURE)
        // Raw SM: item.state.short_name
        const finished = data.filter(g => {
            const status = g.state ? g.state.short_name : (g.fixture ? g.fixture.status.short : 'UNKNOWN');
            return ['FT', 'AET', 'PEN'].includes(status);
        });

        console.log(`Finished matches: ${finished.length}`);

        // Check goals - Log first 5
        finished.slice(0, 5).forEach(game => {
            const homeName = game.participants ? game.participants.find(p => p.meta.location === 'home').name : (game.teams ? game.teams.home.name : 'Unknown');
            const awayName = game.participants ? game.participants.find(p => p.meta.location === 'away').name : (game.teams ? game.teams.away.name : 'Unknown');

            console.log(`\nMatch: ${homeName} vs ${awayName}`);
            console.log(`Scores Array (Raw):`, JSON.stringify(game.scores));
        });

    } catch (e) {
        console.error('Exception:', e);
    }
}

run();
