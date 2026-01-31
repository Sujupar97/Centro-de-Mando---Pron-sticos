
// Scripts para diagnósticar SportMonks (Node.js version)

// Definir fetch manualmente si no existe (Node < 18)
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

async function fetchSportMonks(endpoint, includes = []) {
    const url = new URL(`${SPORTMONKS_BASE_URL}${endpoint}`);
    url.searchParams.set('api_token', API_KEY);
    if (includes.length > 0) url.searchParams.set('include', includes.join(';'));

    console.log(`Fetching: ${url.toString().replace(API_KEY, '***')}`);

    const res = await fetch(url.toString());
    if (!res.ok) {
        console.error(`HTTP Error ${res.status}: ${await res.text()}`);
        return null;
    }
    return await res.json();
}

async function diagnose() {
    console.log(`Diagnosing SportMonks API for fixture ${FIXTURE_ID}...`);

    // 1. Basic fetch
    const data = await fetchSportMonks(`/fixtures/${FIXTURE_ID}`, ['participants', 'league']);

    if (!data || !data.data) {
        console.error('❌ Failed to fetch basic fixture data');
        return;
    }

    const f = data.data;
    console.log(`✅ Fixture Found: ${f.name} (${f.starting_at})`);

    // 2. Test specific includes causing issues?
    console.log('Testing complex includes...');
    const complex = await fetchSportMonks(`/fixtures/${FIXTURE_ID}`, [
        'participants',
        'lineups',
        'statistics',
        'events',
        'scores',
        'venue',
        'referees',
        'formations',
        'coaches',
        'trends',
        'sidelined',
        'odds',
        'predictions',
        'xGFixture',
        'weatherReport',
        'league',
        'season',
        'round'
    ]);

    if (complex && complex.data) {
        console.log('✅ All includes fetched successfully!');
        const d = complex.data;
        console.log(`- Odds: ${d.odds?.length || 0}`);
        console.log(`- Predictions: ${d.predictions ? 'Yes' : 'No'}`);
        console.log(`- xG: ${d.xGFixture ? 'Yes' : 'No'}`);
    } else {
        console.error('❌ Failed fetching complex includes');
    }
}

diagnose();
