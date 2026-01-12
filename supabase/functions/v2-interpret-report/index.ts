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
        // BUILD PROMPT (Gemini SOLO interpreta, NO decide)
        // ═══════════════════════════════════════════════════════════════
        const prompt = `
ERES UN ANALISTA TÁCTICO DE FÚTBOL DE ÉLITE con 20+ años de experiencia profesional.
Idioma de salida: ESTRICTAMENTE ESPAÑOL.

════════════════════════════════════════════════════════════════════════════════
CONTEXTO CRÍTICO: TU ROL ES EXPLICAR Y AUDITAR, NO DECIDIR
════════════════════════════════════════════════════════════════════════════════

Las decisiones de apuesta ya fueron tomadas por el VALUE ENGINE (sistema cuantitativo).
Tu trabajo es:
1. EXPLICAR por qué cada pick tiene (o no tiene) valor desde una perspectiva TÁCTICA
2. CONTEXTUALIZAR el partido (competencia, motivación, dinámica de juego)
3. IDENTIFICAR riesgos adicionales que el modelo estadístico podría no capturar
4. GENERAR un REPORTE COMPLETO para el usuario final

════════════════════════════════════════════════════════════════════════════════
DATOS DEL PARTIDO
════════════════════════════════════════════════════════════════════════════════
- Equipos: ${match.teams?.home?.name || 'Local'} vs ${match.teams?.away?.name || 'Visitante'}
- Competición: ${match.competition?.name || 'Desconocida'} (${match.competition?.country || ''})
- Ronda: ${match.competition?.round || 'N/A'}
- Fecha: ${match.date_time_utc || 'N/A'}
- Árbitro: ${match.referee || 'No confirmado'}

════════════════════════════════════════════════════════════════════════════════
MÉTRICAS CALCULADAS (del Motor Cuantitativo)
════════════════════════════════════════════════════════════════════════════════
${JSON.stringify(metrics, null, 2)}

════════════════════════════════════════════════════════════════════════════════
DECISIONES DEL VALUE ENGINE (OBLIGATORIAS - NO MODIFICAR)
════════════════════════════════════════════════════════════════════════════════
PICKS CON VALOR (BET):
${betPicks.length > 0 ? JSON.stringify(betPicks, null, 2) : 'Ninguno - el sistema no encontró edge suficiente'}

PICKS EN OBSERVACIÓN (WATCH):
${watchPicks.slice(0, 5).map((p: any) => `- ${p.market}: ${p.selection} (edge: ${p.edge ? (p.edge * 100).toFixed(1) + '%' : 'N/A'})`).join('\n')}

════════════════════════════════════════════════════════════════════════════════
DATOS DE CONTEXTO ADICIONALES
════════════════════════════════════════════════════════════════════════════════
- Clasificación Local: Posición ${datasets.standings?.home_context?.position || 'N/A'}, Forma: ${datasets.standings?.home_context?.form || 'N/A'}
- Clasificación Visitante: Posición ${datasets.standings?.away_context?.position || 'N/A'}, Forma: ${datasets.standings?.away_context?.form || 'N/A'}
- Lesionados Local: ${datasets.injuries?.home?.length || 0}
- Lesionados Visitante: ${datasets.injuries?.away?.length || 0}

════════════════════════════════════════════════════════════════════════════════
INSTRUCCIONES ESTRICTAS
════════════════════════════════════════════════════════════════════════════════

❌ PROHIBIDO:
- Inventar picks nuevos que no estén en la lista de BET
- Cambiar decisiones de BET a WATCH/AVOID o viceversa
- Usar información de tu entrenamiento que no esté en los datos proporcionados
- Inventar jugadores o lesiones no listados
- Mencionar predictions de APIs externas (NO EXISTEN en V2)

✅ OBLIGATORIO:
- Explicar CADA pick BET desde perspectiva táctica
- Identificar el escenario probable y uno alternativo
- Señalar riesgos que el modelo estadístico podría no capturar
- Mantener TODO el output en español

════════════════════════════════════════════════════════════════════════════════
FORMATO DE SALIDA (JSON ESTRICTO)
════════════════════════════════════════════════════════════════════════════════
{
  "resumen_ejecutivo": {
    "titular": "Frase de 10-15 palabras que capture la esencia del partido",
    "decision_sistema": "${betPicks.length > 0 ? 'APOSTAR' : 'OBSERVAR'}",
    "picks_principales": ["Pick 1", "Pick 2"],
    "confianza_global": 70,
    "riesgo_principal": "El mayor factor de riesgo en una frase"
  },
  "contexto_competitivo": {
    "titulo": "Análisis del Contexto",
    "situacion_local": "Descripción de la situación del equipo local (2-3 oraciones)",
    "situacion_visitante": "Descripción de la situación del equipo visitante (2-3 oraciones)",
    "implicaciones": "Qué significa esto para el partido"
  },
  "analisis_tactico": {
    "titulo": "Análisis Táctico",
    "enfoque_local": "Cómo juega el local, formación esperada, estilo",
    "enfoque_visitante": "Cómo juega el visitante, formación esperada, estilo",
    "matchup": "Cómo interactúan tácticamente - ventajas/desventajas"
  },
  "proyeccion_escenarios": {
    "escenario_probable": {
      "probabilidad": "60-70%",
      "descripcion": "Descripción del desarrollo más probable del partido",
      "implicacion_picks": "Por qué los picks tienen sentido en este escenario"
    },
    "escenario_alternativo": {
      "probabilidad": "20-30%",
      "descripcion": "Descripción de un escenario alternativo (evento inesperado)",
      "implicacion_picks": "Cómo afectaría esto a los picks"
    }
  },
  "justificacion_picks": [
    {
      "pick": "Mercado: Selección",
      "decision": "BET",
      "justificacion_tactica": "Por qué este pick tiene sentido desde la táctica",
      "datos_soporte": ["Dato 1", "Dato 2"],
      "riesgos_especificos": ["Riesgo 1"]
    }
  ],
  "factores_riesgo": {
    "titulo": "Factores de Riesgo",
    "riesgos": [
      "Riesgo 1 que el modelo podría no capturar",
      "Riesgo 2",
      "Riesgo 3"
    ]
  },
  "conclusion": {
    "veredicto": "Resumen final en 2-3 oraciones explicando por qué apostar o no apostar"
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
