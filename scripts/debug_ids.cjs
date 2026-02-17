
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const date = '2026-02-11';
    console.log(`Checking IDs for date: ${date}`);

    // Fetch 5 matches for today
    const { data: matches } = await supabase
        .from('daily_matches')
        .select('api_fixture_id, home_team, away_team, match_time')
        .gte('match_time', `${date}T00:00:00`)
        .lt('match_time', `${date}T23:59:59`)
        .limit(5);

    console.log('--- Matches (daily_matches) ---');
    if (matches) {
        matches.forEach(m => console.log(`ID: ${m.api_fixture_id} (${typeof m.api_fixture_id}) | ${m.home_team} vs ${m.away_team}`));
    } else {
        console.log("No matches found.");
    }

    // Fetch 5 reports (any recent)
    const { data: reports } = await supabase
        .from('reports_v2')
        .select('fixture_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    console.log('\n--- Reports (reports_v2) ---');
    if (reports) {
        reports.forEach(r => console.log(`ID: ${r.fixture_id} (${typeof r.fixture_id}) | Created: ${r.created_at}`));
    } else {
        console.log("No reports found.");
    }
}

check();
