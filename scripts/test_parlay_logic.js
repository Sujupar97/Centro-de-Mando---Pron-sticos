
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyLinkage(date) {
    console.log(`Checking matches for ${date}...`);

    // 1. Get Matches
    const { data: matches, error: mError } = await supabase
        .from('daily_matches')
        .select('api_fixture_id, match_time, home_team, away_team')
        .gte('match_time', `${date}T00:00:00`)
        .lt('match_time', `${date}T23:59:59`);

    if (mError) {
        console.error("Matches Error:", mError);
        return;
    }

    if (!matches || matches.length === 0) {
        console.log(`No matches found for ${date}`);
        return;
    }

    const matchIds = matches.map(m => m.api_fixture_id);
    console.log(`Found ${matches.length} matches. Sample IDs:`, matchIds.slice(0, 5));

    // 2. Look for Picks linked to these matches
    console.log(`Checking picks with fixture_id in [${matchIds.length} IDs]...`);
    const { data: linkedPicks, error: pError } = await supabase
        .from('value_picks_v2')
        .select('id, fixture_id, p_model, odds, decision')
        .in('fixture_id', matchIds)
        .gte('p_model', 0.80)
        .eq('decision', 'BET');

    if (pError) console.error("Picks Error:", pError);
    else console.log(`Step 2 (Data Linkage): Found ${linkedPicks.length} picks linked to date ${date}`);

    // 3. Look for ANY Picks > 0.80 regardless of date (sanity check)
    // To see if maybe they exist but fixture_id is wrong or date is wrong in DB
    const { data: anyPicks, error: anyError } = await supabase
        .from('value_picks_v2')
        .select('id, fixture_id, p_model, created_at')
        .gte('p_model', 0.80)
        .eq('decision', 'BET')
        .limit(5);

    if (anyError) console.error("Any Picks Error:", anyError);
    else {
        console.log(`Step 3 (Sanity Check): Found ${anyPicks.length} random picks > 0.80.`);
        anyPicks.forEach(p => console.log(`Pick ${p.id}: Fixture ${p.fixture_id}, Prob ${p.p_model}`));

        // Check if any of these match the requested date's IDs
        const overlap = anyPicks.filter(p => matchIds.includes(p.fixture_id));
        console.log(`Overlap from sample: ${overlap.length}`);
    }
}

const targetDate = process.argv[2] || '2026-02-08';
verifyLinkage(targetDate);
