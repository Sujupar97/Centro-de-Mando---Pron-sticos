
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function triggerAnalysis() {
    console.log("Triggering V2 Analysis for Fixture 1379194...");

    const { data, error } = await supabase.functions.invoke('v2-orchestrator', {
        body: { fixture_id: 1491843 }
    });

    if (error) {
        console.error("Error invoking function:", error);
    } else if (data && data.success) {
        console.log("Function Response Success: true");
        console.log("Job ID:", data.job_id);

        console.log("ODDS DEBUG:", data.payload?.odds_debug);

        if (data.payload?.odds) {
            console.log("✅ ODDS FOUND in Payload!");
            console.log("Bookmaker:", data.payload.odds.bookmaker);
        } else {
            console.warn("⚠️ NO ODDS in Payload (Check logs for mapping failure).");
        }
    } else {
        console.log("Function Response Success: false or no data.");
        console.log("Full response:", data);
    }
}

triggerAnalysis();
