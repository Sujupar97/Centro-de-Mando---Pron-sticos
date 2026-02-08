/**
 * DIAGNOSTIC SCRIPT: Dump Raw AI Output
 * This script fetches the EXACT JSON that the AI returned for a given job,
 * without any transformation or adaptation.
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Get job ID from command line or use the latest
const JOB_ID = process.argv[2];

async function dumpRawAIOutput() {
    console.log('\n' + '═'.repeat(80));
    console.log('🔬 RAW AI OUTPUT DIAGNOSTIC');
    console.log('═'.repeat(80));

    let jobId = JOB_ID;

    // If no job ID provided, get the latest one
    if (!jobId) {
        console.log('\n📋 No Job ID provided, fetching LATEST analysis job...\n');
        const { data: latestJob } = await supabase
            .from('analysis_jobs_v2')
            .select('id, fixture_id, status, created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!latestJob) {
            console.error('❌ No analysis jobs found');
            return;
        }
        jobId = latestJob.id;
        console.log(`📌 Latest Job: ${jobId}`);
        console.log(`   Fixture: ${latestJob.fixture_id}`);
        console.log(`   Status: ${latestJob.status}`);
        console.log(`   Created: ${latestJob.created_at}`);
    }

    // 1. Fetch from reports_v2 (raw AI output)
    console.log('\n' + '─'.repeat(80));
    console.log('📦 STEP 1: Fetching from reports_v2.report_packet (RAW AI OUTPUT)');
    console.log('─'.repeat(80));

    const { data: reportV2, error: reportError } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('job_id', jobId)
        .single();

    if (reportError) {
        console.error('❌ Error fetching reports_v2:', reportError.message);
    } else if (reportV2) {
        console.log('✅ Found reports_v2 record');
        console.log(`   Created: ${reportV2.created_at}`);
        console.log(`   Prompt Version: ${reportV2.prompt_version || 'N/A'}`);

        const packet = reportV2.report_packet;

        // Show top-level keys
        console.log('\n📊 TOP-LEVEL KEYS in report_packet:');
        Object.keys(packet).forEach(key => {
            const value = packet[key];
            const type = Array.isArray(value) ? `Array[${value.length}]` : typeof value;
            console.log(`   • ${key}: ${type}`);
        });

        // Check for pronosticos
        console.log('\n🎯 PREDICTIONS CHECK:');
        if (packet.pronosticos && packet.pronosticos.length > 0) {
            console.log(`   ✅ pronosticos: ${packet.pronosticos.length} picks`);
            packet.pronosticos.forEach((p, i) => {
                console.log(`      [${i}] ${p.mercado}: ${p.seleccion} @ ${p.probabilidad_calculada_porcentaje}%`);
            });
        } else {
            console.log('   ❌ pronosticos: EMPTY or MISSING');
        }

        if (packet.probabilidades_derbix) {
            console.log(`   ⚠️  probabilidades_derbix: FOUND (AI used alternate format)`);
            console.log('      ' + JSON.stringify(packet.probabilidades_derbix));
        }

        if (packet.pronosticos_listado) {
            console.log(`   ⚠️  pronosticos_listado: FOUND (AI hallucinated key)`);
        }

        // Show analisis_profundo
        console.log('\n📝 ANALYSIS CONTENT CHECK:');
        if (packet.analisis_profundo) {
            console.log('   ✅ analisis_profundo: FOUND');
            Object.keys(packet.analisis_profundo).forEach(k => {
                console.log(`      • ${k}`);
            });
        } else {
            console.log('   ❌ analisis_profundo: MISSING');
        }

        // Dump full JSON
        console.log('\n' + '─'.repeat(80));
        console.log('📄 FULL RAW JSON OUTPUT (report_packet):');
        console.log('─'.repeat(80));
        console.log(JSON.stringify(packet, null, 2));

    } else {
        console.log('❌ No reports_v2 record found for this job');
    }

    // 2. Fetch from analisis table (cached dashboardData)
    console.log('\n' + '─'.repeat(80));
    console.log('📦 STEP 2: Fetching from analisis.resultado_analisis (CACHED DATA)');
    console.log('─'.repeat(80));

    const { data: job } = await supabase
        .from('analysis_jobs_v2')
        .select('fixture_id')
        .eq('id', jobId)
        .single();

    if (job?.fixture_id) {
        const { data: analisis } = await supabase
            .from('analisis')
            .select('resultado_analisis')
            .eq('partido_id', job.fixture_id)
            .single();

        if (analisis?.resultado_analisis) {
            console.log('✅ Found analisis record');
            const cached = analisis.resultado_analisis;

            console.log('\n📊 TOP-LEVEL KEYS in resultado_analisis:');
            Object.keys(cached).forEach(key => {
                const value = cached[key];
                const type = Array.isArray(value) ? `Array[${value.length}]` : typeof value;
                console.log(`   • ${key}: ${type}`);
            });

            if (cached.dashboardData) {
                console.log('\n📊 KEYS in dashboardData:');
                Object.keys(cached.dashboardData).forEach(key => {
                    console.log(`   • ${key}`);
                });

                // Check predictions in dashboardData
                const preds = cached.dashboardData.predicciones_finales?.detalle;
                if (preds && preds.length > 0) {
                    console.log(`\n🎯 Predictions in dashboardData: ${preds.length}`);
                    preds.forEach((p, i) => {
                        console.log(`   [${i}] ${p.mercado}: ${p.seleccion} @ ${p.probabilidad_estimado_porcentaje}%`);
                    });
                } else {
                    console.log('\n🎯 Predictions in dashboardData: EMPTY');
                }
            }
        } else {
            console.log('❌ No analisis record found');
        }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('🏁 DIAGNOSTIC COMPLETE');
    console.log('═'.repeat(80) + '\n');
}

dumpRawAIOutput().catch(console.error);
