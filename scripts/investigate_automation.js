// INVESTIGACIÓN: ¿Qué pasó con los 221 registros automation?
// SOLO CONSULTA - NO MODIFICA NADA

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateAutomationData() {
    console.log('🔍 INVESTIGACIÓN: ¿Dónde están los datos automation?\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. Ver TODO lo que hay en predictions_results
    console.log('📊 PASO 1: Contenido completo de predictions_results\n');

    const { data: allResults, error: e1 } = await supabase
        .from('predictions_results')
        .select('*')
        .order('verified_at', { ascending: false });

    console.log(`Total registros: ${allResults?.length || 0}\n`);

    if (allResults && allResults.length > 0) {
        // Agrupar por verification_source
        const bySource = {};
        allResults.forEach(r => {
            const source = r.verification_source || 'NULL';
            if (!bySource[source]) {
                bySource[source] = { count: 0, dates: [] };
            }
            bySource[source].count++;
            bySource[source].dates.push(r.verified_at);
        });

        console.log('Por verification_source:');
        Object.entries(bySource).forEach(([source, data]) => {
            console.log(`  ${source}: ${data.count} registros`);
            console.log(`    Primera: ${data.dates[data.dates.length - 1]}`);
            console.log(`    Última: ${data.dates[0]}`);
            console.log('');
        });
    } else {
        console.log('❌ predictions_results está VACÍA\n');
    }

    // 2. Verificar predicciones que DEBERÍAN tener resultado
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 PASO 2: Predicciones con is_won != null\n');

    const { data: withResult } = await supabase
        .from('predictions')
        .select('id, match_date, home_team, away_team, is_won, result_verified_at')
        .not('is_won', 'is', null)
        .order('result_verified_at', { ascending: false })
        .limit(10);

    console.log(`Total predicciones con resultado: ${withResult?.length || 0}\n`);

    if (withResult && withResult.length > 0) {
        console.log('Últimas 10:');
        withResult.forEach(p => {
            console.log(`  - ${p.match_date}: ${p.home_team} vs ${p.away_team}`);
            console.log(`    is_won: ${p.is_won}, verified: ${p.result_verified_at}`);
        });
        console.log('');
    }

    // 3. Buscar si hay relación entre predictions y predictions_results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔗 PASO 3: ¿Hay registros huérfanos?\n');

    // Predicciones que tienen is_won pero NO tienen registro en predictions_results
    const { data: allPredictions } = await supabase
        .from('predictions')
        .select('id, is_won, result_verified_at')
        .not('is_won', 'is', null);

    if (allPredictions) {
        console.log(`Predicciones con is_won != null: ${allPredictions.length}`);

        // Verificar cuántas tienen registro en predictions_results
        let withPredictionResult = 0;

        for (const pred of allPredictions.slice(0, 50)) {
            const { data: result } = await supabase
                .from('predictions_results')
                .select('id')
                .eq('prediction_id', pred.id)
                .limit(1);

            if (result && result.length > 0) {
                withPredictionResult++;
            }
        }

        console.log(`Muestra de 50 predicciones:`);
        console.log(`  - Con registro en predictions_results: ${withPredictionResult}`);
        console.log(`  - SIN registro en predictions_results: ${50 - withPredictionResult}\n`);
    }

    // 4. Verificar logs de la limpieza anterior
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📜 PASO 4: Historial de limpiezas\n');

    console.log('Limpiezas ejecutadas hoy:');
    console.log('  1. clean_contaminated.js (sync-results):');
    console.log('     - Eliminó: 263 registros API-Football');
    console.log('     - Re-verificó: 221 predicciones (29/12 - 02/01)');
    console.log('');
    console.log('  2. clean_migration.js (Migration):');
    console.log('     - Eliminó: 328 registros Migration');
    console.log('     - Re-verificó: 0 predicciones (27/12 sin datos API)');
    console.log('');

    // 5. Conclusión
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 CONCLUSIÓN\n');

    if (!allResults || allResults.length === 0) {
        console.log('❌ PROBLEMA ENCONTRADO:\n');
        console.log('predictions_results está COMPLETAMENTE VACÍA');
        console.log('');
        console.log('💡 POSIBLES CAUSAS:\n');
        console.log('1. La re-verificación con daily-results-verifier NO escribió en predictions_results');
        console.log('   - Esto puede pasar si la función tiene un bug');
        console.log('   - O si las predicciones ya tenían is_won != null (filtro en verifier)');
        console.log('');
        console.log('2. Se ejecutó un DELETE accidental que borró TODO');
        console.log('   - Revisar si clean_migration.js borró más de lo debido');
        console.log('');
        console.log('3. daily-results-verifier solo actualiza predictions, NO predictions_results');
        console.log('   - Verificar el código de la función');
        console.log('');
    } else {
        console.log('✅ Hay datos en predictions_results:');
        console.log(`   Total: ${allResults.length} registros`);
    }

    // 6. Verificar el código de daily-results-verifier
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 PASO 5: Verificar lógica de daily-results-verifier\n');
    console.log('Revisar archivo: supabase/functions/daily-results-verifier/index.ts');
    console.log('Buscar: ¿Escribe en predictions_results O solo en predictions?\n');

    console.log('═══════════════════════════════════════════════════════════\n');

    return {
        resultsCount: allResults?.length || 0,
        predictionsWithResult: allPredictions?.length || 0
    };
}

investigateAutomationData().then(result => {
    console.log('✅ Investigación completada');
    console.log(`   predictions_results: ${result.resultsCount} registros`);
    console.log(`   predictions con resultado: ${result.predictionsWithResult}`);
    console.log('');
    console.log('🎯 PRÓXIMO PASO: Revisar código de daily-results-verifier');
    console.log('   para confirmar si escribe en predictions_results o solo en predictions\n');
    process.exit(0);
}).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
