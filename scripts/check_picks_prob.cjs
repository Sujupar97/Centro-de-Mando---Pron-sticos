
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPicksProb() {
    console.log("Checking picks prob distribution for Feb 8...");

    // Get daily matches IDs first
    const { data: matches } = await supabase
        .from('daily_matches')
        .select('api_fixture_id, home_team, away_team')
        .gte('match_date', '2026-02-08')
        .lte('match_date', '2026-02-08');

    const validIds = matches.map(m => m.api_fixture_id);
    console.log(`Found ${matches.length} matches for Feb 8.`);

    // Get picks
    const { data: picks } = await supabase
        .from('value_picks_v2')
        .select('*')
        .in('fixture_id', validIds);

    if (!picks) return;

    console.log(`Found ${picks.length} picks linked to matches.`);

    // Group by prob
    const distribution = {
        '90+': 0,
        '80-89': 0,
        '70-79': 0,
        '60-69': 0,
        '50-59': 0,
        '<50': 0
    };

    picks.forEach(p => {
        const prob = p.p_model;
        if (prob >= 0.9) distribution['90+']++;
        else if (prob >= 0.8) distribution['80-89']++;
        else if (prob >= 0.7) distribution['70-79']++;
        else if (prob >= 0.6) distribution['60-69']++;
        else if (prob >= 0.5) distribution['50-59']++;
        else distribution['<50']++;

        if (prob >= 0.8) {
            console.log(`High Prob Pick: ${p.fixture_id} (${prob}) - ${matches.find(m => m.api_fixture_id === p.fixture_id)?.home_team}`);
        }
    });

    console.log("Distribution:", distribution);
}

checkPicksProb();
