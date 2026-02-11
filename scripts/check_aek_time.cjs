
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFixtureInfo() {
    console.log("Checking match 1400877 (Panserraikos vs AEK Athens)...");

    // Check match info
    const { data: matches, error } = await supabase
        .from('daily_matches')
        .select('*')
        .eq('api_fixture_id', 1400877);

    if (error || !matches || matches.length === 0) {
        console.error("Match 1400877 not found in daily_matches.");
        return;
    }

    const m = matches[0];
    console.log(`Match ID: ${m.api_fixture_id}`);
    console.log(`Home: ${m.home_team}`);
    console.log(`Away: ${m.away_team}`);
    console.log(`Match Date: ${m.match_date}`);
    console.log(`Match Time: ${m.match_time}`);

    // Check if it falls on Feb 8
    const date = new Date(m.match_time);
    console.log(`Parsed Date: ${date.toISOString()}`);

    // Check Pick
    const { data: picks } = await supabase
        .from('value_picks_v2')
        .select('*')
        .eq('fixture_id', 1400877);

    if (picks && picks.length > 0) {
        picks.forEach(p => {
            console.log(`PICK: ${p.selection} (${p.market}) - Prob: ${p.p_model} - Valid: ${p.p_model >= 0.55}`);
        });
    } else {
        console.log("NO PICKS FOUND for 1400877");
    }
}

checkFixtureInfo();
