import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const jobId = '4d850129-dd44-484d-a6d8-47d7c80c3c57';

async function checkSpecificJob() {
    console.log(`=== AUDITORÍA JOB ${jobId} ===\n`);

    // 1. Verificar Job
    const { data: job } = await supabase.from('analysis_jobs_v2').select('*').eq('id', jobId).single();
    console.log('1. JOB STATUS:', job?.status || 'NOT FOUND');
    console.log('   Fixture:', job?.fixture_id);
    console.log('   Created:', job?.created_at);

    if (!job) return;

    // 2. Verificar reports_v2 (CRÍTICO: ¿El deploy funcionó?)
    const { data: report, error: repError } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

    console.log('\n2. REPORTS_V2:');
    if (report) {
        console.log('   ✅ FOUND!');
        console.log('   Keys:', Object.keys(report.report_packet || {}).length);
        console.log('   Has pronosticos:', !!(report.report_packet as any)?.pronosticos);
    } else {
        console.log('   ❌ NOT FOUND (El backend NO guardó aquí)');
        console.log('   Error:', repError?.message);
    }

    // 3. Verificar tabla analisis (Backup patch)
    const { data: analisis } = await supabase
        .from('analisis')
        .select('*')
        .eq('partido_id', job.fixture_id)
        .maybeSingle();

    console.log('\n3. ANALISIS TABLE:');
    if (analisis?.resultado_analisis) {
        console.log('   ✅ FOUND!');
        console.log('   Has dashboardData:', !!(analisis.resultado_analisis as any)?.dashboardData);
    } else {
        console.log('   ❌ NOT FOUND');
    }
}

checkSpecificJob();
