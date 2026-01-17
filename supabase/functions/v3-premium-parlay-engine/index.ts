// supabase/functions/v3-premium-parlay-engine/index.ts
// MOTOR V3: Análisis Independiente + 60+ Mercados + Cuotas Alto Valor
// NO reutiliza picks existentes - Hace análisis desde cero

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN V3 - CUOTAS DE ALTO VALOR
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
    // Cuotas individuales objetivo (SUBIDAS para más valor)
    MIN_INDIVIDUAL_ODDS: 1.80,  // Subido de 1.60 → Más valor por pick
    MAX_INDIVIDUAL_ODDS: 2.50,

    // Probabilidad objetivo (más arriesgada pero rentable)
    MIN_PROBABILITY: 0.45,  // 45% - Permite cuotas más altas
    MAX_PROBABILITY: 0.65,  // 65%

    // Parlay combinado
    MIN_COMBINED_ODDS: 5.00,  // Subido de 4.00
    MAX_COMBINED_ODDS: 12.00, // Subido de 10.00
    PICKS_PER_PARLAY: 3,
    PARLAYS_TO_GENERATE: 3,

    // Modelo
    MODEL: 'gemini-2.0-flash-exp',
    TEMPERATURE: 0.8  // Más creatividad para mercados diversos
}

// ═══════════════════════════════════════════════════════════════
// CATÁLOGO COMPLETO DE 60+ MERCADOS DISPONIBLES
// ═══════════════════════════════════════════════════════════════
const FULL_MARKET_CATALOG = {
    // === MERCADOS PRINCIPALES ===
    match_winner: {
        category: 'Principal',
        markets: ['home_win', 'draw', 'away_win'],
        typical_odds: { home_win: [1.20, 5.00], draw: [3.00, 5.00], away_win: [1.30, 8.00] }
    },
    double_chance: {
        category: 'Principal',
        markets: ['1x', '12', 'x2'],
        typical_odds: { '1x': [1.10, 1.80], '12': [1.05, 1.50], 'x2': [1.15, 2.00] }
    },
    draw_no_bet: {
        category: 'Principal',
        markets: ['dnb_home', 'dnb_away'],
        typical_odds: { dnb_home: [1.15, 3.00], dnb_away: [1.20, 4.00] }
    },

    // === MERCADOS DE GOLES TOTALES ===
    total_goals: {
        category: 'Goles',
        markets: ['over_0.5', 'under_0.5', 'over_1.5', 'under_1.5', 'over_2.5', 'under_2.5',
            'over_3.5', 'under_3.5', 'over_4.5', 'under_4.5'],
        typical_odds: {
            'over_0.5': [1.05, 1.20], 'under_0.5': [6.00, 15.00],
            'over_1.5': [1.15, 1.50], 'under_1.5': [2.50, 5.00],
            'over_2.5': [1.50, 2.50], 'under_2.5': [1.40, 2.20],
            'over_3.5': [2.00, 4.00], 'under_3.5': [1.20, 1.60],
            'over_4.5': [3.00, 8.00], 'under_4.5': [1.08, 1.30]
        }
    },

    // === AMBOS EQUIPOS MARCAN ===
    btts: {
        category: 'Goles',
        markets: ['btts_yes', 'btts_no'],
        typical_odds: { btts_yes: [1.50, 2.50], btts_no: [1.40, 2.20] }
    },

    // === GOLES POR EQUIPO ===
    home_goals: {
        category: 'Goles Equipo',
        markets: ['home_over_0.5', 'home_over_1.5', 'home_over_2.5',
            'home_under_0.5', 'home_under_1.5', 'home_under_2.5'],
        typical_odds: {
            'home_over_0.5': [1.15, 1.60], 'home_under_0.5': [2.50, 6.00],
            'home_over_1.5': [1.60, 3.00], 'home_under_1.5': [1.30, 2.00],
            'home_over_2.5': [2.50, 5.00], 'home_under_2.5': [1.15, 1.50]
        }
    },
    away_goals: {
        category: 'Goles Equipo',
        markets: ['away_over_0.5', 'away_over_1.5', 'away_over_2.5',
            'away_under_0.5', 'away_under_1.5', 'away_under_2.5'],
        typical_odds: {
            'away_over_0.5': [1.30, 2.00], 'away_under_0.5': [1.70, 3.50],
            'away_over_1.5': [2.00, 4.00], 'away_under_1.5': [1.20, 1.70],
            'away_over_2.5': [3.50, 7.00], 'away_under_2.5': [1.10, 1.40]
        }
    },

    // === MERCADOS POR TIEMPO ===
    first_half: {
        category: 'Por Tiempo',
        markets: ['1h_over_0.5', '1h_over_1.5', '1h_under_0.5', '1h_under_1.5',
            '1h_home_win', '1h_draw', '1h_away_win', '1h_btts_yes', '1h_btts_no'],
        typical_odds: {
            '1h_over_0.5': [1.30, 1.80], '1h_under_0.5': [1.80, 3.50],
            '1h_over_1.5': [2.00, 3.50], '1h_under_1.5': [1.25, 1.60],
            '1h_home_win': [2.00, 4.00], '1h_draw': [2.00, 2.80], '1h_away_win': [3.00, 6.00],
            '1h_btts_yes': [3.00, 5.00], '1h_btts_no': [1.15, 1.40]
        }
    },
    second_half: {
        category: 'Por Tiempo',
        markets: ['2h_over_0.5', '2h_over_1.5', '2h_under_0.5', '2h_under_1.5',
            '2h_home_win', '2h_draw', '2h_away_win', '2h_btts_yes', '2h_btts_no'],
        typical_odds: {
            '2h_over_0.5': [1.20, 1.60], '2h_under_0.5': [2.50, 5.00],
            '2h_over_1.5': [1.80, 3.00], '2h_under_1.5': [1.30, 1.70],
            '2h_home_win': [2.20, 4.50], '2h_draw': [2.20, 3.00], '2h_away_win': [3.50, 7.00],
            '2h_btts_yes': [3.50, 6.00], '2h_btts_no': [1.12, 1.35]
        }
    },

    // === MITAD CON MÁS GOLES ===
    half_with_most_goals: {
        category: 'Por Tiempo',
        markets: ['first_half_most', 'second_half_most', 'equal_halves'],
        typical_odds: { first_half_most: [2.50, 4.50], second_half_most: [1.80, 3.00], equal_halves: [3.00, 5.00] }
    },

    // === MITAD/TIEMPO COMPLETO ===
    halftime_fulltime: {
        category: 'Combinado',
        markets: ['ht_ft_1_1', 'ht_ft_1_x', 'ht_ft_1_2',
            'ht_ft_x_1', 'ht_ft_x_x', 'ht_ft_x_2',
            'ht_ft_2_1', 'ht_ft_2_x', 'ht_ft_2_2'],
        typical_odds: {
            ht_ft_1_1: [2.00, 5.00], ht_ft_1_x: [10.00, 30.00], ht_ft_1_2: [15.00, 50.00],
            ht_ft_x_1: [4.00, 8.00], ht_ft_x_x: [4.00, 8.00], ht_ft_x_2: [6.00, 15.00],
            ht_ft_2_1: [20.00, 60.00], ht_ft_2_x: [12.00, 35.00], ht_ft_2_2: [4.00, 10.00]
        }
    },

    // === CLEAN SHEET / PORTERÍA A CERO ===
    clean_sheet: {
        category: 'Defensa',
        markets: ['home_clean_sheet_yes', 'home_clean_sheet_no',
            'away_clean_sheet_yes', 'away_clean_sheet_no'],
        typical_odds: {
            home_clean_sheet_yes: [2.00, 4.00], home_clean_sheet_no: [1.20, 1.60],
            away_clean_sheet_yes: [2.50, 5.00], away_clean_sheet_no: [1.15, 1.50]
        }
    },

    // === GANAR SIN RECIBIR GOL ===
    win_to_nil: {
        category: 'Combinado',
        markets: ['home_win_to_nil', 'away_win_to_nil'],
        typical_odds: { home_win_to_nil: [2.50, 6.00], away_win_to_nil: [4.00, 10.00] }
    },

    // === MARGEN DE VICTORIA ===
    winning_margin: {
        category: 'Resultado',
        markets: ['home_by_1', 'home_by_2', 'home_by_3plus',
            'away_by_1', 'away_by_2', 'away_by_3plus', 'draw_exactly'],
        typical_odds: {
            home_by_1: [3.50, 6.00], home_by_2: [5.00, 10.00], home_by_3plus: [5.00, 15.00],
            away_by_1: [5.00, 9.00], away_by_2: [8.00, 18.00], away_by_3plus: [10.00, 30.00],
            draw_exactly: [3.00, 5.00]
        }
    },

    // === GOLES PARES/IMPARES ===
    odd_even: {
        category: 'Especial',
        markets: ['total_odd', 'total_even'],
        typical_odds: { total_odd: [1.85, 2.10], total_even: [1.80, 2.05] }
    },

    // === PRIMER GOL ===
    first_goal: {
        category: 'Especial',
        markets: ['first_goal_home', 'first_goal_away', 'no_goal'],
        typical_odds: { first_goal_home: [1.60, 2.50], first_goal_away: [2.00, 3.50], no_goal: [8.00, 20.00] }
    },

    // === ÚLTIMO GOL ===
    last_goal: {
        category: 'Especial',
        markets: ['last_goal_home', 'last_goal_away', 'no_goal_last'],
        typical_odds: { last_goal_home: [1.70, 2.80], last_goal_away: [2.20, 4.00], no_goal_last: [8.00, 20.00] }
    },

    // === GANA AMBAS MITADES ===
    win_both_halves: {
        category: 'Combinado',
        markets: ['home_wins_both_halves', 'away_wins_both_halves'],
        typical_odds: { home_wins_both_halves: [3.50, 8.00], away_wins_both_halves: [6.00, 15.00] }
    },

    // === ANOTA EN AMBAS MITADES ===
    score_both_halves: {
        category: 'Combinado',
        markets: ['home_scores_both_halves', 'away_scores_both_halves'],
        typical_odds: { home_scores_both_halves: [2.50, 5.00], away_scores_both_halves: [3.50, 7.00] }
    },

    // === HANDICAP EUROPEO ===
    handicap: {
        category: 'Handicap',
        markets: ['home_-1', 'home_-2', 'home_+1', 'home_+2',
            'away_-1', 'away_-2', 'away_+1', 'away_+2'],
        typical_odds: {
            'home_-1': [2.00, 4.00], 'home_-2': [3.50, 8.00],
            'home_+1': [1.30, 1.80], 'home_+2': [1.10, 1.40],
            'away_-1': [3.50, 8.00], 'away_-2': [6.00, 15.00],
            'away_+1': [1.50, 2.20], 'away_+2': [1.20, 1.60]
        }
    },

    // === RESULTADO EXACTO (Los más comunes) ===
    exact_score: {
        category: 'Resultado Exacto',
        markets: ['1-0', '2-0', '2-1', '3-0', '3-1', '0-0', '1-1', '2-2',
            '0-1', '0-2', '1-2', '0-3', '1-3'],
        typical_odds: {
            '1-0': [5.00, 10.00], '2-0': [7.00, 15.00], '2-1': [7.00, 13.00],
            '3-0': [12.00, 25.00], '3-1': [12.00, 22.00],
            '0-0': [8.00, 18.00], '1-1': [5.50, 10.00], '2-2': [10.00, 20.00],
            '0-1': [7.00, 15.00], '0-2': [12.00, 25.00], '1-2': [10.00, 18.00],
            '0-3': [20.00, 45.00], '1-3': [18.00, 35.00]
        }
    },

    // === GANA AL MENOS UNA MITAD ===
    win_either_half: {
        category: 'Combinado',
        markets: ['home_win_either_half', 'away_win_either_half'],
        typical_odds: { home_win_either_half: [1.40, 2.20], away_win_either_half: [1.80, 3.00] }
    }
}

// Lista plana de todos los mercados para el prompt
const ALL_MARKETS_LIST = Object.entries(FULL_MARKET_CATALOG)
    .flatMap(([key, val]) => val.markets.map(m => ({
        id: m,
        category: val.category,
        parent: key
    })))

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const startTime = Date.now()

    try {
        const { date } = await req.json()
        const targetDate = date || new Date().toISOString().split('T')[0]

        console.log(`[V3-PremiumParlay] ========================================`)
        console.log(`[V3-PremiumParlay] MOTOR V3 - ANÁLISIS INDEPENDIENTE`)
        console.log(`[V3-PremiumParlay] Fecha: ${targetDate}`)
        console.log(`[V3-PremiumParlay] ========================================`)

        // Initialize clients
        const sbUrl = Deno.env.get('SUPABASE_URL')!
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const geminiKey = Deno.env.get('GEMINI_API_KEY')!

        const supabase = createClient(sbUrl, sbKey)
        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({
            model: CONFIG.MODEL,
            generationConfig: {
                temperature: CONFIG.TEMPERATURE,
                responseMimeType: "application/json"
            }
        })

        // ═══════════════════════════════════════════════════════════════
        // FASE 1: CARGAR DATOS CRUDOS DE PARTIDOS
        // ═══════════════════════════════════════════════════════════════
        console.log('[V3-PremiumParlay] FASE 1: Cargando datos crudos...')

        // Obtener analysis_jobs_v2 con data_football completo
        const { data: analysisJobs, error: jobsError } = await supabase
            .from('analysis_jobs_v2')
            .select('*')
            .gte('created_at', `${targetDate}T00:00:00`)
            .lt('created_at', `${targetDate}T23:59:59`)
            .eq('status', 'done')

        if (jobsError) {
            console.error('[V3-PremiumParlay] Error fetching jobs:', jobsError)
        }

        // Obtener nombres de equipos desde daily_matches
        const fixtureIds = (analysisJobs || []).map(j => j.fixture_id).filter(Boolean)

        let matchDataMap = new Map<number, any>()
        if (fixtureIds.length > 0) {
            const { data: dailyMatches } = await supabase
                .from('daily_matches')
                .select('api_fixture_id, home_team, away_team, league_name')
                .in('api_fixture_id', fixtureIds)

            if (dailyMatches) {
                dailyMatches.forEach(m => matchDataMap.set(m.api_fixture_id, m))
            }
        }

        console.log(`[V3-PremiumParlay] Encontrados: ${analysisJobs?.length || 0} partidos con análisis`)

        if (!analysisJobs || analysisJobs.length < 3) {
            return new Response(JSON.stringify({
                success: false,
                error: `Se necesitan mínimo 3 partidos analizados. Encontrados: ${analysisJobs?.length || 0}`
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            })
        }

        // ═══════════════════════════════════════════════════════════════
        // FASE 2: PREPARAR CONTEXTO ESTADÍSTICO
        // ═══════════════════════════════════════════════════════════════
        console.log('[V3-PremiumParlay] FASE 2: Preparando contexto estadístico...')

        const matchContexts = []
        for (const job of analysisJobs.slice(0, 20)) { // Max 20 partidos
            const df = job.data_football || {}
            const matchInfo = matchDataMap.get(job.fixture_id)

            // Extraer estadísticas crudas
            const homeTeam = matchInfo?.home_team || df.match?.teams?.home?.name || 'Local'
            const awayTeam = matchInfo?.away_team || df.match?.teams?.away?.name || 'Visitante'
            const league = matchInfo?.league_name || df.match?.competition?.name || 'Liga'

            // Calcular métricas desde datos crudos
            const datasets = df.datasets || {}
            const homeLast10 = datasets.home_team_last40?.all?.slice(0, 10) || []
            const awayLast10 = datasets.away_team_last40?.all?.slice(0, 10) || []
            const h2h = datasets.h2h?.slice(0, 5) || []

            // Métricas calculadas
            const homeGoalsScored = homeLast10.reduce((sum: number, m: any) =>
                sum + (m.goals?.scored || 0), 0) / Math.max(homeLast10.length, 1)
            const homeGoalsConceded = homeLast10.reduce((sum: number, m: any) =>
                sum + (m.goals?.conceded || 0), 0) / Math.max(homeLast10.length, 1)
            const awayGoalsScored = awayLast10.reduce((sum: number, m: any) =>
                sum + (m.goals?.scored || 0), 0) / Math.max(awayLast10.length, 1)
            const awayGoalsConceded = awayLast10.reduce((sum: number, m: any) =>
                sum + (m.goals?.conceded || 0), 0) / Math.max(awayLast10.length, 1)

            // BTTS rate
            const homeBttsRate = homeLast10.filter((m: any) =>
                (m.goals?.scored || 0) > 0 && (m.goals?.conceded || 0) > 0
            ).length / Math.max(homeLast10.length, 1)
            const awayBttsRate = awayLast10.filter((m: any) =>
                (m.goals?.scored || 0) > 0 && (m.goals?.conceded || 0) > 0
            ).length / Math.max(awayLast10.length, 1)

            // Over 2.5 rate
            const homeOver25Rate = homeLast10.filter((m: any) =>
                ((m.goals?.scored || 0) + (m.goals?.conceded || 0)) > 2.5
            ).length / Math.max(homeLast10.length, 1)
            const awayOver25Rate = awayLast10.filter((m: any) =>
                ((m.goals?.scored || 0) + (m.goals?.conceded || 0)) > 2.5
            ).length / Math.max(awayLast10.length, 1)

            matchContexts.push({
                fixture_id: job.fixture_id,
                home_team: homeTeam,
                away_team: awayTeam,
                league: league,
                stats: {
                    home_avg_scored: homeGoalsScored.toFixed(2),
                    home_avg_conceded: homeGoalsConceded.toFixed(2),
                    away_avg_scored: awayGoalsScored.toFixed(2),
                    away_avg_conceded: awayGoalsConceded.toFixed(2),
                    home_btts_rate: (homeBttsRate * 100).toFixed(0) + '%',
                    away_btts_rate: (awayBttsRate * 100).toFixed(0) + '%',
                    home_over25_rate: (homeOver25Rate * 100).toFixed(0) + '%',
                    away_over25_rate: (awayOver25Rate * 100).toFixed(0) + '%',
                    h2h_last_5: h2h.length
                },
                h2h_summary: h2h.slice(0, 3).map((m: any) => `${m.home_score}-${m.away_score}`).join(', ')
            })
        }

        console.log(`[V3-PremiumParlay] Contextos preparados: ${matchContexts.length}`)

        // ═══════════════════════════════════════════════════════════════
        // FASE 3: PROMPT DE ANÁLISIS INDEPENDIENTE A GEMINI
        // ═══════════════════════════════════════════════════════════════
        console.log('[V3-PremiumParlay] FASE 3: Generando parlays con IA...')

        const marketsList = Object.entries(FULL_MARKET_CATALOG)
            .map(([key, val]) => `${val.category}: ${val.markets.join(', ')}`)
            .join('\n')

        const prompt = `Eres un EXPERTO ANALISTA de apuestas deportivas con 20 años de experiencia.

Tu tarea: Analizar los siguientes partidos y generar ${CONFIG.PARLAYS_TO_GENERATE} PARLAYS de ALTO VALOR.

═══════════════════════════════════════════════════════════════
REGLAS CRÍTICAS - SEGUIR AL PIE DE LA LETRA:
═══════════════════════════════════════════════════════════════

1. CUOTAS INDIVIDUALES: Entre ${CONFIG.MIN_INDIVIDUAL_ODDS} y ${CONFIG.MAX_INDIVIDUAL_ODDS}
   - NO uses mercados con cuota < ${CONFIG.MIN_INDIVIDUAL_ODDS} (muy seguros, poco valor)
   - NO uses mercados con cuota > ${CONFIG.MAX_INDIVIDUAL_ODDS} (muy arriesgados)

2. CUOTA COMBINADA: El producto de las 3 cuotas debe estar entre ${CONFIG.MIN_COMBINED_ODDS} y ${CONFIG.MAX_COMBINED_ODDS}
   - Ejemplo: 1.65 × 1.85 × 1.90 = 5.80 ✅


3. CADA PARLAY DEBE TENER EXACTAMENTE 3 PICKS de 3 PARTIDOS DIFERENTES

4. ⚠️ PROCESO DE ANÁLISIS OBLIGATORIO PARA CADA PARTIDO:
   Para CADA partido, debes:
   a) EVALUAR TODOS estos mercados:
      - 1X2 (Local, Empate, Visitante)
      - Doble Oportunidad (1X, X2, 12)
      - Over/Under 1.5, 2.5, 3.5
      - BTTS Sí/No
      - Goles del Local Over/Under
      - Goles del Visitante Over/Under
      - Primera mitad Over/Under
      - Segunda mitad Over/Under
      - Handicap
      - Clean Sheet
      - Win to Nil
   b) CALCULAR la probabilidad y valor de CADA mercado
   c) ELEGIR el mercado con MEJOR VALOR (cuota alta + probabilidad razonable)
   
   Si el mejor mercado coincide entre partidos, está bien - pero debe ser resultado de un análisis profundo, NO pereza.

5. CUOTAS MÍNIMAS: 
   - NUNCA uses cuotas menores a ${CONFIG.MIN_INDIVIDUAL_ODDS}
   - Busca mercados con cuotas entre 1.85 y 2.30 para máximo valor
   - EVITA mercados "seguros" como Over 0.5 o Under 4.5

6. MERCADOS DISPONIBLES (TODOS debes evaluarlos):
${marketsList}

═══════════════════════════════════════════════════════════════
PARTIDOS A ANALIZAR:
═══════════════════════════════════════════════════════════════

${matchContexts.map((m, i) => `
PARTIDO ${i + 1}: ${m.home_team} vs ${m.away_team}
Liga: ${m.league}
fixture_id: ${m.fixture_id}
Estadísticas:
  - ${m.home_team}: Anota ${m.stats.home_avg_scored} goles/partido, Recibe ${m.stats.home_avg_conceded}
  - ${m.away_team}: Anota ${m.stats.away_avg_scored} goles/partido, Recibe ${m.stats.away_avg_conceded}
  - BTTS: ${m.home_team} ${m.stats.home_btts_rate}, ${m.away_team} ${m.stats.away_btts_rate}
  - Over 2.5: ${m.home_team} ${m.stats.home_over25_rate}, ${m.away_team} ${m.stats.away_over25_rate}
  - H2H reciente: ${m.h2h_summary || 'Sin datos'}
`).join('\n')}

═══════════════════════════════════════════════════════════════
RESPUESTA REQUERIDA (JSON):
═══════════════════════════════════════════════════════════════

{
  "parlays": [
    {
      "name": "Nombre del Parlay",
      "confidence_tier": "balanced", 
      "strategy": "Breve descripción de la estrategia del parlay",
      "picks": [
        {
          "fixture_id": 123456,
          "home_team": "Equipo Local",
          "away_team": "Equipo Visitante",
          "market": "over_2.5",
          "selection": "Over 2.5 Goles",
          "odds": 1.85,
          "probability": 0.55,
          "reasoning": "Análisis específico de por qué este mercado tiene valor"
        }
      ],
      "combined_odds": 5.80,
      "combined_probability": 0.16
    }
  ]
}

⚠️ REGLAS CRÍTICAS ADICIONALES:
- NUNCA uses el mismo fixture_id + market en más de un parlay
- Ejemplo PROHIBIDO: "Partido 123 Over 1.5" en Parlay 1 Y en Parlay 2
- Cada pronóstico (fixture + mercado) debe aparecer en UN SOLO parlay
- Si un pronóstico falla, solo debe afectar a UN parlay, no a varios

IMPORTANTE:
- Usa CUALQUIER mercado de la lista, no solo los básicos
- Busca VALUE: mercados donde crees que la probabilidad real es mayor que la implícita
- Sé CREATIVO: usa mercados de primer tiempo, segundo tiempo, handicaps, etc.`

        const result = await model.generateContent(prompt)
        const responseText = result.response.text()

        console.log('[V3-PremiumParlay] Respuesta recibida de Gemini')

        // ═══════════════════════════════════════════════════════════════
        // FASE 4: PARSEAR Y VALIDAR RESPUESTA
        // ═══════════════════════════════════════════════════════════════
        console.log('[V3-PremiumParlay] FASE 4: Validando respuesta...')

        let parsed
        try {
            parsed = JSON.parse(responseText)
        } catch (e) {
            // Intentar extraer JSON del texto
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0])
            } else {
                throw new Error('No se pudo parsear respuesta de Gemini')
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // VALIDACIÓN DE PARLAYS INDIVIDUALES
        // ═══════════════════════════════════════════════════════════════
        const validParlays = (parsed.parlays || []).filter((p: any) => {
            // Validar 3 picks
            if (!p.picks || p.picks.length !== 3) return false

            // Validar partidos diferentes
            const fixtureIds = p.picks.map((pk: any) => pk.fixture_id)
            if (new Set(fixtureIds).size !== 3) return false

            // Validar cuotas individuales
            for (const pick of p.picks) {
                if (!pick.odds || pick.odds < CONFIG.MIN_INDIVIDUAL_ODDS || pick.odds > CONFIG.MAX_INDIVIDUAL_ODDS) {
                    return false
                }
            }

            // Calcular cuota combinada real
            const combinedOdds = p.picks.reduce((acc: number, pk: any) => acc * pk.odds, 1)
            if (combinedOdds < CONFIG.MIN_COMBINED_ODDS || combinedOdds > CONFIG.MAX_COMBINED_ODDS) {
                return false
            }

            // Actualizar cuota combinada
            p.combined_odds = parseFloat(combinedOdds.toFixed(2))

            // Calcular probabilidad como PROMEDIO (según solicitud del usuario)
            // En vez de multiplicar (que da valores muy bajos), promediamos
            const avgProbability = p.picks.reduce((sum: number, pk: any) => sum + (pk.probability || 0.5), 0) / p.picks.length
            p.combined_probability = parseFloat((avgProbability * 100).toFixed(1))

            return true
        })

        // ═══════════════════════════════════════════════════════════════
        // VALIDACIÓN GLOBAL: NO DUPLICAR PRONÓSTICOS ENTRE PARLAYS
        // ═══════════════════════════════════════════════════════════════
        const usedPicks = new Set<string>()
        const uniqueParlays = validParlays.filter((p: any) => {
            // Verificar que ningún pick de este parlay ya esté usado
            for (const pick of p.picks) {
                const pickKey = `${pick.fixture_id}_${pick.market}`
                if (usedPicks.has(pickKey)) {
                    console.log(`[V3-PremiumParlay] ⚠️ Rechazando parlay: pick duplicado ${pickKey}`)
                    return false // Rechazar este parlay, tiene un pick duplicado
                }
            }
            // Marcar todos los picks de este parlay como usados
            for (const pick of p.picks) {
                const pickKey = `${pick.fixture_id}_${pick.market}`
                usedPicks.add(pickKey)
            }
            return true
        })

        console.log(`[V3-PremiumParlay] Parlays válidos: ${validParlays.length}, Únicos: ${uniqueParlays.length}`)

        // ═══════════════════════════════════════════════════════════════
        // FASE 5: RESPUESTA FINAL
        // ═══════════════════════════════════════════════════════════════
        const duration = Date.now() - startTime

        return new Response(JSON.stringify({
            success: true,
            parlays: uniqueParlays,  // Usar uniqueParlays para evitar duplicados
            stats: {
                matches_analyzed: matchContexts.length,
                parlays_generated: uniqueParlays.length,
                parlays_with_duplicates_removed: validParlays.length - uniqueParlays.length,
                markets_available: ALL_MARKETS_LIST.length,
                duration_ms: duration
            },
            source: 'v3-independent-analysis'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('[V3-PremiumParlay] Error:', error)
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
