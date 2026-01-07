// FASE 5: Re-verificación completa con código corregido
// Ejecuta daily-results-verifier para todas las fechas

import fetch from 'node-fetch';

const url = 'https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/daily-results-verifier';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

const dates = [
    '2025-12-27',
    '2025-12-28',
    '2025-12-29',
    '2025-12-30',
    '2025-12-31',
    '2026-01-01',
    '2026-01-02',
    '2026-01-03'
];

async function reverifyDate(date) {
    console.log(`📅 Procesando: ${date}...`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({ date })
        });

        const result = await response.json();

        if (result.success) {
            console.log(`   ✅ Fixtures: ${result.fixtures} | Actualizadas: ${result.updated} | Fallidas: ${result.failed}`);
        } else {
            console.log(`   ❌ Error: ${result.error}`);
        }

        return result;
    } catch (error) {
        console.log(`   ❌ Error de red: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function reverifyAll() {
    console.log('🔄 RE-VERIFICANDO CON CÓDIGO CORREGIDO\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    let totalFixtures = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    for (const date of dates) {
        const result = await reverifyDate(date);

        if (result.success) {
            totalFixtures += result.fixtures || 0;
            totalUpdated += result.updated || 0;
            totalFailed += result.failed || 0;
        }

        // Esperar entre requests
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📋 RESUMEN DE RE-VERIFICACIÓN');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total fixtures procesados: ${totalFixtures}`);
    console.log(`Total predicciones actualizadas: ${totalUpdated}`);
    console.log(`Total fallidas: ${totalFailed}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (totalUpdated > 0) {
        console.log('✅ RE-VERIFICACIÓN EXITOSA');
        console.log(`   ${totalUpdated} predicciones ahora tienen verificación CORRECTA`);
        console.log('   con lógica mejorada (Team Totals + Team Corners)\n');
    } else {
        console.log('⚠️  No se actualizó ninguna predicción');
        console.log('   Esto puede pasar si los fixtures son muy antiguos\n');
    }

    console.log('🎯 SIGUIENTE PASO: Validar que tu caso específico funciona');
    console.log('   (Baniyas Menos de 1.5, Brighton Más de 6.5 Corners)\n');

    return { totalFixtures, totalUpdated, totalFailed };
}

reverifyAll().then(result => {
    console.log('✅ Re-verificación completada');
    console.log(`   Predicciones actualizadas: ${result.totalUpdated}`);
    process.exit(0);
}).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
