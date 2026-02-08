
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchSportMonks, getFixtureComplete } from './supabase/functions/_shared/sportmonks-client.ts';
// We can't easily import the edge function handler itself because it uses Deno.serve and edge runtime specific APIs.
// Instead, we will replicate the PAYLOAD CONSTRUCTION logic here to inspect the data we are sending to the AI.
// And we will use a MOCK prompt generation to see if the tokens blow up or if data is missing.

/* 
   AUDIT SCRIPT GOAL:
   1. Fetch data for fixture 19631548 (Man City vs Newcastle, per user screenshot)
   2. Check if data is truly "Zero" or if we have stats.
   3. Check the prompt construction logic (mocked).
*/

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_TOKEN = Deno.env.get("SPORTMONKS_API_TOKEN")!;

if (!SUPABASE_URL || !SUPABASE_KEY || !API_TOKEN) {
    console.error("Missing environment variables.");
    Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FIXTURE_ID = 19631548; // From screenshot

async function runAudit() {
    console.log(`\n🕵️‍♂️ STARTING V5 DEEP AUDIT for Fixture ${FIXTURE_ID}...\n`);

    // 1. Fetch Raw Data from SportMonks
    console.log(`[1] Fetching fresh data from SportMonks API...`);
    const fixtureData = await getFixtureComplete(FIXTURE_ID);

    if (!fixtureData) {
        console.error("❌ CRITICAL: Fixture not found in API.");
        return;
    }

    console.log(`✅ Data Fetched.`);
    console.log(`   - State: ${fixtureData.state?.state}`);
    console.log(`   - Stats Available: ${fixtureData.statistics?.length > 0 ? "YES" : "NO"} (${fixtureData.statistics?.length} entries)`);
    console.log(`   - Lineups Available: ${fixtureData.lineups?.length > 0 ? "YES" : "NO"}`);
    console.log(`   - Events Available: ${fixtureData.events?.length > 0 ? "YES" : "NO"}`);
    console.log(`   - Odds Available: ${fixtureData.odds?.length > 0 ? "YES" : "NO"}`);

    if (fixtureData.statistics?.length === 0) {
        console.warn("\n⚠️ WARNING: STATISTICS ARE EMPTY. This perfectly explains '0 picks' if based on stats.");
        // Investigate why. Is it too early? Screenshot says "miércoles 4 de febrero". Today is Jan.
        // Wait, current date is 2026-02-04?
        // Ah, user simulation time.
    }

    // 2. Simulate Payload Construction
    console.log(`\n[2] Constructing AI Payload (Simulation)...`);

    // Check key data points for the AI
    const homeTeamId = fixtureData.participants?.find((p: any) => p.meta?.location === 'home')?.id;
    const awayTeamId = fixtureData.participants?.find((p: any) => p.meta?.location === 'away')?.id;

    console.log(`   - Home Team ID: ${homeTeamId}`);
    console.log(`   - Away Team ID: ${awayTeamId}`);

    // Check recent form (crucial for "analysis")
    // We won't make the API calls here to avoid complexity, but we know the EDGE FUNCTION does.
    // We assume the Edge Function *fetches* them correctly (audit_api_connectivity.ts passed).

    // 3. AUDIT THE PROMPT LOGIC (Mental Walkthrough & Code Check)
    console.log(`\n[3] Auditing AI Prompt Logic (Hypothesis)...`);
    console.log(`   - Hypothesis A: AI is "lazy" and returns 0 picks because threshold is too high.`);
    console.log(`   - Hypothesis B: The prompt JSON schema is invalid, causing a silent crash/fallback.`);
    console.log(`   - Hypothesis C: The "Edge" definition is confusing.`);

    // We will verify the PROMPT TEXT next by reading the artifacts.

    // 4. Check Database for Existing Report
    console.log(`\n[4] Checking 'reports_v2' for what was ACTUALLY saved...`);
    const { data: report, error } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('fixture_id', FIXTURE_ID)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (report) {
        console.log(`✅ Report Found in DB (ID: ${report.job_id})`);
        console.log(`   - Prompt Version: ${report.prompt_version}`);
        console.log(`   - Created At: ${report.created_at}`);

        // INSPECT THE CONTENT
        const analysis = report.report_packet;
        console.log(`\n[5] INSPECTING SAVED ANALYSIS CONTENT:`);

        if (analysis.resumen_ejecutivo) {
            console.log(`   - Titular: "${analysis.resumen_ejecutivo.titular}"`);
            console.log(`   - Veredicto: "${analysis.resumen_ejecutivo.veredicto}"`);
            console.log(`   - Picks Count: ${analysis.resumen_ejecutivo.picks_principales?.length || 0}`);
        } else {
            console.error(`❌ CRITICAL: 'resumen_ejecutivo' is MISSING in DB record.`);
        }

        if (analysis.pronosticos) {
            console.log(`   - Pronosticos Array: ${analysis.pronosticos.length} items`);
            if (analysis.pronosticos.length === 0) {
                console.warn(`⚠️ "Zero Picks" confirmed in DB.`);
            }
        } else {
            console.log(`   - Pronosticos Array: UNDEFINED`);
        }

    } else {
        console.log(`❌ No report found for this fixture.`);
    }

    console.log(`\n🏁 AUDIT COMPLETE.`);
}

runAudit();
