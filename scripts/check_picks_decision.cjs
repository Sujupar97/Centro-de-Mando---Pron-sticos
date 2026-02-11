
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPicksDecision() {
    console.log("Checking picks decision distribution for Feb 8...");

    // Get daily matches IDs first
    const { data: matches } = await supabase
        .from('daily_matches')
        .select('api_fixture_id')
        .gte('match_date', '2026-02-08')
        .lte('match_date', '2026-02-08');

    const validIds = matches.map(m => m.api_fixture_id);

    // Get picks
    const { data: picks } = await supabase
        .from('value_picks_v2')
        .select('decision')
        .in('fixture_id', validIds);

    if (!picks) return;

    console.log(`Found ${picks.length} picks linked to matches.`);

    // Group by decision
    const distribution = {};

    picks.forEach(p => {
        const d = p.decision;
        distribution[d] = (distribution[d] || 0) + 1;
    });

    console.log("Decision Distribution:", distribution);
}

checkPicksDecision();
