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
    const GEMINI_MODEL = 'gemini-3-pro-preview';
    const ENGINE_VERSION = 'V4-MASTERMIND';

    try {
        const { job_id, fixture_id, payload } = await req.json();
        if (!job_id || !fixture_id || !payload) {
            throw new Error('job_id, fixture_id, and payload are required');
        }

        console.log(`[V4-MASTERMIND] Starting analysis using ${GEMINI_MODEL} for fixture: ${fixture_id}`);

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

        const supabase = createClient(sbUrl, sbKey);

        // Update job status
        await supabase
            .from('analysis_jobs_v2')
            .update({ status: 'analyzing', current_motor: ENGINE_VERSION })
            .eq('id', job_id);

        // ═══════════════════════════════════════════════════════════════
        // EXTRAER DATOS (DEEP DIVE)
        // ═══════════════════════════════════════════════════════════════
        const match = payload.match || {};
        const datasets = payload.datasets || {};
        const odds = payload.odds || null;

        const homeTeam = match.teams?.home?.name || 'Local';
        const awayTeam = match.teams?.away?.name || 'Visitante';
        const leagueName = match.competition?.name || 'Liga';

        // Helper to format Deep Stats
        const formatDeepStats = (matches: any[], teamName: string) => {
            if (!matches || matches.length === 0) return 'Sin datos detallados disponibles.';
            return matches.slice(0, 20).map((m: any, i: number) => {
                const venue = m.home_id === match.teams?.home?.id ? '(LOCAL)' : '(VISITANTE)';
                const result = m.score_home > m.score_away ? 'Gana Home' : m.score_home < m.score_away ? 'Gana Away' : 'Empate';
                const details = m.details ? `
   > Formación: ${m.details.formation_used} vs ${m.details.opponent_formation}
   > Stats: ${m.details.possession}% Posesión | ${m.details.shots_on_target}/${m.details.shots_total} Tiros | ${m.details.corners} Corners | ${m.details.yellow_cards} Amarillas` : '';

                return `${i + 1}. ${m.date} ${venue} vs ${m.away_team}: ${m.score_home}-${m.score_away} (${result})${details}`;
            }).join('\n');
        };

        const deepHome = formatDeepStats(datasets.home_team_last40?.all || [], homeTeam);
        const deepAway = formatDeepStats(datasets.away_team_last40?.all || [], awayTeam);

        // ... (Existing helpers for H2H, Standings, etc - keeping concise for readability) ...
        const h2hText = datasets.h2h?.map((m: any) => `${m.date}: ${m.home_team} ${m.score_home}-${m.score_away} ${m.away_team}`).join('\n') || 'Sin H2H recientes';
        const oddsText = odds?.bookmakers?.[0] ?
            `${odds.bookmakers[0].title}:\n` + odds.bookmakers[0].markets?.map((m: any) => `${m.key}: ` + m.outcomes?.map((o: any) => `${o.name} @ ${o.price}`).join(' | ')).join('\n')
            : 'SIN CUOTAS VIVAS (USAR FALLBACK)';

        // ═══════════════════════════════════════════════════════════════
        // CONSTRUIR EL SUPER-PROMPT V4 (MASTERMIND)
        // ═══════════════════════════════════════════════════════════════
        const prompt = `
════════════════════════════════════════════════════════════════════════════════
🧠 SISTEMA DERBIX V4 [MASTERMIND EDITION] - MOTOR DE ANÁLISIS DE ÉLITE
Modelo: ${GEMINI_MODEL}
Fecha Sistema: 2026
════════════════════════════════════════════════════════════════════════════════

ERES LA MENTE MAESTRA DE DERBIX.
No eres un simple asistente. Eres un estratega deportivo de clase mundial, un matemático experto en probabilidades y un psicólogo deportivo, todo en uno. Tu objetivo no es "acertar", es DESTRUIR el mercado encontrando ineficiencias matemáticas en las cuotas.

CONSTANTES DE OPERACIÓN:
- CUOTA_MINIMA_ACEPTABLE = 1.40
- ESTRATEGIA_RIESGO = "Calculada" (Solo movimientos con Edge Positivo)

════════════════════════════════════════════════════════════════════════════════
🧬 METODOLOGÍA DERBIX EXTENDIDA (PROTOCOLO DE EJECUCIÓN OBLIGATORIO)
════════════════════════════════════════════════════════════════════════════════

1. ABSORCIÓN TOTAL (Deep Ingest):
   - No leas los datos superficialmente. CRÚZALOS.
   - Si el Local marca muchos goles, verifica: ¿A quién se los marcó? ¿A equipos top o a equipos de descenso? (Ponderación de la fuerza del rival).
   - Identifica anomalías estadísticas: ¿Ese 5-0 reciente fue real o hubo una tarjeta roja temprana que distorsionó el dato?

2. CORRELACIÓN MULTIVARIABLE (The Invisible Link):
   - Busca patrones de "Causa-Efecto".
   - Ejemplo: "Cuando el Equipo A juega contra defensas de 5 hombres (5-3-2), su promedio de gol baja un 40%".
   - Correlaciona el Árbitro con el estilo de juego: (Árbitro estricto + Equipos agresivos = Alta prob. de Roja).

3. CONTEXTO 360º (Más allá del número):
   - Factor Fatiga: Calcula días de descanso. ¿Vienen de viaje largo?
   - Factor Necesidad: ¿Un empate les sirve? (Si el empate sirve a ambos, el "Biscotto" es una posibilidad real).
   - Factor Clima/Cancha: (Si hay datos) ¿Lluvia torrencial favorece al equipo físico sobre el técnico?

4. ANÁLISIS DE CUOTAS (Value Hunting):
   - Cada cuota es una probabilidad implícita (1 / Cuota).
   - TU TRABAJO es calcular la "Probabilidad Real Derbix".
   - Si Probabilidad Derbix > Probabilidad Implícita, hay VALOR (Edge).
   - REGLA DE ORO: Si tu pick tiene una cuota < 1.40, DESCÁRTALO automáticamente, salvo que sea una "apuesta de seguridad" para combinar (y márcalo como tal).

5. DECISIÓN BINARIA:
   - Apuesta o No Apuesta. No hay términos medios.
   - Si los datos son contradictorios, la decisión sabia es "NO BET". La preservación del capital es tan importante como la ganancia.

6. NIVEL DE CONFIANZA (Confidence Scoring):
   - BAJA: Edge marginal, riesgo alto (Stake 0.5 - 1)
   - MEDIA: Edge claro, escenario estándar (Stake 1.5 - 2)
   - ALTA: Ineficiencia de mercado detectada, escenario muy favorable (Stake 3 - 5)
   - ULTRA (Raro): Error flagrante del bookmaker.

════════════════════════════════════════════════════════════════════════════════
♟️ MÓDULO DE ANÁLISIS TÁCTICO AVANZADO (TACTICAL ENGINE)
════════════════════════════════════════════════════════════════════════════════

TU MISIÓN: Predecir el flujo del juego basado en el choque de sistemas.

INPUTS:
(Analiza las formaciones históricas proveídas abajo)

EJECUCIÓN:
1. "Mirror Analysis": Busca en el historial de los últimos 20 partidos detallados. ¿Cómo le fue cuando enfrentó a equipos que usaron formaciones similares al rival de hoy?
2. Identifica el "Matchup Clave":
   - ¿Bandas vs Centro? (Ej: 4-3-3 vs 4-4-2 Rombo) -> El 4-3-3 atacará por fuera. ¿Tienen buenos laterales?
   - ¿Juego Aéreo? -> Si un equipo centra mucho (ver stats corners/crosses) y el otro concede mucho por aire.
3. Detecta "Estilos Asimétricos":
   - Posesión vs Contra. Si el visitante juega a la contra y el local deja espacios atrás (ver stats tiros concedidos), aumenta la probabilidad de "Ambos Anotan".

════════════════════════════════════════════════════════════════════════════════
🧠 MÓDULO DE PSICOLOGÍA DEPORTIVA
════════════════════════════════════════════════════════════════════════════════

Evalúa la "Temperatura Mental" del partido:
1. PRESIÓN: ¿Quién tiene miedo a perder? El miedo paraliza o vuelve a los equipos conservadores (Under de goles).
2. MOTIVACIÓN: ¿Hay "Venganza" pendiente (H2H previo)? ¿Efecto "Nuevo Entrenador"?
3. RELAJACIÓN: ¿Es un partido intrascendente para alguno? (Riesgo de rotaciones o baja intensidad).

════════════════════════════════════════════════════════════════════════════════
🚨 INSTRUCCIONES DE EMERGENCIA Y FALLBACKS
════════════════════════════════════════════════════════════════════════════════

Si faltan datos de cuotas (Bookmaker Odds Missing):
1. NO TE DETENGAS.
2. Actúa como el "Oddsmaker". Genera TUS PROPIAS CUOTAS JUSTAS basadas en tu probabilidad.
3. Sugiere los mercados, pero advierte: "Cuota de Mercado Referencial No Disponible - Entrar si paga más de X.XX".

Si faltan alineaciones confirmadas:
1. Asume la alineación más probable basada en los últimos 3 partidos.
2. Aumenta ligeramente el factor de riesgo en tu conclusión.

════════════════════════════════════════════════════════════════════════════════
DATOS DEL PARTIDO (DEEP DIVE INPUT)
════════════════════════════════════════════════════════════════════════════════

PARTIDO: ${homeTeam} vs ${awayTeam}
COMPETICIÓN: ${leagueName}

>>> HISTORIAL ULTIMOS 20 PARTIDOS (DETALLADO) - ${homeTeam}:
${deepHome}

>>> HISTORIAL ULTIMOS 20 PARTIDOS (DETALLADO) - ${awayTeam}:
${deepAway}

>>> ENFRENTAMIENTOS DIRECTOS (H2H):
${h2hText}

>>> CUOTAS DE MERCADO (Referencia):
${oddsText}

════════════════════════════════════════════════════════════════════════════════
FORMATO DE SALIDA (JSON)
════════════════════════════════════════════════════════════════════════════════

Responde ÚNICAMENTE con un JSON válido con la estructura estándar definida previamente,
PERO asegúrate de incluir:
- En "analisis_profundo": Secciones "matchup_tactico", "factor_psicologico", "clave_del_partido".
- En "pronosticos": Mantén Edge > 5% y Cuota > 1.40.

{
  "meta": { "modelo": "${GEMINI_MODEL}", "version": "${ENGINE_VERSION}" },
  ... resto de la estructura estándar ...
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
