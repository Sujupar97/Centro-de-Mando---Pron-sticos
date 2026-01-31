
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function auditSpecificJob() {
    const jobId = 'c4663f5b-bba2-4e5b-a065-84883ad9ff52';
    console.log(`Auditing Job ID: ${jobId}`);

    const { data: job, error } = await supabase
        .from('analysis_jobs_v2')
        .select('*')
        .eq('id', jobId)
        .single();

    if (error) {
        console.error("Error fetching job:", error);
        return;
    }

    console.log("Job Found:");
    console.log(`Status: ${job.status}`);
    console.log(`Error: ${job.error_message}`);
    console.log(`Coverage Score: ${job.data_coverage_score}`);

    const { data: picks } = await supabase
        .from('value_picks_v2')
        .select('market, odds, selection, status')
        .eq('job_id', jobId);

    console.log(`Picks: ${picks?.length || 0}`);
    picks?.forEach(p => console.log(`[${p.market}] Sel: ${p.selection} Odds: ${p.odds}`));
}

auditSpecificJob();
