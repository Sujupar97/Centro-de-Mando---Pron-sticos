// Script para configurar cron de daily-results-verifier via Management API
// Ejecuta diariamente a las 4 AM UTC (11 PM Colombia)

const SUPABASE_PROJECT_REF = 'nokejmhlpsaoerhddcyc';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function configureCron() {
    console.log('🔧 Configurando cron para daily-results-verifier...\n');

    if (!SUPABASE_ACCESS_TOKEN) {
        console.error('❌ ERROR: Falta SUPABASE_ACCESS_TOKEN');
        console.error('');
        console.error('Necesitas un token de acceso de Supabase:');
        console.error('1. Ve a: https://supabase.com/dashboard/account/tokens');
        console.error('2. Crea un nuevo token');
        console.error('3. Ejecuta: export SUPABASE_ACCESS_TOKEN="tu_token"');
        console.error('4. Vuelve a ejecutar este script');
        process.exit(1);
    }

    const apiUrl = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/functions/daily-results-verifier/schedule`;

    const cronConfig = {
        schedule: '0 4 * * *', // 4 AM UTC diario
        enabled: true
    };

    console.log(`📅 Configuración del cron:`);
    console.log(`   Schedule: ${cronConfig.schedule}`);
    console.log(`   Horario: 4:00 AM UTC (11:00 PM Colombia)`);
    console.log(`   Estado: ${cronConfig.enabled ? 'ACTIVO' : 'INACTIVO'}`);
    console.log('');

    try {
        const response = await fetch(apiUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cronConfig)
        });

        console.log(`📊 Status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const data = await response.json();
            console.log('\n✅ CRON CONFIGURADO EXITOSAMENTE');
            console.log('');
            console.log('📋 Detalles:');
            console.log(JSON.stringify(data, null, 2));
            console.log('');
            console.log('🎯 Próxima ejecución: Mañana a las 4:00 AM UTC');
        } else {
            const error = await response.json();
            console.error('\n❌ ERROR al configurar cron:');
            console.error(JSON.stringify(error, null, 2));
            console.log('');
            console.log('💡 Alternativa: Configurar manualmente en Dashboard');
            console.log('   1. Ve a: https://supabase.com/dashboard/project/nokejmhlpsaoerhddcyc/functions');
            console.log('   2. Busca daily-results-verifier');
            console.log('   3. Pestaña "Cron Jobs" o "Schedule"');
            console.log('   4. Agrega: 0 4 * * * (4 AM UTC)');
        }

    } catch (error) {
        console.error('\n❌ ERROR de red:');
        console.error(error.message);
    }
}

configureCron().then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Script fallido:', err);
    process.exit(1);
});
