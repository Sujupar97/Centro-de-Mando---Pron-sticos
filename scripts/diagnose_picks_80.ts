// scripts/diagnose_picks_80.ts
// Diagnostica por qué no aparecen los picks de 80%+ en el sistema de parlays

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    const date = '2026-01-29';
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('DIAGNÓSTICO: PICKS 80%+ PARA PARLAYS');
    console.log('Fecha:', date);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Verificar jobs V2 de hoy
    console.log('1. JOBS EN analysis_jobs_v2:');
    const { data: jobsV2, error: jobsV2Err } = await supabase
        .from('analysis_jobs_v2')
        .select('id, fixture_id, status, created_at')
        .gte('created_at', `${date}T00:00:00`)
        .lt('created_at', `${date}T23:59:59`)
        .eq('status', 'done');

    console.log(`   Encontrados: ${jobsV2?.length || 0} jobs con status=done`);
    if (jobsV2?.length) {
        console.log('   Fixtures:', jobsV2.map(j => j.fixture_id).slice(0, 10).join(', '));
    }

    // 2. Verificar value_picks_v2 para esos jobs
    console.log('\n2. PICKS EN value_picks_v2:');
    if (jobsV2?.length) {
        const jobIds = jobsV2.map(j => j.id);

        // Todos los picks
        const { data: allPicks } = await supabase
            .from('value_picks_v2')
            .select('*')
            .in('job_id', jobIds);

        console.log(`   Total picks (cualquier prob): ${allPicks?.length || 0}`);

        // Picks con 80%+
        const { data: highPicks } = await supabase
            .from('value_picks_v2')
            .select('*')
            .in('job_id', jobIds)
            .gte('p_model', 0.80);

        console.log(`   Picks con p_model >= 0.80: ${highPicks?.length || 0}`);

        if (highPicks?.length) {
            console.log('   Detalle:');
            highPicks.forEach(p => {
                console.log(`     - ${p.market}: ${p.selection} = ${Math.round(p.p_model * 100)}%`);
            });
        }
    }

    // 3. Verificar tabla analisis (donde V3 guarda)
    console.log('\n3. REGISTROS EN TABLA analisis:');
    const { data: analisis } = await supabase
        .from('analisis')
        .select('partido_id, resultado_analisis, created_at')
        .gte('created_at', `${date}T00:00:00`)
        .lt('created_at', `${date}T23:59:59`);

    console.log(`   Encontrados: ${analisis?.length || 0} registros`);

    // 4. Extraer predicciones 80%+ de la tabla analisis
    if (analisis?.length) {
        console.log('\n4. PREDICCIONES 80%+ DENTRO DE dashboardData:');
        let totalHighProb = 0;

        for (const a of analisis) {
            const data = a.resultado_analisis?.dashboardData || a.resultado_analisis;
            if (!data) continue;

            // Intentar extraer predicciones
            const preds = data.predicciones_finales?.detalle ||
                data.predicciones_finales ||
                [];

            if (!Array.isArray(preds)) continue;

            const highProb = preds.filter((p: any) => {
                const prob = p.probabilidad_estimado_porcentaje || p.probabilidad || p.p_model || 0;
                return prob >= 80;
            });

            if (highProb.length) {
                console.log(`\n   Fixture ${a.partido_id}:`);
                highProb.forEach((p: any) => {
                    const prob = p.probabilidad_estimado_porcentaje || p.probabilidad || p.p_model;
                    console.log(`     ✅ ${p.mercado || p.market}: ${p.seleccion || p.selection} = ${prob}%`);
                    totalHighProb++;
                });
            }
        }

        console.log(`\n   TOTAL PICKS 80%+ EN DASHBOARDDATA: ${totalHighProb}`);
    }

    // 5. Conclusión
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('CONCLUSIÓN:');
    console.log('═══════════════════════════════════════════════════════════════');

    const jobsCount = jobsV2?.length || 0;
    const analisisCount = analisis?.length || 0;

    if (jobsCount === 0 && analisisCount > 0) {
        console.log('❌ PROBLEMA: Los análisis están en tabla "analisis" pero NO en "analysis_jobs_v2"');
        console.log('   SOLUCIÓN: El componente HighProbPicks debe consultar tabla "analisis" directamente');
    } else if (jobsCount > 0) {
        console.log('✅ Jobs V2 encontrados. Verificando si tienen picks en value_picks_v2...');
    }
}

diagnose().catch(console.error);
