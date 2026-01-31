
// Scripts para diagnósticar SportMonks (Node.js version) - TEST EXHAUSTIVO

if (!global.fetch) {
    console.error('Este script requiere Node.js 18+ o un polyfill de fetch');
    process.exit(1);
}

const SPORTMONKS_BASE_URL = 'https://api.sportmonks.com/v3/football';
const API_KEY = process.env.SPORTMONKS_API_KEY;
const FIXTURE_ID = 19622078;

if (!API_KEY) {
    console.error('❌ Falta SPORTMONKS_API_KEY');
    process.exit(1);
}

async function fetchWithInclude(include) {
    const url = new URL(`${SPORTMONKS_BASE_URL}/fixtures/${FIXTURE_ID}`);
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('include', include);

    // console.log(`Testing include: ${include}`); // Comentado para menos ruido

    const res = await fetch(url.toString());
    if (!res.ok) {
        console.error(`❌ Include '${include}' FAILED: ${res.status} ${res.statusText}`);
        try {
            const txt = await res.text();
            console.error(`   Body: ${txt}`);
        } catch (e) { }
        return false;
    }
    console.log(`✅ Include '${include}' OK`);
    return true;
}

async function diagnose() {
    console.log(`Diagnosing SportMonks API includes for fixture ${FIXTURE_ID}...`);

    const includesToTest = [
        'participants',
        'lineups',
        'statistics',
        'events',
        'scores',
        'venue',
        'referees',
        'formations',
        'coaches',
        'sidelined',
        'odds',
        'predictions',
        'xGFixture',
        'weatherReport',
        'league',
        'season',
        'round'
    ];

    let failed = [];

    for (const inc of includesToTest) {
        const ok = await fetchWithInclude(inc);
        if (!ok) failed.push(inc);
    }

    console.log('\n--------------------------------');
    if (failed.length > 0) {
        console.error(`❌ FAILED INCLUDES (${failed.length}):`);
        failed.forEach(f => console.error(`   - ${f}`));
    } else {
        console.log('✅ ALL INCLUDES PASSED!');
    }
}

diagnose();
