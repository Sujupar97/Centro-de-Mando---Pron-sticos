import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const jobId = '4d850129-dd44-484d-a6d8-47d7c80c3c57';

async function repairJob() {
    console.log(`🔧 REPARANDO JOB ${jobId}...`);

    // 1. Get job info
    const { data: job } = await supabase.from('analysis_jobs_v2').select('*').eq('id', jobId).single();
    if (!job) {
        console.error('❌ Job not found');
        return;
    }

    // 2. Get existing analysis data from 'analisis'
    const { data: analisis } = await supabase
        .from('analisis')
        .select('*')
        .eq('partido_id', job.fixture_id)
        .single();

    if (!analisis?.resultado_analisis?.dashboardData) {
        console.error('❌ No valid dashboardData found in analisis table');
        return;
    }

    console.log('✅ Found dashboardData in analisis table');
    const dashboard = analisis.resultado_analisis.dashboardData;

    // 3. Reconstruct minimal report_packet
    const reportPacket = {
        meta: {
            modelo_version: 'V3-AI-GEMINI-2.0',
            fecha_generacion: new Date().toISOString(),
            fixture_id: job.fixture_id
        },
        // Mapear lo que podamos del dashboardData hacia atrás
        resumen_ejecutivo: dashboard.resumen_ejecutivo,
        pronosticos: dashboard.predicciones_finales?.detalle?.map((p: any) => ({
            mercado: p.mercado,
            seleccion: p.seleccion,
            probabilidad_calculada_porcentaje: p.probabilidad_estimado_porcentaje,
            cuota_actual: p.odds,
            edge_porcentaje: p.edge,
            justificacion: p.justificacion_detallada
        })) || [],
        factores_riesgo: {
            riesgo_principal: dashboard.advertencias?.riesgos?.[0] || 'N/A'
        }
    };

    // 4. Insert into reports_v2
    const { error } = await supabase.from('reports_v2').insert({
        job_id: jobId,
        fixture_id: job.fixture_id,
        report_packet: reportPacket,
        prompt_version: 'V3-REPAIR-SCRIPT', // Campo requerido que faltaba
        created_at: new Date().toISOString()
    });

    if (error) {
        console.error('❌ Error inserting into reports_v2:', error);
    } else {
        console.log('✅ Job reparado exitosamente en reports_v2');
    }
}

repairJob();
