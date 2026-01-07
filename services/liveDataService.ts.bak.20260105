import { DashboardData, Game, AnalyzedGameDB, TopPickItem, League, Country, GameDetails } from '../types';
import { getCurrentDateInBogota, getLocalDayRange } from '../utils/dateUtils';
import { supabase } from './supabaseService';

// --- CONSTANTES ---
const IMPORTANT_LEAGUES_IDS = [
    2, 3, 39, 140, 135, 78, 61, 71, 128, 239, 13, 11
];

/**
 * Función genérica para llamar a la Edge Function 'football-data-proxy'.
 * Esta función ya no maneja claves API; la seguridad está en el servidor.
 */
const callProxy = async <T>(endpoint: string, params: any = {}): Promise<T> => {
    const { data, error } = await supabase.functions.invoke('football-data-proxy', {
        body: { endpoint, ...params }
    });

    if (error) {
        console.error(`Error invocando football-data-proxy para ${endpoint}:`, error);
        throw new Error(error.message || 'Error de conexión con el servidor de datos.');
    }

    return data as T;
};

// --- PROCESAMIENTO DE DATOS (Se mantiene igual para estructurar la UI) ---

const processFixturesResponse = (response: Game[]): DashboardData => {
    if (!response || response.length === 0) return { importantLeagues: [], countryLeagues: [] };

    const leaguesMap: { [id: number]: League } = {};
    for (const game of response) {
        if (!leaguesMap[game.league.id]) {
            leaguesMap[game.league.id] = { ...game.league, games: [] };
        }
        // Deduplicate games based on fixture ID
        const existingGame = leaguesMap[game.league.id].games.find(g => g.fixture.id === game.fixture.id);
        if (!existingGame) {
            leaguesMap[game.league.id].games.push(game);
        }
    }

    const allLeagues = Object.values(leaguesMap);
    const importantLeagues = allLeagues.filter(l => IMPORTANT_LEAGUES_IDS.includes(l.id));
    const otherLeagues = allLeagues.filter(l => !IMPORTANT_LEAGUES_IDS.includes(l.id));

    const countryMap: { [name: string]: Country } = {};
    otherLeagues.forEach(league => {
        const countryName = league.country || 'Internacional';
        if (!countryMap[countryName]) countryMap[countryName] = { name: countryName, flag: league.logo, leagues: [] };
        countryMap[countryName].leagues.push(league);
    });

    const countryLeagues = Object.values(countryMap).sort((a, b) => a.name.localeCompare(b.name));

    return { importantLeagues, countryLeagues };
};

// --- FUNCIONES EXPORTADAS ---

export const fetchFixturesByDate = async (date: string): Promise<DashboardData> => {
    console.log(`[DEBUG] fetchFixturesByDate called for: ${date}`);
    // Delegamos la petición al proxy
    try {
        const data = await callProxy<Game[]>('fixtures', { date });
        console.log(`[DEBUG] Proxy returned ${data?.length} fixtures for ${date}`, data);
        const processed = processFixturesResponse(data);
        console.log(`[DEBUG] Processed data:`, processed);
        return processed;
    } catch (e) {
        console.error(`[DEBUG] Error in fetchFixturesByDate:`, e);
        throw e;
    }
};

export const fetchFixturesByRange = async (from: string, to: string): Promise<DashboardData> => {
    try {
        const data = await callProxy<Game[]>('fixtures', { from, to });
        return processFixturesResponse(data);
    } catch (e) {
        console.error(`[DEBUG] Error in fetchFixturesByRange:`, e);
        throw e;
    }
};

export const fetchLiveFixtures = async (): Promise<DashboardData> => {
    const data = await callProxy<Game[]>('fixtures', { live: 'all' });
    return processFixturesResponse(data);
};

export const fetchFixturesList = async (ids: number[]): Promise<Game[]> => {
    if (ids.length === 0) return [];
    // API-Sports supports max 20 IDs usually, but reducing to 10 to avoid Edge Function timeouts.
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) {
        chunks.push(ids.slice(i, i + 10));
    }

    const results: Game[] = [];
    for (const chunk of chunks) {
        const idsStr = chunk.join('-');
        try {
            const data = await callProxy<Game[]>('fixtures', { ids: idsStr });
            if (data && Array.isArray(data)) {
                results.push(...data);
            }
        } catch (e) {
            console.error(`Error fetching chunk ${idsStr}:`, e);
        }
    }
    return results;
};

export const fetchGameDetails = async (game: Game): Promise<GameDetails> => {
    const fixtureId = game.fixture.id;
    const isFinished = ['FT', 'AET', 'PEN'].includes(game.fixture.status.short);

    // 1. Intentar caché local primero si el partido terminó
    if (isFinished) {
        const { data: cachedData } = await supabase
            .from('partido_detalles_cache')
            .select('dossier')
            .eq('fixture_id', fixtureId)
            .single();

        if (cachedData) return cachedData.dossier as GameDetails;
    }

    // 2. Pedir al Proxy que construya el Dossier completo
    // El proxy ahora tiene un modo especial 'full-dossier' para hacer todas las llamadas
    // internas (H2H, Standings, Stats) en el servidor y ahorrar round-trips.
    const dossier = await callProxy<GameDetails>('full-dossier', {
        fixtureId: fixtureId,
        homeTeamId: game.teams.home.id,
        awayTeamId: game.teams.away.id,
        leagueId: game.league.id,
        fixtureDate: game.fixture.date // Pass date for server-side season calculation
    });

    // 3. Guardar en caché si terminó
    if (isFinished && dossier) {
        await supabase.from('partido_detalles_cache').upsert({
            fixture_id: fixtureId,
            dossier: dossier as any,
            last_updated: new Date().toISOString(),
        }, { onConflict: 'fixture_id' });
    }

    return dossier;
};

export const fetchTopPicks = async (date: string) => {
    try {
        console.log(`[TopPicks] Fetching for date: ${date}`);

        // 1. Obtener Partidos (para info de equipos y logos)
        const allFixtures = await fetchFixturesByDate(date);
        const games = [
            ...allFixtures.importantLeagues.flatMap(l => l.games),
            ...allFixtures.countryLeagues.flatMap(c => c.leagues.flatMap(l => l.games))
        ];

        const fixtureIds = games.map(g => g.fixture.id);
        console.log(`[TopPicks] Found ${games.length} games, fixture IDs:`, fixtureIds.slice(0, 10), '...');

        if (fixtureIds.length === 0) return [];

        const { supabase } = await import('./supabaseService');

        // 2. DEDUPLICACIÓN ROBUSTA (Estrategia Jobs -> Runs -> Predictions)

        // A) Obtener Jobs exitosos recientes para estos partidos
        const { data: jobs, error: jobError } = await supabase
            .from('analysis_jobs')
            .select('id, api_fixture_id, created_at')
            .in('api_fixture_id', fixtureIds)
            .eq('status', 'done')
            .order('created_at', { ascending: false });

        if (jobError) throw jobError;

        // B) Filtrar para quedarse solo con el ÚLTIMO Job ID por fixture
        const latestJobIdByFixture = new Map<number, string>();
        jobs?.forEach((job: any) => {
            // api_fixture_id es numérico según schema, pero aseguramos
            const fid = Number(job.api_fixture_id);
            if (!latestJobIdByFixture.has(fid)) {
                latestJobIdByFixture.set(fid, job.id);
            }
        });

        const validJobIds = Array.from(latestJobIdByFixture.values());

        if (validJobIds.length === 0) return [];

        // C) Obtener los Run IDs asociados a esos Jobs únicos
        const { data: runs, error: runError } = await supabase
            .from('analysis_runs')
            .select('id, job_id')
            .in('job_id', validJobIds);

        if (runError) throw runError;

        const validRunIds = runs?.map((r: any) => r.id) || [];

        if (validRunIds.length === 0) return [];

        console.log(`[TopPicks] Found ${validJobIds.length} unique jobs -> ${validRunIds.length} valid runs.`);

        // 3. Obtener Predicciones de esos Runs UNICOS
        const { data: predictions, error } = await supabase
            .from('predictions')
            .select('*')
            .in('analysis_run_id', validRunIds)
            .order('probability', { ascending: false });

        console.log(`[TopPicks] Predictions query result:`, { found: predictions?.length || 0, error: error?.message });

        if (error) throw error;

        // 4. Cruzar datos (Join en memoria)
        const topPicks: TopPickItem[] = [];

        predictions.forEach((pred: any) => {
            // Encontrar el juego usando el api_fixture_id del run (o guardado en pred si existe, pero mejor usar el map inverso o buscar en games)
            // Pred tiene fixture_id (asumimos que es el api id)
            const game = games.find(g => g.fixture.id === pred.fixture_id);
            if (!game) return;

            topPicks.push({
                gameId: pred.fixture_id,
                analysisRunId: pred.analysis_run_id,
                matchup: `${game.teams.home.name} vs ${game.teams.away.name}`,
                date: game.fixture.date,
                league: game.league.name,
                teams: {
                    home: { name: game.teams.home.name, logo: game.teams.home.logo },
                    away: { name: game.teams.away.name, logo: game.teams.away.logo }
                },
                bestRecommendation: {
                    market: pred.market,
                    prediction: pred.selection,
                    probability: pred.probability,
                    confidence: pred.confidence,
                    reasoning: pred.reasoning
                },
                result: pred.is_won === true ? 'Won' : (pred.is_won === false ? 'Lost' : 'Pending'),
                odds: pred.odds // Mapped from DB
            });
        });

        // Sort by probability desc
        return topPicks.sort((a: any, b: any) => (b.bestRecommendation.probability || 0) - (a.bestRecommendation.probability || 0));

    } catch (error: any) {
        console.error('Error al obtener Top Picks:', error.message);
        return [];
    }
};
