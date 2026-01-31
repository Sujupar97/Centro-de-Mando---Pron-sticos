import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Fixture ID from URL: 1451286 (Stuttgart vs Young Boys)
const fixtureId = 1451286;

async function deepAudit() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`AUDITORÍA PROFUNDA: Fixture ${fixtureId}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Buscar job
    const { data: job } = await supabase
        .from('analysis_jobs_v2')
        .select('*')
        .eq('fixture_id', fixtureId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!job) {
        console.log('❌ No se encontró job para este fixture');
        return;
    }

    console.log('1. JOB INFO:');
    console.log(`   ID: ${job.id}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Motor: ${job.current_motor}`);
    console.log(`   Creado: ${job.created_at}`);

    // 2. Verificar reports_v2
    const { data: report } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('job_id', job.id)
        .maybeSingle();

    console.log('\n2. REPORTS_V2:');
    if (report) {
        console.log('   ✅ Encontrado');
        console.log('   prompt_version:', report.prompt_version);

        const rp = report.report_packet as any;
        console.log('\n   ESTRUCTURA report_packet:');
        console.log('   Keys principales:', Object.keys(rp || {}).join(', '));

        // Analizar resumen_ejecutivo
        console.log('\n   → resumen_ejecutivo:');
        if (rp?.resumen_ejecutivo) {
            console.log('     Keys:', Object.keys(rp.resumen_ejecutivo).join(', '));
            console.log('     titular:', rp.resumen_ejecutivo.titular?.substring(0, 50) || 'N/A');
            console.log('     frase_principal:', rp.resumen_ejecutivo.frase_principal?.substring(0, 50) || 'N/A');
            console.log('     bullets:', rp.resumen_ejecutivo.bullets?.length || 'N/A');
            console.log('     puntos_clave:', rp.resumen_ejecutivo.puntos_clave?.length || 'N/A');
        } else {
            console.log('     ❌ NO EXISTE');
        }

        // Analizar analisis_detallado
        console.log('\n   → analisis_detallado (o analisis_profundo):');
        const ad = rp?.analisis_detallado || rp?.analisis_profundo;
        if (ad) {
            console.log('     Keys:', Object.keys(ad).join(', '));
        } else {
            console.log('     ❌ NO EXISTE');
        }

        // Analizar pronosticos
        console.log('\n   → pronosticos:');
        if (rp?.pronosticos) {
            console.log('     Cantidad:', rp.pronosticos.length);
            if (rp.pronosticos[0]) {
                console.log('     Sample keys:', Object.keys(rp.pronosticos[0]).join(', '));
            }
        } else {
            console.log('     ❌ NO EXISTE');
        }
    } else {
        console.log('   ❌ NO ENCONTRADO');
    }

    // 3. Verificar tabla analisis
    const { data: analisis } = await supabase
        .from('analisis')
        .select('*')
        .eq('partido_id', fixtureId)
        .maybeSingle();

    console.log('\n3. TABLA ANALISIS:');
    if (analisis?.resultado_analisis) {
        const ra = analisis.resultado_analisis as any;
        console.log('   ✅ Encontrado');
        console.log('   Keys principales:', Object.keys(ra).join(', '));

        if (ra.dashboardData) {
            console.log('\n   → dashboardData:');
            console.log('     Keys:', Object.keys(ra.dashboardData).join(', '));

            // Resumen ejecutivo
            const re = ra.dashboardData.resumen_ejecutivo;
            console.log('\n     → resumen_ejecutivo:');
            if (re) {
                console.log('       Keys:', Object.keys(re).join(', '));
                console.log('       titular:', re.titular?.substring(0, 50) || 'N/A');
                console.log('       frase_principal:', re.frase_principal?.substring(0, 50) || 'N/A');
                console.log('       bullets:', re.bullets?.length || 'N/A');
            } else {
                console.log('       ❌ NO EXISTE');
            }

            // Analisis detallado
            const adDb = ra.dashboardData.analisis_detallado;
            console.log('\n     → analisis_detallado:');
            if (adDb) {
                console.log('       Keys:', Object.keys(adDb).join(', '));
            } else {
                console.log('       ❌ NO EXISTE');
            }

            // Predicciones finales
            const pf = ra.dashboardData.predicciones_finales;
            console.log('\n     → predicciones_finales:');
            if (pf) {
                console.log('       Keys:', Object.keys(pf).join(', '));
                console.log('       detalle count:', pf.detalle?.length || 'N/A');
            } else {
                console.log('       ❌ NO EXISTE');
            }
        }
    } else {
        console.log('   ❌ NO ENCONTRADO');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('FIN AUDITORÍA');
    console.log('═══════════════════════════════════════════════════════════════');
}

deepAudit();
