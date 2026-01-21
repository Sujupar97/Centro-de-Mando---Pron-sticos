// Sincronizar análisis V2 existentes a tabla 'analisis' para compatibilidad con v3-parlay-engine
// Ejecutar: node sync_v2_to_analisis.mjs

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseKey = process.argv[2]; // Pasar service role key como argumento

if (!supabaseKey) {
    console.error('Usage: node sync_v2_to_analisis.mjs <SERVICE_ROLE_KEY>');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncV2ToAnalisis() {
    console.log('🔄 Sincronizando análisis V2 a tabla analisis...\n');

    // 1. Obtener todos los jobs V2 completados
    const { data: jobs, error: jobsError } = await supabase
        .from('analysis_jobs_v2')
        .select('id, fixture_id, created_at')
        .eq('status', 'done')
        .order('created_at', { ascending: false });

    if (jobsError) {
        console.error('Error obteniendo jobs:', jobsError);
        return;
    }

    console.log(`📊 Encontrados ${jobs?.length || 0} jobs V2 completados\n`);

    // 2. Para cada job, obtener picks y report
    let synced = 0;
    let skipped = 0;

    for (const job of jobs || []) {
        // Obtener picks (de value_picks_v2)
        const { data: picks } = await supabase
            .from('value_picks_v2')
            .select('*')
            .eq('job_id', job.id);

        // Obtener report (de reports_v2)
        const { data: reportRow } = await supabase
            .from('reports_v2')
            .select('report_packet')
            .eq('job_id', job.id)
            .single();

        if (!picks || picks.length === 0) {
            console.log(`⏭️  Job ${job.id.slice(0, 8)} sin picks, saltando...`);
            skipped++;
            continue;
        }

        const betPicks = picks.filter(p => p.decision === 'BET');
        const reportData = reportRow?.report_packet || {};

        // Crear estructura dashboardData
        const dashboardData = {
            veredicto_analista: {
                decision: betPicks.length > 0 ? 'APOSTAR' : 'OBSERVAR',
                nivel_confianza: betPicks.length > 0 ? (betPicks[0]?.confidence || 70) : 50,
                probabilidad: betPicks.length > 0 ? Math.round((betPicks[0]?.p_model || 0.6) * 100) : 50,
                razon_principal: reportData.resumen_ejecutivo?.titular || 'Análisis V2',
                riesgo_principal: reportData.factores_riesgo?.riesgos?.[0] || 'Sin riesgos identificados',
                seleccion_clave: betPicks[0]?.selection || picks[0]?.selection || 'N/A'
            },
            mercado_recomendado: betPicks.length > 0 ? {
                market_name: betPicks[0]?.market || 'N/A',
                market_key: betPicks[0]?.selection || 'N/A',
                razonamiento: ''
            } : null,
            analisis_mercados_completo: {
                ranking_oportunidades: picks.slice(0, 5).map(p => ({
                    mercado: p.market,
                    seleccion: p.selection,
                    cuota: p.odds,
                    probabilidad: Math.round((p.p_model || 0.5) * 100),
                    edge: Math.round((p.edge || 0) * 100)
                }))
            },
            v2_source: true,
            job_id: job.id,
            generated_at: job.created_at
        };

        // Delete existing record first, then insert
        await supabase
            .from('analisis')
            .delete()
            .eq('partido_id', job.fixture_id);

        const { error: insertError } = await supabase
            .from('analisis')
            .insert({
                partido_id: job.fixture_id,
                resultado_analisis: { dashboardData }
            });

        if (insertError) {
            console.error(`❌ Error sincronizando fixture ${job.fixture_id}:`, insertError.message);
        } else {
            console.log(`✅ Fixture ${job.fixture_id} sincronizado (${betPicks.length} BET picks)`);
            synced++;
        }
    }

    console.log(`\n========================================`);
    console.log(`📈 Sincronización completada:`);
    console.log(`   ✅ Sincronizados: ${synced}`);
    console.log(`   ⏭️  Omitidos: ${skipped}`);
    console.log(`========================================`);
}

syncV2ToAnalisis().catch(console.error);
