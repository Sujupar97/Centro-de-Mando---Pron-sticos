
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJobAndReport(fixtureId) {
    console.log(`Checking Job/Report for Fixture ${fixtureId}...`);

    // 1. Check Job
    const { data: jobs, error: jError } = await supabase
        .from('analysis_jobs_v2')
        .select('*')
        .eq('fixture_id', fixtureId);

    if (jError) {
        console.error("Job Error:", jError);
        return;
    }

    if (!jobs || jobs.length === 0) {
        console.log("No Analysis Job found for this fixture.");
        return;
    }

    const job = jobs[0];
    console.log(`Found Job ${job.id}: Status=${job.status}, Created=${job.created_at}`);

    // 2. Check Report
    const { data: reports, error: rError } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('job_id', job.id);

    if (rError) {
        console.error("Report Error:", rError);
        return;
    }

    if (!reports || reports.length === 0) {
        console.log("No Report found for this job.");
        return;
    }

    const report = reports[0];
    console.log(`Found Report ${report.id} (Created ${report.created_at})`);

    // 3. Inspect Report Packet for Picks
    // The report_packet usually contains the AI JSON
    try {
        const packet = typeof report.report_packet === 'string'
            ? JSON.parse(report.report_packet)
            : report.report_packet;

        console.log("Report Packet Keys:", Object.keys(packet));

        // Check for 'picks_recomendados' or similar
        if (packet.picks_recomendados) {
            console.log("Found 'picks_recomendados' in AI Output:");
            console.log(JSON.stringify(packet.picks_recomendados, null, 2));
        } else {
            console.log("WARNING: 'picks_recomendados' MISSING in report packet.");
            console.log("Full Packet Structure:", JSON.stringify(packet).slice(0, 500) + "...");
        }
    } catch (e) {
        console.error("Error parsing report packet:", e);
    }
}

checkJobAndReport(1400877);
