import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function findAndClean() {
    // Buscar últimos 5 jobs para limpiar
    const { data: jobs } = await supabase
        .from('analysis_jobs_v2')
        .select('id, fixture_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('Últimos 5 jobs:', jobs);

    if (jobs && jobs.length > 0) {
        for (const job of jobs) {
            console.log(`Limpiando job: ${job.id}, fixture: ${job.fixture_id}`);

            await supabase.from('analysis_jobs_v2').delete().eq('id', job.id);
            await supabase.from('reports_v2').delete().eq('job_id', job.id);
            await supabase.from('reports_v2').delete().eq('fixture_id', job.fixture_id);
            await supabase.from('analisis').delete().eq('partido_id', job.fixture_id);
        }
        console.log('✅ Todos los jobs limpiados');
    }
}

findAndClean();
