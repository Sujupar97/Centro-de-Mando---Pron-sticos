import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function repairAllJobs() {
    console.log('🔧 INICIANDO REPARACIÓN MASIVA DE JOBS V3...\n');

    // 1. Buscar todos los jobs V3 recientes "done"
    const { data: jobs, error } = await supabase
        .from('analysis_jobs_v2')
        .select('*')
        .eq('status', 'done')
        .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Últimas 24h
        .order('created_at', { ascending: false });

    if (!jobs || jobs.length === 0) {
        console.log('No recent jobs found.');
        return;
    }

    console.log(`Escanando ${jobs.length} jobs recientes...`);

    let repairedCount = 0;

    for (const job of jobs) {
        // Verificar si existe en reports_v2
        const { data: report } = await supabase
            .from('reports_v2')
            .select('id')
            .eq('job_id', job.id)
            .maybeSingle();

        if (report) {
            console.log(`✅ Job ${job.id.slice(0, 8)} OK (Ya existe en reports_v2)`);
            continue;
        }

        console.log(`⚠️ Job ${job.id.slice(0, 8)} FALTANTE en reports_v2. Intentando reparar...`);

        // Buscar backup en tabla 'analisis'
        const { data: analisis } = await supabase
            .from('analisis')
            .select('*')
            .eq('partido_id', job.fixture_id)
            .maybeSingle();

        if (!analisis?.resultado_analisis?.dashboardData) {
            console.log(`   ❌ No hay datos backup en tabla analisis. Imposible reparar.`);
            continue;
        }

        // Reconstruir packet
        const dashboard = analisis.resultado_analisis.dashboardData;
        const reportPacket = {
            meta: {
                modelo_version: 'V3-AI-GEMINI-2.0',
                fecha_generacion: new Date().toISOString(),
                fixture_id: job.fixture_id
            },
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
            },
            repaired_by_script: true
        };

        // Insertar en reports_v2
        const { error: insError } = await supabase.from('reports_v2').insert({
            job_id: job.id,
            fixture_id: job.fixture_id,
            report_packet: reportPacket,
            prompt_version: 'V3-REPAIR-BATCH',
            created_at: new Date().toISOString()
        });

        if (insError) {
            console.log(`   ❌ Error insertando: ${insError.message}`);
        } else {
            console.log(`   ✅ Job REPARADO exitosamente.`);
            repairedCount++;
        }
    }

    console.log(`\n🎉 Reparación completada. Total reparados: ${repairedCount}`);
}

repairAllJobs();
