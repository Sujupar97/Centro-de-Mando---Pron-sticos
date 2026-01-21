
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
import fs from 'fs';

// Load env
if (fs.existsSync('.env')) {
    dotenv.config({ path: '.env' });
} else {
    console.warn("No .env file found");
}

const sbUrl = process.env.VITE_SUPABASE_URL;
const sbKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!sbUrl || !sbKey) {
    console.error("Missing SUPABASE vars");
    process.exit(1);
}

const supabase = createClient(sbUrl, sbKey);

async function debugData(date) {
    console.log(`\n🔍 DEBUGGING DATA FOR: ${date}`);

    // 1. Check Daily Matches
    const { data: matches, error: matchErr } = await supabase
        .from('daily_matches')
        .select('id, api_fixture_id, match_status, home_team, away_team, match_date')
        .eq('match_date', date);

    if (matchErr) { console.error("Matches Error:", matchErr); return; }
    console.log(`\n1. Daily Matches found: ${matches?.length}`);
    let finishedMatches = [];
    if (matches?.length) {
        console.log("   Sample status:", matches[0].match_status);
        finishedMatches = matches; // We consider all matches now for debugging context
    }

    // 4. GLOBAL COUNTS (To detect if RLS is hiding everything)
    const { count: parlayCount, error: pcErr } = await supabase.from('parlays').select('*', { count: 'exact', head: true });
    console.log(`\n📊 GLOBAL STATS:`);
    console.log(`   - Total Parlays in DB: ${parlayCount} (Error: ${pcErr?.message || 'None'})`);

    const { count: pickCount, error: pickErr } = await supabase.from('value_picks_v2').select('*', { count: 'exact', head: true });
    // Note: picks verification depends on analysis_jobs_v2
    console.log(`   - Total Value Picks V2: ${pickCount} (Error: ${pickErr?.message || 'None'})`);

    const { count: jobCount } = await supabase.from('analysis_jobs_v2').select('*', { count: 'exact', head: true });
    console.log(`   - Total Analysis Jobs V2: ${jobCount}`);

    // 5. SAMPLE DATA (If count > 0)
    if (parlayCount > 0) {
        const { data: sample } = await supabase.from('parlays').select('id, date, status, legs').order('created_at', { ascending: false }).limit(2);
        console.log(`\n   Latest Parlay 1: Date='${sample[0].date}', Legs Count=${sample[0].legs?.length}, Status='${sample[0].status}'`);
    }

    if (pickCount > 0) {
        const { data: sample } = await supabase.from('value_picks_v2').select('id, job_id, market, selection').limit(2);
        console.log(`   Sample Pick 1: ${sample[0].market} - ${sample[0].selection}`);
    }
}

debugData('2026-01-20');
