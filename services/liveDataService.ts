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
        const { supabase } = await import('./supabaseService');

        let games: Game[] = [];

        // 1. ESTRATEGIA DB-FIRST: Consultar daily_matches (Nuestra Fuente de Verdad)
        const { data: localMatches, error: localError } = await supabase
            .from('daily_matches')
            .select('*')
            .gte('match_time', `${date}T00:00:00`)
            .lt('match_time', `${date}T23:59:59`);

        if (localMatches && localMatches.length > 0) {
            console.log(`[TopPicks] ✅ Usando ${localMatches.length} partidos de daily_matches (DB Local)`);

            // Convertir formato plano de daily_matches a estructura anidada Game
            games = localMatches.map(m => ({
                fixture: {
                    id: m.api_fixture_id,
                    date: m.match_time,
                    status: { short: m.match_status || 'NS', long: '', elapsed: null },
                    venue: { id: null, name: '', city: '' }, // id: null agregado para cumplir interfaz
                    referee: null,
                    period: { first: null, second: null },
                    timestamp: new Date(m.match_time).getTime() / 1000,
                    timezone: 'UTC'
                },
                league: {
                    id: m.league_id,
                    name: m.league_name,
                    country: '',
                    logo: '',
                    flag: '',
                    season: new Date().getFullYear(),
                    round: ''
                },
                teams: {
                    home: { id: 0, name: m.home_team, logo: m.home_team_logo, winner: null },
                    away: { id: 0, name: m.away_team, logo: m.away_team_logo, winner: null }
                },
                goals: { home: m.home_score, away: m.away_score },
                score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null }, extratime: { home: null, away: null }, penalty: { home: null, away: null } }
            }));

        } else {
            console.log('[TopPicks] ⚠️ No hay datos locales, intentando API externa (Fallback)...');
            // 2. Fallback: API Externa (comportamiento original)
            const allFixtures = await fetchFixturesByDate(date);
            games = [
                ...allFixtures.importantLeagues.flatMap(l => l.games),
                ...allFixtures.countryLeagues.flatMap(c => c.leagues.flatMap(l => l.games))
            ];
        }

        const fixtureIds = games.map(g => g.fixture.id);
        console.log(`[TopPicks] Found ${games.length} games to check. IDs sample:`, fixtureIds.slice(0, 5));

        if (fixtureIds.length === 0) return [];

        // ═══════════════════════════════════════════════════════════════
        // ESTRATEGIA V2 PRIMERO: Buscar en analysis_jobs_v2 + value_picks_v2
        // ═══════════════════════════════════════════════════════════════
        const { data: v2Jobs } = await supabase
            .from('analysis_jobs_v2')
            .select('id, fixture_id')
            .in('fixture_id', fixtureIds)
            .eq('status', 'done');

        if (v2Jobs && v2Jobs.length > 0) {
            console.log(`[TopPicks] ✅ V2: Encontrados ${v2Jobs.length} jobs V2`);

            const v2JobIds = v2Jobs.map((j: any) => j.id);

            // Obtener value_picks_v2 con BET o WATCH con alta probabilidad
            const { data: v2Picks } = await supabase
                .from('value_picks_v2')
                .select('*')
                .in('job_id', v2JobIds)
                .in('decision', ['BET', 'WATCH'])
                .gte('p_model', 0.50)  // Solo picks con >50% probabilidad
                .order('p_model', { ascending: false });

            if (v2Picks && v2Picks.length > 0) {
                console.log(`[TopPicks] ✅ V2: Encontrados ${v2Picks.length} picks con >50% prob`);

                // Mapear v2JobId -> fixtureId
                const jobToFixture = new Map<string, number>();
                v2Jobs.forEach((j: any) => jobToFixture.set(j.id, j.fixture_id));

                // ═══════════════════════════════════════════════════════════════
                // FIX BUG 3: DEDUPLICAR - Solo 1 pick por partido (el de mayor prob)
                // ═══════════════════════════════════════════════════════════════
                const bestPickByFixture = new Map<number, any>();
                for (const pick of v2Picks) {
                    const fixtureId = jobToFixture.get(pick.job_id);
                    if (!fixtureId) continue;

                    const existing = bestPickByFixture.get(fixtureId);
                    if (!existing || pick.p_model > existing.p_model) {
                        bestPickByFixture.set(fixtureId, pick);
                    }
                }

                console.log(`[TopPicks] V2: Deduplicado de ${v2Picks.length} a ${bestPickByFixture.size} picks (1 por partido)`);

                const topPicks: TopPickItem[] = [];

                for (const [fixtureId, pick] of bestPickByFixture.entries()) {
                    const game = games.find(g => g.fixture.id === fixtureId);
                    if (!game) continue;

                    // ═══════════════════════════════════════════════════════════════
                    // FIX: Confianza basada SOLO en probabilidad (no en edge)
                    // ═══════════════════════════════════════════════════════════════
                    let confidence: 'Alta' | 'Media' | 'Baja' = 'Media';
                    const prob = pick.p_model * 100;

                    if (prob >= 60) {
                        confidence = 'Alta';  // 60%+ = Alta confianza (aparece en Oportunidades)
                    } else if (prob >= 45) {
                        confidence = 'Media'; // 45-59% = Media
                    } else {
                        confidence = 'Baja';  // <45% = Baja (no se muestra)
                    }

                    topPicks.push({
                        gameId: fixtureId,
                        analysisRunId: pick.job_id,
                        matchup: `${game.teams.home.name} vs ${game.teams.away.name}`,
                        date: game.fixture.date,
                        league: game.league.name,
                        teams: {
                            home: { name: game.teams.home.name, logo: game.teams.home.logo },
                            away: { name: game.teams.away.name, logo: game.teams.away.logo }
                        },
                        bestRecommendation: {
                            market: pick.market?.replace(/_/g, ' ').toUpperCase() || pick.market,
                            prediction: pick.selection,
                            probability: Math.round(prob),
                            confidence: confidence,
                            reasoning: pick.rationale || `Probabilidad: ${Math.round(prob)}%`
                        },
                        result: 'Pending',
                        odds: undefined  // FIX BUG 2: NO mostrar cuotas de API-Football
                    });
                }

                // Si encontramos picks V2, retornarlos
                if (topPicks.length > 0) {
                    return topPicks.sort((a, b) =>
                        (b.bestRecommendation.probability || 0) - (a.bestRecommendation.probability || 0)
                    );
                }
            }
        }

        console.log('[TopPicks] ⚠️ Sin picks V2 válidos, buscando en V1...');

        // ═══════════════════════════════════════════════════════════════
        // FALLBACK V1: Estrategia Jobs -> Runs -> Predictions
        // ═══════════════════════════════════════════════════════════════

        // A) Obtener Jobs exitosos recientes para estos partidos
        let { data: jobs, error: jobError } = await supabase
            .from('analysis_jobs')
            .select('id, api_fixture_id, created_at')
            .in('api_fixture_id', fixtureIds)
            .eq('status', 'done')
            .order('created_at', { ascending: false });

        if (jobError) throw jobError;

        // FALLBACK ROBUSTO: Si no encontramos jobs por fixture IDs de daily_matches,
        // buscar jobs creados HOY que estén 'done' (para cubrir desincronización)
        if (!jobs || jobs.length < 3) {
            console.log('[TopPicks] ⚠️ Pocos jobs por fixture IDs, buscando por fecha de creación...');

            const { data: jobsByDate } = await supabase
                .from('analysis_jobs')
                .select('id, api_fixture_id, created_at')
                .eq('status', 'done')
                .gte('created_at', `${date}T00:00:00`)
                .lt('created_at', `${date}T23:59:59`)
                .order('created_at', { ascending: false });

            if (jobsByDate && jobsByDate.length > (jobs?.length || 0)) {
                console.log(`[TopPicks] ✅ Encontrados ${jobsByDate.length} jobs por created_at (fallback)`);
                jobs = jobsByDate;

                // Re-construir games a partir de los jobs encontrados (datos mínimos)
                const additionalFixtureIds = jobsByDate
                    .map(j => j.api_fixture_id)
                    .filter(fid => !fixtureIds.includes(fid));

                if (additionalFixtureIds.length > 0) {
                    console.log(`[TopPicks] Agregando ${additionalFixtureIds.length} fixtures adicionales al pool`);
                    fixtureIds.push(...additionalFixtureIds);
                }
            }
        }

        // B) Filtrar para quedarse solo con el ÚLTIMO Job ID por fixture
        const latestJobIdByFixture = new Map<number, string>();
        jobs?.forEach((job: any) => {
            const fid = Number(job.api_fixture_id);
            if (!latestJobIdByFixture.has(fid)) {
                latestJobIdByFixture.set(fid, job.id);
            }
        });

        const validJobIds = Array.from(latestJobIdByFixture.values());

        if (validJobIds.length === 0) {
            console.log('[TopPicks] 0 Jobs encontrados para estos partidos.');
            return [];
        }

        // C) Obtener los Run IDs asociados a esos Jobs únicos
        const { data: runs, error: runError } = await supabase
            .from('analysis_runs')
            .select('id, job_id')
            .in('job_id', validJobIds);

        if (runError) throw runError;

        const validRunIds = runs?.map((r: any) => r.id) || [];

        if (validRunIds.length === 0) {
            console.log('[TopPicks] 0 Runs encontrados para estos Jobs.');
            return [];
        }

        console.log(`[TopPicks] Found ${validJobIds.length} unique jobs -> ${validRunIds.length} valid runs.`);

        // 4. Obtener Predicciones de esos Runs UNICOS
        const { data: predictions, error } = await supabase
            .from('predictions')
            .select('*')
            .in('analysis_run_id', validRunIds)
            .order('probability', { ascending: false });

        if (error) throw error;

        console.log(`[TopPicks] Predictions found: ${predictions?.length || 0}`);

        // 5. Cruzar datos (Join en memoria)
        const topPicks: TopPickItem[] = [];

        predictions?.forEach((pred: any) => {
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

        // Ordenar por probabilidad descendente
        return topPicks.sort((a: any, b: any) => (b.bestRecommendation.probability || 0) - (a.bestRecommendation.probability || 0));

    } catch (error: any) {
        console.error('Error al obtener Top Picks:', error.message);
        return [];
    }
};
