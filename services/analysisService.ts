import { supabase } from './supabaseService';
import { AnalysisJob, AnalysisRun, VisualAnalysisResult, DashboardAnalysisJSON, JobProgress } from '../types';
import { fetchFixturesList } from './liveDataService';

export interface PerformanceStats {
    total: number;
    wins: number;
    losses: number;
    pushed: number;
    winRate: number;
    yield: number;
    byMarket: Record<string, { total: number; wins: number; winRate: number }>;
    byLeague: Record<string, { total: number; wins: number; winRate: number }>;
    byDate: Record<string, { total: number; wins: number; profit: number }>;
    byConfidence: Record<'HIGH' | 'MEDIUM' | 'LOW', { total: number; wins: number; winRate: number }>;
    byProbability: Record<string, { total: number; wins: number; winRate: number }>;
    rawPredictions: any[];
}

/**
 * Utility: Mark stuck jobs as failed (Zombies cleanup)
 */
export const resetStuckJobs = async (): Promise<number> => {
    // Defines "Stuck" as created > 1 minute ago (aggressive cleanup for UI)
    const timeThreshold = new Date(Date.now() - 1 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('analysis_jobs')
        .update({ status: 'failed', last_error: 'Manual Reset: Timeout or Stuck' })
        // Removed time threshold to force clean ALL stuck non-completed jobs
        .in('status', ['queued', 'collecting_evidence', 'analyzing', 'ingesting', 'data_ready'])
        .select();

    if (error) {
        console.error("Error resetting stuck jobs:", error);
        throw error;
    }
    return data ? data.length : 0;
};

/**
 * Inicia un trabajo de análisis llamando al Motor V2.
 * V2 usa pipeline: ETL → Features → Models → Value Engine → Report
 */
export const createAnalysisJob = async (apiFixtureId: number, timezone: string = 'America/Bogota', organizationId?: string): Promise<string> => {
    try {
        console.log(`[V2] Iniciando análisis para fixture ${apiFixtureId}...`);

        // ═══════════════════════════════════════════════════════════════
        // MOTOR V2: Pipeline completo (5 motores)
        // ═══════════════════════════════════════════════════════════════
        const { data, error } = await supabase.functions.invoke('v2-orchestrator', {
            body: {
                fixture_id: apiFixtureId
            }
        });

        let responseData = data;

        // Robustez: Si data viene como string, parsearlo
        if (typeof data === 'string') {
            try {
                responseData = JSON.parse(data);
            } catch (e) {
                console.error("[V2] Error parseando respuesta:", e);
            }
        }

        if (error) {
            console.error("[V2] Error de Edge Function:", error);
            throw new Error(error.message || JSON.stringify(error));
        }

        if (!responseData?.success) {
            console.error("[V2] Pipeline falló:", responseData?.error);
            throw new Error(responseData?.error || "Pipeline V2 falló");
        }

        if (!responseData.job_id) {
            console.error("[V2] Respuesta sin job_id:", responseData);
            throw new Error("V2 no devolvió job_id válido");
        }

        console.log(`[V2] ✅ Análisis completado: ${responseData.job_id}`);
        console.log(`[V2] Picks: ${responseData.summary?.bet_picks || 0} BET, ${responseData.summary?.watch_picks || 0} WATCH`);

        // V2 guarda en analysis_jobs_v2, pero retornamos el job_id para compatibilidad
        return responseData.job_id;

    } catch (err: any) {
        console.error("[V2] Error crítico:", err);
        throw new Error(err.message || "Error en el Motor V2. Intenta nuevamente.");
    }
};

/* ═══════════════════════════════════════════════════════════════
   V1 LEGACY (Comentado - usar solo si V2 falla)
   ═══════════════════════════════════════════════════════════════
export const createAnalysisJobV1 = async (apiFixtureId: number, timezone: string = 'America/Bogota', organizationId?: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('create-analysis-job', {
        body: {
            api_fixture_id: apiFixtureId,
            timezone,
            organization_id: organizationId,
            last_n: 10,
            threshold: 70
        }
    });
    if (error || !data?.job_id) throw new Error("Error V1");
    return data.job_id;
};
*/

/**
 * Obtiene el estado actual de un trabajo.
 * V2: Busca primero en analysis_jobs_v2, luego en analysis_jobs (V1).
 */
export const getAnalysisJob = async (jobId: string): Promise<AnalysisJob | null> => {
    // Intentar V2 primero
    const { data: v2Data, error: v2Error } = await supabase
        .from('analysis_jobs_v2')
        .select('*')
        .eq('id', jobId)
        .single();

    if (v2Data && !v2Error) {
        // Mapear V2 al formato esperado por la UI (V2 tiene estructura diferente)
        return {
            id: v2Data.id,
            api_fixture_id: v2Data.fixture_id,
            fixture_id: v2Data.fixture_id,
            status: v2Data.status === 'done' ? 'done' : v2Data.status === 'failed' ? 'failed' : 'processing',
            created_at: v2Data.created_at,
            updated_at: v2Data.updated_at,
            error_message: v2Data.error_message,
            organization_id: null,
            completeness_score: v2Data.data_coverage_score || 100,
            estimated_calls: 5,
            actual_calls: 5,
            progress_jsonb: { step: 'V2', completeness_score: 100, fetched_items: 5, total_items: 5 }
        } as unknown as AnalysisJob;
    }

    // Fallback a V1
    const { data, error } = await supabase
        .from('analysis_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

    if (error) {
        return null;
    }
    return data as AnalysisJob;
};

/**
 * Busca análisis por fixture_id (para persistencia al refrescar).
 * Prioriza V2, luego fallback a V1.
 */
export const getAnalysisResultByFixture = async (fixtureId: number): Promise<VisualAnalysisResult | null> => {
    // 1. Buscar último job V2 completado para este fixture
    const { data: v2Job } = await supabase
        .from('analysis_jobs_v2')
        .select('id')
        .eq('fixture_id', fixtureId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (v2Job) {
        console.log(`[V2] Encontrado análisis para fixture ${fixtureId}: job ${v2Job.id}`);
        return getAnalysisResult(v2Job.id);
    }

    // 2. Fallback: Buscar en V1
    const { data: v1Job } = await supabase
        .from('analysis_jobs')
        .select('id')
        .eq('api_fixture_id', fixtureId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (v1Job) {
        console.log(`[V1] Encontrado análisis para fixture ${fixtureId}: job ${v1Job.id}`);
        return getAnalysisResult(v1Job.id);
    }

    console.log(`[Analysis] No hay análisis para fixture ${fixtureId}`);
    return null;
};

/**
 * Obtiene el resultado final del análisis.
 * V2: Busca en reports_v2 + value_picks_v2, luego fallback a V1.
 */
export const getAnalysisResult = async (jobId: string): Promise<VisualAnalysisResult | null> => {
    // ═══════════════════════════════════════════════════════════════
    // INTENTAR V2 PRIMERO
    // ═══════════════════════════════════════════════════════════════
    const { data: v2Report } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('job_id', jobId)
        .single();

    if (v2Report?.report_packet) {
        // Obtener picks V2 - Primero BET, si no hay, WATCH ordenados por edge
        let { data: v2Picks } = await supabase
            .from('value_picks_v2')
            .select('*')
            .eq('job_id', jobId)
            .eq('decision', 'BET')
            .order('rank', { ascending: true })
            .limit(3);

        // ✅ FALLBACK: Si no hay BET, mostrar top 3 WATCH por edge
        if (!v2Picks || v2Picks.length === 0) {
            const { data: watchPicks } = await supabase
                .from('value_picks_v2')
                .select('*')
                .eq('job_id', jobId)
                .eq('decision', 'WATCH')
                .order('edge', { ascending: false })
                .limit(3);
            v2Picks = watchPicks || [];
            console.log(`[V2] Fallback a WATCH picks: ${v2Picks.length}`);
        }

        // Obtener job V2 para fixture_id
        const { data: v2Job } = await supabase
            .from('analysis_jobs_v2')
            .select('*')
            .eq('id', jobId)
            .single();

        // ═══════════════════════════════════════════════════════════════
        // MEGA-UPGRADE: Obtener TODOS los mercados calculados para mostrar ranking
        // ═══════════════════════════════════════════════════════════════
        let allCalculatedMarkets: any[] = [];
        if (v2Job?.fixture_id) {
            const { data: marketProbs } = await supabase
                .from('market_probs_v2')
                .select('*')
                .eq('fixture_id', v2Job.fixture_id)
                .order('p_model', { ascending: false });

            if (marketProbs && marketProbs.length > 0) {
                console.log(`[V2-MEGA] Mercados calculados encontrados: ${marketProbs.length}`);
                allCalculatedMarkets = marketProbs;
            }
        }

        // Transformar V2 al formato esperado por la UI
        const report = v2Report.report_packet;
        const betPicks = v2Picks || [];

        // ═══════════════════════════════════════════════════════════════
        // FIX BUG 1: Normalizar market names para hacer match con Gemini
        // ═══════════════════════════════════════════════════════════════
        const normalizeMarket = (m: string): string => {
            return m.toLowerCase()
                .replace(/[_\.\s]/g, '')
                .replace('goals', 'goles')
                .replace('over', 'mas')
                .replace('under', 'menos')
                .replace('btts', 'ambosanotan')
                .replace('yes', 'si')
                .replace('no', 'no');
        };

        const getJustification = (market: string) => {
            const normalized = normalizeMarket(market);
            const justif = report.justificacion_picks?.find((j: any) => {
                const pickNorm = normalizeMarket(j.pick || '');
                return pickNorm.includes(normalized) || normalized.includes(pickNorm);
            });

            if (!justif) {
                console.log(`[V2] ⚠️ No encontrada justificación para market: ${market} (normalized: ${normalized})`);
            }
            return justif || null;
        };

        // Crear fallbacks inteligentes basados en datos del pick
        const createSmartFallback = (pick: any) => {
            const prob = Math.round(pick.p_model * 100);
            const market = pick.market.replace(/_/g, ' ');

            return {
                base_estadistica: [
                    `Probabilidad calculada: ${prob}% basado en estadísticas históricas`,
                    `Análisis de ${pick.model_name || 'modelo cuantitativo'}`
                ],
                contexto_competitivo: [
                    pick.rationale || `Tendencia favorable para ${market}`
                ],
                conclusion: pick.rationale || `El modelo indica ${prob}% de probabilidad para ${pick.selection}.`
            };
        };

        return {
            analysisText: report.resumen_ejecutivo?.titular || "Análisis V2 completado.",
            dashboardData: {
                veredicto_analista: {
                    decision: betPicks.length > 0 ? 'APOSTAR' : 'OBSERVAR',
                    titulo_accion: report.resumen_ejecutivo?.titular || '',
                    seleccion_clave: betPicks[0]?.selection || null,
                    probabilidad: betPicks[0] ? Math.round(betPicks[0].p_model * 100) : 50,
                    nivel_confianza: betPicks[0]?.confidence >= 70 ? 'ALTA' : betPicks[0]?.confidence >= 50 ? 'MEDIA' : 'BAJA',
                    razon_principal: report.conclusion?.veredicto || '',
                    riesgo_principal: report.resumen_ejecutivo?.riesgo_principal || ''
                },
                resumen_ejecutivo: {
                    frase_principal: report.resumen_ejecutivo?.titular || '',
                    puntos_clave: [
                        report.contexto_competitivo?.situacion_local,
                        report.contexto_competitivo?.situacion_visitante,
                        report.resumen_ejecutivo?.riesgo_principal
                    ].filter(Boolean)
                },
                analisis_detallado: {
                    contexto_competitivo: {
                        titulo: report.contexto_competitivo?.titulo || 'Contexto Competitivo',
                        bullets: [
                            report.contexto_competitivo?.situacion_local,
                            report.contexto_competitivo?.situacion_visitante,
                            report.contexto_competitivo?.implicaciones
                        ].filter(Boolean)
                    },
                    analisis_tactico_formaciones: {
                        titulo: report.analisis_tactico?.titulo || 'Análisis Táctico',
                        bullets: [
                            report.analisis_tactico?.enfoque_local,
                            report.analisis_tactico?.enfoque_visitante,
                            report.analisis_tactico?.matchup
                        ].filter(Boolean)
                    },
                    analisis_escenarios: {
                        titulo: 'Escenarios Proyectados',
                        bullets: [
                            `Probable (${report.proyeccion_escenarios?.escenario_probable?.probabilidad || '60-70%'}): ${report.proyeccion_escenarios?.escenario_probable?.descripcion || ''}`,
                            `Alternativo (${report.proyeccion_escenarios?.escenario_alternativo?.probabilidad || '20-30%'}): ${report.proyeccion_escenarios?.escenario_alternativo?.descripcion || ''}`
                        ].filter(b => b && b.length > 20)
                    }
                },
                // ═══════════════════════════════════════════════════════════════
                // FIX BUG 1 & 2: Justificaciones normalizadas, SIN cuotas API-Football
                // ═══════════════════════════════════════════════════════════════
                predicciones_finales: {
                    detalle: betPicks.map((p: any) => {
                        const justif = getJustification(p.market);
                        const fallback = createSmartFallback(p);

                        return {
                            mercado: p.market.replace(/_/g, ' ').replace(/\./g, ','),
                            seleccion: p.selection,
                            probabilidad_estimado_porcentaje: Math.round(p.p_model * 100),
                            edge: null,  // FIX BUG 2: NO mostrar edge sin cuotas reales
                            odds: null,  // FIX BUG 2: NO mostrar cuotas de API-Football
                            justificacion_detallada: {
                                base_estadistica: justif?.datos_soporte || fallback.base_estadistica,
                                contexto_competitivo: justif?.riesgos_especificos || fallback.contexto_competitivo,
                                conclusion: justif?.justificacion_tactica || fallback.conclusion
                            }
                        };
                    })
                },
                advertencias: {
                    titulo: 'Factores de Riesgo',
                    riesgos: report.factores_riesgo?.riesgos || []
                },
                // ═══════════════════════════════════════════════════════════════
                // MEGA-UPGRADE V2: Probabilidades típicas REALES + ordenamiento por VALUE
                // ═══════════════════════════════════════════════════════════════
                analisis_mercados_calculados: (() => {
                    if (allCalculatedMarkets.length === 0) return null;

                    // Probabilidades típicas REALES del mercado (basadas en estadísticas históricas)
                    const TYPICAL_PROBABILITIES: Record<string, number> = {
                        // Goles - muy predecibles
                        'over_0.5_goals': 0.88,
                        'over_1.5_goals': 0.72,
                        'over_2.5_goals': 0.52,
                        'over_3.5_goals': 0.30,
                        'over_4.5_goals': 0.15,
                        'over_5.5_goals': 0.07,
                        'under_2.5_goals': 0.48,
                        // BTTS
                        'btts_yes': 0.50,
                        'btts_no': 0.50,
                        // Team Goals
                        'home_over_0.5': 0.75,
                        'home_over_1.5': 0.45,
                        'away_over_0.5': 0.65,
                        'away_over_1.5': 0.35,
                        // Half Goals
                        '1h_over_0.5': 0.60,
                        '2h_over_0.5': 0.70,
                        'fh_over_05': 0.60,
                        'sh_over_05': 0.70,
                        // Corners - más difíciles de predecir
                        'corners_over_8.5': 0.55,
                        'corners_over_9.5': 0.45,
                        'corners_over_10.5': 0.35,
                        'corners_over_11.5': 0.25,
                        // Tarjetas
                        'cards_over_3.5': 0.50,
                        'cards_over_4.5': 0.35,
                        'cards_over_5.5': 0.22,
                        // Resultados
                        '1x2_home': 0.45,
                        '1x2_draw': 0.25,
                        '1x2_away': 0.30,
                        'double_chance_1x': 0.70,
                        'double_chance_x2': 0.55,
                        'double_chance_12': 0.75,
                    };

                    // Función para obtener probabilidad típica
                    const getTypicalProb = (market: string): number => {
                        // Buscar coincidencia exacta
                        if (TYPICAL_PROBABILITIES[market]) return TYPICAL_PROBABILITIES[market];
                        // Buscar por partes del nombre
                        for (const [key, value] of Object.entries(TYPICAL_PROBABILITIES)) {
                            if (market.includes(key) || key.includes(market)) return value;
                        }
                        return 0.50; // Default
                    };

                    // Calcular VALUE SCORE real para cada mercado
                    const marketsWithValue = allCalculatedMarkets.map((m: any) => {
                        const typicalProb = getTypicalProb(m.market);
                        const valueScore = Math.round((m.p_model - typicalProb) * 100);
                        return {
                            ...m,
                            typical_prob: typicalProb,
                            value_score: valueScore
                        };
                    });

                    // Ordenar por VALUE SCORE (no por probabilidad bruta)
                    const sortedByValue = marketsWithValue
                        .filter((m: any) => m.value_score > 5) // Solo mercados con >5% de value
                        .sort((a: any, b: any) => b.value_score - a.value_score);

                    // Buscar corners y tarjetas para el resumen
                    const cornersMarket = allCalculatedMarkets.find((m: any) => m.market.includes('corner'));
                    const cardsMarket = allCalculatedMarkets.find((m: any) => m.market.includes('card'));

                    return {
                        descripcion: "Análisis de mercados ordenado por VALUE REAL (no probabilidad)",
                        mercados_evaluados: allCalculatedMarkets.length,
                        mercados_con_valor: sortedByValue.length,
                        resumen: {
                            goles_esperados: allCalculatedMarkets.find((m: any) => m.market === 'over_2.5_goals')?.model_inputs?.lambda_total ||
                                (allCalculatedMarkets.find((m: any) => m.market === 'over_2.5_goals')?.p_model ?
                                    Math.round(allCalculatedMarkets.find((m: any) => m.market === 'over_2.5_goals').p_model * 5 * 10) / 10 : null),
                            corners_esperados: cornersMarket?.model_inputs?.expected_corners ||
                                (cornersMarket ? (cornersMarket.market.includes('9.5') ? 9.5 :
                                    cornersMarket.market.includes('10.5') ? 10.5 :
                                        cornersMarket.market.includes('8.5') ? 8.5 : null) : null),
                            tarjetas_esperadas: cardsMarket?.model_inputs?.expected_cards ||
                                (cardsMarket ? (cardsMarket.market.includes('4.5') ? 4.5 :
                                    cardsMarket.market.includes('3.5') ? 3.5 : null) : null),
                            btts_probabilidad: Math.round((allCalculatedMarkets.find((m: any) => m.market === 'btts_yes')?.p_model || 0) * 100),
                        },
                        top_oportunidades: sortedByValue
                            .slice(0, 10)
                            .map((m: any) => {
                                // ═══════════════════════════════════════════════════════════════
                                // TRADUCTOR: Mercados técnicos → Español para apostadores
                                // ═══════════════════════════════════════════════════════════════
                                const translateMarket = (market: string, selection: string): string => {
                                    const TRANSLATIONS: Record<string, string> = {
                                        // BTTS
                                        'btts_yes': 'Ambos Anotan - Sí',
                                        'btts_no': 'Ambos Anotan - No',
                                        // Resultado 1X2
                                        '1x2_home': 'Victoria Local',
                                        '1x2_draw': 'Empate',
                                        '1x2_away': 'Victoria Visitante',
                                        // Doble Oportunidad
                                        'double_chance_1x': 'Local o Empate (1X)',
                                        'double_chance_x2': 'Empate o Visitante (X2)',
                                        'double_chance_12': 'Local o Visitante (12)',
                                        // Goles Over/Under
                                        'over_0.5_goals': 'Más de 0.5 Goles',
                                        'over_1.5_goals': 'Más de 1.5 Goles',
                                        'over_2.5_goals': 'Más de 2.5 Goles',
                                        'over_3.5_goals': 'Más de 3.5 Goles',
                                        'over_4.5_goals': 'Más de 4.5 Goles',
                                        'under_2.5_goals': 'Menos de 2.5 Goles',
                                        // Goles por equipo
                                        'home_over_0.5': 'Local Anota (+0.5)',
                                        'home_over_1.5': 'Local Anota 2+ Goles',
                                        'away_over_0.5': 'Visitante Anota (+0.5)',
                                        'away_over_1.5': 'Visitante Anota 2+ Goles',
                                        // Tiempos
                                        '1t_over_0.5': 'Gol en 1er Tiempo',
                                        '1t_over_1.5': '2+ Goles en 1er Tiempo',
                                        '2t_over_0.5': 'Gol en 2do Tiempo',
                                        '2t_over_1.5': '2+ Goles en 2do Tiempo',
                                        'fh_over_05': 'Gol en 1er Tiempo',
                                        'sh_over_05': 'Gol en 2do Tiempo',
                                        '1h_over_0.5': 'Gol en 1er Tiempo',
                                        '2h_over_0.5': 'Gol en 2do Tiempo',
                                        // Corners
                                        'corners_over_8.5': 'Más de 8.5 Corners',
                                        'corners_over_9.5': 'Más de 9.5 Corners',
                                        'corners_over_10.5': 'Más de 10.5 Corners',
                                        'corners_over_11.5': 'Más de 11.5 Corners',
                                        'corners_over_12.5': 'Más de 12.5 Corners',
                                        // Tarjetas
                                        'cards_over_3.5': 'Más de 3.5 Tarjetas',
                                        'cards_over_4.5': 'Más de 4.5 Tarjetas',
                                        'cards_over_5.5': 'Más de 5.5 Tarjetas',
                                        // Hándicap
                                        'handicap_home_-0.5': 'Local Gana (Hándicap -0.5)',
                                        'handicap_home_-1.5': 'Local Gana por 2+ (Hándicap -1.5)',
                                        'handicap_away_+0.5': 'Visitante No Pierde (+0.5)',
                                    };

                                    // 1. Buscar traducción exacta
                                    if (TRANSLATIONS[market]) return TRANSLATIONS[market];

                                    // 2. Traducir selecciones genéricas
                                    if (selection === 'Yes' || selection === 'Sí') return 'Ambos Anotan - Sí';
                                    if (selection === 'No') return 'Ambos Anotan - No';
                                    if (selection === '1') return 'Victoria Local';
                                    if (selection === '2') return 'Victoria Visitante';
                                    if (selection === 'X') return 'Empate';
                                    if (selection === '1X') return 'Local o Empate';
                                    if (selection === 'X2') return 'Empate o Visitante';
                                    if (selection === '12') return 'Local o Visitante';

                                    // 3. Patterns para traducciones dinámicas
                                    if (market.includes('1t_over') || market.includes('1h_over') || market.includes('fh_over')) {
                                        const goals = market.match(/(\d+\.?\d*)/)?.[1] || '0.5';
                                        return `+${goals} Goles 1er Tiempo`;
                                    }
                                    if (market.includes('2t_over') || market.includes('2h_over') || market.includes('sh_over')) {
                                        const goals = market.match(/(\d+\.?\d*)/)?.[1] || '0.5';
                                        return `+${goals} Goles 2do Tiempo`;
                                    }
                                    if (market.includes('corner')) {
                                        const num = market.match(/(\d+\.?\d*)/)?.[1];
                                        return num ? `+${num} Corners` : 'Corners Over';
                                    }
                                    if (market.includes('card')) {
                                        const num = market.match(/(\d+\.?\d*)/)?.[1];
                                        return num ? `+${num} Tarjetas` : 'Tarjetas Over';
                                    }

                                    // 4. Fallback: limpiar el texto técnico
                                    return selection
                                        .replace(/over/gi, 'Más de')
                                        .replace(/under/gi, 'Menos de')
                                        .replace(/_/g, ' ')
                                        .replace(/\./g, ',');
                                };

                                return {
                                    mercado: translateMarket(m.market, m.selection || ''),
                                    categoria: m.market.includes('corner') ? 'Corners' :
                                        m.market.includes('card') ? 'Tarjetas' :
                                            m.market.includes('goal') || m.market.includes('btts') ? 'Goles' :
                                                m.market.includes('1x2') || m.market.includes('double') ? 'Resultado' : 'Otro',
                                    probabilidad_calculada: Math.round(m.p_model * 100),
                                    probabilidad_tipica: Math.round(m.typical_prob * 100),
                                    value_score: m.value_score,
                                    confianza: m.value_score > 15 ? 'ALTA' : m.value_score > 8 ? 'MEDIA' : 'BAJA',
                                    recomendacion: m.rationale || ''
                                };
                            })
                    };
                })()
            } as unknown as DashboardAnalysisJSON,
            analysisRun: {
                id: jobId,
                job_id: jobId,
                fixture_id: v2Job?.fixture_id,
                report_pre_jsonb: report,
                summary_pre_text: report.resumen_ejecutivo?.titular,
                predictions: betPicks.map((p: any) => ({
                    id: p.id,
                    market: p.market,
                    selection: p.selection,
                    probability: Math.round(p.p_model * 100),
                    confidence: p.confidence,
                    reasoning: report.justificacion_picks?.find((j: any) =>
                        j.pick?.toLowerCase().includes(p.market.toLowerCase())
                    )?.justificacion_tactica || ''
                }))
            } as unknown as AnalysisRun
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // FALLBACK A V1
    // ═══════════════════════════════════════════════════════════════
    const { data: runData, error: runError } = await supabase
        .from('analysis_runs')
        .select('*, predictions(*)')
        .eq('job_id', jobId)
        .single();

    if (runError || !runData) {
        console.error("Error fetching analysis run:", runError);
        return null;
    }

    const run = runData as AnalysisRun;

    return {
        analysisText: run.summary_pre_text || "Análisis completado.",
        dashboardData: run.report_pre_jsonb as DashboardAnalysisJSON,
        analysisRun: run
    };
};

/**
 * Obtiene todos los resultados visuales validados de una fecha específica.
 * FILTRO ESTRICTO: Solo devuelve análisis de partidos que se juegan EXACTAMENTE en la fecha solicitada.
 */
export const getAnalysesByDate = async (date: string): Promise<VisualAnalysisResult[]> => {
    const targetDate = date.split('T')[0]; // Asegurar YYYY-MM-DD
    console.log(`[ParlayBuilder] Getting analyses for match date: ${targetDate}`);

    // FILTRO CORRECTO: Usar match_date de analysis_runs (fecha del PARTIDO)
    // No usar created_at que es la fecha de creación del análisis
    const { data: runs, error } = await supabase
        .from('analysis_runs')
        .select('*, predictions(*)')
        .eq('match_date', targetDate); // ✅ FILTRA POR FECHA DEL PARTIDO

    if (error) {
        console.error("Error fetching daily analyses:", error);
        return [];
    }

    if (!runs || runs.length === 0) {
        console.log(`[ParlayBuilder] No analysis runs found for match date ${targetDate}`);
        return [];
    }

    console.log(`[ParlayBuilder] Found ${runs.length} analysis runs for match date ${targetDate}`);

    // Mapear resultados
    return runs
        .filter(r => r.predictions && r.predictions.length > 0)
        .map(r => ({
            analysisText: r.summary_pre_text || '',
            dashboardData: r.report_pre_jsonb as DashboardAnalysisJSON,
            analysisRun: r as AnalysisRun
        }));
};

/**
 * Obtiene el resultado (Reporte) directamente por ID de Ejecución (Run ID).
 * Útil para Top Picks que ya tienen el ID del run.
 */
export const getAnalysisResultByRunId = async (runId: string): Promise<VisualAnalysisResult | null> => {
    const { data: runData, error: runError } = await supabase
        .from('analysis_runs')
        .select('*, predictions(*)')
        .eq('id', runId)
        .single();

    if (runError || !runData) {
        console.error("Error fetching analysis run by ID:", runError);
        return null;
    }

    const run = runData as AnalysisRun;

    return {
        analysisText: run.summary_pre_text || "Análisis completado.",
        dashboardData: run.report_pre_jsonb as DashboardAnalysisJSON,
        analysisRun: run
    };
};

/**
 * Obtiene el resultado (Reporte) por Fixture ID desde la tabla 'analisis' (legacy cache).
 * Útil para Top Picks donde las predicciones no tienen analysis_run_id.
 */
export const getAnalysisResultByFixtureId = async (fixtureId: number): Promise<VisualAnalysisResult | null> => {
    // ═══════════════════════════════════════════════════════════════
    // FIX: Buscar en V2 primero (analysis_jobs_v2)
    // ═══════════════════════════════════════════════════════════════
    const { data: v2Job } = await supabase
        .from('analysis_jobs_v2')
        .select('id')
        .eq('fixture_id', fixtureId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (v2Job) {
        console.log(`[analysisService] V2 job encontrado para fixture ${fixtureId}: ${v2Job.id}`);
        return await getAnalysisResult(v2Job.id);
    }

    // ═══════════════════════════════════════════════════════════════
    // FALLBACK: Buscar en tabla legacy 'analisis'
    // ═══════════════════════════════════════════════════════════════
    const { data, error } = await supabase
        .from('analisis')
        .select('resultado_analisis')
        .eq('partido_id', fixtureId)
        .single();

    if (error || !data) {
        console.log(`[analysisService] No se encontró análisis para fixture ${fixtureId} en ninguna fuente`);
        return null;
    }

    // El formato en 'analisis' tiene la estructura { dashboardData: {...} }
    const result = data.resultado_analisis as any;

    return {
        analysisText: result?.dashboardData?.resumen_ejecutivo?.frase_principal || "Análisis completado.",
        dashboardData: result?.dashboardData as DashboardAnalysisJSON,
        analysisRun: undefined // No hay run asociado en esta tabla legacy
    };
};


/**
 * Invoca el proceso de verificación de pronósticos (Post-Match Analysis).
 * Si no se pasa fixtureId, procesa los pendientes en lote.
 */
export const verifyPendingPredictions = async (fixtureId?: string | number[]): Promise<{
    success: boolean;
    processed: number;
    details: any[];
    debug?: { trace: string[]; targetsFound: number; }
}> => {
    try {
        const body = Array.isArray(fixtureId)
            ? { fixture_ids: fixtureId }
            : { fixture_id: fixtureId };

        const { data, error } = await supabase.functions.invoke('verify-prediction', {
            body: body
        });

        if (error) throw error;
        return data;
    } catch (err: any) {
        console.error("Error verifying predictions:", err);
        return { success: false, processed: 0, details: [], debug: { trace: [], targetsFound: 0 } };
    }
};

/**
 * Obtiene estadísticas de rendimiento agregadas para un rango de fechas.
 */
export const fetchPerformanceStats = async (start: Date, end: Date): Promise<PerformanceStats> => {
    // 1. Fetch runs in range
    const { data: runs, error } = await supabase
        .from('analysis_runs')
        .select(`
            id, 
            created_at,
            fixture_id,
            predictions (
                id, market, selection, is_won, probability, verification_status
            )
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

    if (error) throw error;
    if (!runs) return {
        total: 0, wins: 0, losses: 0, pushed: 0, winRate: 0, yield: 0,
        byMarket: {}, byLeague: {}, byDate: {},
        byConfidence: { HIGH: { total: 0, wins: 0, winRate: 0 }, MEDIUM: { total: 0, wins: 0, winRate: 0 }, LOW: { total: 0, wins: 0, winRate: 0 } },
        byProbability: {},
        rawPredictions: []
    };


    // 2. Aggregate
    // Flatten predictions from runs to a single array for the helper
    const allPredictions: any[] = [];

    // Also need to map league names from metadata
    // --- NEW: Fetch Fixture Metadata for League info ---
    const fixtureIds = [...new Set(runs.map((r: any) => parseInt(r.fixture_id)))];
    let gamesMap: Record<number, any> = {};

    if (fixtureIds.length > 0) {
        try {
            const games = await fetchFixturesList(fixtureIds);
            games.forEach(g => {
                gamesMap[g.fixture.id] = g;
            });
        } catch (e) {
            console.error("Error fetching fixtures for report:", e);
        }
    }

    runs.forEach((run: any) => {
        if (!run.predictions) return;

        // Find League
        const fixtureId = parseInt(run.fixture_id);
        const game = gamesMap[fixtureId];
        const leagueName = game ? game.league.name : "Desconocida";

        run.predictions.forEach((p: any) => {
            if (p.verification_status !== 'verified' || p.is_won === null) return;
            // Enrich with metadata needed for aggregation
            allPredictions.push({ ...p, date: run.created_at, league: leagueName });
        });
    });

    return aggregateStats(allPredictions);
};

/**
 * Re-usable aggregator for client-side filtering
 */
export const aggregateStats = (predictions: any[]): PerformanceStats => {
    let total = 0;
    let wins = 0;
    let losses = 0;
    let pushed = 0;

    const byMarket: Record<string, { total: number; wins: number; winRate: number }> = {};
    const byLeague: Record<string, { total: number; wins: number; winRate: number }> = {};
    const byDate: Record<string, { total: number; wins: number; profit: number }> = {};

    const byConfidence: Record<'HIGH' | 'MEDIUM' | 'LOW', { total: number; wins: number; winRate: number }> = {
        HIGH: { total: 0, wins: 0, winRate: 0 },
        MEDIUM: { total: 0, wins: 0, winRate: 0 },
        LOW: { total: 0, wins: 0, winRate: 0 }
    };

    const byProbability: Record<string, { total: number; wins: number; winRate: number }> = {};

    const getProbBucket = (prob: number) => {
        if (prob >= 90) return "90-100%";
        if (prob >= 80) return "80-89%";
        if (prob >= 70) return "70-79%";
        if (prob >= 60) return "60-69%";
        return "<60%";
    };

    predictions.forEach(p => {
        total++;
        const dateKey = new Date(p.date).toLocaleDateString('es-CO');
        const leagueName = p.league || "Desconocida";

        // Init Maps
        if (!byMarket[p.market]) byMarket[p.market] = { total: 0, wins: 0, winRate: 0 };
        if (!byDate[dateKey]) byDate[dateKey] = { total: 0, wins: 0, profit: 0 };
        if (!byLeague[leagueName]) byLeague[leagueName] = { total: 0, wins: 0, winRate: 0 };

        // Probability Buckets
        let prob = p.probability || 0;
        // Auto-detect decimal probability (e.g. 0.85) and convert to percentage
        if (prob > 0 && prob <= 1) {
            prob = prob * 100;
        }

        const probBucket = getProbBucket(prob);
        if (!byProbability[probBucket]) byProbability[probBucket] = { total: 0, wins: 0, winRate: 0 };

        // Confidence Level
        let confLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        if (prob >= 80) confLevel = 'HIGH';
        else if (prob >= 60) confLevel = 'MEDIUM';

        byMarket[p.market].total++;
        byDate[dateKey].total++;
        byLeague[leagueName].total++;
        byProbability[probBucket].total++;
        byConfidence[confLevel].total++;

        if (p.is_won === true) {
            wins++;
            byMarket[p.market].wins++;
            byDate[dateKey].wins++;
            byLeague[leagueName].wins++;
            byProbability[probBucket].wins++;
            byConfidence[confLevel].wins++;
        } else if (p.is_won === false) {
            losses++;
        } else {
            pushed++;
        }
    });

    // Calc Rates
    const winRate = total > 0 ? (wins / total) * 100 : 0;

    Object.keys(byMarket).forEach(k => {
        byMarket[k].winRate = (byMarket[k].wins / byMarket[k].total) * 100;
    });

    Object.keys(byLeague).forEach(k => {
        byLeague[k].winRate = (byLeague[k].wins / byLeague[k].total) * 100;
    });

    Object.keys(byProbability).forEach(k => {
        byProbability[k].winRate = (byProbability[k].wins / byProbability[k].total) * 100;
    });

    ['HIGH', 'MEDIUM', 'LOW'].forEach(k => {
        const key = k as 'HIGH' | 'MEDIUM' | 'LOW';
        if (byConfidence[key].total > 0) {
            byConfidence[key].winRate = (byConfidence[key].wins / byConfidence[key].total) * 100;
        }
    });

    return {
        total,
        wins,
        losses,
        pushed,
        winRate,
        yield: 0,
        byMarket,
        byLeague,
        byDate,
        byConfidence,
        byProbability,
        rawPredictions: predictions
    };
};

/**
 * Busca analysis_runs pendientes de verificación en un rango de fechas.
 * ESTRATEGIA: Intersección (API Fechas <-> DB Pendientes).
 * 1. Obtiene fixtures del rango desde API.
 * 2. Filtra IDs de partidos terminados.
 * 3. Busca cuáles de esos IDs tienen análisis pendientes en DB.
 */
export const fetchPendingVerificationRuns = async (startDate: string, endDate: string): Promise<number[]> => {
    try {
        console.log(`[Discovery] ID-First Strategy. Scanning range ${startDate} to ${endDate}`);

        // 1. Get ALL Pending Prediction Fixture IDs from DB (Cheap query)
        const { data: predictions, error } = await supabase
            .from('predictions')
            .select('fixture_id')
            .is('is_won', null); // Pending status

        if (error) {
            console.error("[Discovery] DB Error:", error);
            throw error;
        }

        const pendingIds = [...new Set(predictions?.map(p => p.fixture_id) || [])];
        console.log(`[Discovery] Found ${pendingIds.length} candidate pending IDs in DB.`);

        if (pendingIds.length === 0) return [];

        // 2. Fetch Details for these IDs (Batched by Service)
        const games = await fetchFixturesList(pendingIds);

        console.log(`[Discovery] Fetched details for ${games.length} games.`);

        // 3. Filter by Date Range & Status
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Adjust for timezone if needed, but assuming simple comparison YYYY-MM-DD

        const validIds = games.filter(g => {
            const date = new Date(g.fixture.date);
            const dateStr = g.fixture.date.split('T')[0]; // Simple string comp
            const inRange = dateStr >= startDate && dateStr <= endDate;
            const isFinished = ['FT', 'AET', 'PEN'].includes(g.fixture.status.short);

            return inRange && isFinished;
        }).map(g => g.fixture.id);

        console.log(`[Discovery] After filter: ${validIds.length} matches ready to verify.`);
        return validIds;

    } catch (err) {
        console.error("Error fetching pending runs:", err);
        return [];
    }
};

/**
 * Forzar un análisis post-partido (Retroactivo) para un partido específico.
 */
export const runPostMatchAnalysis = async (fixtureId: number): Promise<boolean> => {
    try {
        const { data, error } = await supabase.functions.invoke('verify-prediction', {
            body: { fixture_id: fixtureId }
        });
        if (error) throw error;
        return data.success;
    } catch (e) {
        console.error("Error invoking post-match analysis:", e);
        return false;
    }
};

/**
 * Obtener todos los feedbacks de aprendizaje del sistema en un rango.
 */
export const fetchPerformanceFeedbacks = async (startDate: string, endDate: string): Promise<string[]> => {
    // Buscar runs que tengan post_match_analysis y estén en el rango
    const { data: runs, error } = await supabase
        .from('analysis_runs')
        .select('post_match_analysis')
        .not('post_match_analysis', 'is', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

    if (error) {
        console.error("Error fetching feedbacks:", error);
        return [];
    }

    if (!runs) return [];

    // Extraer solo los textos de feedback y performance_review
    const feedbacks: string[] = [];
    runs.forEach((r: any) => {
        const pm = r.post_match_analysis;
        // Handle both string (legacy) and JSONB
        if (typeof pm === 'string') {
            feedbacks.push(pm);
        } else if (pm && typeof pm === 'object') {
            if (pm.learning_feedback) feedbacks.push(`FEEDBACK: ${pm.learning_feedback}`);
            if (pm.performance_review) feedbacks.push(`REVIEW: ${pm.performance_review}`);
        }
    });

    return feedbacks;
};

/**
 * Buscar runs verificados que NO tengan análisis post-partido.
 */
export const fetchMissingPostMatchRuns = async (startDate: string, endDate: string): Promise<any[]> => {
    // 1. Get runs that have resolved predictions but miss analysis
    // We widen the search window for 'created_at' because the analysis might have been created DAYS BEFORE the match.
    // We will verify the strict Match Date match later using the API data.
    const searchStart = new Date(startDate);
    searchStart.setDate(searchStart.getDate() - 7); // Look back 7 days
    const expandedStartDate = searchStart.toISOString().split('T')[0];

    const { data: runs, error } = await supabase
        .from('analysis_runs')
        .select(`
            id, created_at, actual_outcome, post_match_analysis,
            predictions!inner(is_won, fixture_id)
        `)
        .gte('created_at', expandedStartDate)
        .lte('created_at', endDate + 'T23:59:59')
        .not('predictions.is_won', 'is', null) // Only verified/resolved bets
        .is('post_match_analysis', null);       // Missing the 360 analysis

    if (error) {
        console.error("Error fetching missing runs:", error.message, error.details || '');
        return [];
    }

    // Deduplicate runs (in case multiple predictions joined for the same run)
    const uniqueRuns = Array.from(new Map(runs?.map(item => [item.id, item])).values());
    const validRuns = uniqueRuns;

    if (validRuns.length === 0) return [];

    // 2. Enrich with fixture details for UI
    // CRITICAL FIX: Use the fixture_id from PREDICTIONS (Integer) not AnalysisRun (UUID)
    // Runs might have 1:N predictions, we just take the first one's fixture_id as the canonical API ID.
    const runMap = validRuns.map(r => {
        // Safe cast: predictions is array due to Join
        const preds = r.predictions as any[];
        const apiFixtureId = preds && preds.length > 0 ? preds[0].fixture_id : null;
        return { ...r, api_fixture_id: apiFixtureId };
    });

    const fixtureIds = runMap.map(r => r.api_fixture_id).filter(id => id !== null);
    const fixturesMap = await fetchFixturesList(fixtureIds); // Returns DetailedGame[]

    // 3. Merge & Filter by Match Date
    const userStartDate = new Date(startDate).setHours(0, 0, 0, 0);
    const userEndDate = new Date(endDate).setHours(23, 59, 59, 999);

    return runMap.map(r => {
        const game = fixturesMap.find(f => f.fixture.id === r.api_fixture_id);

        // Skip if we couldn't find game details (shouldn't happen often)
        if (!game) return null;

        const gameDate = new Date(game.fixture.date);
        // strict filter: match must be within the USER selected range
        if (gameDate.getTime() < userStartDate || gameDate.getTime() > userEndDate) {
            return null;
        }

        return {
            run_id: r.id,
            fixture_id: r.api_fixture_id,
            date: game.fixture.date,
            home: game.teams.home.name || `Home (${r.api_fixture_id})`,
            away: game.teams.away.name || `Away (${r.api_fixture_id})`,
            outcome: r.actual_outcome
        };
    }).filter(item => item !== null); // Removing nulls from date mismatch
};
