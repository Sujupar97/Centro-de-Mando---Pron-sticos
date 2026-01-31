// supabase/functions/v3-ai-analyzer/index.ts
// MOTOR V3: IA PURO - Gemini hace TODO el análisis y toma de decisiones
// Elimina dependencia de motores matemáticos B, C, D

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import JSON5 from "https://esm.sh/json5@2.2.3"
import { corsHeaders } from '../_shared/cors.ts'

const ENGINE_VERSION = '3.0.0';
const PROMPT_VERSION = '3.0.0';

// Lista completa de mercados a evaluar
const MARKETS_CATALOG = `
═══ MERCADOS DISPONIBLES PARA EVALUAR ═══

RESULTADO (1X2):
- Victoria Local
- Empate  
- Victoria Visitante
- Doble Oportunidad: 1X (Local o Empate)
- Doble Oportunidad: X2 (Empate o Visitante)
- Doble Oportunidad: 12 (Local o Visitante)
- Empate Apuesta No (DNB) Local
- Empate Apuesta No (DNB) Visitante

GOLES TOTALES:
- Over 0.5 Goles
- Under 0.5 Goles
- Over 1.5 Goles
- Under 1.5 Goles
- Over 2.5 Goles
- Under 2.5 Goles
- Over 3.5 Goles
- Under 3.5 Goles
- Over 4.5 Goles
- Under 4.5 Goles

AMBOS ANOTAN (BTTS):
- Ambos Anotan: Sí
- Ambos Anotan: No
- BTTS + Over 2.5
- BTTS + Under 3.5

GOLES POR EQUIPO:
- Local Over 0.5 Goles
- Local Over 1.5 Goles
- Local Over 2.5 Goles
- Visitante Over 0.5 Goles
- Visitante Over 1.5 Goles
- Visitante Over 2.5 Goles
- Local Anota: Sí
- Local Anota: No
- Visitante Anota: Sí
- Visitante Anota: No

GOLES POR TIEMPO:
- Gol en 1er Tiempo: Sí
- Gol en 1er Tiempo: No
- Gol en 2do Tiempo: Sí
- 1er Tiempo Over 0.5
- 1er Tiempo Over 1.5
- 2do Tiempo Over 0.5
- 2do Tiempo Over 1.5
- Mayor Cantidad Goles: 1er Tiempo
- Mayor Cantidad Goles: 2do Tiempo
- Mayor Cantidad Goles: Igual

CORNERS:
- Corners Over 7.5
- Corners Over 8.5
- Corners Over 9.5
- Corners Over 10.5
- Corners Over 11.5
- Corners Under 9.5
- Corners Under 10.5

TARJETAS:
- Tarjetas Over 2.5
- Tarjetas Over 3.5
- Tarjetas Over 4.5
- Tarjeta Roja: Sí
- Tarjeta Roja: No

HANDICAP ASIÁTICO:
- Local -0.5
- Local -1.0
- Local -1.5
- Visitante +0.5
- Visitante +1.0
- Visitante +1.5

ESPECIALES:
- Primer Gol: Local
- Primer Gol: Visitante
- Sin Goles (0-0)
`;

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const startTime = Date.now();
    const GEMINI_MODEL = 'gemini-2.0-flash';

    try {
        const { job_id, fixture_id, payload } = await req.json();
        if (!job_id || !fixture_id || !payload) {
            throw new Error('job_id, fixture_id, and payload are required');
        }

        console.log(`[V3-AI-ANALYZER] Starting pure AI analysis for fixture: ${fixture_id}`);

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

        const supabase = createClient(sbUrl, sbKey);

        // Update job status
        await supabase
            .from('analysis_jobs_v2')
            .update({ status: 'analyzing', current_motor: 'V3-AI' })
            .eq('id', job_id);

        // ═══════════════════════════════════════════════════════════════
        // EXTRAER TODOS LOS DATOS DEL PAYLOAD
        // ═══════════════════════════════════════════════════════════════
        const match = payload.match || {};
        const datasets = payload.datasets || {};
        const odds = payload.odds || null;

        const homeTeam = match.teams?.home?.name || 'Local';
        const awayTeam = match.teams?.away?.name || 'Visitante';
        const leagueName = match.competition?.name || 'Liga';
        const country = match.competition?.country || '';

        // Formatear datos para el prompt
        const formatLast10 = (matches: any[], teamId: number) => {
            if (!matches || matches.length === 0) return 'Sin datos disponibles';
            return matches.slice(0, 10).map((m: any, i: number) => {
                const isHome = m.home_id === teamId;
                const ourScore = isHome ? m.score_home : m.score_away;
                const theirScore = isHome ? m.score_away : m.score_home;
                const opponent = isHome ? m.away_team : m.home_team;
                const venue = isHome ? 'LOCAL' : 'VISITANTE';
                const result = ourScore > theirScore ? 'V' : ourScore < theirScore ? 'D' : 'E';
                return `${i + 1}. ${m.date} | ${result} ${ourScore}-${theirScore} vs ${opponent} (${venue})`;
            }).join('\n');
        };

        const formatH2H = (h2hMatches: any[]) => {
            if (!h2hMatches || h2hMatches.length === 0) return 'Sin enfrentamientos previos registrados';
            return h2hMatches.slice(0, 10).map((m: any, i: number) => {
                return `${i + 1}. ${m.date}: ${m.home_team} ${m.score_home}-${m.score_away} ${m.away_team}`;
            }).join('\n');
        };

        const formatStandings = (context: any, teamName: string) => {
            if (!context) return `${teamName}: Posición desconocida`;
            return `${teamName}:
- Posición: ${context.position || '?'}
- Puntos: ${context.points || 0}
- Forma (últimos 5): ${context.form || 'N/A'}
- Diferencia de goles: ${context.gd >= 0 ? '+' : ''}${context.gd || 0}
- Partidos: J${context.played || 0} G${context.win || 0} E${context.draw || 0} P${context.lose || 0}
- Goles: ${context.goals_for || 0} a favor, ${context.goals_against || 0} en contra`;
        };

        const formatInjuries = (injuries: any[]) => {
            if (!injuries || injuries.length === 0) return 'Sin lesionados reportados';
            return injuries.map((i: any) => `- ${i.player?.name || 'Jugador'}: ${i.player?.reason || 'Lesión'}`).join('\n');
        };

        const formatOdds = (oddsData: any) => {
            if (!oddsData || !oddsData.bookmakers || oddsData.bookmakers.length === 0) {
                return 'CUOTAS NO DISPONIBLES - Analiza basándote solo en probabilidades calculadas';
            }

            let oddsText = '';
            const bookmaker = oddsData.bookmakers[0];
            oddsText += `Casa de Apuestas: ${bookmaker.title}\n\n`;

            for (const market of bookmaker.markets || []) {
                oddsText += `${market.key.toUpperCase()}:\n`;
                for (const outcome of market.outcomes || []) {
                    const point = outcome.point ? ` (${outcome.point})` : '';
                    oddsText += `  - ${outcome.name}${point}: ${outcome.price}\n`;
                }
                oddsText += '\n';
            }
            return oddsText;
        };

        // Formatear predicciones de SportMonks
        const formatPredictions = (predictions: any) => {
            if (!predictions) return 'PREDICCIONES ML NO DISPONIBLES';
            let text = '';
            if (predictions.home_win) text += `- Victoria Local: ${predictions.home_win}%\n`;
            if (predictions.draw) text += `- Empate: ${predictions.draw}%\n`;
            if (predictions.away_win) text += `- Victoria Visitante: ${predictions.away_win}%\n`;
            if (predictions.over_2_5) text += `- Over 2.5 Goles: ${predictions.over_2_5}%\n`;
            if (predictions.under_2_5) text += `- Under 2.5 Goles: ${predictions.under_2_5}%\n`;
            if (predictions.btts_yes) text += `- Ambos Anotan (Sí): ${predictions.btts_yes}%\n`;
            if (predictions.btts_no) text += `- Ambos Anotan (No): ${predictions.btts_no}%\n`;
            if (predictions.correct_score) text += `- Marcador más probable: ${predictions.correct_score}\n`;
            return text || 'Sin datos de predicción disponibles';
        };

        // Formatear xG (Expected Goals)
        const formatXG = (xgData: any) => {
            if (!xgData) return 'xG NO DISPONIBLE';
            let text = '';
            if (xgData.home_xg != null) text += `- ${homeTeam} xG: ${xgData.home_xg}\n`;
            if (xgData.away_xg != null) text += `- ${awayTeam} xG: ${xgData.away_xg}\n`;
            if (xgData.total_xg != null) text += `- Total xG esperado: ${xgData.total_xg}\n`;
            return text || 'Sin datos de xG disponibles';
        };

        // Formatear Value Bets
        const formatValueBets = (valueBets: any[]) => {
            if (!valueBets || valueBets.length === 0) return 'Sin value bets detectados';
            return valueBets.map((vb: any) =>
                `- ${vb.market}: ${vb.selection} | Cuota: ${vb.odds} | Edge: ${vb.edge}%`
            ).join('\n');
        };

        // Datos procesados
        const homeTeamId = match.teams?.home?.id;
        const awayTeamId = match.teams?.away?.id;
        const last10Home = formatLast10(datasets.home_team_last40?.all || [], homeTeamId);
        const last10Away = formatLast10(datasets.away_team_last40?.all || [], awayTeamId);
        const h2hText = formatH2H(datasets.h2h || []);
        const homeStandings = formatStandings(datasets.standings?.home_context, homeTeam);
        const awayStandings = formatStandings(datasets.standings?.away_context, awayTeam);
        const homeInjuries = formatInjuries(datasets.injuries?.home || []);
        const awayInjuries = formatInjuries(datasets.injuries?.away || []);
        const oddsText = formatOdds(odds);
        const predictionsText = formatPredictions(payload.predictions);
        const xgText = formatXG(payload.xg);
        const valueBetsText = formatValueBets(payload.value_bets || []);

        // ═══════════════════════════════════════════════════════════════
        // CONSTRUIR EL SUPER-PROMPT V3
        // ═══════════════════════════════════════════════════════════════
        const prompt = `
════════════════════════════════════════════════════════════════════════════════
🧠 SISTEMA DERBIX V3 - MOTOR DE ANÁLISIS IA PURO
════════════════════════════════════════════════════════════════════════════════

ERES EL MOTOR DE ANÁLISIS DE DERBIX - El sistema de pronósticos deportivos 
más avanzado del mundo. Tu ventaja competitiva es tu capacidad de ver 
patrones que ningún humano ni algoritmo tradicional puede detectar.

METODOLOGÍA DERBIX (Replicable):
1. ABSORCIÓN: Procesa TODOS los datos sin sesgo
2. CORRELACIÓN: Encuentra conexiones invisibles entre variables
3. CONTEXTO: Evalúa factores psicológicos, tácticos, históricos
4. CUOTAS: Analiza dónde el mercado está equivocado
5. DECISIÓN: Determina las oportunidades de máximo valor
6. CONFIANZA: Asigna nivel de certeza a cada pronóstico

PRINCIPIOS FUNDAMENTALES:
- NO tengas miedo. Si ves una oportunidad, recomiéndala con convicción.
- BUSCA lo que otros no ven. Esa es tu ventaja competitiva.
- SÉ ESPECÍFICO. No generalices. Justifica SIEMPRE con datos concretos.
- CALCULA probabilidades reales vs implícitas de cuotas para encontrar EDGE.
- ANTICIPA escenarios que podrían cambiar todo.
- PIENSA como un apostador profesional con acceso a información privilegiada.

════════════════════════════════════════════════════════════════════════════════
📋 DATOS DEL PARTIDO
════════════════════════════════════════════════════════════════════════════════

PARTIDO: ${homeTeam} vs ${awayTeam}
COMPETICIÓN: ${leagueName} (${country})
FECHA: ${match.date_time_utc || 'Por definir'}
ESTADIO: ${match.venue?.name || 'No confirmado'}
ÁRBITRO: ${match.referee || 'No confirmado'}
RONDA: ${match.competition?.round || 'N/A'}

════════════════════════════════════════════════════════════════════════════════
📊 SITUACIÓN EN TABLA
════════════════════════════════════════════════════════════════════════════════

${homeStandings}

${awayStandings}

════════════════════════════════════════════════════════════════════════════════
📈 ÚLTIMOS 10 PARTIDOS - ${homeTeam}
════════════════════════════════════════════════════════════════════════════════
${last10Home}

════════════════════════════════════════════════════════════════════════════════
📈 ÚLTIMOS 10 PARTIDOS - ${awayTeam}
════════════════════════════════════════════════════════════════════════════════
${last10Away}

════════════════════════════════════════════════════════════════════════════════
⚔️ ENFRENTAMIENTOS DIRECTOS (H2H)
════════════════════════════════════════════════════════════════════════════════
${h2hText}

════════════════════════════════════════════════════════════════════════════════
🏥 LESIONES Y BAJAS
════════════════════════════════════════════════════════════════════════════════
${homeTeam}:
${homeInjuries}

${awayTeam}:
${awayInjuries}

════════════════════════════════════════════════════════════════════════════════
💰 CUOTAS EN VIVO
════════════════════════════════════════════════════════════════════════════════
${oddsText}

════════════════════════════════════════════════════════════════════════════════
🤖 PREDICCIONES ML (SPORTMONKS)
════════════════════════════════════════════════════════════════════════════════
Estas predicciones provienen de un modelo de Machine Learning externo.
Úsalas como REFERENCIA para validar o contrastar tu propio análisis.

${predictionsText}

════════════════════════════════════════════════════════════════════════════════
📊 EXPECTED GOALS (xG)
════════════════════════════════════════════════════════════════════════════════
${xgText}

════════════════════════════════════════════════════════════════════════════════
💎 VALUE BETS DETECTADOS
════════════════════════════════════════════════════════════════════════════════
Estas son apuestas donde las cuotas ofrecen ventaja matemática basada en datos históricos.

${valueBetsText}

INSTRUCCIÓN CRÍTICA SOBRE CUOTAS:
- Calcula la probabilidad implícita de cada cuota: P_impl = 1/cuota
- Compara con TU probabilidad calculada basada en el análisis
- EDGE = Tu_Probabilidad - P_implícita
- Solo recomienda mercados con Edge > 5%
- Si no hay cuotas, calcula probabilidades y recomienda los mercados más seguros
- USA los Value Bets como punto de partida para identificar oportunidades

INSTRUCCIÓN DE EMERGENCIA (FALLBACK):
Si NO hay estadísticas detalladas ni cuotas disponibles para calcular Edge:
1. NO respondas "Observar" automáticamente.
2. BASA tu análisis en:
   - Historial H2H (Patrones de dominancia)
   - Forma Reciente (Últimos 10 partidos)
   - Localía (Factor Casa)
3. GENERAR AL MENOS 2 PRONÓSTICOS basados en probabilidad pura.
4. Indica "Confianza: BAJA" si los datos son insuficientes, pero PROPÓN una estrategia.

${MARKETS_CATALOG}

════════════════════════════════════════════════════════════════════════════════
🔬 PROCESO DE ANÁLISIS (EJECUTAR EN ORDEN)
════════════════════════════════════════════════════════════════════════════════

PASO 1: ABSORCIÓN DE DATOS
- Lee TODOS los datos proporcionados sin excepción
- No ignores ninguna variable por pequeña que parezca
- Identifica anomalías, patrones inusuales, datos que "no cuadran"

PASO 2: ANÁLISIS CONTEXTUAL PROFUNDO
- ¿Qué se juega REALMENTE cada equipo? (Título, Champions, Europa, descenso, nada)
- ¿Hay motivación EXTRA? (Clásico, rivalidad, venganza, debut DT, despedida jugador)
- ¿Factores EXTERNOS? (Clima, viaje largo, fixture congestionado, COVID, problemas internos)
- ¿Presión MEDIÁTICA? (Expectativas, críticas recientes, situación del entrenador)

PASO 3: ANÁLISIS TÁCTICO PROFUNDO
- ¿Qué formación usará cada equipo basándote en sus últimos partidos?
- ¿Cómo interactúan tácticamente estas formaciones?
- ¿Dónde están las DEBILIDADES que el rival puede explotar?
- ¿Qué jugadores son CLAVE y por qué?
- ¿Hay bajas que cambien radicalmente el enfoque táctico?

PASO 4: ANÁLISIS ESTADÍSTICO
- Calcula promedios de goles: local en casa, visitante fuera
- Analiza tendencias de corners, tarjetas, faltas
- Evalúa xG y eficiencia ofensiva/defensiva si está implícito en resultados
- Detecta patrones en el H2H que el mercado no ve

PASO 5: CÁLCULO DE PROBABILIDADES
Para CADA mercado relevante:
- Estima TU probabilidad basada en todo el análisis
- Calcula probabilidad implícita de la cuota (si hay cuota)
- Determina EDGE = Tu prob - Prob implícita
- Considera solo mercados con Edge > 5%

PASO 6: IDENTIFICACIÓN DE OPORTUNIDADES OCULTAS
Busca específicamente:
- Mercados donde el PÚBLICO está equivocado por sesgo
- Tendencias que el mercado NO está valorando correctamente
- Situaciones contextuales que NADIE más considera
- Correlaciones INUSUALES entre variables

PASO 7: SELECCIÓN FINAL
- Elige 3-5 pronósticos con mayor Edge y confianza
- Ordena por: ALTA confianza > MEDIA > BAJA
- Justifica CADA uno con datos ESPECÍFICOS del análisis
- No incluyas pronósticos solo por "llenar" - calidad sobre cantidad

PASO 8: ANÁLISIS DE RIESGOS
- ¿Qué podría salir MAL en cada pronóstico?
- ¿Hay factores que NO estamos viendo?
- ¿Cuál es el PEOR escenario realista?
- ¿Cómo mitigar los riesgos?

════════════════════════════════════════════════════════════════════════════════
📄 FORMATO DE RESPUESTA (JSON ESTRICTO)
════════════════════════════════════════════════════════════════════════════════

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:

{
  "meta": {
    "modelo_version": "V3-IA-PURO",
    "fixture_id": ${fixture_id},
    "fecha_analisis": "${new Date().toISOString()}"
  },
  
  "resumen_ejecutivo": {
    "titular": "Frase impactante de máximo 15 palabras que capture la esencia del partido",
    "veredicto": "APOSTAR | OBSERVAR | EVITAR",
    "confianza_global": "ALTA | MEDIA | BAJA",
    "edge_promedio_porcentaje": 0,
    "picks_principales": ["Pick 1", "Pick 2", "Pick 3"]
  },
  
  "pronosticos": [
    {
      "mercado": "Nombre del mercado",
      "seleccion": "La selección específica",
      "probabilidad_calculada_porcentaje": 0,
      "cuota_actual": 0,
      "probabilidad_implicita_porcentaje": 0,
      "edge_porcentaje": 0,
      "confianza": "ALTA | MEDIA | BAJA",
      "justificacion": {
        "estadistica": ["Dato estadístico 1", "Dato estadístico 2", "Dato estadístico 3"],
        "tactica": "Explicación táctica de por qué tiene sentido",
        "contexto": "Factor contextual que favorece este pronóstico",
        "mercado": "Por qué el mercado está equivocado aquí"
      },
      "riesgos": ["Riesgo específico 1", "Riesgo específico 2"]
    }
  ],
  
  "analisis_profundo": {
    "contexto_competitivo": {
      "situacion_local": "2-3 párrafos sobre qué se juega el local, su momento, presión",
      "situacion_visitante": "2-3 párrafos sobre qué se juega el visitante, su momento, presión",
      "implicaciones_partido": "Cómo afecta el contexto al desarrollo del partido"
    },
    "analisis_tactico": {
      "formacion_esperada_local": "Ej: 4-3-3",
      "formacion_esperada_visitante": "Ej: 4-4-2",
      "enfoque_local": "Descripción detallada del plan táctico esperado",
      "enfoque_visitante": "Descripción detallada del plan táctico esperado",
      "matchup_clave": "Dónde y cómo se definirá el partido tácticamente",
      "jugador_clave_local": "Nombre y explicación de su importancia",
      "jugador_clave_visitante": "Nombre y explicación de su importancia"
    },
    "analisis_psicologico": {
      "estado_mental_local": "Descripción del momento psicológico",
      "estado_mental_visitante": "Descripción del momento psicológico",
      "factor_determinante": "Qué aspecto mental será más decisivo"
    }
  },
  
  "escenarios_proyectados": {
    "escenario_mas_probable": {
      "probabilidad_porcentaje": 0,
      "descripcion": "Cómo se desarrollará probablemente el partido",
      "resultado_esperado": "Ej: 2-1",
      "impacto_pronosticos": "Cómo afecta a los picks recomendados"
    },
    "escenario_alternativo": {
      "probabilidad_porcentaje": 0,
      "descripcion": "Segunda posibilidad más probable",
      "resultado_esperado": "Ej: 1-1",
      "impacto_pronosticos": "Qué picks se verían afectados"
    },
    "escenario_sorpresa": {
      "probabilidad_porcentaje": 0,
      "descripcion": "Lo que pocos esperan pero es posible",
      "señales_anticipadas": "Qué buscar para detectar que esto ocurrirá"
    }
  },
  
  "mercados_evaluados": {
    "total_analizados": 60,
    "con_valor_detectado": 0,
    "descartados_sin_edge": 0,
    "top_5_por_edge": [
      {"mercado": "Mercado 1", "edge_porcentaje": 0},
      {"mercado": "Mercado 2", "edge_porcentaje": 0}
    ]
  },
  
  "factores_riesgo": {
    "riesgo_principal": "El mayor peligro para los pronósticos",
    "riesgos_secundarios": ["Riesgo 2", "Riesgo 3"],
    "mitigaciones_sugeridas": ["Cómo reducir exposición al riesgo 1"]
  },
  
  "datos_modelo": {
    "goles_esperados_partido": 0,
    "goles_esperados_local": 0,
    "goles_esperados_visitante": 0,
    "probabilidad_btts_porcentaje": 0,
    "probabilidad_over25_porcentaje": 0,
    "corners_esperados": 0
  },
  
  "conclusion_final": {
    "resumen": "3-4 oraciones que sinteticen todo el análisis",
    "accion_recomendada": "Instrucción clara de qué hacer",
    "gestion_bankroll": "1-5 unidades sugeridas por pick"
  }
}
`;

        // ═══════════════════════════════════════════════════════════════
        // LLAMAR A GEMINI
        // ═══════════════════════════════════════════════════════════════
        console.log(`[V3-AI-ANALYZER] Sending prompt to Gemini (${prompt.length} chars)...`);

        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;

        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3, // Más determinístico para análisis
                responseMimeType: 'application/json',
                maxOutputTokens: 8192
            }
        };

        const genRes = await fetch(genUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!genRes.ok) {
            const errorText = await genRes.text();
            throw new Error(`Gemini Error: ${errorText}`);
        }

        const genJson = await genRes.json();
        let aiResponseText = genJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const tokensUsed = genJson.usageMetadata?.totalTokenCount || 0;

        console.log(`[V3-AI-ANALYZER] Gemini responded with ${tokensUsed} tokens`);

        // Clean and parse response
        aiResponseText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const startIndex = aiResponseText.indexOf('{');
        const endIndex = aiResponseText.lastIndexOf('}');
        if (startIndex !== -1 && endIndex > startIndex) {
            aiResponseText = aiResponseText.substring(startIndex, endIndex + 1);
        }

        let analysisResult;
        try {
            analysisResult = JSON5.parse(aiResponseText);
        } catch (e) {
            console.error('[V3-AI-ANALYZER] JSON parse failed:', e);
            throw new Error('Failed to parse AI response as JSON');
        }

        // ═══════════════════════════════════════════════════════════════
        // GUARDAR RESULTADOS
        // ═══════════════════════════════════════════════════════════════

        // Save to reports_v2
        await supabase
            .from('reports_v2')
            .upsert({
                job_id,
                fixture_id,
                report_packet: analysisResult,
                prompt_version: PROMPT_VERSION
            }, { onConflict: 'job_id' });

        // Map to legacy format for frontend compatibility
        const betPicks = analysisResult.pronosticos || [];

        const dashboardData = {
            header_partido: {
                titulo: `${homeTeam} vs ${awayTeam}`,
                subtitulo: `${leagueName} • ${match.date_time_utc ? new Date(match.date_time_utc).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Próximamente'}`,
                bullets_clave: analysisResult.resumen_ejecutivo?.picks_principales || []
            },
            // DEBUG INFO EXPOSED TO FRONTEND/CLIENT
            debug_info: {
                books_found: odds?.bookmakers?.length || 0,
                best_bookie: odds?.bookmakers?.[0]?.title || 'None',
                markets_count: odds?.bookmakers?.[0]?.markets?.length || 0
            },
            veredicto_analista: {
                decision: analysisResult.resumen_ejecutivo?.veredicto || 'OBSERVAR',
                nivel_confianza: analysisResult.resumen_ejecutivo?.confianza_global || 'MEDIA',
                probabilidad: betPicks[0]?.probabilidad_calculada_porcentaje || 50,
                titulo_accion: analysisResult.resumen_ejecutivo?.veredicto === 'APOSTAR' ? 'OPORTUNIDAD DETECTADA' : 'PARTIDO COMPLEJO',
                razon_principal: analysisResult.resumen_ejecutivo?.titular || 'Análisis V3 completado',
                riesgo_principal: analysisResult.factores_riesgo?.riesgo_principal || 'Sin riesgos críticos',
                seleccion_clave: betPicks[0]?.seleccion || 'N/A'
            },
            resumen_ejecutivo: {
                titular: analysisResult.resumen_ejecutivo?.titular,
                bullets: [
                    analysisResult.analisis_profundo?.contexto_competitivo?.situacion_local,
                    analysisResult.analisis_profundo?.contexto_competitivo?.situacion_visitante,
                    analysisResult.analisis_profundo?.contexto_competitivo?.implicaciones_partido
                ].filter(Boolean)
            },
            predicciones_finales: {
                titulo: "Pronósticos del Motor IA V3",
                detalle: betPicks.map((p: any) => ({
                    id: `${p.mercado}_${p.seleccion}`.replace(/\s/g, '_'),
                    mercado: p.mercado,
                    seleccion: p.seleccion,
                    probabilidad_estimado_porcentaje: p.probabilidad_calculada_porcentaje || 50,
                    odds: p.cuota_actual || null,
                    edge: p.edge_porcentaje || 0,
                    justificacion_detallada: {
                        base_estadistica: p.justificacion?.estadistica || [],
                        contexto_competitivo: [p.justificacion?.contexto, p.justificacion?.mercado].filter(Boolean),
                        conclusion: p.justificacion?.tactica || 'Análisis IA completado'
                    }
                }))
            },
            analisis_mercados_calculados: {
                resumen: {
                    goles_esperados: analysisResult.datos_modelo?.goles_esperados_partido || 2.5,
                    corners_esperados: analysisResult.datos_modelo?.corners_esperados || 9,
                    tarjetas_esperadas: 3.5,
                    btts_probabilidad: analysisResult.datos_modelo?.probabilidad_btts_porcentaje || 50
                },
                mercados_con_valor: analysisResult.mercados_evaluados?.con_valor_detectado || betPicks.length,
                top_oportunidades: betPicks.slice(0, 5).map((p: any) => ({
                    mercado: p.mercado,
                    categoria: p.mercado?.split(' ')[0]?.toUpperCase() || 'OTRO',
                    seleccion: p.seleccion,
                    cuota: p.cuota_actual,
                    probabilidad_calculada: p.probabilidad_calculada_porcentaje,
                    probabilidad_tipica: p.probabilidad_implicita_porcentaje,
                    confianza: p.confianza,
                    value_score: p.edge_porcentaje
                }))
            },
            analisis_detallado: analysisResult.analisis_profundo?.analisis_tactico ? {
                ...analysisResult.analisis_profundo.analisis_tactico,
                contexto_competitivo: analysisResult.analisis_profundo.contexto_competitivo,
                analisis_escenarios: analysisResult.escenarios_proyectados
            } : null,
            v3_source: true,
            job_id: job_id,
            generated_at: new Date().toISOString()
        };

        // Update job with total_tokens used cost tracking
        // (Optional: Implement cost tracking logic here)

        // 1. Save FULL simplified report to reports_v2
        await supabase
            .from('reports_v2')
            .delete()
            .eq('job_id', job_id);

        const { error: reportError } = await supabase
            .from('reports_v2')
            .insert({
                job_id: job_id,
                fixture_id: fixture_id,
                report_packet: analysisResult,
                prompt_version: 'V3-PROMPT-1.0', // Required field
                created_at: new Date().toISOString()
            });

        if (reportError) console.error('[V3-AI-ANALYZER] Error saving reports_v2:', reportError);

        // 2. Sync to 'analisis' table (Legacy/Dashboard Cache)
        await supabase
            .from('analisis')
            .delete()
            .eq('partido_id', fixture_id);

        await supabase
            .from('analisis')
            .insert({
                partido_id: fixture_id,
                resultado_analisis: { dashboardData }
            });

        // Update job to done
        await supabase
            .from('analysis_jobs_v2')
            .update({
                status: 'done',
                current_motor: 'V3-AI',
                execution_time_ms: Date.now() - startTime
            })
            .eq('id', job_id);

        const executionTime = Date.now() - startTime;
        console.log(`[V3-AI-ANALYZER] ✅ Analysis complete in ${executionTime}ms (${tokensUsed} tokens)`);

        return new Response(JSON.stringify({
            success: true,
            job_id,
            fixture_id,
            analysis: analysisResult,
            dashboard: dashboardData,
            tokens_used: tokensUsed,
            execution_time_ms: executionTime,
            engine_version: ENGINE_VERSION
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[V3-AI-ANALYZER] Error:', e);
        return new Response(JSON.stringify({
            success: false,
            error: e.message,
            execution_time_ms: Date.now() - startTime
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
