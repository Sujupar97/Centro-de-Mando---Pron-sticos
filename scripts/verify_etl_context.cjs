
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Fetching etl_context from analysis_jobs_v2...');

    const { data: job, error } = await supabase
        .from('analysis_jobs_v2')
        .select('id, etl_context')
        .neq('etl_context', null) // Avoid nulls
        .limit(1)
        .single();

    if (error) {
        console.error("Error fetching job:", error);
        return;
    }

    if (job) {
        const payload = job.etl_context;
        console.log(`Job ID: ${job.id}`);
        console.log(`Has etl_context? ${!!payload}`);
        if (payload && payload.match) {
            console.log('Teams:', `${payload.match.teams?.home?.name} vs ${payload.match.teams?.away?.name}`);
        }
    } else {
        console.log("No job found with etl_context.");
    }
}

check();
