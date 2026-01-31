
// Script para depurar filtros de SportMonks

if (!global.fetch) {
    console.error('Este script requiere Node.js 18+');
    process.exit(1);
}

const SPORTMONKS_BASE_URL = 'https://api.sportmonks.com/v3/football';
const API_KEY = process.env.SPORTMONKS_API_KEY;
const TEAM_ID = 2864; // Botafogo

if (!API_KEY) {
    console.error('❌ Falta SPORTMONKS_API_KEY');
    process.exit(1);
}

async function testFilter(name, params) {
    console.log(`\nTesting: ${name}`);
    const url = new URL(`${SPORTMONKS_BASE_URL}/fixtures`);
    url.searchParams.set('api_token', API_KEY);

    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
    }

    console.log(`URL: ${url.toString().replace(API_KEY, '***')}`);

    const res = await fetch(url.toString());
    if (!res.ok) {
        console.error(`❌ FAILED ${res.status}: ${await res.text()}`);
    } else {
        const json = await res.json();
        console.log(`✅ SUCCESS! Found ${json.data?.length} fixtures`);
    }
}

async function run() {
    // Intento 1: Lo que tenemos ahora
    await testFilter('Intento 1 (Actual)', {
        'filter[participant_id]': TEAM_ID,
        'per_page': 5
    });

    // Intento 2: Sin corchetes (no estándar, pero probando)
    await testFilter('Intento 2 (Flat)', {
        'participant_id': TEAM_ID,
        'per_page': 5
    });

    // Intento 3: filters en plural (algunas APIs usan esto)
    await testFilter('Intento 3 (filters array)', {
        'filters[participant_id]': TEAM_ID,
        'per_page': 5
    });
}

run();
