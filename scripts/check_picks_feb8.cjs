
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPicks() {
    const date = '2026-02-08';
    console.log(`Checking picks for ${date}...`);

    // 1. Get Fixtures for Date
    const { data: matches, error: matchesError } = await supabase
        .from('daily_matches')
        .select('api_fixture_id, home_team, away_team')
        .gte('match_time', `${date}T00:00:00`)
        .lt('match_time', `${date}T23:59:59`);

    if (matchesError) {
        console.error("Error fetching matches:", matchesError);
        return;
    }

    console.log(`Found ${matches.length} matches for ${date}.`);
    const fixtureIds = matches.map(m => m.api_fixture_id);

    if (fixtureIds.length === 0) {
        console.log("No matches, so no picks possible.");
        return;
    }

    // 2. Get Picks
    const { data: picks, error: picksError } = await supabase
        .from('value_picks_v2')
        .select('*')
        .in('fixture_id', fixtureIds)
        .order('p_model', { ascending: false });

    if (picksError) {
        console.error("Error fetching picks:", picksError);
        return;
    }

    console.log(`Found ${picks.length} total picks for this date.`);

    // Filter like value-engine
    const validPicks = picks.filter(p => p.decision === 'BET' && p.p_model >= 0.80 && p.odds > 1.05);
    console.log(`Found ${validPicks.length} VALID picks (BET, >=80%, odds>1.05).`);

    validPicks.forEach(p => {
        const match = matches.find(m => m.api_fixture_id === p.fixture_id);
        console.log(`- [${p.p_model * 100}%] ${match?.home_team} vs ${match?.away_team}: ${p.market} ${p.selection} (@${p.odds})`);
    });
}

checkPicks();
