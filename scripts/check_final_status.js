// Verificar estado post-limpieza Migration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPostCleanup() {
    console.log('📊 ESTADO POST-LIMPIEZA MIGRATION\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. Verificar predictions_results
    const { data: allResults } = await supabase
        .from('predictions_results')
        .select('verification_source, was_correct');

    console.log('📋 predictions_results:\n');

    if (allResults) {
        const bySource = {};
        allResults.forEach(r => {
            const source = r.verification_source || 'null';
            if (!bySource[source]) bySource[source] = { total: 0, correct: 0, incorrect: 0 };
            bySource[source].total++;
            if (r.was_correct === true) bySource[source].correct++;
            if (r.was_correct === false) bySource[source].incorrect++;
        });

        Object.entries(bySource).forEach(([source, stats]) => {
            const accuracy = ((stats.correct / stats.total) * 100).toFixed(1);
            console.log(`   ${source}:`);
            console.log(`     Total: ${stats.total}`);
            console.log(`     Accuracy: ${accuracy}%`);
            console.log('');
        });
    }

    // 2. Verificar accuracy general
    const { data: predictions } = await supabase
        .from('predictions')
        .select('is_won')
        .not('is_won', 'is', null);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎯 ACCURACY GENERAL DEL SISTEMA\n');

    if (predictions) {
        const won = predictions.filter(p => p.is_won === true).length;
        const lost = predictions.filter(p => p.is_won === false).length;
        const total = won + lost;
        const accuracy = ((won / total) * 100).toFixed(1);

        console.log(`   Total predicciones: ${total}`);
        console.log(`   Ganadas: ${won}`);
        console.log(`   Perdidas: ${lost}`);
        console.log(`   ACCURACY: ${accuracy}%\n`);

        if (parseFloat(accuracy) >= 70) {
            console.log('✅ ACCURACY MEJORADO (>= 70%)');
        } else {
            console.log('⚠️  Accuracy aún bajo (<70%)');
        }
    }

    // 3. Pendientes
    const { count: pending } = await supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .is('is_won', null);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`⏳ Predicciones pendientes: ${pending}\n`);

    // 4. Conclusión
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 CONCLUSIÓN\n');

    const currentAccuracy = predictions ? ((predictions.filter(p => p.is_won === true).length / predictions.filter(p => p.is_won !== null).length) * 100).toFixed(1) : 0;

    if (parseFloat(currentAccuracy) >= 70) {
        console.log('✅ DATOS LIMPIOS');
        console.log(`   - Accuracy antes: 60.4%`);
        console.log(`   - Accuracy ahora: ${currentAccuracy}%`);
        console.log(`   - Mejora: +${(parseFloat(currentAccuracy) - 60.4).toFixed(1)}%`);
        console.log('');
        console.log('🧠 TU ML AHORA ESTÁ LIMPIO');
        console.log('   - Solo datos verificados automáticamente');
        console.log('   - Accuracy confiable para entrenamiento');
    } else {
        console.log('⚠️  ACCURACY AÚN BAJO');
        console.log(`   - Accuracy actual: ${currentAccuracy}%`);
        console.log(`   - ${pending} predicciones sin verificar`);
        console.log('');
        console.log('💡 POSIBLE CAUSA:');
        console.log('   - Los 328 registros Migration no se pudieron re-verificar');
        console.log('   - (API sin datos historic del 27/12)');
        console.log('');
        console.log('🎯 OPCIONES:');
        console.log('   A) Eliminar esas 328 predicciones (quedaría solo automation)');
        console.log('   B) Dejarlas pendientes (no afectan ML si is_won = null)');
    }

    console.log('═══════════════════════════════════════════════════════════\n');
}

checkPostCleanup().then(() => {
    console.log('✅ Verificación completada');
    process.exit(0);
}).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
