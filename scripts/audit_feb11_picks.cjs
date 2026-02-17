
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditFeb11() {
    console.log("🔍 Auditing Picks for Feb 11, 2026...");

    // 1. Get Matches for Feb 11
    const date = '2026-02-11';
    const { data: matches, error: matchError } = await supabase
        .from('daily_matches')
        .select('api_fixture_id, home_team, away_team, match_time')
        .gte('match_time', `${date}T00:00:00`)
        .lt('match_time', `${date}T23:59:59`);

    if (matchError) {
        console.error("Error fetching matches:", matchError);
        return;
    }

    console.log(`Found ${matches.length} matches for ${date}.`);
    const fixtureIds = matches.map(m => m.api_fixture_id);

    if (fixtureIds.length === 0) {
        console.log("No matches found.");
        return;
    }

    // 2. Get Picks for these matches
    const { data: picks, error: pickError } = await supabase
        .from('value_picks_v2')
        .select('*')
        .in('fixture_id', fixtureIds)
        .order('p_model', { ascending: false });

    if (pickError) {
        console.error("Error fetching picks:", pickError);
        return;
    }

    console.log(`Found ${picks.length} total picks linked to these matches.`);

    // 3. Analyze Buckets
    const buckets = {
        '80+': picks.filter(p => p.p_model >= 0.80),
        '78-79': picks.filter(p => p.p_model >= 0.78 && p.p_model < 0.80),
        '70-77': picks.filter(p => p.p_model >= 0.70 && p.p_model < 0.78),
        'Below 70': picks.filter(p => p.p_model < 0.70)
    };

    console.log("\n📊 Distribution:");
    console.log(`> 80%:    ${buckets['80+'].length}`);
    console.log(`78-79%:   ${buckets['78-79'].length}`);
    console.log(`70-77%:   ${buckets['70-77'].length}`);
    console.log(`< 70%:    ${buckets['Below 70'].length}`);

    // 4. Detail High Prob Picks
    if (buckets['80+'].length > 0) {
        console.log("\n🔥 PICKS > 80% (Should be visible):");
        buckets['80+'].forEach(p => {
            const m = matches.find(x => x.api_fixture_id === p.fixture_id) || {};
            console.log(`- [${(p.p_model * 100).toFixed(0)}%] ${m.home_team} vs ${m.away_team}: ${p.selection} (${p.market})`);
        });
    } else {
        console.log("\n⚠️ NO PICKS > 80% FOUND IN DB.");
    }

    if (buckets['78-79'].length > 0) {
        console.log("\n✨ PICKS 78-79% (Reference):");
        buckets['78-79'].forEach(p => {
            const m = matches.find(x => x.api_fixture_id === p.fixture_id) || {};
            console.log(`- [${(p.p_model * 100).toFixed(0)}%] ${m.home_team} vs ${m.away_team}: ${p.selection} (${p.market})`);
        });
    }

    // Check Creation Time (to see if they are pre-update or post-update)
    if (picks.length > 0) {
        const firstPick = picks[0];
        console.log(`\n🕒 Sample Pick Created At: ${firstPick.created_at}`);
        const pickDate = new Date(firstPick.created_at);
        const tuningDate = new Date('2026-02-10T21:00:00Z'); // Approx time of tuning update

        if (pickDate < tuningDate) {
            console.log("⚠️ NOTE: These picks seem to be generated BEFORE the AI Tuning update.");
        } else {
            console.log("✅ NOTE: These picks were generated AFTER the AI Tuning update.");
        }
    }
}

auditFeb11();
