import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function triggerDirectCreate() {
    const args = process.argv.slice(2);
    const fixtureIdArg = args[0];

    if (!fixtureIdArg) {
        console.error("Please provide a fixture_id argument. Example: npx tsx scripts/trigger_analysis_direct_create.ts 1379208");
        process.exit(1);
    }

    const fixtureId = parseInt(fixtureIdArg);
    console.log(`Invoking v2-create-job DIRECTLY for ${fixtureId}...`);

    const { data, error } = await supabase.functions.invoke('v2-create-job', {
        body: { fixture_id: fixtureId }
    });

    if (error) {
        console.error("Function Error:", error);
    } else {
        console.log("---------------------------------------------------");
        console.log("Success:", data.success);
        console.log("Job ID:", data.job_id);
        console.log("---------------------------------------------------");

        if (data.payload?.odds) {
            console.log("✅ ODDS FOUND!");
            console.log("Bookmaker:", data.payload.odds.bookmaker);
            console.log("H2H:", JSON.stringify(data.payload.odds.h2h, null, 2));
            console.log("Totals Lines Count:", data.payload.odds.totals_lines?.length);
            console.log("Current Line 2.5:", JSON.stringify(data.payload.odds.totals, null, 2));
        } else {
            console.log("❌ NO ODDS FOUND IN PAYLOAD");
        }

        console.log("---------------------------------------------------");
        console.log("ODDS DEBUG INFO:", JSON.stringify(data.payload?.odds_debug, null, 2));
    }
}

triggerDirectCreate();
