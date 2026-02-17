
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Fetching last report ID...');

    const { data: reports, error: rErr } = await supabase
        .from('reports_v2')
        .select('fixture_id, job_id, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

    if (rErr) console.error("Reports Error:", rErr);

    if (reports && reports.length > 0) {
        const r = reports[0];
        console.log(`Report Found! ID: ${r.fixture_id}, Job ID: ${r.job_id}`);

        // Now fetch job
        const { data: job, error: jErr } = await supabase
            .from('analysis_jobs_v2')
            .select('payload')
            .eq('id', r.job_id)
            .single();

        if (jErr) console.error("Job Error:", jErr);

        if (job) {
            const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
            const match = payload?.match || {};
            console.log(`--- Job Payload for ${r.job_id} ---`);
            console.log('Teams:', `${match.teams?.home?.name} vs ${match.teams?.away?.name}`);
            console.log('Date:', match.date_time);
        } else {
            console.log("No job found.");
        }
    } else {
        console.log("No reports found.");
    }
}

check();
