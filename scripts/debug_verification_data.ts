
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/std@0.168.0/dotenv/load.ts";

const sbUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const sbKey = Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY')!; // Need service role to bypass policies if any

// Use user provided keys if not in env (local running might need them set)
// Or better, just rely on what is in .env if I run with deno run -A --env

if (!sbUrl || !sbKey) {
   console.error("Missing SUPABASE vars");
   Deno.exit(1);
}

const supabase = createClient(sbUrl, sbKey);

async function debugData(date: string) {
    console.log(`\n🔍 DEBUGGING DATA FOR: ${date}`);

    // 1. Check Daily Matches (The entry point)
    const { data: matches, error: matchErr } = await supabase
        .from('daily_matches')
        .select('id, api_fixture_id, match_status, home_team, away_team, match_date')
        .eq('match_date', date);
    
    if (matchErr) { console.error("Matches Error:", matchErr); return; }
    console.log(`\n1. Daily Matches found: ${matches?.length}`);
    if (matches?.length) {
        console.log("   Sample status:", matches[0].match_status);
        const finished = matches.filter(m => ['FT', 'AET', 'PEN'].includes(m.match_status));
        console.log(`   Finished (FT/AET/PEN): ${finished.length}`);
        if (finished.length === 0) console.warn("   ⚠️ NO FINISHED MATCHES. Verification loop prevents running on unfinished matches.");
    }

    // 2. Check Parlays
    const { data: parlays, error: parlayErr } = await supabase
        .from('parlays')
        .select('id, status, legs')
        .eq('date', date);

    if (parlayErr) { console.error("Parlays Error:", parlayErr); return; }
    console.log(`\n2. Parlays found: ${parlays?.length}`);
    parlays?.forEach(p => {
        console.log(`   - Parlay ${p.id.slice(0,5)}: Status='${p.status}'`);
    });

    // 3. Check Value Picks (via Analysis Jobs)
    // We need to see if we can link them manually since the EF does an inner join
    const { data: jobs } = await supabase
        .from('analysis_jobs_v2')
        .select('id, fixture_id, status')
        //.eq('created_at', date) // Created date might differ
        .limit(10); // Just check recent
    
    // Better: Get picks directly and check their associated job's fixture
    // But EF logic is: value_picks_v2 -> inner join analysis_jobs_v2 -> filter by fixture_id from daily_matches
    
    // Let's grab one finished match ID if exists
    const ftMatch = matches?.find(m => ['FT', 'AET', 'PEN'].includes(m.match_status));
    if (ftMatch) {
        console.log(`\n3. Tracing connections for match ${ftMatch.home_team} vs ${ftMatch.away_team} (ID: ${ftMatch.api_fixture_id})`);
        
        // Find job for this fixture
        const { data: job } = await supabase
            .from('analysis_jobs_v2')
            .select('id')
            .eq('fixture_id', ftMatch.api_fixture_id)
            .maybeSingle();
        
        if (!job) {
            console.warn("   ⚠️ No Analysis Job found for this fixture. Picks won't be found.");
        } else {
            console.log(`   Job found: ${job.id}`);
            const { data: picks } = await supabase
                .from('value_picks_v2')
                .select('*')
                .eq('job_id', job.id);
            console.log(`   Picks linked to job: ${picks?.length}`);
        }
    } else {
        console.log("\n3. Skipping pick trace (no FT match)");
    }
}

// Run for the target date
debugData('2026-01-20');
