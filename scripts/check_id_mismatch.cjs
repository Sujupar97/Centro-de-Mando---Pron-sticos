
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFixtureDiscrepancy() {
    console.log("Checking Fixture ID 19451998 vs 1400877...");

    // 1. Check Value Picks for the report's Fixture ID (19451998)
    const { data: picks, error: pError } = await supabase
        .from('value_picks_v2')
        .select('*')
        .eq('fixture_id', 19451998);

    if (pError) console.error("Picks Error:", pError);
    else {
        console.log(`Found ${picks.length} picks for ID 19451998 (from Report).`);
        if (picks.length > 0) {
            const highProb = picks.filter(p => p.p_model >= 0.80);
            console.log(`- High Prob Picks (>0.80): ${highProb.length}`);
            highProb.forEach(p => console.log(`  - ${p.market} ${p.selection} (${p.p_model}) IsBet: ${p.decision}`));
        }
    }

    // 2. Check Daily Matches for that ID (19451998)
    const { data: match1, error: mError1 } = await supabase
        .from('daily_matches')
        .select('*')
        .eq('api_fixture_id', 19451998);

    if (mError1) console.error("Match 1 Error:", mError1);
    else {
        if (match1.length > 0) {
            console.log(`Found Match for ID 19451998 in daily_matches!`);
            console.log(`- ${match1[0].home_team} vs ${match1[0].away_team} @ ${match1[0].match_time}`);
        } else {
            console.log(`ID 19451998 NOT found in daily_matches.`);
        }
    }

    // 3. Check Daily Matches for the "other" ID (1400877) we found earlier
    const { data: match2, error: mError2 } = await supabase
        .from('daily_matches')
        .select('*')
        .eq('api_fixture_id', 1400877);

    if (mError2) console.error("Match 2 Error:", mError2);
    else {
        if (match2.length > 0) {
            console.log(`Found Match for ID 1400877 in daily_matches!`);
            console.log(`- ${match2[0].home_team} vs ${match2[0].away_team} @ ${match2[0].match_time}`);
        } else {
            console.log(`ID 1400877 NOT found in daily_matches (Wait, we found it earlier?).`);
        }
    }
}

checkFixtureDiscrepancy();
