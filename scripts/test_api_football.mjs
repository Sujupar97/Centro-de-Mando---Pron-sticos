// Script para probar directamente la API de fútbol
// Verifica si hay partidos para mañana en las ligas principales

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || ''; // Poner key aquí para test

async function testFootballAPI() {
    console.log('🏈 PRUEBA DIRECTA DE API-FOOTBALL\n');
    console.log('='.repeat(50));

    // Fecha de mañana
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetDate = tomorrow.toISOString().split('T')[0];

    console.log(`📅 Fecha objetivo: ${targetDate}`);

    // Ligas principales para probar
    const testLeagues = [39, 140, 135, 78, 61]; // Premier, La Liga, Serie A, Bundesliga, Ligue 1

    if (!API_FOOTBALL_KEY) {
        console.log('\n⚠️ API_FOOTBALL_KEY no configurada');
        console.log('   Necesitas configurar la variable de entorno en Supabase:');
        console.log('   Dashboard → Settings → Edge Functions → Secrets');
        console.log('   Agregar: API_FOOTBALL_KEY = tu_key_de_api_football');

        // Probar con fecha ficticia para demo
        console.log('\n📝 Demo con datos ficticios:');
        const fakeMatches = [
            { home: 'Real Madrid', away: 'Barcelona', league: 'La Liga', time: '20:00' },
            { home: 'Man City', away: 'Liverpool', league: 'Premier League', time: '18:30' },
            { home: 'Bayern', away: 'Dortmund', league: 'Bundesliga', time: '15:30' },
        ];

        console.log('\n   Partidos de ejemplo que se escanearían:');
        fakeMatches.forEach(m => {
            console.log(`   ⚽ ${m.home} vs ${m.away} (${m.league}) - ${m.time}`);
        });

        return;
    }

    console.log('\n🔍 Buscando partidos...');

    try {
        const leaguesParam = testLeagues.join('-');
        const response = await fetch(
            `https://v3.football.api-sports.io/fixtures?date=${targetDate}&league=${leaguesParam}`,
            {
                headers: {
                    'x-rapidapi-key': API_FOOTBALL_KEY,
                    'x-rapidapi-host': 'v3.football.api-sports.io'
                }
            }
        );

        if (!response.ok) {
            console.log(`❌ Error HTTP: ${response.status}`);
            return;
        }

        const data = await response.json();

        console.log(`\n✅ Respuesta recibida`);
        console.log(`   Remaining requests: ${data.results || 'N/A'}`);
        console.log(`   Partidos encontrados: ${data.response?.length || 0}`);

        if (data.response && data.response.length > 0) {
            console.log('\n   Partidos:');
            data.response.slice(0, 5).forEach(match => {
                console.log(`   ⚽ ${match.teams.home.name} vs ${match.teams.away.name}`);
                console.log(`      Liga: ${match.league.name}`);
                console.log(`      Hora: ${new Date(match.fixture.timestamp * 1000).toLocaleTimeString()}`);
            });
        } else {
            console.log('\n   ℹ️ No hay partidos programados para mañana en estas ligas');
            console.log('   (Normal en fechas sin jornadas)');
        }

    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n' + '='.repeat(50));
}

testFootballAPI().catch(console.error);
