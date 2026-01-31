import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function debug() {
    console.log('=== BUSCANDO ÚLTIMO JOB V3 ===\n');

    // 1. Get latest job
    const { data: job } = await supabase
        .from('analysis_jobs_v2')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!job) {
        console.log('❌ No jobs found');
        return;
    }

    console.log('1. LATEST JOB FOUND:');
    console.log('   ID:', job.id);
    console.log('   Fixture ID:', job.fixture_id);
    console.log('   Status:', job.status);
    console.log('   Created:', job.created_at);

    const jobId = job.id;
    const fixtureId = job.fixture_id;

    // 2. Check reports_v2
    const { data: report } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

    console.log('\n2. reports_v2:');
    console.log('   Found:', !!report);
    if (report?.report_packet) {
        const rp = report.report_packet as any;
        console.log('   Has pronosticos:', !!rp.pronosticos);
        console.log('   Meta:', rp.meta);
    }

    // 3. Check analisis table
    const { data: analisis, error: anaErr } = await supabase
        .from('analisis')
        .select('*')
        .eq('partido_id', fixtureId)
        .maybeSingle();

    console.log('\n3. analisis table (partido_id=' + fixtureId + '):');
    console.log('   Found:', !!analisis);
    console.log('   Error:', anaErr?.message || 'none');

    if (analisis?.resultado_analisis) {
        const ra = analisis.resultado_analisis as any;
        console.log('   Has dashboardData:', !!ra.dashboardData);
        if (ra.dashboardData) {
            console.log('   Veredicto:', ra.dashboardData.veredicto_analista?.decision);
            console.log('   Titular:', ra.dashboardData.header_partido?.subtitulo);
        }
    }

    process.exit(0);
}

debug();
