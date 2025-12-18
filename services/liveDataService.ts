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
        leaguesMap[game.league.id].games.push(game);
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

export const fetchLiveFixtures = async (): Promise<DashboardData> => {
    const data = await callProxy<Game[]>('fixtures', { live: 'all' });
    return processFixturesResponse(data);
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
        season: 2023 // Idealmente dinámico, pero funcional por ahora
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

        if (fixtureIds.length === 0) return [];

        // 2. Obtener Predicciones Relacionales (Direct SQL Select) ✅
        const { supabase } = await import('./supabaseService');
        const { data: predictions, error } = await supabase
            .from('predictions')
            .select('*')
            .in('fixture_id', fixtureIds)
            .order('probability', { ascending: false });

        if (error) throw error;

        // 3. Cruzar datos (Join en memoria)
        const topPicks = predictions.map((pred: any) => {
            const game = games.find(g => g.fixture.id === pred.fixture_id);
            if (!game) return null;

            return {
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
                }
            };
        }).filter((item: any) => item !== null);

        return topPicks;

    } catch (error: any) {
        console.error('Error al obtener Top Picks:', error.message);
        return [];
    }
};
