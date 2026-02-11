
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log("Checking value_picks_v2 for recent entries...");
    const { data: picks, error } = await supabase
        .from('value_picks_v2')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching picks:", error);
        return;
    }

    if (!picks || picks.length === 0) {
        console.log("No picks found in value_picks_v2");
        return;
    }

    const pick = picks[0];
    console.log(`Found ${picks.length} picks. Last one ID: ${pick.id}`);
    console.log(`Pick Data: fixture_id=${pick.fixture_id}, odds=${pick.odds}, p_implied=${pick.p_implied}, market=${pick.market}`);

    if (pick.fixture_id) {
        console.log(`Fetching fixture ${pick.fixture_id}...`);
        const { data: fixture, error: fixError } = await supabase
            .from('fixtures')
            .select('*')
            .eq('id', pick.fixture_id)
            .single();

        if (fixError) {
            console.error("Error fetching fixture:", fixError);
        } else {
            console.log("Fixture Row:", JSON.stringify(fixture, null, 2));
            console.log("Fixture Home Team:", fixture.home_team);
            console.log("Fixture Away Team:", fixture.away_team);
            console.log("Type of home_team:", typeof fixture.home_team);
        }
    } else {
        console.log("Pick has no fixture_id!");
    }
}

checkData();
