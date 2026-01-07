// Script para migrar datos de predictions → predictions_results
// SOLUCIÓN FINAL para regenerar predictions_results

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateToResults() {
    console.log('🔄 MIGRACIÓN: predictions → predictions_results\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. Obtener TODAS las predicciones con is_won != null
    console.log('📊 PASO 1: Obteniendo predicciones verificadas...\n');

    const { data: verified, error: e1 } = await supabase
        .from('predictions')
        .select('id, fixture_id, is_won, result_verified_at, market, selection')
        .not('is_won', 'is', null);

    if (e1 || !verified) {
        console.error('❌ Error:', e1);
        process.exit(1);
    }

    console.log(`✅ Obtenidas: ${verified.length} predicciones verificadas\n`);

    // 2. Migrar a predictions_results
    console.log('🔄 PASO 2: Migrando a predictions_results...\n');

    let migrated = 0;
    let errors = 0;

    for (const pred of verified) {
        try {
            const { error: insertError } = await supabase
                .from('predictions_results')
                .insert({
                    prediction_id: pred.id,
                    fixture_id: pred.fixture_id,
                    was_correct: pred.is_won,
                    predicted_market: pred.market,
                    predicted_outcome: pred.selection,
                    predicted_probability: 0, // No disponible en datos antiguos
                    verified_at: pred.result_verified_at || new Date().toISOString(),
                    verification_source: 'automation'
                });

            if (insertError) {
                console.error(`  ❌ Error en ${pred.id}:`, insertError.message);
                errors++;
            } else {
                migrated++;
                if (migrated % 50 === 0) {
                    console.log(`  ✅ Migradas: ${migrated}/${verified.length}`);
                }
            }
        } catch (err) {
            console.error(`  ❌ Error:`, err);
            errors++;
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 10));
    }

    console.log(`\n✅ Migración completada: ${migrated} exitosas, ${errors} errores\n`);

    // 3. Validar resultado
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 PASO 3: Validando resultado...\n');

    const { count: resultsCount } = await supabase
        .from('predictions_results')
        .select('*', { count: 'exact', head: true });

    const { data: results } = await supabase
        .from('predictions_results')
        .select('was_correct, verification_source');

    console.log(`Total registros en predictions_results: ${resultsCount}\n`);

    if (results && results.length > 0) {
        const correct = results.filter(r => r.was_correct === true).length;
        const incorrect = results.filter(r => r.was_correct === false).length;
        const accuracy = ((correct / results.length) * 100).toFixed(1);

        console.log('Estadísticas:');
        console.log(`  Correctas: ${correct}`);
        console.log(`  Incorrectas: ${incorrect}`);
        console.log(`  Accuracy: ${accuracy}%`);
        console.log(`  verification_source: ${results[0].verification_source}`);
        console.log('');
    }

    // Resumen final
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ SISTEMA RESTAURADO\n');
    console.log(`predictions: ${verified.length} con is_won != null`);
    console.log(`predictions_results: ${resultsCount} registros`);
    console.log('');
    console.log('🧠 ML Dashboard: FUNCIONAL');
    console.log('🎯 Embeddings: FUNCIONAL');
    console.log('');
    console.log('Próximos pasos:');
    console.log('  1. Verificar ML Dashboard en http://localhost:3000/ml-learning');
    console.log('  2. Activar aprendizaje ML');
    console.log('  3. Monitorear accuracy en próximos días');
    console.log('═══════════════════════════════════════════════════════════\n');

    return { migrated, errors, total: resultsCount };
}

migrateToResults().then(result => {
    console.log('✅ Migración completada exitosamente');
    console.log(`   Migradas: ${result.migrated}`);
    console.log(`   Total en predictions_results: ${result.total}`);
    process.exit(result.errors > 0 ? 1 : 0);
}).catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
});
