
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditV2Job(fixtureId: number) {
    console.log(`\n=== AUDITING V2 JOBS FOR FIXTURE ${fixtureId} ===\n`);

    const { data: jobs, error } = await supabase
        .from('analysis_jobs_v2')
        .select('*')
        .eq('fixture_id', fixtureId)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching jobs:", error);
        return;
    }

    if (jobs.length === 0) {
        console.log("No V2 jobs found for this fixture.");
        return;
    }

    console.log(`Found ${jobs.length} jobs.`);

    for (const job of jobs) {
        console.log(`\nJob ID: ${job.id}`);
        console.log(`Status: ${job.status}`);
        console.log(`Coverage Score: ${job.data_coverage_score}`);
        console.log(`Error Message: ${job.error_message || 'None'}`);
        console.log(`Created At: ${job.created_at}`);

        // Check if we have picks (which would imply odds if decision flow worked)
        const { data: picks } = await supabase
            .from('value_picks_v2')
            .select('*')
            .eq('job_id', job.id);

        console.log(`Picks generated: ${picks?.length || 0}`);
        if (picks && picks.length > 0) {
            const withOdds = picks.filter(p => p.odds !== null).length;
            console.log(`Picks with Odds: ${withOdds}`);

            if (withOdds === 0) {
                console.warn("⚠️ NO ODDS DETECTED IN PICKS");
            }
        }
    }
}

auditV2Job(1388449);
