
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY/SERVICE_ROLE in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function trigger() {
    const fixtureId = 1492139; // Vitoria vs Flamengo (Today)
    console.log(`Triggering V3 Analysis for Fixture: ${fixtureId}...`);

    const { data, error } = await supabase.functions.invoke('v3-orchestrator', {
        body: { fixture_id: fixtureId }
    });

    if (error) {
        console.error("Error triggering function:", error);
        return;
    }

    console.log("Success:", data.success);
    if (data.success) {
        console.log("Pipeline Full Result:", JSON.stringify(data, null, 2));
    } else {
        console.error("Pipeline Failed:", data.error);
    }
}

trigger();
