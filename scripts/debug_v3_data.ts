import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const jobId = '642ed021-0635-474f-bab3-a5abb94f9b92';

async function debug() {
    console.log('=== DEBUGGING V3 DATA ===\n');

    // 1. Check analysis_jobs_v2
    const { data: job } = await supabase
        .from('analysis_jobs_v2')
        .select('*')
        .eq('id', jobId)
        .single();

    console.log('1. analysis_jobs_v2:');
    console.log('   Status:', job?.status);
    console.log('   Fixture ID:', job?.fixture_id);
    console.log('   Created:', job?.created_at);

    const fixtureId = job?.fixture_id;

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
        console.log('   Has meta:', !!rp.meta);
        console.log('   Keys:', Object.keys(rp).slice(0, 5));
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
        console.log('   Keys:', Object.keys(ra).slice(0, 5));
    }

    // 4. Check if analisis has ANY rows
    const { data: allAnalisis, count } = await supabase
        .from('analisis')
        .select('partido_id', { count: 'exact' })
        .limit(5);

    console.log('\n4. analisis table total:');
    console.log('   Total rows:', count);
    console.log('   Sample partido_ids:', allAnalisis?.map(a => a.partido_id));

    process.exit(0);
}

debug();
