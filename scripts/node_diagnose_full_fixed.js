
// Scripts para diagnósticar SportMonks (Node.js version) - FLUJO COMPLETO CORREGIDO

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

    // console.log(`Fetching: ${url.pathname}...`);

    const res = await fetch(url.toString());
    if (!res.ok) {
        // console.error(`❌ HTTP Error ${res.status} on ${endpoint}`); 
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    return json.data;
}

// Replicas de funciones del cliente CORREGIDAS
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
        // 'predictions', // REMOVED PERMANENTLY
        // 'xGFixture',   // REMOVED PERMANENTLY
        'weatherReport',
        'league',
        'season',
        'round'
    ]);
}

async function getTeamFixtures(teamId) {
    // FIX APLICADO: Filtros Planos
    return await fetchSportMonks(`/fixtures`, ['participants', 'scores', 'venue', 'league'], {
        'participant_id': teamId, // FLAT FILTER
        'per_page': 5,
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
    // FIX APLICADO: Try/Catch para endpoints prohibidos
    try {
        return await fetchSportMonks(`/predictions/probabilities/fixtures/${id}`);
    } catch (e) {
        console.warn(`[WARN] Predictions not available: ${e.message}`);
        return null;
    }
}

async function getValueBets(id) {
    // FIX APLICADO: Try/Catch para endpoints prohibidos
    try {
        return await fetchSportMonks(`/predictions/value-bets/fixtures/${id}`);
    } catch (e) {
        console.warn(`[WARN] Value Bets not available: ${e.message}`);
        return [];
    }
}


async function diagnoseFullFlow() {
    console.log(`Diagnosing FULL FLOW (FIXED) for fixture ${FIXTURE_ID}...`);

    // STAGE 1
    console.log('\n--- STAGE 1: Main Fixture ---');
    let fixture;
    try {
        fixture = await getFixtureComplete(FIXTURE_ID);
        console.log('✅ Stage 1 OK');
    } catch (e) {
        console.error('❌ Failed Stage 1:', e.message);
        return;
    }

    const homeId = fixture.participants.find(p => p.meta.location === 'home').id;
    const awayId = fixture.participants.find(p => p.meta.location === 'away').id;
    const seasonId = fixture.season_id;

    console.log(`Context: Home=${homeId}, Away=${awayId}, Season=${seasonId}`);

    // STAGE 2
    console.log('\n--- STAGE 2: Parallel Fetches ---');

    // Ejecutar promesas y capturar errores individualmente para no romper todo
    const p1 = getTeamFixtures(homeId).then(r => console.log('✅ Home History OK')).catch(e => console.error('❌ Home History Failed:', e.message));
    const p2 = getTeamFixtures(awayId).then(r => console.log('✅ Away History OK')).catch(e => console.error('❌ Away History Failed:', e.message));
    const p3 = getH2H(homeId, awayId).then(r => console.log('✅ H2H OK')).catch(e => console.error('❌ H2H Failed:', e.message));
    const p4 = seasonId ? getStandings(seasonId).then(r => console.log('✅ Standings OK')).catch(e => console.error('❌ Standings Failed:', e.message)) : Promise.resolve();
    const p5 = getPredictions(FIXTURE_ID).then(r => console.log(r ? '✅ Probabilities OK' : '⚠️ Probabilities Skipped (Graceful fail)'));
    const p6 = getValueBets(FIXTURE_ID).then(r => console.log(r && r.length > 0 ? '✅ ValueBets OK' : '⚠️ ValueBets Skipped/Empty (Graceful fail)'));

    await Promise.all([p1, p2, p3, p4, p5, p6]);
    console.log('\n--- Diagnosis Complete ---');
}

diagnoseFullFlow();
