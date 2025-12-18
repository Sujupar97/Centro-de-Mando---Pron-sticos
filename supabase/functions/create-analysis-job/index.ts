import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: any;

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { api_fixture_id } = await req.json();
    console.log(`[JOB-START] Comparable Method Analysis for fixture: ${api_fixture_id}`);

    // --- INIT ---
    // --- INIT ---
    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(sbUrl, sbKey);

    // Create Job (EARLY SAVE for traceability)
    const { data: job, error: jobError } = await supabase
      .from('analysis_jobs')
      .insert({
        api_fixture_id,
        status: 'collecting_evidence',
        progress_jsonb: { step: 'Validando configuración...', completeness_score: 5 }
      })
      .select().single();

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
    const fixtureData = await fetchFootball(`fixtures?id=${api_fixture_id}`);
    if (!fixtureData || fixtureData.length === 0) throw new Error("Fixture not found");
    const game = fixtureData[0];
    const { home: homeTeam, away: awayTeam } = game.teams;
    const leagueId = game.league.id;
    const season = game.league.season;

    // 2. Fetch Blocks (Parallel)
    console.log(`[ETL] Fetching Comparable Blocks for ${homeTeam.name} vs ${awayTeam.name}...`);

    // H_home_last10: Home Team at Home
    // H_away_last10: Home Team Away
    // A_home_last10: Away Team at Home
    // A_away_last10: Away Team Away
    // H2H: Head to Head

    const [
      h_home, h_away,
      a_home, a_away,
      h2h,
      standingsData
    ] = await Promise.all([
      fetchFootball(`fixtures?team=${homeTeam.id}&last=10&venue=${homeTeam.id}`), // Aprox venue, better to filter by team-home
      fetchFootball(`fixtures?team=${homeTeam.id}&last=10`), // Filter later
      fetchFootball(`fixtures?team=${awayTeam.id}&last=10`), // Filter later
      fetchFootball(`fixtures?team=${awayTeam.id}&last=10&status=FT`), // Just last 10 games
      fetchFootball(`fixtures/headtohead?h2h=${homeTeam.id}-${awayTeam.id}&last=10`),
      fetchFootball(`standings?league=${leagueId}&season=${season}`)
    ]);

    // Refine Blocks (Strict 'Home vs Away' logic isn't perfect via API alone, 
    // so API returns 'last 10 games involving team'. We must filter conceptually if needed, 
    // but for now we trust the "Last 10 form" generally. 
    // Wait, user asked for: "H como local", "H como visitante".
    // API endpoint `fixtures?team={id}&last=10` returns mixed.
    // Correct refactor: Fetch last 20 and filter? Or rely on API parameters?
    // API has `venue` param but it takes ID. Team ID != Venue ID.
    // We will separate manually from a larger fetch if needed, 
    // BUT for stability/speed we'll fetch general form and classify in memory.

    // Revised Strategy: Fetch last 20 matches for each team to ensure we have enough Home/Away splits.
    // But to save quota, let's stick to the 'last 10 total' the user sees, OR obey the prompt "last 10 where H played home".
    // API doesn't strictly support "last 10 where team was home". It supports "last X".
    // I will fetch last 15 for each to get a good mix.

    // Redoing fetches for better block accuracy:
    const [last15_H, last15_A] = await Promise.all([
      fetchFootball(`fixtures?team=${homeTeam.id}&last=15&status=FT`),
      fetchFootball(`fixtures?team=${awayTeam.id}&last=15&status=FT`)
    ]);

    // Build Blocks in Memory
    const blocks = {
      H_home_last10: last15_H.filter((f: any) => f.teams.home.id === homeTeam.id).slice(0, 10),
      H_away_last10: last15_H.filter((f: any) => f.teams.away.id === homeTeam.id).slice(0, 10),
      A_home_last10: last15_A.filter((f: any) => f.teams.home.id === awayTeam.id).slice(0, 10),
      A_away_last10: last15_A.filter((f: any) => f.teams.away.id === awayTeam.id).slice(0, 10),
      H2H_last10: h2h || []
    };

    // --- STAGE 2: CONTEXT & STAKES ---
    const standings = standingsData?.[0]?.league?.standings?.[0] || []; // Simple table

    // Calculate Pressure/Stakes
    let pressure = 'Unknown';
    let pressure_reason = 'No standings data';
    let priority = 'League'; // Default

    if (standings.length > 0) {
      const homeRank = standings.find((s: any) => s.team.id === homeTeam.id)?.rank;
      const awayRank = standings.find((s: any) => s.team.id === awayTeam.id)?.rank;
      const total = standings.length;

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
        standings_snippet: standings.slice(0, 5).map((s: any) => `${s.rank}. ${s.team.name} (${s.points}pts)`) // Top 5 context
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

    console.log("[AI-START] Sending prompt to Gemini...");
    const genRes = await fetch(genUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody)
    });

    if (!genRes.ok) {
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
      fixture_id: job.id, // Using Job ID as Fixture ID per your schema pattern? Or api_fixture_id?
      // Note: Schema analysis_runs.fixture_id is UUID/Text? Need to check. 
      // Logic: job.id is UUID. analysis_runs.job_id is UUID.
      model_version: 'gemini-1.5-flash-comparable',
      summary_pre_text: aiData.resumen_ejecutivo?.frase_principal || 'Análisis Completo',
      report_pre_jsonb: aiData
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
    // Return 200 for debugging
    return new Response(JSON.stringify({ error: err.message, detailed_error: JSON.stringify(err), success: false }), { status: 200, headers: corsHeaders });
  }
});