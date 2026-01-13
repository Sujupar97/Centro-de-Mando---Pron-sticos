// supabase/functions/v2-interpret-report/index.ts
// MOTOR E: Interpretación + Reporte
// Propósito: Gemini genera interpretación y reporte (NO decide picks)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import JSON5 from "https://esm.sh/json5@2.2.3"
import { corsHeaders } from '../_shared/cors.ts'

const ENGINE_VERSION = '2.0.0';
const PROMPT_VERSION = '2.0.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const { job_id, fixture_id, payload, metrics, picks } = await req.json();
    if (!job_id || !fixture_id) throw new Error('job_id and fixture_id are required');

    console.log(`[V2-INTERPRET] Generating report for job: ${job_id}`);

    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

    const supabase = createClient(sbUrl, sbKey);

    // Update job status
    await supabase
      .from('analysis_jobs_v2')
      .update({ status: 'interpret', current_motor: 'E' })
      .eq('id', job_id);

    // Filter picks for BET decisions only
    const betPicks = picks.filter((p: any) => p.decision === 'BET');
    const watchPicks = picks.filter((p: any) => p.decision === 'WATCH');

    const match = payload?.match || {};
    const datasets = payload?.datasets || {};

    // ═══════════════════════════════════════════════════════════════
    // PREPARAR DATOS DETALLADOS PARA PROMPT
    // ═══════════════════════════════════════════════════════════════

    // Formatear últimos 5 partidos de cada equipo
    const formatLast5 = (matches: any[], teamId: number) => {
      if (!matches || matches.length === 0) return 'No hay datos disponibles';
      return matches.slice(0, 5).map((m: any, i: number) => {
        const isHome = m.home_id === teamId;
        const ourScore = isHome ? m.score_home : m.score_away;
        const theirScore = isHome ? m.score_away : m.score_home;
        const opponent = isHome ? m.away_team : m.home_team;
        const venue = isHome ? 'LOCAL' : 'VISITANTE';
        const result = ourScore > theirScore ? 'VICTORIA' : ourScore < theirScore ? 'DERROTA' : 'EMPATE';
        return `${i + 1}. ${m.date} - ${result} ${ourScore}-${theirScore} vs ${opponent} (${venue})`;
      }).join('\n');
    };

    // Formatear H2H
    const formatH2H = (h2hMatches: any[]) => {
      if (!h2hMatches || h2hMatches.length === 0) return 'Sin historial de enfrentamientos directos';
      const homeTeamId = match.teams?.home?.id;
      let homeWins = 0, awayWins = 0, draws = 0;

      const details = h2hMatches.slice(0, 10).map((m: any, i: number) => {
        const homeWon = m.score_home > m.score_away;
        const awayWon = m.score_away > m.score_home;
        if (m.home_id === homeTeamId) {
          if (homeWon) homeWins++; else if (awayWon) awayWins++; else draws++;
        } else {
          if (homeWon) awayWins++; else if (awayWon) homeWins++; else draws++;
        }
        return `${i + 1}. ${m.date}: ${m.home_team} ${m.score_home}-${m.score_away} ${m.away_team}`;
      }).join('\n');

      return `RESUMEN H2H (últimos ${h2hMatches.length}): ${homeWins}V - ${draws}E - ${awayWins}D\n\nDETALLE:\n${details}`;
    };

    // Interpretar posición en tabla
    const interpretPosition = (pos: number | null, points: number | null, form: string | null, gd: number | null) => {
      if (!pos) return 'Posición desconocida';
      let situation = '';
      if (pos <= 4) situation = 'ZONA DE CHAMPIONS - Máxima presión por mantener el puesto';
      else if (pos <= 6) situation = 'ZONA EUROPA - Luchando por competiciones europeas';
      else if (pos <= 10) situation = 'MEDIA TABLA - Sin presión, pueden jugar liberados';
      else if (pos <= 15) situation = 'ZONA BAJA - Necesitan puntos para alejarse del descenso';
      else situation = 'ZONA DE DESCENSO - Presión máxima, desesperación por puntos';

      const formText = form ? `Forma reciente: ${form} (${form.split('').filter((c: string) => c === 'W').length} victorias de 5)` : '';
      const gdText = gd ? `Diferencia de goles: ${gd >= 0 ? '+' : ''}${gd}` : '';

      return `Posición ${pos} | ${points || 0} pts | ${situation}\n${formText}\n${gdText}`;
    };

    // Formatear lesiones
    const formatInjuries = (injuries: any[]) => {
      if (!injuries || injuries.length === 0) return 'Sin lesionados reportados';
      return injuries.map((i: any) => `- ${i.player?.name || 'Jugador'}: ${i.player?.reason || 'Lesión'}`).join('\n');
    };

    // Datos procesados
    const homeTeamId = match.teams?.home?.id;
    const awayTeamId = match.teams?.away?.id;
    const last5Home = formatLast5(datasets.home_team_last40?.all || [], homeTeamId);
    const last5Away = formatLast5(datasets.away_team_last40?.all || [], awayTeamId);
    const h2hAnalysis = formatH2H(datasets.h2h || []);
    const homeContext = interpretPosition(
      datasets.standings?.home_context?.position,
      datasets.standings?.home_context?.points,
      datasets.standings?.home_context?.form,
      datasets.standings?.home_context?.gd
    );
    const awayContext = interpretPosition(
      datasets.standings?.away_context?.position,
      datasets.standings?.away_context?.points,
      datasets.standings?.away_context?.form,
      datasets.standings?.away_context?.gd
    );
    const homeInjuries = formatInjuries(datasets.injuries?.home || []);
    const awayInjuries = formatInjuries(datasets.injuries?.away || []);

    // ═══════════════════════════════════════════════════════════════
    // BUILD PROMPT PROFUNDO (Gemini SOLO interpreta, NO decide)
    // ═══════════════════════════════════════════════════════════════
    const prompt = `
ERES UN ANALISTA TÁCTICO DE FÚTBOL DE ÉLITE con 25+ años analizando partidos profesionalmente.
Tu análisis debe ser PROFUNDO, ESPECÍFICO y PROFESIONAL. No quiero generalidades.
Idioma de salida: ESPAÑOL.

════════════════════════════════════════════════════════════════════════════════
🎯 TU MISIÓN: ANALIZAR Y EXPLICAR (NO DECIDIR PICKS)
════════════════════════════════════════════════════════════════════════════════
Las decisiones de apuesta YA fueron tomadas por el VALUE ENGINE usando matemáticas.
Tu trabajo es:
1. EXPLICAR tácticamente por qué esas decisiones tienen sentido (o los riesgos)
2. ANALIZAR en PROFUNDIDAD: formaciones, estados mentales, lo que se juegan
3. GENERAR un reporte que un apostador profesional usaría

════════════════════════════════════════════════════════════════════════════════
📋 DATOS DEL PARTIDO
════════════════════════════════════════════════════════════════════════════════
🏟️ PARTIDO: ${match.teams?.home?.name || 'Local'} vs ${match.teams?.away?.name || 'Visitante'}
🏆 COMPETICIÓN: ${match.competition?.name || 'Liga'} (${match.competition?.country || ''})
📅 FECHA: ${match.date_time_utc || 'Por definir'}
🔔 RONDA: ${match.competition?.round || 'N/A'}
👨‍⚖️ ÁRBITRO: ${match.referee || 'No confirmado'}

════════════════════════════════════════════════════════════════════════════════
📊 SITUACIÓN EN TABLA - ${match.teams?.home?.name}
════════════════════════════════════════════════════════════════════════════════
${homeContext}

════════════════════════════════════════════════════════════════════════════════
📊 SITUACIÓN EN TABLA - ${match.teams?.away?.name}
════════════════════════════════════════════════════════════════════════════════
${awayContext}

════════════════════════════════════════════════════════════════════════════════
📈 ÚLTIMOS 5 PARTIDOS - ${match.teams?.home?.name}
════════════════════════════════════════════════════════════════════════════════
${last5Home}

════════════════════════════════════════════════════════════════════════════════
📈 ÚLTIMOS 5 PARTIDOS - ${match.teams?.away?.name}
════════════════════════════════════════════════════════════════════════════════
${last5Away}

════════════════════════════════════════════════════════════════════════════════
⚔️ HISTORIAL DE ENFRENTAMIENTOS DIRECTOS (H2H)
════════════════════════════════════════════════════════════════════════════════
${h2hAnalysis}

════════════════════════════════════════════════════════════════════════════════
🏥 LESIONADOS
════════════════════════════════════════════════════════════════════════════════
${match.teams?.home?.name}:
${homeInjuries}

${match.teams?.away?.name}:
${awayInjuries}

════════════════════════════════════════════════════════════════════════════════
🔢 MÉTRICAS CALCULADAS POR EL MODELO
════════════════════════════════════════════════════════════════════════════════
- Goles promedio local en casa: ${metrics?.goals?.home?.as_home?.scored_avg?.toFixed(2) || 'N/A'}
- Goles promedio visitante fuera: ${metrics?.goals?.away?.as_away?.scored_avg?.toFixed(2) || 'N/A'}
- Probabilidad BTTS: ${metrics?.btts?.combined_btts_probability ? (metrics.btts.combined_btts_probability * 100).toFixed(1) + '%' : 'N/A'}

════════════════════════════════════════════════════════════════════════════════
🎯 DECISIONES DEL VALUE ENGINE (MATEMÁTICAS - NO CAMBIAR)
════════════════════════════════════════════════════════════════════════════════
${betPicks.length > 0 ? `✅ PICKS CON VALOR:
${betPicks.map((p: any) => `• ${p.market}: ${p.selection} | Prob: ${(p.p_model * 100).toFixed(0)}% | Edge: +${(p.edge * 100).toFixed(1)}%`).join('\n')}` : '❌ El modelo NO encontró valor matemático en ningún mercado.'}

${watchPicks.length > 0 ? `👀 MERCADOS EN OBSERVACIÓN:
${watchPicks.slice(0, 5).map((p: any) => `• ${p.market}: ${p.selection} (Edge: ${p.edge ? (p.edge * 100).toFixed(1) + '%' : 'N/A'})`).join('\n')}` : ''}

════════════════════════════════════════════════════════════════════════════════
📝 ANÁLISIS OBLIGATORIO
════════════════════════════════════════════════════════════════════════════════
DEBES ANALIZAR:
1. **ESTADO PSICOLÓGICO**: ¿Tienen presión? ¿Qué se juegan? ¿Hay motivación extra?
2. **FORMACIONES**: ¿Qué formación usan y QUÉ SIGNIFICA tácticamente?
3. **MATCHUPS**: ¿Cómo chocan las formaciones? ¿Quién tiene ventaja?
4. **CONTEXTO**: ¿Los picks del modelo tienen sentido táctico?

❌ PROHIBIDO: Inventar picks, cambiar decisiones, mencionar APIs externas.

════════════════════════════════════════════════════════════════════════════════
📄 FORMATO JSON
════════════════════════════════════════════════════════════════════════════════
{
  "resumen_ejecutivo": {
    "titular": "Frase de 10-15 palabras que capture la ESENCIA TÁCTICA del partido",
    "decision_sistema": "${betPicks.length > 0 ? 'APOSTAR' : 'OBSERVAR'}",
    "picks_principales": ${JSON.stringify(betPicks.slice(0, 3).map((p: any) => `${p.selection} (${p.market})`))},
    "confianza_global": ${betPicks[0]?.confidence || 50},
    "riesgo_principal": "El mayor factor que podría arruinar los picks"
  },
  "contexto_competitivo": {
    "titulo": "Lo Que Se Juegan",
    "situacion_local": "2-3 oraciones sobre presión, motivación, posición del local",
    "situacion_visitante": "2-3 oraciones sobre presión, motivación, posición del visitante",
    "implicaciones": "Cómo afecta esto al desarrollo del partido"
  },
  "analisis_tactico": {
    "titulo": "Análisis Táctico Profundo",
    "enfoque_local": "Formación, estilo de juego, qué buscan hacer tácticamente",
    "enfoque_visitante": "Formación, estilo de juego, qué buscan hacer tácticamente",
    "matchup": "Cómo chocan tácticamente - quién tiene ventaja y por qué"
  },
  "analisis_psicologico": {
    "titulo": "Factor Mental",
    "estado_local": "¿Cómo llegan mentalmente? ¿Confianza o crisis?",
    "estado_visitante": "¿Cómo llegan mentalmente? ¿Confianza o crisis?",
    "factor_clave": "Qué aspecto mental será determinante"
  },
  "proyeccion_escenarios": {
    "escenario_probable": {
      "probabilidad": "55-65%",
      "descripcion": "Cómo se desarrollará probablemente el partido",
      "implicacion_picks": "Por qué los picks tienen sentido aquí"
    },
    "escenario_alternativo": {
      "probabilidad": "25-35%",
      "descripcion": "Qué podría salir diferente",
      "implicacion_picks": "Cómo afectaría a los picks"
    }
  },
  "justificacion_picks": [
    {
      "pick": "Mercado: Selección",
      "decision": "BET",
      "justificacion_tactica": "Por qué TÁCTICAMENTE este pick hace sentido",
      "datos_soporte": ["Dato estadístico 1", "Dato estadístico 2"],
      "riesgos_especificos": ["Riesgo específico de este pick"]
    }
  ],
  "factores_riesgo": {
    "titulo": "Alertas y Riesgos",
    "riesgos": ["Riesgo 1 no capturado por modelo", "Riesgo 2 táctico", "Riesgo 3 contextual"]
  },
  "conclusion": {
    "veredicto": "2-3 oraciones finales explicando por qué apostar o no desde perspectiva táctica"
  }
}
`;

    // ═══════════════════════════════════════════════════════════════
    // CALL GEMINI
    // ═══════════════════════════════════════════════════════════════
    const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json'
      }
    };

    const genRes = await fetch(genUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!genRes.ok) throw new Error(`Gemini Error: ${await genRes.text()}`);

    const genJson = await genRes.json();
    let aiResponseText = genJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const tokensUsed = genJson.usageMetadata?.totalTokenCount || 0;

    // Clean response
    aiResponseText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const startIndex = aiResponseText.indexOf('{');
    const endIndex = aiResponseText.lastIndexOf('}');
    if (startIndex !== -1 && endIndex > startIndex) {
      aiResponseText = aiResponseText.substring(startIndex, endIndex + 1);
    }

    let reportData;
    try {
      reportData = JSON5.parse(aiResponseText);
    } catch (e) {
      console.error('[V2-INTERPRET] JSON parse failed, using fallback');
      reportData = {
        resumen_ejecutivo: {
          titular: 'Error en generación de reporte',
          decision_sistema: betPicks.length > 0 ? 'APOSTAR' : 'OBSERVAR',
          picks_principales: betPicks.map((p: any) => `${p.market}: ${p.selection}`),
          confianza_global: 50,
          riesgo_principal: 'Error técnico en generación'
        },
        conclusion: {
          veredicto: 'El reporte no pudo ser generado correctamente. Consulta los picks directamente.'
        }
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // SAVE INTERPRETATION
    // ═══════════════════════════════════════════════════════════════
    await supabase
      .from('interpretation_v2')
      .insert({
        job_id,
        fixture_id,
        interpretation_packet: {
          tactical_analysis: reportData.analisis_tactico,
          scenario_projection: reportData.proyeccion_escenarios,
          risk_assessment: reportData.factores_riesgo,
          pick_justifications: reportData.justificacion_picks
        },
        prompt_version: PROMPT_VERSION,
        tokens_used: tokensUsed,
        generation_time_ms: Date.now() - startTime
      });

    // ═══════════════════════════════════════════════════════════════
    // SAVE FULL REPORT
    // ═══════════════════════════════════════════════════════════════
    await supabase
      .from('reports_v2')
      .insert({
        job_id,
        fixture_id,
        report_packet: reportData,
        prompt_version: PROMPT_VERSION
      });

    // Update job to done
    await supabase
      .from('analysis_jobs_v2')
      .update({
        status: 'done',
        current_motor: 'E',
        execution_time_ms: Date.now() - startTime
      })
      .eq('id', job_id);

    const executionTime = Date.now() - startTime;
    console.log(`[V2-INTERPRET] ✅ Report generated in ${executionTime}ms (${tokensUsed} tokens)`);

    return new Response(JSON.stringify({
      success: true,
      job_id,
      fixture_id,
      report: reportData,
      tokens_used: tokensUsed,
      execution_time_ms: executionTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('[V2-INTERPRET] Error:', e);
    return new Response(JSON.stringify({
      success: false,
      error: e.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
