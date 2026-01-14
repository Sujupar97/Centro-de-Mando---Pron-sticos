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
            .select('id, fixture_id, created_at')
            .in('fixture_id', fixtureIds)
            .eq('status', 'done');

        if (v2Jobs && v2Jobs.length > 0) {
            console.log(`[TopPicks] ✅ V2: Encontrados ${v2Jobs.length} jobs V2`);

            // ═══════════════════════════════════════════════════════════════
            // FIX: Solo el job MÁS RECIENTE por fixture (evita duplicados)
            // ═══════════════════════════════════════════════════════════════
            const latestJobByFixture = new Map<number, any>();
            for (const job of v2Jobs) {
                const existing = latestJobByFixture.get(job.fixture_id);
                if (!existing || new Date(job.created_at) > new Date(existing.created_at)) {
                    latestJobByFixture.set(job.fixture_id, job);
                }
            }
            const latestJobIds = Array.from(latestJobByFixture.values()).map((j: any) => j.id);
            console.log(`[TopPicks] V2: Filtrado a ${latestJobIds.length} jobs (más recientes por fixture)`);

            // Obtener value_picks_v2 con BET o WATCH con alta probabilidad
            const { data: v2Picks } = await supabase
                .from('value_picks_v2')
                .select('*')
                .in('job_id', latestJobIds)
                .in('decision', ['BET', 'WATCH'])
                .gte('p_model', 0.50)  // Solo picks con >50% probabilidad
                .order('p_model', { ascending: false });

            if (v2Picks && v2Picks.length > 0) {
                console.log(`[TopPicks] ✅ V2: Encontrados ${v2Picks.length} picks con >50% prob`);

                // Mapear v2JobId -> fixtureId
                const jobToFixture = new Map<string, number>();
                v2Jobs.forEach((j: any) => jobToFixture.set(j.id, j.fixture_id));

                // ═══════════════════════════════════════════════════════════════
                // DICCIONARIO DE TRADUCCIÓN DE MERCADOS (del inglés al español)
                // ═══════════════════════════════════════════════════════════════
                const MARKET_TRANSLATIONS: Record<string, string> = {
                    // BTTS
                    'btts_yes': 'Ambos Equipos Anotan: Sí',
                    'btts_no': 'Ambos Equipos Anotan: No',
                    'btts yes': 'Ambos Equipos Anotan: Sí',
                    'btts no': 'Ambos Equipos Anotan: No',
                    // Goles Over/Under
                    'over_0.5_goals': 'Más de 0.5 Goles',
                    'over_1.5_goals': 'Más de 1.5 Goles',
                    'over_2.5_goals': 'Más de 2.5 Goles',
                    'over_3.5_goals': 'Más de 3.5 Goles',
                    'over_4.5_goals': 'Más de 4.5 Goles',
                    'over_5.5_goals': 'Más de 5.5 Goles',
                    'under_0.5_goals': 'Menos de 0.5 Goles',
                    'under_1.5_goals': 'Menos de 1.5 Goles',
                    'under_2.5_goals': 'Menos de 2.5 Goles',
                    'under_3.5_goals': 'Menos de 3.5 Goles',
                    // 1X2
                    'home_win': 'Victoria Local',
                    'away_win': 'Victoria Visitante',
                    'draw': 'Empate',
                    '1x2_home': 'Victoria Local',
                    '1x2_away': 'Victoria Visitante',
                    '1x2_draw': 'Empate',
                    // Doble Oportunidad
                    'double_chance_1x': 'Doble Oportunidad 1X',
                    'double_chance_x2': 'Doble Oportunidad X2',
                    'double_chance_12': 'Doble Oportunidad 12',
                    // Goles por Equipo
                    'home_over_0.5': 'Local Anota +0.5',
                    'home_over_1.5': 'Local Anota +1.5',
                    'away_over_0.5': 'Visitante Anota +0.5',
                    'away_over_1.5': 'Visitante Anota +1.5',
                    // Handicaps
                    'handicap_home_-0.5': 'Handicap Local -0.5',
                    'handicap_home_-1.5': 'Handicap Local -1.5',
                    'handicap_away_+0.5': 'Handicap Visitante +0.5',
                    'handicap_away_+1.5': 'Handicap Visitante +1.5',
                    // Corners
                    'corners_over_8.5': 'Más de 8.5 Corners',
                    'corners_over_10.5': 'Más de 10.5 Corners',
                    'corners_over_12.5': 'Más de 12.5 Corners',
                    // Tarjetas
                    'cards_over_3.5': 'Más de 3.5 Tarjetas',
                    'cards_over_4.5': 'Más de 4.5 Tarjetas',
                    'cards_over_5.5': 'Más de 5.5 Tarjetas',
                    // Marcador Exacto
                    'correct_score_0_0': 'Marcador Exacto 0-0',
                    // FASE 1: Primer Tiempo (1T)
                    '1t_over_0.5': '1T Más de 0.5 Goles',
                    '1t_over_1.5': '1T Más de 1.5 Goles',
                    // FASE 1: Segundo Tiempo (2T)
                    '2t_over_0.5': '2T Más de 0.5 Goles',
                    '2t_over_1.5': '2T Más de 1.5 Goles',
                };

                const translateMarket = (market: string): string => {
                    const key = market.toLowerCase().replace(/\s+/g, '_').replace(/\./g, '.');
                    if (MARKET_TRANSLATIONS[key]) return MARKET_TRANSLATIONS[key];
                    // Fallback: normalizar el market
                    return market
                        .replace(/_/g, ' ')
                        .replace('over', 'Más de')
                        .replace('under', 'Menos de')
                        .replace('goals', 'Goles')
                        .replace('btts', 'Ambos Anotan')
                        .replace('yes', 'Sí')
                        .replace('no', 'No');
                };

                const translateSelection = (selection: string): string => {
                    const lower = selection.toLowerCase();
                    if (lower === 'yes' || lower === 'sí') return 'Sí';
                    if (lower === 'no') return 'No';
                    if (lower === 'over') return 'Más';
                    if (lower === 'under') return 'Menos';
                    return selection;
                };

                // ═══════════════════════════════════════════════════════════════
                // FASE 1: Agrupar picks por fixture para encontrar alternativas
                // ═══════════════════════════════════════════════════════════════
                const picksByFixture = new Map<number, any[]>();
                for (const pick of v2Picks) {
                    const fixtureId = jobToFixture.get(pick.job_id);
                    if (!fixtureId) continue;
                    if (!picksByFixture.has(fixtureId)) {
                        picksByFixture.set(fixtureId, []);
                    }
                    picksByFixture.get(fixtureId)!.push(pick);
                }

                const topPicks: TopPickItem[] = [];

                // ═══════════════════════════════════════════════════════════════
                // FASE 2: Procesar cada fixture
                // ═══════════════════════════════════════════════════════════════
                for (const [fixtureId, fixturePicks] of picksByFixture.entries()) {
                    const game = games.find(g => g.fixture.id === fixtureId);
                    if (!game) continue;

                    // Clasificar picks por tipo de mercado para encontrar alternativas
                    const goalLines = fixturePicks.filter(p =>
                        p.market?.includes('over_') && p.market?.includes('goals')
                    ).sort((a, b) => b.p_model - a.p_model);

                    for (const pick of fixturePicks) {
                        const prob = pick.p_model * 100;

                        // Ignorar prob < 60% (muy baja)
                        if (prob < 60) continue;

                        // NOTA: Mostramos TODOS los picks ≥60% (incluidos >92%)

                        // Determinar confidence
                        const confidence: 'Alta' | 'Media' | 'Baja' = prob >= 80 ? 'Alta' : prob >= 60 ? 'Media' : 'Baja';

                        // Buscar alternativa si es línea de goles y hay una opción más segura
                        let alternative: { market: string; probability: number } | undefined = undefined;
                        if (pick.market?.includes('goals')) {
                            const saferLine = goalLines.find(p =>
                                p.p_model > pick.p_model && p.p_model <= 0.92 && p.market !== pick.market
                            );
                            if (saferLine) {
                                alternative = {
                                    market: translateMarket(saferLine.market),
                                    probability: Math.round(saferLine.p_model * 100)
                                };
                            }
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
                                market: translateMarket(pick.market || ''),
                                prediction: translateSelection(pick.selection || ''),
                                probability: Math.round(prob),
                                confidence: confidence,
                                reasoning: pick.rationale || `Probabilidad: ${Math.round(prob)}%`
                            },
                            result: 'Pending',
                            odds: undefined,
                            alternative: alternative
                        });
                    }
                }

                console.log(`[TopPicks] V2: Total picks 60-92%: ${topPicks.length}`);

                // Si encontramos picks V2, retornarlos ordenados por probabilidad
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
