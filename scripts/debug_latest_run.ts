
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLatestRun() {
    console.log(`Connecting to: ${supabaseUrl}`);

    // Check Jobs first
    const { count: jobCount, error: jobErr } = await supabase.from('analysis_jobs').select('*', { count: 'exact', head: true });
    console.log(`Job Count: ${jobCount}, Error: ${jobErr ? JSON.stringify(jobErr) : 'None'}`);

    // Check Runs
    const { count: runCount, error: runErr } = await supabase.from('analysis_runs').select('*', { count: 'exact', head: true });
    console.log(`Run Count: ${runCount}, Error: ${runErr ? JSON.stringify(runErr) : 'None'}`);

    console.log("Fetching latest analysis run...");

    // 1. Get latest run
    const { data: runs, error } = await supabase
        .from('analysis_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error("Error fetching run:", error);
        return;
    }

    if (!runs || runs.length === 0) {
        console.log("No analysis runs found.");
        return;
    }

    const run = runs[0];
    console.log(`Latest Run ID: ${run.id}`);
    console.log(`Fixture ID: ${run.fixture_id}`);
    console.log(`League: ${run.league_name}`);
    console.log(`Created At: ${run.created_at}`);

    // 2. Inspect Raw Evidence
    // Note: create-analysis-job stores result in 'analysis_evidence' table, not jsonb, for bulk data.
    console.log("Checking 'analysis_evidence' table for this run...");
    const { data: evidenceRows, error: evError } = await supabase
        .from('analysis_evidence')
        .select('block_type, fixture_api_id, stats_snapshot')
        .eq('analysis_run_id', run.id);

    if (evError) {
        console.error("Error fetching evidence rows:", evError);
        return;
    }

    // Count by block type
    const counts: Record<string, number> = {};
    const teams: Record<string, any> = {};

    evidenceRows?.forEach((row: any) => {
        counts[row.block_type] = (counts[row.block_type] || 0) + 1;
        // Inspect one snapshot to see teams
        if (!teams[row.block_type]) {
            // Try to extract date
            const fixture = row.stats_snapshot?.fixture || row.stats_snapshot?.date;
            const date = typeof fixture === 'string' ? fixture : fixture?.date;

            teams[row.block_type] = {
                home: row.stats_snapshot?.teams?.home?.name,
                away: row.stats_snapshot?.teams?.away?.name,
                date: date
            };
        }
    });

    console.log("\n--- EVIDENCE BLOCK COUNTS ---");
    console.table(counts);

    // console.log("\n--- SAMPLE DATA PER BLOCK ---");
    // console.log(JSON.stringify(teams, null, 2));
}

debugLatestRun().catch(console.error);
