const https = require('https');
const fs = require('fs');

// Read .env manually
const envContent = fs.readFileSync('.env', 'utf-8');
const sbUrlMatch = envContent.match(/SUPABASE_URL=(.+)/);
const sbKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

if (!sbUrlMatch || !sbKeyMatch) {
    console.error('❌ Could not read SUPABASE_URL or KEY from .env');
    process.exit(1);
}

const SUPABASE_URL = sbUrlMatch[1].trim();
const SERVICE_KEY = sbKeyMatch[1].trim();
const LIST_URL = `${SUPABASE_URL}/functions/v1/v2-list-fixtures-sportmonks`;
const CREATE_JOB_URL = `${SUPABASE_URL}/functions/v1/v2-create-job-sportmonks`;

const TODAY = new Date().toISOString().split('T')[0];

console.log(`[VERIFY V4] Starting End-to-End Verification`);
console.log(`[TARGET] ${SUPABASE_URL}`);
console.log(`[DATE] ${TODAY}`);

function request(url, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            path: u.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_KEY}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

(async () => {
    try {
        // 1. Get Fixtures
        console.log(`\n1️⃣ Fetching fixtures for today...`);
        const listRes = await request(LIST_URL, { date: TODAY });

        if (listRes.status !== 200) {
            console.error(`❌ Failed to list fixtures. Status: ${listRes.status}`);
            console.error(listRes.body);
            process.exit(1);
        }

        const fixtures = JSON.parse(listRes.body);
        if (!fixtures || fixtures.length === 0) {
            console.error('⚠️ No fixtures found for today. Cannot verify.');
            process.exit(0);
        }

        const targetFixture = fixtures[0];
        const fixtureId = targetFixture.fixture.id;
        const teams = `${targetFixture.teams?.home?.name} vs ${targetFixture.teams?.away?.name}`;

        console.log(`✅ Found ${fixtures.length} fixtures.`);
        console.log(`🎯 Selecting Fixture ID: ${fixtureId} (${teams})`);

        // 2. Trigger V4 Analysis
        console.log(`\n2️⃣ Triggering V4 Mastermind Engine (Job Creation)...`);
        console.log(`   (This will fetch deep stats 20x and call Gemini-3-Pro-Preview)`);

        const jobRes = await request(CREATE_JOB_URL, { fixture_id: fixtureId });

        if (jobRes.status === 200) {
            console.log(`✅ SUCCESS! HTTP 200 OK`);
            console.log(`RESPONSE: ${jobRes.body}`);
            console.log(`\n🎉 CONCLUSION: Motor V4 is ACTIVE and accepting requests.`);
            console.log(`   If Gemini-3-Pro-Preview was invalid, this usually loops or fails fast.`);
            console.log(`   Check Supabase logs for internal "Model not found" errors if unsure.`);
        } else {
            console.error(`❌ FAILURE. Status: ${jobRes.status}`);
            console.error(`RESPONSE: ${jobRes.body}`);
            console.error(`\nPossible Causes:`);
            console.error(`- Gemini-3-Pro-Preview model name is invalid/private.`);
            console.error(`- Deep Data fetch timed out (Edge Function 10s limit?).`);
        }

    } catch (e) {
        console.error('EXCEPTION:', e);
    }
})();
