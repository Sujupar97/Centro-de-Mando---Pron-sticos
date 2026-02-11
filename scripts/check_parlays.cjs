
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkParlays() {
    console.log("Checking parlays for Feb 8...");

    const { data: parlays, error } = await supabase
        .from('smart_parlays_v2')
        .select('*')
        .eq('date', '2026-02-08');

    if (error) {
        console.error("Error fetching parlays:", error);
        return;
    }

    if (parlays && parlays.length > 0) {
        console.log(`Found ${parlays.length} parlays.`);
        parlays.forEach(p => {
            console.log(`Parlay: ${p.name}`);
            p.picks.forEach(pick => {
                console.log(`  - Pick: ${pick.fixture_id} | ${pick.selection} | ${pick.home_team} vs ${pick.away_team} | Prob: ${pick.p_model}`);
            });
        });
    } else {
        console.log("NO PARLAYS FOUND for Feb 8.");
    }
}

checkParlays();
