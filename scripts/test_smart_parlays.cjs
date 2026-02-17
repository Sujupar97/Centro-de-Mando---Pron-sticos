
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSmartParlays() {
    // 1. Check if there are reports for today or recent date
    // If not, maybe use a mock date?
    // Let's try 2026-02-11 (today in user context)
    const date = '2026-02-11';

    console.log(`🤖 Invoking Smart Parlays V2 for date: ${date}...`);

    const { data, error } = await supabase.functions.invoke('v3-smart-parlays', {
        body: { date: date, force_regenerate: true }
    });

    if (error) {
        console.error("❌ Function Error:", error);
        return;
    }

    if (!data.success) {
        console.error("❌ Operation Failed:", data.message || data.error);
        console.log("Full Response:", JSON.stringify(data, null, 2));
        if (data.logs && Array.isArray(data.logs)) {
            console.log("\n📜 FUNCTION LOGS:");
            data.logs.forEach(l => console.log(l));
        }
        return;
    }

    console.log("✅ Success!");
    console.log("------------------------------------------");
    console.log("PARLAY ARCHITECT RESULT:");
    console.log(JSON.stringify(data.parlay, null, 2));
    console.log("------------------------------------------");
}

testSmartParlays();
