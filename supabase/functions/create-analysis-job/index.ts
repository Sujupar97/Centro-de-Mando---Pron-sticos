import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: any;

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let supabase: any;
  let job: any;

  try {
    const { api_fixture_id } = await req.json();
    console.log(`[JOB-START] Comparable Method Analysis for fixture: ${api_fixture_id}`);

    // --- INIT ---
    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(sbUrl, sbKey);

    // Create Job (EARLY SAVE for traceability)
    const { data: jobCreated, error: jobError } = await supabase
      .from('analysis_jobs')
      .insert({
        api_fixture_id,
        status: 'collecting_evidence',
        progress_jsonb: { step: 'Validando configuración...', completeness_score: 5 }
      })
      .select().single();

    // Assign to outer var
    job = jobCreated;

    if (jobError) throw jobError;

    // Validate External Secrets
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const footballKeys = Deno.env.get('API_FOOTBALL_KEYS');

    if (!geminiKey || !footballKeys) {
      const msg = `Faltan secretos: ${!geminiKey ? 'GEMINI ' : ''}${!footballKeys ? 'FOOTBALL' : ''}`;
      console.error(msg);

      await supabase.from('analysis_jobs').update({
        status: 'failed',
        last_error: msg,
        progress_jsonb: { step: 'Error de Configuración', error: msg, completeness_score: 0 }
      }).eq('id', job.id);

      return new Response(JSON.stringify({ job_id: job.id, status: 'failed', error: msg }), { headers: corsHeaders });
    }

    // Helper: API Fetch
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
      return [];
    };

    // --- STAGE 1: ETL & COLLECTION ---
    // 1. Target Fixture
    // 1. Target Fixture
    const fixtureData = await fetchFootball(`fixtures?id=${api_fixture_id}`);
    if (!fixtureData || fixtureData.length === 0) throw new Error("Fixture not found");
    const game = fixtureData[0];
    const { home: homeTeam, away: awayTeam } = game.teams;
    const leagueId = game.league.id;

    // FETCH CORRECT SEASON (Robust Date-Match Logic)
    // We match the fixture date against the league's season coverage (start/end)
    let season = game.league.season; // Init with fixture default
    try {
      const leagueData = await fetchFootball(`leagues?id=${leagueId}`); // Fetch ALL seasons
      if (leagueData && leagueData.length > 0 && leagueData[0].seasons) {
        const seasonsList = leagueData[0].seasons;
        const matchDate = new Date(game.fixture.date);

        // Strategy 1: Find season covering the date
        const matchedSeason = seasonsList.find((s: any) => {
          const start = new Date(s.start);
          const end = new Date(s.end);
          // Add buffer? usually api dates are precise. 
          return matchDate >= start && matchDate <= end;
        });

        if (matchedSeason) {
          season = matchedSeason.year;
          console.log(`[SEASON-LOGIC] Match Date ${game.fixture.date} falls in Season ${season}`);
        } else {
          // Strategy 2: If future/past, find the 'current' season (active now)
          const currentSeason = seasonsList.find((s: any) => s.current);
          if (currentSeason) {
            season = currentSeason.year;
            console.log(`[SEASON-LOGIC] No date match, using active CURRENT season ${season}`);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to calculate season by date, referencing fixture default", e);
    }


    // 2. Fetch Blocks (Parallel)
    console.log(`[ETL] Fetching Extended Data for ${homeTeam.name} vs ${awayTeam.name} (Season ${season})...`);

    const [
      last15_H, last15_A,
      h2h,
      standingsData,
      injuriesData,
      predictionsData,
      statsHome,
      statsAway
    ] = await Promise.all([
      fetchFootball(`fixtures?team=${homeTeam.id}&last=15&status=FT`),
      fetchFootball(`fixtures?team=${awayTeam.id}&last=15&status=FT`),
      fetchFootball(`fixtures/headtohead?h2h=${homeTeam.id}-${awayTeam.id}&last=10`),
      fetchFootball(`standings?league=${leagueId}&season=${season}`),
      fetchFootball(`injuries?fixture=${api_fixture_id}`),
      fetchFootball(`predictions?fixture=${api_fixture_id}`),
      fetchFootball(`teams/statistics?league=${leagueId}&season=${season}&team=${homeTeam.id}`),
      fetchFootball(`teams/statistics?league=${leagueId}&season=${season}&team=${awayTeam.id}`)
    ]);

    // Build Blocks in Memory
    const blocks = {
      H_home_last10: last15_H.filter((f: any) => f.teams.home.id === homeTeam.id).slice(0, 10),
      H_away_last10: last15_H.filter((f: any) => f.teams.away.id === homeTeam.id).slice(0, 10),
      A_home_last10: last15_H.filter((f: any) => f.teams.home.id === awayTeam.id).slice(0, 10),
      A_away_last10: last15_H.filter((f: any) => f.teams.away.id === awayTeam.id).slice(0, 10),
      H2H_last10: h2h || []
    };

    // ... (unchanged blocks)




    // --- STAGE 2: CONTEXT & STAKES ---
    const allStandings = standingsData?.[0]?.league?.standings?.[0] || [];

    // Intelligent Standings Slice (Contextual Table)
    let relevantStandings = [];
    if (allStandings.length > 0) {
      const homeIdx = allStandings.findIndex((s: any) => s.team.id === homeTeam.id);
      const awayIdx = allStandings.findIndex((s: any) => s.team.id === awayTeam.id);

      // Get generic key positions
      const top3 = allStandings.slice(0, 3);
      const bottom3 = allStandings.slice(-3);

      // Get neighbors for home and away
      const getNeighbors = (idx: number) => {
        if (idx === -1) return [];
        const start = Math.max(0, idx - 2);
        const end = Math.min(allStandings.length, idx + 3);
        return allStandings.slice(start, end);
      };

      const homeNeighbors = getNeighbors(homeIdx);
      const awayNeighbors = getNeighbors(awayIdx);

      // Merge and deduplicate
      const merged = [...top3, ...bottom3, ...homeNeighbors, ...awayNeighbors];
      const unique = new Map();
      merged.forEach((item: any) => unique.set(item.rank, item));
      relevantStandings = Array.from(unique.values()).sort((a: any, b: any) => a.rank - b.rank);
    }

    // Calculate Pressure/Stakes
    let pressure = 'Unknown';
    let pressure_reason = 'No standings data';
    let priority = 'League'; // Default

    if (allStandings.length > 0) {
      const homeRank = allStandings.find((s: any) => s.team.id === homeTeam.id)?.rank;
      const awayRank = allStandings.find((s: any) => s.team.id === awayTeam.id)?.rank;
      const total = allStandings.length;

      if (homeRank <= 4 || awayRank <= 4) {
        pressure = 'High';
        pressure_reason = 'Title/European Spot Contention';
      } else if (homeRank >= total - 3 || awayRank >= total - 3) {
        pressure = 'High';
        pressure_reason = 'Relegation Battle';
      } else {
        pressure = 'Medium';
        pressure_reason = 'Mid-table stability';
      }
    }

    if (game.league.name.includes("Champions") || game.league.name.includes("Libertadores")) {
      priority = "International Cup - High Priority";
      pressure = "High";
    }

    // Prepare Context Object for Gemini
    const gameContext = {
      target_fixture: {
        tournament: game.league,
        round: game.league.round,
        date: game.fixture.date,
        home_team: homeTeam.name,
        away_team: awayTeam.name,
        venue: game.fixture.venue
      },
      stakes_analysis: {
        pressure_level: pressure,
        reason: pressure_reason,
        priority_competition: priority,
        standings_context_snippet: relevantStandings.map((s: any) => `${s.rank}. ${s.team.name} (${s.points}pts, GD: ${s.goalsDiff})`)
      },
      injuries: injuriesData?.map((i: any) => `${i.team.name}: ${i.player.name} (${i.type})`) || [],
      season_stats: {
        home: {
          form: statsHome?.form,
          goals_for_avg: statsHome?.goals?.for?.average?.total,
          goals_against_avg: statsHome?.goals?.against?.average?.total,
          clean_sheets: statsHome?.clean_sheet?.total,
          failed_to_score: statsHome?.failed_to_score?.total
        },
        away: {
          form: statsAway?.form,
          goals_for_avg: statsAway?.goals?.for?.average?.total,
          goals_against_avg: statsAway?.goals?.against?.average?.total,
          clean_sheets: statsAway?.clean_sheet?.total,
          failed_to_score: statsAway?.failed_to_score?.total
        }
      },
      api_prediction: {
        winner: predictionsData?.[0]?.predictions?.winner,
        advice: predictionsData?.[0]?.predictions?.advice,
        percent: predictionsData?.[0]?.predictions?.percent
      },
      comparable_blocks: {
        H_home_last10_summary: blocks.H_home_last10.map((f: any) => `${f.score.fulltime.home}-${f.score.fulltime.away} vs ${f.teams.away.name}`),
        H_away_last10_summary: blocks.H_away_last10.map((f: any) => `${f.score.fulltime.home}-${f.score.fulltime.away} @ ${f.teams.home.name}`),
        A_away_last10_summary: blocks.A_away_last10.map((f: any) => `${f.score.fulltime.home}-${f.score.fulltime.away} @ ${f.teams.home.name}`),
        H2H_summary: blocks.H2H_last10.map((f: any) => `${(f.fixture?.date || f.date || '').split('T')[0]}: ${f.teams?.home?.name || 'Home'} ${f.score?.fulltime?.home}-${f.score?.fulltime?.away} ${f.teams?.away?.name || 'Away'}`)
      },
      data_quality: {
        h_home_count: blocks.H_home_last10.length,
        a_away_count: blocks.A_away_last10.length,
        h2h_count: blocks.H2H_last10.length,
        h2h_insufficient: blocks.H2H_last10.length < 5
      }
    };

    // --- STAGE 3: AI EXECUTION ---
    await supabase.from('analysis_jobs').update({ status: 'analyzing', progress_jsonb: { step: 'Generando Informe Estratégico...', completeness_score: 50 } }).eq('id', job.id);

    const prompt = `
    ACT AS AN ELITE SPORTS ANALYST. ANALYZE THIS MATCH USING THE "COMPARABLE METHOD".
    
    CRITICAL INSTRUCTIONS:
    1. INJURIES: You MUST check the 'injuries' list. If key players are missing, this is a major factor.
    2. STANDINGS: Use the 'standings_context_snippet' to understand the TRUE table pressure (relegation gap, title race) beyond just rank.
    3. PREDICTIONS: Review 'api_prediction' as a second opinion, but form your own conclusions.
    
    STRICT DATA SOURCE:
    ${JSON.stringify(gameContext)}

    OUTPUT JSON FORMAT (Strict):
    {
      "header_partido": { "titulo": "string", "subtitulo": "string", "bullets_clave": ["string"] },
      "resumen_ejecutivo": { "frase_principal": "string", "puntos_clave": ["string"] },
      "tablas_comparativas": {
        "forma": {
          "titulo": "Comparativa de Forma (Últimos 5)",
          "columnas": ["Equipo", "Goles Favor", "Goles Contra", "Pts"],
          "filas": [ ["Home", "10", "5", "12"], ["Away", "8", "8", "7"] ]
        }
      },
      "graficos_sugeridos": [
        {
          "titulo": "Probabilidad de Victoria",
          "descripcion": "Basado en forma reciente y H2H",
          "series": [ { "nombre": "Probabilidad", "valores": { "Home": 45, "Draw": 25, "Away": 30 } } ]
        }
      ],
      "analisis_detallado": {
         "contexto_competitivo": { "titulo": "Contexto", "bullets": ["string"] },
         "estilo_y_tactica": { "titulo": "Estilo y Táctica", "bullets": ["string"] },
         "alineaciones_y_bajas": { "titulo": "Alineaciones y Bajas", "bullets": ["string"] },
         "factores_situacionales": { "titulo": "Factores Situacionales", "bullets": ["string"] },
         "escenarios_de_partido": { "titulo": "Escenarios Probables", "escenarios": [ { "nombre": "string", "probabilidad_aproximada": "string", "descripcion": "string" } ] }
      },
      "predicciones_finales": {
        "detalle": [
          {
            "mercado": "string (1X2, Over/Under, etc)",
            "seleccion": "string",
            "probabilidad_estimado_porcentaje": number,
            "justificacion_detallada": { "base_estadistica": ["string"], "contexto_competitivo": ["string"], "conclusion": "string" }
          }
        ]
      },
      "advertencias": { "titulo": "Riesgos", "bullets": ["string"] }
    }
    `;

    // Debug: Log context size
    console.log(`[AI-CONTEXT] Validating Data Quality... H_Home: ${blocks.H_home_last10.length}, A_Away: ${blocks.A_away_last10.length}, H2H: ${blocks.H2H_last10.length}`);

    // Gemini Call 
    const requestBody = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5 } };
    const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${geminiKey}`;

    console.log("[AI-START] Sending prompt to Gemini 3 Pro Preview...");
    const genRes = await fetch(genUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody)
    });

    if (!genRes.ok) {
      // ... (error handling remains same, handled by outer catch mostly)
      const errText = await genRes.text();
      console.error(`[AI-ERROR] Gemini API Failed: ${genRes.status} - ${errText}`);
      throw new Error(`Gemini API Error (${genRes.status}): ${errText}`);
    }

    const genJson = await genRes.json();
    if (!genJson.candidates || genJson.candidates.length === 0) {
      console.error("[AI-ERROR] No candidates returned.", JSON.stringify(genJson));
      throw new Error("Gemini returned no candidates. Potential Refusal or Empty response.");
    }

    let aiResponseText = genJson.candidates[0].content?.parts?.[0]?.text || "{}";
    aiResponseText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();

    let aiData;
    try {
      aiData = JSON.parse(aiResponseText);
    } catch (parseErr) {
      console.error("[AI-ERROR] JSON Parse Failed", aiResponseText);
      throw new Error("Failed to parse AI response as JSON");
    }


    // --- STAGE 4: PERSISTENCE (Evidence & Context) ---
    console.log(`[DB-SAVE] Saving Analysis and Evidence for Job ${job.id}`);
    // 1. Save Run
    const { data: run, error: runErr } = await supabase.from('analysis_runs').insert({
      job_id: job.id,
      fixture_id: job.id, // Reverted to UUID to match schema
      league_name: game.league.name, // NEW: Persist League Name
      league_id: game.league.id,     // NEW: Persist League ID
      model_version: 'gemini-3-pro',
      summary_pre_text: aiData.resumen_ejecutivo?.frase_principal || 'Análisis Completo',
      report_pre_jsonb: {
        ...aiData,
        _raw_evidence: {
          injuries: injuriesData,
          api_predictions: predictionsData,
          stats_home: statsHome,
          stats_away: statsAway,
          standings_context: relevantStandings
        }
      }
    }).select().single();

    if (runErr) throw runErr;

    // 2. Save Context (Using defensive try-catch in case migration hasn't run)
    try {
      await supabase.from('match_context').insert({
        analysis_run_id: run.id,
        competition_type: null, // infer or map
        pressure_level: pressure,
        pressure_reason: pressure_reason,
        priority_competition: priority
      });
    } catch (e) { console.warn("Failed to save match_context (Table missing?)", e); }

    // 3. Save Evidence (Bulk)
    try {
      const evidenceRows = [
        ...blocks.H_home_last10.map((f: any) => ({ analysis_run_id: run.id, fixture_api_id: f.fixture.id, block_type: 'H_home_last10', stats_snapshot: f })),
        ...blocks.A_away_last10.map((f: any) => ({ analysis_run_id: run.id, fixture_api_id: f.fixture.id, block_type: 'A_away_last10', stats_snapshot: f })),
        ...blocks.H2H_last10.map((f: any) => ({ analysis_run_id: run.id, fixture_api_id: f.fixture.id, block_type: 'H2H', stats_snapshot: f }))
      ];
      if (evidenceRows.length > 0) await supabase.from('analysis_evidence').insert(evidenceRows);
    } catch (e) { console.warn("Failed to save analysis_evidence (Table missing?)", e); }

    // 4. Save Predictions
    try {
      const preds = aiData.predicciones_finales?.detalle || [];
      const predRows = preds.map((p: any) => ({
        analysis_run_id: run.id,
        fixture_id: api_fixture_id,
        market: p.mercado,
        selection: p.seleccion,
        probability: p.probabilidad_estimado_porcentaje,
        confidence: p.probabilidad_estimado_porcentaje > 70 ? 'High' : 'Medium',
        reasoning: p.justificacion_detallada?.conclusion
      }));
      if (predRows.length > 0) await supabase.from('predictions').insert(predRows);
    } catch (e) { console.error("Error saving predictions", e); }

    // 5. Update Legacy Cache & Job Status
    await supabase.from('analisis').upsert({ partido_id: api_fixture_id, resultado_analisis: { dashboardData: aiData } });
    await supabase.from('analysis_jobs').update({ status: 'done', completeness_score: 100 }).eq('id', job.id);

    return new Response(JSON.stringify({ success: true, run_id: run.id, job_id: job.id }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("FATAL ERROR IN FUNCTION:", err);

    // CRITICAL FIX: Update Job Status to FAILED in DB
    if (supabase && job?.id) {
      try {
        await supabase.from('analysis_jobs').update({
          status: 'failed',
          last_error: err.message || 'Fatal Error',
          progress_jsonb: { step: 'Error Crítico del Sistema', error: err.message, completeness_score: 0 }
        }).eq('id', job.id);
        console.log(`[ERROR-HANDLER] Marked Job ${job.id} as FAILED in DB.`);
      } catch (dbErr) {
        console.error("Failed to update job status to failed:", dbErr);
      }
    }

    return new Response(JSON.stringify({ error: err.message, detailed_error: JSON.stringify(err), success: false }), { status: 200, headers: corsHeaders });
  }
});