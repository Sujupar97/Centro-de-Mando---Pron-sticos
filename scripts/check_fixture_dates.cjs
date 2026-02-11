
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFixtureDates() {
    console.log("Checking match dates for fixtures: 1388454, 1503644, 1378018");

    // Check specific fixtures
    const { data: matches, error } = await supabase
        .from('daily_matches')
        .select('api_fixture_id, match_time, home_team, away_team')
        .in('api_fixture_id', [1388454, 1503644, 1378018]);

    if (error) {
        console.error("Error fetching matches:", error);
    } else {
        console.log(`Found ${matches.length} matches:`);
        matches.forEach(m => {
            console.log(`Match ${m.api_fixture_id}: ${m.home_team} vs ${m.away_team} @ ${m.match_time}`);
        });

        // Check if any match found
        if (matches.length === 0) {
            console.log("No matches found in daily_matches for these IDs.");
        }
    }
}

checkFixtureDates();
