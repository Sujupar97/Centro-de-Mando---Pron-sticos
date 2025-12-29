// Script para probar API-Football directamente con una llamada simple
const API_KEY = process.argv[2] || '';

async function testAPI() {
    console.log('🔍 VERIFICANDO API-FOOTBALL...\n');

    if (!API_KEY) {
        console.log('❌ Necesitas pasar la API key como argumento:');
        console.log('   node scripts/verify_api.mjs TU_API_KEY');
        console.log('\nPuedes obtenerla de: https://dashboard.api-football.com');
        return;
    }

    const targetDate = '2025-12-29';

    // Prueba 1: Llamar a la API directamente sin filtro de liga
    console.log(`📅 Buscando TODOS los partidos para: ${targetDate}`);

    try {
        const response = await fetch(
            `https://v3.football.api-sports.io/fixtures?date=${targetDate}`,
            {
                headers: {
                    'x-rapidapi-key': API_KEY,
                    'x-rapidapi-host': 'v3.football.api-sports.io'
                }
            }
        );

        if (!response.ok) {
            console.log(`❌ Error HTTP: ${response.status}`);
            console.log('   Posibles causas:');
            console.log('   - API key inválida');
            console.log('   - Límite de requests excedido');
            return;
        }

        const data = await response.json();

        console.log(`\n📊 Resultado:`);
        console.log(`   - Results in response: ${data.results}`);
        console.log(`   - Total partidos: ${data.response?.length || 0}`);
        console.log(`   - Errors: ${JSON.stringify(data.errors)}`);

        if (data.response && data.response.length > 0) {
            console.log(`\n⚽ Primeros 10 partidos:`);
            data.response.slice(0, 10).forEach((m, i) => {
                console.log(`   ${i + 1}. ${m.teams.home.name} vs ${m.teams.away.name}`);
                console.log(`      Liga: ${m.league.name} (ID: ${m.league.id})`);
                console.log(`      País: ${m.league.country}`);
            });

            // Mostrar ligas únicas
            const uniqueLeagues = [...new Set(data.response.map(m => `${m.league.id}-${m.league.name}`))];
            console.log(`\n📋 Ligas con partidos mañana: ${uniqueLeagues.length}`);
            uniqueLeagues.slice(0, 20).forEach(l => console.log(`   - ${l}`));

            // Verificar cuáles de nuestras ligas top están
            const ourLeagues = [39, 140, 135, 78, 61, 2, 3]; // Premier, LaLiga, Serie A, Bundesliga, Ligue1, Champions, Europa
            const matchingLeagues = data.response.filter(m => ourLeagues.includes(m.league.id));
            console.log(`\n🎯 Partidos de LIGAS TOP encontrados: ${matchingLeagues.length}`);
            matchingLeagues.forEach(m => {
                console.log(`   ⚽ ${m.teams.home.name} vs ${m.teams.away.name} (${m.league.name})`);
            });

        } else {
            console.log('\n⚠️ No hay partidos para esta fecha.');
        }

    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

testAPI();
