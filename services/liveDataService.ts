
import { Game, DashboardData, League, Country, GameDetails, TopPickItem, AnalyzedGameDB } from '../types';
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

    return { importantLeagues, countryLeagues: Object.values(countryMap) };
};

// --- FUNCIONES EXPORTADAS ---

export const fetchFixturesByDate = async (date: string): Promise<DashboardData> => {
    // Delegamos la petición al proxy
    const data = await callProxy<Game[]>('fixtures', { date });
    return processFixturesResponse(data);
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

export const fetchTopPicksByDate = async (date: string): Promise<TopPickItem[]> => {
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    try {
        const { data, error } = await supabase
            .from('analisis')
            .select(`
                partido_id,
                resultado_analisis,
                partidos!inner (
                    fecha,
                    equipo_local_nombre,
                    equipo_visitante_nombre,
                    equipo_local_logo,
                    equipo_visitante_logo,
                    liga_nombre
                )
            `)
            .gte('partidos.fecha', startOfDay)
            .lte('partidos.fecha', endOfDay);

        if (error) throw error;
        if (!data) return [];

        return data.map((item: any) => {
                const typedItem = item as AnalyzedGameDB;
                const analysisData = typedItem.resultado_analisis.dashboardData || typedItem.resultado_analisis.visualData;
                let bestRec = null;
                
                if (typedItem.resultado_analisis.dashboardData) {
                    const preds = typedItem.resultado_analisis.dashboardData.predicciones_finales.detalle;
                    if (preds && preds.length > 0) {
                        const sorted = [...preds].sort((a, b) => b.probabilidad_estimado_porcentaje - a.probabilidad_estimado_porcentaje);
                        const top = sorted[0];
                        bestRec = {
                            market: top.mercado,
                            prediction: top.seleccion,
                            probability: top.probabilidad_estimado_porcentaje,
                            confidence: top.probabilidad_estimado_porcentaje >= 75 ? 'Alta' : top.probabilidad_estimado_porcentaje >= 50 ? 'Media' : 'Baja',
                            reasoning: top.justificacion_detallada.conclusion
                        };
                    }
                } else if (typedItem.resultado_analisis.visualData?.recommendations) {
                    const recs = typedItem.resultado_analisis.visualData.recommendations;
                    if (recs.length > 0) {
                        bestRec = recs.reduce((prev: any, current: any) => 
                            (prev.probability > current.probability) ? prev : current
                        );
                    }
                }

                if (!bestRec) return null;

                return {
                    gameId: typedItem.partido_id,
                    matchup: `${typedItem.partidos.equipo_local_nombre} vs ${typedItem.partidos.equipo_visitante_nombre}`,
                    date: typedItem.partidos.fecha,
                    league: typedItem.partidos.liga_nombre,
                    teams: {
                        home: { name: typedItem.partidos.equipo_local_nombre, logo: typedItem.partidos.equipo_local_logo },
                        away: { name: typedItem.partidos.equipo_visitante_nombre, logo: typedItem.partidos.equipo_visitante_logo }
                    },
                    bestRecommendation: bestRec
                };
            })
            .filter((item): item is TopPickItem => item !== null)
            .sort((a, b) => b.bestRecommendation.probability - a.bestRecommendation.probability);

    } catch (error: any) {
        console.error('Error al obtener Top Picks:', error.message);
        throw new Error('No se pudieron cargar las mejores opciones.');
    }
};
