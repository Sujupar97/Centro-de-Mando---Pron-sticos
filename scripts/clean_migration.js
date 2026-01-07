// FASE 2B: Limpieza de datos Migration
// Opción B: Re-verificar con daily-results-verifier

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanMigrationData() {
    console.log('🧹 LIMPIEZA DE DATOS MIGRATION - OPCIÓN B\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // PASO 1: Exportar prediction_ids
    console.log('📦 PASO 1: Exportando prediction_ids de Migration...\n');

    const { data: migration, error: e1 } = await supabase
        .from('predictions_results')
        .select('*')
        .eq('verification_source', 'Migration from existing is_won')
        .order('verified_at', { ascending: true });

    if (e1 || !migration) {
        console.error('❌ Error:', e1);
        process.exit(1);
    }

    const predictionIds = [...new Set(migration.map(r => r.prediction_id))];

    console.log(`✅ Migration records: ${migration.length}`);
    console.log(`✅ Unique prediction IDs: ${predictionIds.length}\n`);

    // Guardar backup
    const backupData = {
        fecha_export: new Date().toISOString(),
        total_records: migration.length,
        unique_predictions: predictionIds.length,
        accuracy: ((migration.filter(r => r.was_correct === true).length / migration.length) * 100).toFixed(1),
        prediction_ids: predictionIds,
        full_records: migration
    };

    writeFileSync('scripts/migration_backup.json', JSON.stringify(backupData, null, 2));
    console.log('✅ Backup guardado: scripts/migration_backup.json\n');

    // PASO 2: Conteo ANTES
    console.log('📋 PASO 2: Conteo ANTES de limpieza...\n');

    const { count: beforeMigration } = await supabase
        .from('predictions_results')
        .select('*', { count: 'exact', head: true })
        .eq('verification_source', 'Migration from existing is_won');

    const { count: beforeAutomation } = await supabase
        .from('predictions_results')
        .select('*', { count: 'exact', head: true })
        .eq('verification_source', 'automation');

    console.log(`   Migration: ${beforeMigration}`);
    console.log(`   Automation: ${beforeAutomation}\n`);

    // PASO 3: Eliminar Migration
    console.log('🗑️  PASO 3: Eliminando registros Migration...\n');

    const { error: deleteError, count: deletedCount } = await supabase
        .from('predictions_results')
        .delete({ count: 'exact' })
        .eq('verification_source', 'Migration from existing is_won');

    if (deleteError) {
        console.error('❌ Error al eliminar:', deleteError);
        process.exit(1);
    }

    console.log(`✅ Eliminados: ${deletedCount} registros\n`);

    // PASO 4: Resetear predictions
    console.log('🔄 PASO 4: Reseteando predicciones...\n');

    const batchSize = 50;
    let totalUpdated = 0;

    for (let i = 0; i < predictionIds.length; i += batchSize) {
        const batch = predictionIds.slice(i, i + batchSize);

        const { error: updateError, count } = await supabase
            .from('predictions')
            .update({
                is_won: null,
                result_verified_at: null,
                verification_status: null
            }, { count: 'exact' })
            .in('id', batch);

        if (updateError) {
            console.error(`❌ Error en lote ${i / batchSize + 1}:`, updateError);
            continue;
        }

        totalUpdated += (count || 0);
        console.log(`   Lote ${Math.floor(i / batchSize) + 1}: ${count} predicciones reseteadas`);
    }

    console.log(`\n✅ Total reseteadas: ${totalUpdated} predicciones\n`);

    // PASO 5: Validar limpieza
    console.log('✔️  PASO 5: Validando limpieza...\n');

    const { count: afterMigration } = await supabase
        .from('predictions_results')
        .select('*', { count: 'exact', head: true })
        .eq('verification_source', 'Migration from existing is_won');

    const { count: afterAutomation } = await supabase
        .from('predictions_results')
        .select('*', { count: 'exact', head: true })
        .eq('verification_source', 'automation');

    console.log(`   Migration: ${afterMigration} (esperado: 0)`);
    console.log(`   Automation: ${afterAutomation} (esperado: ${beforeAutomation})\n`);

    // Resumen
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 RESUMEN DE LIMPIEZA');
    console.log('═══════════════════════════════════════════════════════════');

    const success = afterMigration === 0;

    if (success) {
        console.log('✅ LIMPIEZA EXITOSA');
        console.log(`   - Eliminados: ${deletedCount} registros Migration`);
        console.log(`   - Reseteadas: ${totalUpdated} predicciones`);
        console.log(`   - Backup: scripts/migration_backup.json`);
        console.log(`   - Pendientes de re-verificación: ${totalUpdated}`);
    } else {
        console.log('⚠️  LIMPIEZA PARCIAL');
        console.log(`   - Migration restantes: ${afterMigration}`);
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    return {
        success,
        deleted: deletedCount,
        updated: totalUpdated
    };
}

cleanMigrationData().then(result => {
    if (result.success) {
        console.log('🎯 PRÓXIMO PASO: Re-verificar con daily-results-verifier');
        console.log('   Ejecutando automáticamente...\n');
    }
    process.exit(result.success ? 0 : 1);
}).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
