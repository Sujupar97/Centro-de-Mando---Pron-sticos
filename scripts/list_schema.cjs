
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listSchema() {
    console.log("Listing schema for key tables...");

    // Check daily_matches
    const { data: matches, error: matchesError } = await supabase
        .from('daily_matches')
        .select('*')
        .limit(1);

    if (matchesError) console.error("Error fetching daily_matches:", matchesError);
    else if (matches && matches.length > 0) {
        console.log("daily_matches structure:", Object.keys(matches[0]));
        console.log("Sample:", matches[0]);
    } else {
        console.log("daily_matches is empty.");
    }

    // Check value_picks_v2
    const { data: picks, error: picksError } = await supabase
        .from('value_picks_v2')
        .select('*')
        .limit(1);

    if (picksError) console.error("Error fetching value_picks_v2:", picksError);
    else if (picks && picks.length > 0) {
        console.log("value_picks_v2 structure:", Object.keys(picks[0]));
    }
}

listSchema();
