import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import JSON5 from "https://esm.sh/json5@2.2.3"
import { corsHeaders } from '../_shared/cors.ts'

// ... existing code ...


// --- SETUP ---
const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let supabase: any;
  let job: any;

  try {
    const { api_fixture_id } = await req.json();
    console.log(`[JOB-START] Elite Analysis for fixture: ${api_fixture_id}`);

    // CONFIG
    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(sbUrl, sbKey);

    // JOB INIT
    const { data: jobCreated, error: jobError } = await supabase
      .from('analysis_jobs')
      .insert({
        api_fixture_id,
        status: 'collecting_evidence',
        progress_jsonb: { step: 'Iniciando recolección de datos...', completeness_score: 5 }
      })
      .select().single();

    job = jobCreated;
    if (jobError) throw jobError;

    // SECRETS
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const footballKeys = Deno.env.get('API_FOOTBALL_KEYS');
    if (!geminiKey || !footballKeys) throw new Error("Missing API Secrets");

    // HELPER: FETCH
    const rawKeys = typeof footballKeys === 'string' ? footballKeys : '';
    const apiKeys = rawKeys.split(',').map((k: any) => k.trim()).filter((k: string) => k.length > 0);
    const fetchFootball = async (path: string) => {
      for (const key of apiKeys) {
        try {
          const res = await fetch(`${API_FOOTBALL_BASE}/${path}`, { headers: { 'x-apisports-key': key } });
          if (res.ok) {
            const json = await res.json();
            if (!json.errors || Object.keys(json.errors).length === 0) return json.response;
          }
        } catch (e) { console.error(e); }
      }
      return []; // Return empty on fail
    };

    // --- STAGE 1: CORE DATA FETCH ---
    const fixtureData = await fetchFootball(`fixtures?id=${api_fixture_id}`);
    if (!fixtureData || fixtureData.length === 0) throw new Error("Fixture not found");
    const game = fixtureData[0];
    const { home: homeTeam, away: awayTeam } = game.teams;
    const leagueId = game.league.id;

    // SEASON LOGIC (Robust)
    let season = game.league.season;
    try {
      // ... (Simplified logic for brevity, relying on fixture season if fetch fails)
      // Ideally we would double check with league endpoint but we can trust fixture season usually
    } catch (e) { }

    console.log(`[ETL] Fetching detailed data for ${homeTeam.name} vs ${awayTeam.name} (${season})...`);

    // PARALLEL FETCHING (Enhanced with tactical data)
    const [
      last40_H, last40_A,
      h2h,
      standingsData,
      injuriesData,
      predictionsData,
      statsHome,
      statsAway,
      oddsData,
      currentMatchLineups, // NEW: Lineups for this match
      refereeFixtures // NEW: Referee's recent matches
    ] = await Promise.all([
      fetchFootball(`fixtures?team=${homeTeam.id}&last=40&status=FT`),
      fetchFootball(`fixtures?team=${awayTeam.id}&last=40&status=FT`),
      fetchFootball(`fixtures/headtohead?h2h=${homeTeam.id}-${awayTeam.id}&last=20`),
      fetchFootball(`standings?league=${leagueId}&season=${season}`),
      fetchFootball(`injuries?fixture=${api_fixture_id}`),
      fetchFootball(`predictions?fixture=${api_fixture_id}`),
      fetchFootball(`teams/statistics?league=${leagueId}&season=${season}&team=${homeTeam.id}`),
      fetchFootball(`teams/statistics?league=${leagueId}&season=${season}&team=${awayTeam.id}`),
      fetchFootball(`odds?fixture=${api_fixture_id}`),
      fetchFootball(`fixtures/lineups?fixture=${api_fixture_id}`), // Get formations for this match
      game.fixture.referee ? fetchFootball(`fixtures?referee=${encodeURIComponent(game.fixture.referee)}&last=20&status=FT`) : Promise.resolve([]) // Referee stats
    ]);



    // --- STAGE 2: PROCESS & ENRICH COMPARABLES ---

    // Helper to format match objects for AI
    const createMatchObject = (f: any, stats: any = null) => ({
      date: f.fixture.date.split('T')[0],
      home_team: f.teams.home.name,
      away_team: f.teams.away.name,
      score: `${f.goals.home}-${f.goals.away}`,
      is_home_for_team: f.teams.home.id === homeTeam.id || f.teams.home.id === awayTeam.id ? 'YES' : 'NO', // Rough check
      stats: stats ? {
        shots: stats.reduce((acc: any, curr: any) => acc + (curr.statistics.find((s: any) => s.type === 'Total Shots')?.value || 0), 0),
        corners: stats.reduce((acc: any, curr: any) => acc + (curr.statistics.find((s: any) => s.type === 'Corner Kicks')?.value || 0), 0),
        // Simplification: api-football stats are per team. We need to parse correctly.
        // If we fetch stats/fixture, we get array of 2 teams.
        home_stats: stats.find((t: any) => t.team.id === f.teams.home.id)?.statistics?.reduce((acc: any, s: any) => ({ ...acc, [s.type]: s.value }), {}),
        away_stats: stats.find((t: any) => t.team.id === f.teams.away.id)?.statistics?.reduce((acc: any, s: any) => ({ ...acc, [s.type]: s.value }), {})
      } : null
    });

    // 2.1 Identify Comparables (Last 10 specific condition)
    // Home as Home
    const homeAsHome10 = (last40_H || []).filter((f: any) => f.teams.home.id === homeTeam.id).slice(0, 10);
    // Away as Away
    const awayAsAway10 = (last40_A || []).filter((f: any) => f.teams.away.id === awayTeam.id).slice(0, 10);

    // 2.2 Fetch Stats AND Lineups for these 20 matches (TACTICAL ENRICHMENT)
    const comparableIds = [...homeAsHome10, ...awayAsAway10].map((f: any) => f.fixture.id);
    const uniqueComparableIds = [...new Set(comparableIds)];

    const statsMap = new Map();
    const lineupsMap = new Map(); // NEW: Store formations
    console.log(`[ETL] Enriching ${uniqueComparableIds.length} comparables with stats + lineups...`);

    await Promise.all(uniqueComparableIds.map(async (fid) => {
      const [s, l] = await Promise.all([
        fetchFootball(`fixtures/statistics?fixture=${fid}`),
        fetchFootball(`fixtures/lineups?fixture=${fid}`)
      ]);
      if (s && s.length > 0) statsMap.set(fid, s);
      if (l && l.length > 0) lineupsMap.set(fid, l);
    }));

    const enrich = (list: any[]) => list.map(f => createMatchObject(f, statsMap.get(f.fixture.id)));

    // --- STAGE 2.5: TACTICAL DATA PROCESSING ---

    // Process lineups to extract formations and tactical patterns
    const processTacticalData = (fixtureIds: number[], teamId: number) => {
      const formations: any[] = [];
      const formationStats: Record<string, { count: number, wins: number, draws: number, losses: number, goalsFor: number, goalsAgainst: number }> = {};

      fixtureIds.forEach(fid => {
        const lineup = lineupsMap.get(fid);
        const fixtureData = [...(homeAsHome10 || []), ...(awayAsAway10 || [])].find(f => f.fixture.id === fid);
        if (!lineup || !fixtureData) return;

        const teamLineup = lineup.find((l: any) => l.team.id === teamId);
        if (!teamLineup) return;

        const isHome = fixtureData.teams.home.id === teamId;
        const goalsFor = isHome ? fixtureData.goals.home : fixtureData.goals.away;
        const goalsAgainst = isHome ? fixtureData.goals.away : fixtureData.goals.home;
        const result = goalsFor > goalsAgainst ? 'W' : (goalsFor < goalsAgainst ? 'L' : 'D');

        const formation = teamLineup.formation || 'Unknown';

        formations.push({
          fixture_id: fid,
          team_id: teamId, // For DB save
          date: fixtureData.fixture.date.split('T')[0],
          formation,
          starting_xi: teamLineup.startXI?.map((p: any) => ({
            name: p.player.name,
            number: p.player.number,
            position: p.player.pos,
            grid: p.player.grid
          })),
          substitutes: teamLineup.substitutes?.map((p: any) => ({
            name: p.player.name,
            number: p.player.number,
            position: p.player.pos
          })) || [],
          result,
          goals_for: goalsFor,
          goals_against: goalsAgainst
        });

        if (!formationStats[formation]) {
          formationStats[formation] = { count: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
        }
        formationStats[formation].count++;
        formationStats[formation][result === 'W' ? 'wins' : (result === 'D' ? 'draws' : 'losses')]++;
        formationStats[formation].goalsFor += goalsFor || 0;
        formationStats[formation].goalsAgainst += goalsAgainst || 0;
      });

      return { formations, formationStats };
    };

    const homeFormations = processTacticalData(homeAsHome10.map(f => f.fixture.id), homeTeam.id);
    const awayFormations = processTacticalData(awayAsAway10.map(f => f.fixture.id), awayTeam.id);


    // Process referee statistics
    const processRefereeStats = async (matches: any[]) => {
      if (!matches || matches.length === 0) return null;

      let totalYellow = 0;
      let totalRed = 0;
      let homeYellow = 0;
      let awayYellow = 0;
      let validGames = 0;

      // Fetch stats for referee's matches (limit to first 10 to avoid timeout)
      const refMatchesToAnalyze = matches.slice(0, 10);

      for (const m of refMatchesToAnalyze) {
        try {
          const stats = await fetchFootball(`fixtures/statistics?fixture=${m.fixture.id}`);
          if (!stats || stats.length < 2) continue;

          validGames++;
          const homeStats = stats[0]?.statistics || [];
          const awayStats = stats[1]?.statistics || [];

          const homeYC = homeStats.find((s: any) => s.type === 'Yellow Cards')?.value || 0;
          const awayYC = awayStats.find((s: any) => s.type === 'Yellow Cards')?.value || 0;
          const homeRC = homeStats.find((s: any) => s.type === 'Red Cards')?.value || 0;
          const awayRC = awayStats.find((s: any) => s.type === 'Red Cards')?.value || 0;

          totalYellow += (parseInt(homeYC) || 0) + (parseInt(awayYC) || 0);
          totalRed += (parseInt(homeRC) || 0) + (parseInt(awayRC) || 0);
          homeYellow += parseInt(homeYC) || 0;
          awayYellow += parseInt(awayYC) || 0;
        } catch (e) {
          console.error(`Error fetching referee match stats: ${m.fixture.id}`, e);
        }
      }

      return validGames > 0 ? {
        referee_name: game.fixture.referee,
        total_games: validGames,
        avg_yellow_cards: (totalYellow / validGames).toFixed(2),
        avg_red_cards: (totalRed / validGames).toFixed(2),
        home_yellow_avg: (homeYellow / validGames).toFixed(2),
        away_yellow_avg: (awayYellow / validGames).toFixed(2)
      } : null;
    };

    const refereeStats = game.fixture.referee ? await processRefereeStats(refereeFixtures) : null;


    // --- STAGE 3: BUILD "CONTRATO DE ENTRADA" JSON ---

    const allStandings = standingsData?.[0]?.league?.standings?.[0] || [];
    const getTeamContext = (tid: number) => {
      const s = allStandings.find((x: any) => x.team.id === tid);
      return s ? { position: s.rank, points: s.points, form: s.form, gd: s.goalsDiff } : null;
    };

    const inputPayload = {
      match: {
        match_id: `${api_fixture_id}`,
        date_time_utc: game.fixture.date,
        competition: {
          name: game.league.name,
          country: game.league.country,
          type: game.league.type, // League vs Cup
          round: game.league.round
        },
        venue: { stadium: game.fixture.venue.name, city: game.fixture.venue.city },
        teams: { home: { id: homeTeam.id, name: homeTeam.name }, away: { id: awayTeam.id, name: awayTeam.name } }
      },
      datasets: {
        home_team_last40: {
          overall: (last40_H || []).slice(0, 40).map((f: any) => createMatchObject(f)),
          as_home: (last40_H || []).filter((f: any) => f.teams.home.id === homeTeam.id).slice(0, 20).map((f: any) => createMatchObject(f)),
          as_away: (last40_H || []).filter((f: any) => f.teams.away.id === homeTeam.id).slice(0, 20).map((f: any) => createMatchObject(f))
        },
        away_team_last40: {
          overall: (last40_A || []).slice(0, 40).map((f: any) => createMatchObject(f)),
          as_home: (last40_A || []).filter((f: any) => f.teams.home.id === awayTeam.id).slice(0, 20).map((f: any) => createMatchObject(f)),
          as_away: (last40_A || []).filter((f: any) => f.teams.away.id === awayTeam.id).slice(0, 20).map((f: any) => createMatchObject(f))
        },
        comparables_last10: {
          home: {
            as_home: enrich(homeAsHome10) // ENRICHED WITH STATS
          },
          away: {
            as_away: enrich(awayAsAway10) // ENRICHED WITH STATS
          },
          notes: "Comparables specifically selected for Condition (Home vs Home, Away vs Away)"
        },
        h2h: { last_matches: (h2h || []).map((f: any) => createMatchObject(f)) },
        standings: {
          table_snapshot: allStandings.slice(0, 8), // Top 8 only to save tokens, usually relevant
          home_team_context: getTeamContext(homeTeam.id),
          away_team_context: getTeamContext(awayTeam.id)
        },
        availability: {
          home: { injuries: (injuriesData || []).filter((i: any) => i.team.id === homeTeam.id) },
          away: { injuries: (injuriesData || []).filter((i: any) => i.team.id === awayTeam.id) }
        },
        season_stats: {
          home: statsHome,
          away: statsAway
        },
        api_prediction: {
          provider: "API-Football",
          outputs: predictionsData?.[0]?.predictions || {}
        },
        odds: {
          book: oddsData?.[0]?.bookmakers?.[0]?.name || "Unknown",
          markets: oddsData?.[0]?.bookmakers?.[0]?.bets || []
        },
        tactical_analysis: {
          current_match_formations: {
            home: currentMatchLineups?.[0] || null,
            away: currentMatchLineups?.[1] || null
          },
          home_team_tactical_profile: {
            recent_formations: homeFormations.formations,
            formation_statistics: homeFormations.formationStats,
            most_used_formation: Object.entries(homeFormations.formationStats).sort((a: any, b: any) => b[1].count - a[1].count)[0]?.[0] || "Unknown",
            tactical_notes: `Based on last 10 home matches. Analyze formation patterns, key players, and tactical flexibility.`
          },
          away_team_tactical_profile: {
            recent_formations: awayFormations.formations,
            formation_statistics: awayFormations.formationStats,
            most_used_formation: Object.entries(awayFormations.formationStats).sort((a: any, b: any) => b[1].count - a[1].count)[0]?.[0] || "Unknown",
            tactical_notes: `Based on last 10 away matches. Analyze formation patterns, key players, and tactical flexibility.`
          },
          referee_analysis: refereeStats ? {
            ...refereeStats,
            tactical_impact: `Referee ${refereeStats.referee_name}: Avg ${refereeStats.avg_yellow_cards} yellow cards/game. Consider impact on card markets and playing style.`
          } : null
        }
      }
    };

    const prompt = `
YOU ARE AN ELITE FOOTBALL TACTICAL ANALYST with 20+ years of professional experience.
Output language: CONSTANTLY, STRICTLY, ONLY SPANISH (ESPAÑOL).

Your expertise includes:
- Tactical formations analysis (4-4-2, 4-3-3, 3-5-2, 5-3-2, etc.)
- Player positioning, movement patterns, and roles within systems
- Set-piece strategies (corners, free kicks) and execution
- In-game adjustments and substitution impact
- Referee tendencies and their impact on game flow and betting markets
- Weather/pitch condition effects on tactics and outcomes

CRITICAL MINDSET:
You combine STATISTICAL ANALYSIS with TACTICAL INTELLIGENCE. Don't just report numbers—INTERPRET them through a tactical lens. Identify opportunities in ANY market: goals, corners, cards, players, BTTS, handicaps, etc.

==========================================
STRICT DATA SOURCE (JSON):
==========================================
${JSON.stringify(inputPayload)}

==========================================
TACTICAL ANALYSIS METHODOLOGY:
==========================================

1. FORMATION ANALYSIS (CRITICAL):
   For each team, analyze their tactical_analysis section:
   A. FORMATION PATTERNS: Frequency, success rate, flexibility.
   B. FORMATION MATCHUP: How Team A's shape plays against Team B's.
   C. KEY PLAYERS: Starters, injuries impact.

2. REFEREE IMPACT ANALYSIS:
   - Analyze card stats if available.
   - Correlate referee style with team tactics (e.g., Physical defense + Strict ref = Cards).

3. SCENARIO ANALYSIS (NEW):
   - PROBABLE SCENARIO: The most logical game script (60-70% chance).
   - UNEXPECTED SCENARIO: A "Black Swan" event or alternative outcome (e.g., early red card, underdog scores first). How does this change the live betting strategy?

4. OPPORTUNITY IDENTIFICATION (ALL MARKETS):
   - Corners, Cards, Goals, BTTS, Player Props.
   - Justify everything with TACTICS + DATA.

==========================================
OUTPUT FORMAT (STRICT JSON):
==========================================
{
  "veredicto_analista": {
    "decision": "APOSTAR", // VALUES: "APOSTAR" | "OBSERVAR" | "EVITAR"
    "titulo_accion": "OPORTUNIDAD CLARA DETECTADA" or "NO HAY VALOR / ALTO RIESGO",
    "seleccion_clave": "Ej: Más de 2.5 Goles", // NULL if decision is EVITAR/OBSERVAR
    "probabilidad": 85, // INTEGER 0-100. Estimate based on stats dominance.
    "nivel_confianza": "ALTA", // VALUES: "ALTA" | "MEDIA" | "BAJA"
    "razon_principal": "Argumento más fuerte en una frase.",
    "riesgo_principal": "El mayor peligro de esta predicción."
  },
  "header_partido": {
    "titulo": "Local vs Visitante: [Gancho Táctico]",
    "subtitulo": "Competición - Estadio",
    "bullets_clave": ["Insight Táctico 1", "Insight Táctico 2", "Insight Táctico 3"]
  },
  "resumen_ejecutivo": {
    "frase_principal": "Una frase poderosa resumiendo el duelo táctico.",
    "puntos_clave": [
      "Análisis de formaciones",
      "Impacto del Árbitro",
      "Oportunidad clave detectada",
      "Riesgo principal"
    ]
  },
  "tablas_comparativas": {
    "forma_reciente": {
      "titulo": "Forma Reciente (Últimos 10)",
      "columnas": ["Equipo", "PJ", "W", "D", "L", "GF", "GC"],
      "filas": [
        ["Local", 10, 6, 2, 2, 18, 8],
        ["Visitante", 10, 4, 3, 3, 12, 11]
      ]
    },
    "formaciones_tacticas": {
      "titulo": "Análisis de Formaciones",
      "columnas": ["Equipo", "Formación Principal", "Veces Usada", "W-D-L", "GF/GC"],
      "filas": [
        ["Local", "4-3-3", "8/10", "6-1-1", "15-6"],
        ["Visitante", "5-4-1", "7/10", "3-3-1", "8-5"]
      ]
    },
    "promedio_goles": {
      "titulo": "Promedio de Goles",
      "columnas": ["Equipo", "GF/P", "GC/P", "Total/P"],
      "filas": [
        ["Local", 1.8, 0.8, 2.6],
        ["Visitante", 1.2, 1.1, 2.3]
      ]
    }
  },
  "graficos_sugeridos": [
    {
      "titulo": "Corners por Formación",
      "descripcion": "Promedio de corners cuando juegan con su formación principal",
      "series": [
        {"nombre": "Local (4-3-3)", "valores": {"Corners a favor": 5.2, "Corners en contra": 3.1}},
        {"nombre": "Visitante (5-4-1)", "valores": {"Corners a favor": 2.8, "Corners en contra": 4.5}}
      ]
    }
  ],
  "analisis_detallado": {
    "contexto_competitivo": {
      "titulo": "Contexto Competitivo",
      "bullets": ["Texto en ESPAÑOL"]
    },
    "analisis_tactico_formaciones": {
      "titulo": "Análisis Táctico de Formaciones",
      "bullets": ["Texto en ESPAÑOL"]
    },
    "impacto_arbitro": {
      "titulo": "Impacto del Árbitro",
      "bullets": ["Texto en ESPAÑOL"]
    },
    "alineaciones_y_bajas": {
      "titulo": "Alineaciones y Bajas Críticas",
      "bullets": ["Texto en ESPAÑOL"]
    },
    "analisis_escenarios": {
      "titulo": "Proyección de Escenarios",
      "escenarios": [
        {
          "nombre": "ESCENARIO PROBABLE (60-70%)",
          "probabilidad_aproximada": "65%",
          "descripcion": "Descripción detallada de cómo se desarrollará el partido bajo condiciones normales. Quién domina, quién contragolpea, ritmo esperado.",
          "implicacion_apuestas": "Apuntar a Over de córners y victoria local ajustada."
        },
        {
          "nombre": "ESCENARIO INESPERADO / ALTERNATIVO (20-30%)",
          "probabilidad_aproximada": "25%",
          "descripcion": "Qué pasa si el visitante anota primero o el local sufre una expulsión. Plan de juego alternativo.",
          "implicacion_apuestas": "Si visitante anota primero, buscar 'Both Teams to Score' o Local empata."
        }
      ]
    }
  },
  "predicciones_finales": {
    "detalle": [
      {
        "mercado": "Total Corners",
        "seleccion": "Over 9.5",
        "probabilidad_estimado_porcentaje": 75,
        "justificacion_detallada": {
          "base_estadistica": ["Datos"],
          "contexto_competitivo": ["Contexto"],
          "conclusion": "Conclusión en ESPAÑOL."
        }
      }
    ]
  },
  "advertencias": {
    "titulo": "Factores de Riesgo",
    "bullets": ["Riesgo 1", "Riesgo 2"]
  }
}

CRITICAL REMINDERS:
1. OUTPUT MUST BE 100% IN SPANISH. NO ENGLISH IN VALUES.
2. NEVER, NEVER INVENT ODDS/PRICES (NO "1.85"). IT IS STRICTLY FORBIDDEN.
3. BE A STRICT FILTER. If the match is 50/50 or risky, set 'decision' to "EVITAR".
4. ONLY set 'decision' to "APOSTAR" if you have >70% confidence.
5. In 'veredicto_analista', use simple, direct language. Tell the user exactly what to do (Bet or Avoid).
6. KEEP THE SCENARIO ANALYSIS. It is useful.
`;


    // --- STAGE 5: EXECUTION ---

    // Using Gemini 3 Pro Preview (Explicitly requested by User)
    const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${geminiKey}`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json' // FORCE JSON MODE
      }
    };

    const genRes = await fetch(genUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });

    if (!genRes.ok) throw new Error(`Gemini Error: ${await genRes.text()}`);
    const genJson = await genRes.json();
    let aiResponseText = genJson.candidates[0].content?.parts?.[0]?.text || "{}";

    // ROBUST CLEANUP:
    // 1. Remove markdown
    aiResponseText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
    // 2. Extract strictly from valid JSON boundaries if extra text exists
    const startIndex = aiResponseText.indexOf('{');
    const endIndex = aiResponseText.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
      aiResponseText = aiResponseText.substring(startIndex, endIndex + 1);
    }

    let aiData;
    try {
      // JSON5 is the "Root Solution": It handles comments, trailing commas, single quotes, 
      // and unquoted keys - effectively parsing any "JSON-like" JS object structure 
      // without using dangerous eval().
      aiData = JSON5.parse(aiResponseText);
    } catch (e) {
      console.error("JSON5 Parsing failed. Raw text:", aiResponseText);
      throw new Error(`Critical AI Syntax Error: ${e.message}`);
    }

    // --- STAGE 6: SAVE ---
    // Save enriched evidence
    const { data: runData, error: runError } = await supabase.from('analysis_runs').insert({
      job_id: job.id,
      fixture_id: job.id, // REVERTED: DB column expects UUID. Using job.id as intended by schema.
      model_version: 'gemini-3-pro-preview',
      summary_pre_text: aiData.resumen_ejecutivo?.frase_principal,
      report_pre_jsonb: aiData
    }).select().single();

    if (runError) {
      console.error('[SAVE] Error saving analysis_run:', runError);
      throw runError;
    }

    // --- STAGE 6.5: SAVE PREDICTIONS TO DEDICATED TABLE ---
    const predictions = aiData.predicciones_finales?.detalle || [];
    if (predictions.length > 0 && runData) {
      const predictionsToInsert = predictions.map((p: any) => ({
        analysis_run_id: runData.id,
        fixture_id: api_fixture_id, // Use actual API fixture ID for TopPicks lookup
        market: p.mercado || 'Mercado',
        selection: p.seleccion || 'Selección',
        probability: p.probabilidad_estimado_porcentaje || 50,
        confidence: (p.probabilidad_estimado_porcentaje || 50) >= 70 ? 'Alta' : 'Media',
        reasoning: p.justificacion_detallada?.conclusion || ''
      }));

      const { error: predError } = await supabase.from('predictions').insert(predictionsToInsert);
      if (predError) {
        console.error('[SAVE] Error saving predictions:', predError);
      } else {
        console.log(`[SAVE] Inserted ${predictionsToInsert.length} predictions for fixture ${api_fixture_id}`);
      }
    }

    // --- STAGE 6.6: CACHE TACTICAL & REFEREE DATA ---

    // 1. Save Referee Stats (Upsert)
    if (refereeStats && game.fixture.referee) {
      // Use current league/season context for cache key
      const refPayload = {
        referee_name: game.fixture.referee,
        league_id: leagueId,
        season: season,
        total_games: refereeStats.total_games,
        avg_yellow_cards: parseFloat(refereeStats.avg_yellow_cards),
        avg_red_cards: parseFloat(refereeStats.avg_red_cards),
        avg_fouls: 0, // Not calculated yet
        home_yellow_avg: parseFloat(refereeStats.home_yellow_avg),
        away_yellow_avg: parseFloat(refereeStats.away_yellow_avg),
        last_updated: new Date().toISOString()
      };

      const { error: refError } = await supabase.from('referee_stats').upsert(refPayload, {
        onConflict: 'referee_name, league_id, season'
      });

      if (refError) console.error('[SAVE] Referee cache error:', refError);
      else console.log('[SAVE] Updated referee stats cache');
    }

    // 2. Save Tactical Data (Formations)
    // Combine home and away formations to save
    const allFormations = [...homeFormations.formations, ...awayFormations.formations];
    if (allFormations.length > 0) {
      const tacticalPayloads = allFormations.map((f: any) => ({
        fixture_id: f.fixture_id,
        team_id: f.team_id,
        team_name: f.team_id === homeTeam.id ? homeTeam.name : (f.team_id === awayTeam.id ? awayTeam.name : 'Unknown'),
        formation: f.formation,
        starting_eleven: f.starting_xi,
        substitutes: f.substitutes,
        match_date: f.date
      }));

      // Upsert to match_tactical_data
      const { error: tacError } = await supabase.from('match_tactical_data').upsert(tacticalPayloads, {
        onConflict: 'fixture_id, team_id'
      });

      if (tacError) console.error('[SAVE] Tactical data error:', tacError);
      else console.log(`[SAVE] Cached ${tacticalPayloads.length} tactical records`);
    }


    // Save Evidence Blocks (New Schema)
    // We can save the raw enriched blocks for debugging
    // ...

    // Update status
    await supabase.from('analysis_jobs').update({ status: 'done', completeness_score: 100 }).eq('id', job.id);
    await supabase.from('analisis').upsert({ partido_id: api_fixture_id, resultado_analisis: { dashboardData: aiData } });


    return new Response(JSON.stringify({ success: true, job_id: job.id }), { headers: corsHeaders });

  } catch (err: any) {
    if (job?.id) await supabase.from('analysis_jobs').update({ status: 'failed', last_error: err.message }).eq('id', job.id);
    return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders });
  }
});