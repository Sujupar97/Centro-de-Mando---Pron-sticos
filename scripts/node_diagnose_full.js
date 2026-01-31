
// Scripts para diagnósticar SportMonks (Node.js version) - FLUJO COMPLETO

if (!global.fetch) {
    console.error('Este script requiere Node.js 18+ o un polyfill de fetch');
    process.exit(1);
}

const SPORTMONKS_BASE_URL = 'https://api.sportmonks.com/v3/football';
const API_KEY = process.env.SPORTMONKS_API_KEY;
const FIXTURE_ID = 19622078; // Botafogo vs Cruzeiro

if (!API_KEY) {
    console.error('❌ Falta SPORTMONKS_API_KEY');
    process.exit(1);
}

async function fetchSportMonks(endpoint, includes = [], filters = {}) {
    const url = new URL(`${SPORTMONKS_BASE_URL}${endpoint}`);
    url.searchParams.set('api_token', API_KEY);
    if (includes.length > 0) url.searchParams.set('include', includes.join(';'));
    for (const [k, v] of Object.entries(filters)) url.searchParams.set(k, v);

    console.log(`Fetching: ${url.pathname}...`);

    const res = await fetch(url.toString());
    if (!res.ok) {
        console.error(`❌ HTTP Error ${res.status} on ${endpoint}: ${await res.text()}`);
        return null; // Return null on error to simulate client behavior
    }
    const json = await res.json();
    return json.data;
}

// Replicas de funciones del cliente
async function getFixtureComplete(id) {
    return await fetchSportMonks(`/fixtures/${id}`, [
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
        // 'predictions', // REMOVED
        // 'xGFixture',   // REMOVED
        'weatherReport',
        'league',
        'season',
        'round'
    ]);
}

async function getTeamFixtures(teamId) {
    return await fetchSportMonks(`/fixtures`, ['participants', 'scores', 'venue', 'league'], {
        'filter[participant_id]': teamId,
        'per_page': 5, // Reduced for test
        'order': 'starting_at',
        'sort': 'desc'
    });
}

async function getH2H(t1, t2) {
    return await fetchSportMonks(`/fixtures/head-to-head/${t1}/${t2}`, ['participants', 'scores'], { 'per_page': 5 });
}

async function getStandings(seasonId) {
    return await fetchSportMonks(`/standings/seasons/${seasonId}`, ['participant', 'details']);
}

async function getPredictions(id) {
    // Esta función llama a un endpoint diferente
    return await fetchSportMonks(`/predictions/probabilities/fixtures/${id}`);
}

async function getValueBets(id) {
    return await fetchSportMonks(`/predictions/value-bets/fixtures/${id}`);
}


async function diagnoseFullFlow() {
    console.log(`Diagnosing FULL FLOW for fixture ${FIXTURE_ID}...`);

    // STAGE 1
    console.log('\n--- STAGE 1: Main Fixture ---');
    const fixture = await getFixtureComplete(FIXTURE_ID);
    if (!fixture) {
        console.error('❌ Failed Stage 1');
        return;
    }
    console.log('✅ Stage 1 OK');

    const homeId = fixture.participants.find(p => p.meta.location === 'home').id;
    const awayId = fixture.participants.find(p => p.meta.location === 'away').id;
    const seasonId = fixture.season_id;

    console.log(`Context: Home=${homeId}, Away=${awayId}, Season=${seasonId}`);

    // STAGE 2
    console.log('\n--- STAGE 2: Parallel Fetches ---');

    const p1 = getTeamFixtures(homeId).then(r => console.log(r ? '✅ Home History OK' : '❌ Home History Failed'));
    const p2 = getTeamFixtures(awayId).then(r => console.log(r ? '✅ Away History OK' : '❌ Away History Failed'));
    const p3 = getH2H(homeId, awayId).then(r => console.log(r ? '✅ H2H OK' : '❌ H2H Failed'));
    const p4 = seasonId ? getStandings(seasonId).then(r => console.log(r ? '✅ Standings OK' : '❌ Standings Failed')) : Promise.resolve();

    // PROBANDO ENDPOINTS DE PREDICCIONES Y VALUE BETS QUE TAMBIÉN PODRÍAN ESTAR PROHIBIDOS
    const p5 = getPredictions(FIXTURE_ID).then(r => console.log(r ? '✅ Probabilities OK' : '❌ Probabilities API Failed (403?)'));
    const p6 = getValueBets(FIXTURE_ID).then(r => console.log(r ? '✅ ValueBets OK' : '❌ ValueBets API Failed (403?)'));

    await Promise.all([p1, p2, p3, p4, p5, p6]);
    console.log('\n--- Diagnosis Complete ---');
}

diagnoseFullFlow();
