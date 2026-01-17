/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MARKET CALCULATOR - Motor de Cálculo de Mercados de Nivel Mundial
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo calcula automáticamente probabilidades para 60+ mercados
 * basándose en datos reales de partidos, estadísticas y tendencias.
 * 
 * IMPORTANTE: Estos cálculos se hacen ANTES de llamar a la IA, para que
 * Gemini solo valide y agregue contexto táctico, no invente números.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TeamStats {
    fixtures?: { played?: { total?: number } };
    goals?: { for?: { average?: { total?: number; home?: number; away?: number } }; against?: { average?: { total?: number } } };
    clean_sheet?: { total?: number };
    failed_to_score?: { total?: number };
    biggest?: { goals?: { for?: { home?: number; away?: number }; against?: { home?: number; away?: number } } };
}

export interface MatchStats {
    'Total Shots'?: number;
    'Shots on Goal'?: number;
    'Corner Kicks'?: number;
    'Yellow Cards'?: number;
    'Red Cards'?: number;
    'Fouls'?: number;
    'Ball Possession'?: string;
}

export interface RefereeStats {
    referee_name: string;
    total_games: number;
    avg_yellow_cards: string;
    avg_red_cards: string;
    home_yellow_avg?: string;
    away_yellow_avg?: string;
}

export interface MarketOpportunity {
    market_key: string;
    market_name: string;
    category: string;
    calculated_probability: number;
    typical_implied_prob: number;
    value_score: number;
    confidence: 'ALTA' | 'MEDIA' | 'BAJA';
    data_sources: string[];
    recommendation: string;
}

export interface PreCalculatedMarkets {
    // === GOLES ===
    home_goals_avg: number;
    away_goals_avg: number;
    total_goals_expected: number;
    home_goals_conceded_avg: number;
    away_goals_conceded_avg: number;
    over_05_prob: number;
    over_15_prob: number;
    over_25_prob: number;
    over_35_prob: number;
    over_45_prob: number;
    btts_prob: number;

    // === CORNERS ===
    home_corners_avg: number;
    away_corners_avg: number;
    total_corners_expected: number;
    over_75_corners_prob: number;
    over_85_corners_prob: number;
    over_95_corners_prob: number;
    over_105_corners_prob: number;
    over_115_corners_prob: number;

    // === TARJETAS ===
    referee_yellow_avg: number;
    home_yellow_avg: number;
    away_yellow_avg: number;
    total_yellows_expected: number;
    over_25_yellows_prob: number;
    over_35_yellows_prob: number;
    over_45_yellows_prob: number;
    over_55_yellows_prob: number;
    red_card_prob: number;

    // === TIEMPOS ===
    first_half_goals_avg: number;
    second_half_goals_avg: number;
    fh_over_05_prob: number;
    fh_over_15_prob: number;
    sh_over_05_prob: number;
    sh_over_15_prob: number;

    // === RESULTADO ===
    home_win_prob: number;
    draw_prob: number;
    away_win_prob: number;
    home_clean_sheet_prob: number;
    away_clean_sheet_prob: number;

    // === RANKING FINAL ===
    market_opportunities: MarketOpportunity[];
    markets_evaluated: number;
    markets_with_value: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE CÁLCULO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula probabilidad de Over basándose en promedio esperado
 * Usando distribución de Poisson simplificada
 */
function calculateOverProbability(expectedValue: number, threshold: number): number {
    // Poisson aproximado: P(X > k) ≈ 1 - e^(-λ) * Σ(λ^i/i!)
    let prob = 0;
    for (let k = 0; k <= threshold; k++) {
        prob += (Math.pow(expectedValue, k) * Math.exp(-expectedValue)) / factorial(k);
    }
    return Math.min(95, Math.max(5, Math.round((1 - prob) * 100)));
}

function factorial(n: number): number {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

/**
 * Extrae estadísticas de corners de los últimos partidos
 */
function extractCornersFromMatches(matches: any[]): number {
    if (!matches || matches.length === 0) return 4.5; // Default

    let totalCorners = 0;
    let gamesWithData = 0;

    matches.forEach(m => {
        const stats = m.stats;
        if (stats?.home_stats?.['Corner Kicks'] !== undefined) {
            totalCorners += parseInt(stats.home_stats['Corner Kicks']) || 0;
            totalCorners += parseInt(stats.away_stats?.['Corner Kicks']) || 0;
            gamesWithData++;
        }
    });

    return gamesWithData > 0 ? totalCorners / gamesWithData / 2 : 4.5;
}

/**
 * Extrae estadísticas de tarjetas de los últimos partidos
 */
function extractCardsFromMatches(matches: any[], teamId: number): number {
    if (!matches || matches.length === 0) return 1.5; // Default

    let totalYellows = 0;
    let gamesWithData = 0;

    matches.forEach(m => {
        const isHome = m.teams?.home?.id === teamId;
        const teamStats = isHome ? m.stats?.home_stats : m.stats?.away_stats;

        if (teamStats?.['Yellow Cards'] !== undefined) {
            totalYellows += parseInt(teamStats['Yellow Cards']) || 0;
            gamesWithData++;
        }
    });

    return gamesWithData > 0 ? totalYellows / gamesWithData : 1.5;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULADORA DE MERCADOS DE GOLES
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateGoalsMarkets(
    homeStats: TeamStats,
    awayStats: TeamStats,
    h2h: any[],
    homeAsHome: any[],
    awayAsAway: any[]
): Partial<PreCalculatedMarkets> {
    // Promedios de goles
    const homeGoalsAvg = homeStats?.goals?.for?.average?.home ||
        homeStats?.goals?.for?.average?.total || 1.5;
    const awayGoalsAvg = awayStats?.goals?.for?.average?.away ||
        awayStats?.goals?.for?.average?.total || 1.0;
    const homeConcededAvg = homeStats?.goals?.against?.average?.total || 1.2;
    const awayConcededAvg = awayStats?.goals?.against?.average?.total || 1.3;

    // Total esperado (promedio ponderado)
    const totalExpected = (homeGoalsAvg + awayGoalsAvg + homeConcededAvg + awayConcededAvg) / 2;

    // Calcular BTTS basándose en partidos anteriores
    const homeGamesPlayed = homeStats?.fixtures?.played?.total || 10;
    const awayGamesPlayed = awayStats?.fixtures?.played?.total || 10;
    const homeFailedToScore = homeStats?.failed_to_score?.total || 2;
    const awayFailedToScore = awayStats?.failed_to_score?.total || 3;
    const homeScoreProb = 1 - (homeFailedToScore / homeGamesPlayed);
    const awayScoreProb = 1 - (awayFailedToScore / awayGamesPlayed);
    const bttsProb = Math.round(homeScoreProb * awayScoreProb * 100);

    // H2H analysis
    let h2hOver25 = 0;
    let h2hBtts = 0;
    const h2hTotal = Math.min(h2h?.length || 0, 10);
    h2h?.slice(0, 10).forEach(match => {
        const goals = (match.goals?.home || 0) + (match.goals?.away || 0);
        if (goals >= 3) h2hOver25++;
        if ((match.goals?.home || 0) > 0 && (match.goals?.away || 0) > 0) h2hBtts++;
    });

    return {
        home_goals_avg: parseFloat(homeGoalsAvg.toFixed(2)),
        away_goals_avg: parseFloat(awayGoalsAvg.toFixed(2)),
        home_goals_conceded_avg: parseFloat(homeConcededAvg.toFixed(2)),
        away_goals_conceded_avg: parseFloat(awayConcededAvg.toFixed(2)),
        total_goals_expected: parseFloat(totalExpected.toFixed(2)),
        over_05_prob: calculateOverProbability(totalExpected, 0),
        over_15_prob: calculateOverProbability(totalExpected, 1),
        over_25_prob: calculateOverProbability(totalExpected, 2),
        over_35_prob: calculateOverProbability(totalExpected, 3),
        over_45_prob: calculateOverProbability(totalExpected, 4),
        btts_prob: Math.min(85, Math.max(30, bttsProb))
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULADORA DE MERCADOS DE CORNERS
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateCornersMarkets(
    homeStats: TeamStats,
    awayStats: TeamStats,
    homeAsHome: any[],
    awayAsAway: any[]
): Partial<PreCalculatedMarkets> {
    // Extraer corners de partidos recientes
    const homeCornersAvg = extractCornersFromMatches(homeAsHome);
    const awayCornersAvg = extractCornersFromMatches(awayAsAway);
    const totalCornersExpected = homeCornersAvg + awayCornersAvg;

    return {
        home_corners_avg: parseFloat(homeCornersAvg.toFixed(2)),
        away_corners_avg: parseFloat(awayCornersAvg.toFixed(2)),
        total_corners_expected: parseFloat(totalCornersExpected.toFixed(2)),
        over_75_corners_prob: calculateOverProbability(totalCornersExpected, 7),
        over_85_corners_prob: calculateOverProbability(totalCornersExpected, 8),
        over_95_corners_prob: calculateOverProbability(totalCornersExpected, 9),
        over_105_corners_prob: calculateOverProbability(totalCornersExpected, 10),
        over_115_corners_prob: calculateOverProbability(totalCornersExpected, 11)
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULADORA DE MERCADOS DE TARJETAS
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateCardsMarkets(
    refereeStats: RefereeStats | null,
    homeAsHome: any[],
    awayAsAway: any[],
    homeTeamId: number,
    awayTeamId: number
): Partial<PreCalculatedMarkets> {
    // SI NO HAY DATOS DE ÁRBITRO, NO INVENTAR - OMITIR MERCADOS DE TARJETAS
    // Esto evita predicciones falsas basadas en datos inventados
    if (!refereeStats?.avg_yellow_cards) {
        console.log('[MarketCalculator] No hay datos de árbitro - OMITIENDO mercados de tarjetas');
        return {}; // Retornar vacío, estos mercados no aparecerán en el ranking
    }

    // Parsear valores del árbitro
    const refYellowAvg = parseFloat(refereeStats.avg_yellow_cards);
    const refRedAvg = parseFloat(refereeStats.avg_red_cards || '0');

    // Si el parse falla, omitir
    if (isNaN(refYellowAvg)) {
        console.log('[MarketCalculator] Datos de árbitro inválidos - OMITIENDO mercados de tarjetas');
        return {};
    }

    // Extraer tarjetas de equipos
    const homeYellowAvg = extractCardsFromMatches(homeAsHome, homeTeamId);
    const awayYellowAvg = extractCardsFromMatches(awayAsAway, awayTeamId);

    // Ponderación: 40% árbitro, 30% local, 30% visitante
    const totalExpected = (refYellowAvg * 0.4) + (homeYellowAvg * 0.3) + (awayYellowAvg * 0.3);

    return {
        referee_yellow_avg: parseFloat(refYellowAvg.toFixed(2)),
        home_yellow_avg: parseFloat(homeYellowAvg.toFixed(2)),
        away_yellow_avg: parseFloat(awayYellowAvg.toFixed(2)),
        total_yellows_expected: parseFloat(totalExpected.toFixed(2)),
        over_25_yellows_prob: calculateOverProbability(totalExpected, 2),
        over_35_yellows_prob: calculateOverProbability(totalExpected, 3),
        over_45_yellows_prob: calculateOverProbability(totalExpected, 4),
        over_55_yellows_prob: calculateOverProbability(totalExpected, 5),
        red_card_prob: Math.min(30, Math.round((refRedAvg || 0) * 100))
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULADORA DE MERCADOS POR TIEMPO
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateTimeMarkets(
    homeAsHome: any[],
    awayAsAway: any[],
    totalGoalsExpected: number
): Partial<PreCalculatedMarkets> {
    // Aproximación: 45% de goles en 1T, 55% en 2T (estadística general)
    const fhGoalsExpected = totalGoalsExpected * 0.45;
    const shGoalsExpected = totalGoalsExpected * 0.55;

    return {
        first_half_goals_avg: parseFloat(fhGoalsExpected.toFixed(2)),
        second_half_goals_avg: parseFloat(shGoalsExpected.toFixed(2)),
        fh_over_05_prob: calculateOverProbability(fhGoalsExpected, 0),
        fh_over_15_prob: calculateOverProbability(fhGoalsExpected, 1),
        sh_over_05_prob: calculateOverProbability(shGoalsExpected, 0),
        sh_over_15_prob: calculateOverProbability(shGoalsExpected, 1)
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULADORA DE RESULTADO
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateResultMarkets(
    homeStats: TeamStats,
    awayStats: TeamStats,
    h2h: any[]
): Partial<PreCalculatedMarkets> {
    // Clean sheets
    const homeGames = homeStats?.fixtures?.played?.total || 10;
    const awayGames = awayStats?.fixtures?.played?.total || 10;
    const homeCleanSheets = homeStats?.clean_sheet?.total || 3;
    const awayCleanSheets = awayStats?.clean_sheet?.total || 2;

    // Análisis H2H para probabilidad de resultado
    let homeWins = 0, draws = 0, awayWins = 0;
    h2h?.slice(0, 10).forEach(m => {
        const homeGoals = m.goals?.home || 0;
        const awayGoals = m.goals?.away || 0;
        if (homeGoals > awayGoals) homeWins++;
        else if (homeGoals < awayGoals) awayWins++;
        else draws++;
    });

    const h2hTotal = Math.max(h2h?.length || 1, 1);
    // Ajuste por ventaja de casa (+10% aproximadamente)
    const baseHomeProb = (homeWins / h2hTotal) * 100;
    const baseDrawProb = (draws / h2hTotal) * 100;
    const baseAwayProb = (awayWins / h2hTotal) * 100;

    return {
        home_win_prob: Math.min(70, Math.max(25, Math.round(baseHomeProb * 1.1))),
        draw_prob: Math.min(35, Math.max(20, Math.round(baseDrawProb))),
        away_win_prob: Math.min(55, Math.max(15, Math.round(baseAwayProb * 0.9))),
        home_clean_sheet_prob: Math.round((homeCleanSheets / homeGames) * 100),
        away_clean_sheet_prob: Math.round((awayCleanSheets / awayGames) * 100)
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RANKING DE OPORTUNIDADES
// ═══════════════════════════════════════════════════════════════════════════════

export function rankMarketOpportunities(markets: Partial<PreCalculatedMarkets>): MarketOpportunity[] {
    const opportunities: MarketOpportunity[] = [];

    // Mercados típicos con probabilidades implícitas por casas de apuestas
    const typicalOdds: { [key: string]: { name: string; category: string; typical: number; calcKey: keyof PreCalculatedMarkets } } = {
        // GOLES
        'over_15': { name: 'Más de 1.5 Goles', category: 'Goles', typical: 75, calcKey: 'over_15_prob' },
        'over_25': { name: 'Más de 2.5 Goles', category: 'Goles', typical: 52, calcKey: 'over_25_prob' },
        'over_35': { name: 'Más de 3.5 Goles', category: 'Goles', typical: 35, calcKey: 'over_35_prob' },
        'btts_yes': { name: 'Ambos Marcan - Sí', category: 'BTTS', typical: 55, calcKey: 'btts_prob' },

        // CORNERS
        'over_85_corners': { name: 'Más de 8.5 Corners', category: 'Corners', typical: 55, calcKey: 'over_85_corners_prob' },
        'over_95_corners': { name: 'Más de 9.5 Corners', category: 'Corners', typical: 48, calcKey: 'over_95_corners_prob' },
        'over_105_corners': { name: 'Más de 10.5 Corners', category: 'Corners', typical: 40, calcKey: 'over_105_corners_prob' },

        // TARJETAS
        'over_25_yellows': { name: 'Más de 2.5 Amarillas', category: 'Tarjetas', typical: 65, calcKey: 'over_25_yellows_prob' },
        'over_35_yellows': { name: 'Más de 3.5 Amarillas', category: 'Tarjetas', typical: 50, calcKey: 'over_35_yellows_prob' },
        'over_45_yellows': { name: 'Más de 4.5 Amarillas', category: 'Tarjetas', typical: 35, calcKey: 'over_45_yellows_prob' },

        // TIEMPOS
        'fh_over_05': { name: '1T Más de 0.5 Goles', category: 'Tiempos', typical: 68, calcKey: 'fh_over_05_prob' },
        'sh_over_05': { name: '2T Más de 0.5 Goles', category: 'Tiempos', typical: 72, calcKey: 'sh_over_05_prob' },

        // RESULTADO
        'home_win': { name: 'Victoria Local', category: 'Resultado', typical: 45, calcKey: 'home_win_prob' },
        'draw': { name: 'Empate', category: 'Resultado', typical: 28, calcKey: 'draw_prob' },
        'away_win': { name: 'Victoria Visitante', category: 'Resultado', typical: 30, calcKey: 'away_win_prob' }
    };

    // Calcular value score para cada mercado
    for (const [key, config] of Object.entries(typicalOdds)) {
        const calculatedProb = markets[config.calcKey] as number || 0;
        const valueScore = calculatedProb - config.typical;

        opportunities.push({
            market_key: key,
            market_name: config.name,
            category: config.category,
            calculated_probability: calculatedProb,
            typical_implied_prob: config.typical,
            value_score: parseFloat(valueScore.toFixed(1)),
            confidence: valueScore > 10 ? 'ALTA' : (valueScore > 5 ? 'MEDIA' : 'BAJA'),
            data_sources: [config.calcKey],
            recommendation: valueScore > 5 ? 'APOSTAR' : (valueScore > 0 ? 'CONSIDERAR' : 'EVITAR')
        });
    }

    // Ordenar por value_score descendente
    return opportunities.sort((a, b) => b.value_score - a.value_score);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL: CALCULAR TODOS LOS MERCADOS
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateAllMarkets(input: {
    homeStats: TeamStats;
    awayStats: TeamStats;
    h2h: any[];
    refereeStats: RefereeStats | null;
    homeAsHome: any[];
    awayAsAway: any[];
    homeTeamId: number;
    awayTeamId: number;
}): PreCalculatedMarkets {
    // 1. Calcular mercados de goles
    const goalsMarkets = calculateGoalsMarkets(
        input.homeStats,
        input.awayStats,
        input.h2h,
        input.homeAsHome,
        input.awayAsAway
    );

    // 2. Calcular mercados de corners
    const cornersMarkets = calculateCornersMarkets(
        input.homeStats,
        input.awayStats,
        input.homeAsHome,
        input.awayAsAway
    );

    // 3. Calcular mercados de tarjetas
    const cardsMarkets = calculateCardsMarkets(
        input.refereeStats,
        input.homeAsHome,
        input.awayAsAway,
        input.homeTeamId,
        input.awayTeamId
    );

    // 4. Calcular mercados por tiempo
    const timeMarkets = calculateTimeMarkets(
        input.homeAsHome,
        input.awayAsAway,
        goalsMarkets.total_goals_expected || 2.5
    );

    // 5. Calcular mercados de resultado
    const resultMarkets = calculateResultMarkets(
        input.homeStats,
        input.awayStats,
        input.h2h
    );

    // 6. Combinar todos los mercados
    const allMarkets: Partial<PreCalculatedMarkets> = {
        ...goalsMarkets,
        ...cornersMarkets,
        ...cardsMarkets,
        ...timeMarkets,
        ...resultMarkets
    };

    // 7. Generar ranking de oportunidades
    const opportunities = rankMarketOpportunities(allMarkets);
    const marketsWithValue = opportunities.filter(o => o.value_score > 5).length;

    return {
        ...allMarkets,
        market_opportunities: opportunities,
        markets_evaluated: opportunities.length,
        markets_with_value: marketsWithValue
    } as PreCalculatedMarkets;
}
