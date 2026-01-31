import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    // Get latest job
    const { data: job } = await supabase
        .from('analysis_jobs_v2')
        .select('id, fixture_id, status')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    console.log('Latest job:', job);

    if (job) {
        // Check reports_v2
        const { data: report, error: repErr } = await supabase
            .from('reports_v2')
            .select('*')
            .eq('job_id', job.id)
            .maybeSingle();

        console.log('Report in reports_v2:', report ? 'FOUND' : 'NOT FOUND', repErr?.message || '');
        if (report) {
            console.log('Report keys:', Object.keys(report.report_packet || {}));
            console.log('Has pronosticos?:', !!(report.report_packet as any)?.pronosticos);
        }

        // Check analisis
        const { data: analisis, error: anaErr } = await supabase
            .from('analisis')
            .select('resultado_analisis')
            .eq('partido_id', job.fixture_id)
            .maybeSingle();

        console.log('Analisis table:', analisis ? 'FOUND' : 'NOT FOUND', anaErr?.message || '');
        if (analisis) {
            console.log('Has dashboardData?:', !!(analisis.resultado_analisis as any)?.dashboardData);
        }
    }

    process.exit(0);
}

check();
