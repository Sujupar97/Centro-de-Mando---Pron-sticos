
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFeb8Picks() {
    console.log("Checking picks for Feb 8, 2026...");

    // 1. Get Matches for Feb 8
    const { data: matches, error: mError } = await supabase
        .from('daily_matches')
        .select('api_fixture_id, match_time, home_team, away_team')
        .gte('match_time', '2026-02-08T00:00:00')
        .lt('match_time', '2026-02-08T23:59:59');

    if (mError) {
        console.error("Matches Error:", mError);
        return;
    }

    if (!matches || matches.length === 0) {
        console.log("No matches found for Feb 8.");
        return;
    }

    const matchIds = matches.map(m => m.api_fixture_id);
    console.log(`Found ${matches.length} matches.`);

    // 2. Look for Picks linked to these matches (ANY prob)
    const { data: allPicks, error: pError } = await supabase
        .from('value_picks_v2')
        .select('id, fixture_id, p_model, odds, decision, created_at')
        .in('fixture_id', matchIds)
        .order('p_model', { ascending: false });

    if (pError) console.error("Picks Error:", pError);
    else {
        console.log(`Found ${allPicks.length} picks for Feb 8.`);
        if (allPicks.length > 0) {
            console.log("Top 5 Picks by Probability for Feb 8:");
            allPicks.slice(0, 5).forEach(p => {
                const match = matches.find(m => m.api_fixture_id === p.fixture_id);
                console.log(`- ${match.home_team} vs ${match.away_team} (Fixture ${p.fixture_id}): Prob ${p.p_model} (${p.decision})`);
            });

            const highProb = allPicks.filter(p => p.p_model >= 0.80);
            console.log(`\nCount of picks >= 0.80: ${highProb.length}`);
        }
    }
}

checkFeb8Picks();
