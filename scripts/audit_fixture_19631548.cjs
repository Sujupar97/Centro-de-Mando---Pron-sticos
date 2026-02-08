
const API_KEY = 'RhgNCasAS67wuJtawFoMrkokCP51r89L7dMKQIpXoGVv67BKfnWOcKHcjEG5';
const FIXTURE_ID = 19631548; // Man City vs Newcastle

async function auditFixture() {
    console.log(`Auditing Data for Fixture ${FIXTURE_ID}...`);

    // 1. Check Fixture Details & State
    const url = new URL(`https://api.sportmonks.com/v3/football/fixtures/${FIXTURE_ID}`);
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('include', 'participants;state;odds.bookmaker');

    try {
        const res = await fetch(url.toString());
        const json = await res.json();
        const data = json.data;

        if (!data) {
            console.error("❌ Fixture Data NOT found.");
            return;
        }

        console.log(`\n--- FIXTURE DETAILS ---`);
        console.log(`Match: ${data.name}`);
        console.log(`Date: ${data.starting_at}`);
        console.log(`State: ${data.state?.state} (${data.state?.name})`);

        const homeId = data.participants?.find(p => p.meta.location === 'home')?.id;
        const awayId = data.participants?.find(p => p.meta.location === 'away')?.id;

        console.log(`Home ID: ${homeId}`);
        console.log(`Away ID: ${awayId}`);

        // 2. Check Odds
        const odds = data.odds || [];
        console.log(`Odds Available? ${odds.length > 0 ? '✅ YES' : '❌ NO'}`);
        if (odds.length > 0) console.log(`Bookmakers: ${odds.length}`);

        // 3. Check History (Deep Dive Source)
        // We simulate the call made by v2-create-job
        if (homeId) await checkHistory(homeId, "Home");
        if (awayId) await checkHistory(awayId, "Away");

    } catch (e) {
        console.error("Error:", e);
    }
}

async function checkHistory(teamId, label) {
    const url = new URL(`https://api.sportmonks.com/v3/football/fixtures`);
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('participant_id', teamId);
    url.searchParams.set('per_page', '20'); // Deep Dive requires 20
    url.searchParams.set('sort', 'desc');
    url.searchParams.set('order', 'starting_at');
    // Minimal includes for check
    url.searchParams.set('include', 'scores;participants');

    try {
        const res = await fetch(url.toString());
        const json = await res.json();
        const data = json.data || [];

        console.log(`\n--- ${label} HISTORY CHECK (Team ${teamId}) ---`);
        console.log(`Matches Found: ${data.length}`);

        if (data.length < 5) {
            console.warn(`⚠️ WARNING: Very few historical matches (${data.length}). AI might lack context.`);
        } else {
            console.log(`✅ Sufficient history available for Deep Dive.`);
            // Log most recent match
            if (data[0]) console.log(`Last Match: ${data[0].name} (${data[0].starting_at})`);
        }

    } catch (e) {
        console.error("History fetch error:", e);
    }
}

auditFixture();
