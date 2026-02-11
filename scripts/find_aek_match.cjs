
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findMatch() {
    console.log("Searching for Panserraikos / AEK match...");

    // Search by team name
    const { data: matches, error } = await supabase
        .from('daily_matches')
        .select('*')
        .or('home_team.ilike.%AEK%,away_team.ilike.%AEK%,home_team.ilike.%Panserraikos%,away_team.ilike.%Panserraikos%');

    if (error) {
        console.error("Error searching matches:", error);
        return;
    }

    if (matches.length === 0) {
        console.log("No matches found for AEK or Panserraikos.");
        return;
    }

    console.log(`Found ${matches.length} matches.`);

    for (const m of matches) {
        console.log(`\nMatch: ${m.home_team} vs ${m.away_team}`);
        console.log(`ID: ${m.api_fixture_id}`);
        console.log(`Time: ${m.match_time}`);

        // Check if it's around Feb 8
        const date = new Date(m.match_time);
        if (date.getFullYear() === 2026 && date.getMonth() === 1) { // Feb 2026
            console.log(">>> TARGET MATCH CANDIDATE <<<");

            // Check picks for this ID
            const { data: picks, error: pError } = await supabase
                .from('value_picks_v2')
                .select('*')
                .eq('fixture_id', m.api_fixture_id);

            if (pError) console.error("Error fetching picks:", pError);
            else {
                console.log(`Linked Picks: ${picks.length}`);
                picks.forEach(p => console.log(`- Pick ${p.id}: Prob ${p.p_model}, Market ${p.market}, Odds ${p.odds}`));
            }
        }
    }
}

findMatch();
