// Script para ejecutar manualmente daily-results-verifier
// Verifica que la función está funcional antes de proceder a limpieza

const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

async function testDailyResultsVerifier() {
    console.log('🧪 Probando daily-results-verifier...\n');

    const functionUrl = `${SUPABASE_URL}/functions/v1/daily-results-verifier`;

    // Test con fecha del 1 de Enero
    const testDate = '2026-01-01';

    console.log(`📅 Ejecutando para fecha: ${testDate}`);
    console.log(`🔗 URL: ${functionUrl}\n`);

    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ date: testDate })
        });

        console.log(`📊 Status: ${response.status} ${response.statusText}`);

        const data = await response.json();
        console.log('\n📦 Respuesta:');
        console.log(JSON.stringify(data, null, 2));

        if (response.ok && data.success) {
            console.log('\n✅ daily-results-verifier FUNCIONA CORRECTAMENTE');
            console.log(`   Fixtures verificados: ${data.fixtures || 0}`);
            console.log(`   Predicciones actualizadas: ${data.updated || 0}`);
            console.log(`   Fallos: ${data.failed || 0}`);

            if (data.updated > 0) {
                console.log('\n🎯 LISTO PARA FASE 2');
                console.log('   La función está procesando predicciones correctamente.');
            } else {
                console.log('\n⚠️  ADVERTENCIA: No actualizó predicciones');
                console.log('   Posibles razones:');
                console.log('   - No hay predicciones para esa fecha');
                console.log('   - Todas ya están verificadas');
                console.log('   - Filtro is_won = null no encuentra nada');
            }
        } else {
            console.log('\n❌ ERROR: daily-results-verifier NO funcionó correctamente');
            console.log('   Revisar logs en Supabase Dashboard');
        }

    } catch (error) {
        console.error('\n❌ ERROR al invocar función:');
        console.error(error.message);
        console.log('\n🔍 Posibles causas:');
        console.log('   - Función no desplegada');
        console.log('   - Credenciales incorrectas');
        console.log('   - Network error');
    }
}

// Ejecutar
testDailyResultsVerifier().then(() => {
    console.log('\n✅ Test completado');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Test fallido:', err);
    process.exit(1);
});
