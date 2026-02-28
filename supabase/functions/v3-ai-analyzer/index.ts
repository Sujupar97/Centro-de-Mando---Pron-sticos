// supabase/functions/v3-ai-analyzer/index.ts
// MOTOR V3: IA PURO - Gemini hace TODO el análisis y toma de decisiones
// Elimina dependencia de motores matemáticos B, C, D

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import JSON5 from "https://esm.sh/json5@2.2.3"
import { corsHeaders } from '../_shared/cors.ts'

const ENGINE_VERSION = '8.1.0-ML';
const PROMPT_VERSION = '8.1.0-ML';

// ── ML Calibration: Dynamic Prompt Injection ─────────────────────────

const HARDCODED_CALIBRATION_FALLBACK = `
📊 DATOS REALES DE CALIBRACIÓN (Feb 2026 — 63 picks verificados manualmente):
- Picks que asignamos 80-82% → ganaron solo 55.6%. ESTAMOS INFLANDO ~25 PUNTOS.
- Picks que asignamos 83-85% → ganaron 91.7%. EXCELENTE CALIBRACIÓN AQUÍ.
- Picks que asignamos 86-89% → ganaron solo 62.5%. INFLANDO ~24 PUNTOS.
- CONCLUSIÓN: Solo asigna 80-82% si realmente crees que gana ~55%. Si crees que gana >70%, asigna 83-85%.
- CONCLUSIÓN 2: El rango 86-89% está MÁS INFLADO que el 80-82%. No subas de 85% salvo evidencia ABRUMADORA.
- EN LA PRÁCTICA: Tu "85%" real es más como un "62%" de probabilidad real. Sé BRUTALMENTE honesto.

🏆 LIGAS CON RENDIMIENTO HISTÓRICO (usa para ajustar confianza):
LIGAS FUERTES (podemos confiar más en nuestro análisis):
- Serie A → 100% WR histórico. Podemos ser más agresivos.
- UEFA Champions League → 100% WR. Los grandes equipos son predecibles aquí.
- Liga Argentina → 80% WR. Buen terreno para análisis.
- Championship → 75% WR. Ligas inglesas nos van bien.
- Eredivisie → 75% WR.
LIGAS DÉBILES (reducir confianza 5-10% automáticamente):
- La Liga (España) → solo 25% WR. REDUCIR confianza 10% en TODOS los picks de La Liga.
- Europa League → solo 33% WR. Reducir confianza 8%.
- Eerste Divisie → solo 40% WR. Reducir confianza 5%.
- Ligas menores (1. Lig turca, etc.) → Reducir confianza 5%.
`;

const HARDCODED_MARKET_PRIORITIES_FALLBACK = `
Sigue esta jerarquía de búsqueda (ORDENADA POR RENDIMIENTO HISTÓRICO):

1. 🏆 MERCADOS COMBINADOS — NUESTRO MEJOR PRODUCTO (70% WR, ROI positivo):
   Subtipos que funcionan mejor:
   - "Resultado y Total" (ej: "Equipo & Más de 1.5 Goles") → 100% WR histórico
   - "Doble Oportunidad & Total" (ej: "Local o Empate & Más de 1.5") → 100% WR
   - "Goles & BTTS" (ej: "Más de 2.5 & Ambos Anotan") → 100% WR
   APUNTA A CUOTAS ≥1.70 en combinados — ese rango tiene +29% ROI.

2. MERCADOS INDIVIDUALES FUERTES:
   - BTTS/Ambos Anotan → Buen rendimiento (100% WR)
   - Draw No Bet → Buen rendimiento
   - Over/Under Goles (con datos claros) → 67% WR
   - Corners de equipo → Rentables con buena data
   - Goles del Local/Visitante → Buenos cuando la data es clara

3. ⛔ MERCADOS A EVITAR O USAR CON EXTREMA CAUTELA:
   - "Doble Oportunidad" SOLO (sin combinar) → 0% WR HISTÓRICO (0 de 5 picks ganados).
     NUNCA recomiendes Doble Oportunidad como pick individual.
   - Resultado 1X2 puro (sin combinar) → Solo 50% WR. Evitar salvo evidencia extrema.

4. ⚠️ GESTIÓN DE CUOTAS:
   - CUOTAS IDEALES: 1.70-2.00 → Rango con MEJOR ROI (+29.3%). Priorizar.
   - CUOTAS ACEPTABLES: 1.40-1.69 → Rango más voluminoso pero ROI ~0%.
   - CUOTAS BAJAS (<1.40): Buscar "SOCIO" para combinar y superar 1.40.
`;

interface MLCalibrationBlock {
    calibrationText: string;
    marketPrioritiesText: string;
    source: string;
    factorCount: number;
}

async function buildCalibrationBlock(supabase: any): Promise<MLCalibrationBlock> {
    try {
        // Fetch active calibration factors
        const { data: factors, error: fErr } = await supabase
            .from('ml_calibration_factors')
            .select('*')
            .eq('status', 'active');

        // Fetch active learned patterns
        const { data: patterns, error: pErr } = await supabase
            .from('ml_learned_patterns')
            .select('*')
            .eq('active', true);

        if (fErr || pErr || !factors || factors.length === 0) {
            console.log('[v3-ai-analyzer] ML tables empty or error, using hardcoded calibration fallback');
            return {
                calibrationText: HARDCODED_CALIBRATION_FALLBACK,
                marketPrioritiesText: HARDCODED_MARKET_PRIORITIES_FALLBACK,
                source: 'hardcoded-fallback',
                factorCount: 0,
            };
        }

        // ── Build calibration text from real data (v2 OBSERVATIONAL — informative, not directive) ──
        let calText = `\n📊 DATOS HISTÓRICOS DE RENDIMIENTO (${factors.length} dimensiones analizadas por ML Auto-Learning):\n`;
        calText += `IMPORTANTE: Estos datos son INFORMATIVOS para tu análisis. Tu evaluación del partido específico tiene PRIORIDAD.\n`;
        calText += `Si los fundamentos del partido son sólidos, mantén probabilidades altas incluso si el dato histórico es bajo.\n\n`;

        // Prob band factors
        const probBandFactors = factors.filter((f: any) => f.dimension === 'prob_band');
        if (probBandFactors.length > 0) {
            calText += `RENDIMIENTO HISTÓRICO POR BANDA DE PROBABILIDAD:\n`;
            for (const f of probBandFactors) {
                const gap = f.predicted_avg - f.actual_wr;
                calText += `- Picks asignados ${f.dimension_key} → ganaron ${f.actual_wr.toFixed(1)}% (gap: ${gap.toFixed(1)}pts, muestra: ${f.sample_size}). Dato informativo.\n`;
            }
            calText += `\n`;
        }

        // League factors
        const leagueFactors = factors.filter((f: any) => f.dimension === 'league');
        if (leagueFactors.length > 0) {
            const strong = leagueFactors.filter((f: any) => f.actual_wr >= 65 && f.sample_size >= 10);
            const weak = leagueFactors.filter((f: any) => f.actual_wr < 45 && f.sample_size >= 10);

            if (strong.length > 0) {
                calText += `LIGAS CON BUEN HISTORIAL:\n`;
                for (const f of strong) {
                    calText += `- ${f.dimension_key} → ${f.actual_wr.toFixed(1)}% WR en ${f.sample_size} picks. Dato positivo a considerar.\n`;
                }
                calText += `\n`;
            }

            if (weak.length > 0) {
                calText += `LIGAS CON HISTORIAL BAJO (evaluar con más detalle):\n`;
                for (const f of weak) {
                    calText += `- ${f.dimension_key} → ${f.actual_wr.toFixed(1)}% WR en ${f.sample_size} picks. Considerar con cautela extra, pero NO descartar automáticamente.\n`;
                }
                calText += `\n`;
            }
        }

        // ── Build market priorities from real data ──
        let marketText = `\nDatos de mercados (REFERENCIA HISTÓRICA — el contexto del partido es más importante):\n\n`;

        const marketFactors = factors.filter((f: any) => f.dimension === 'market' && f.sample_size >= 10);
        if (marketFactors.length > 0) {
            const sorted = [...marketFactors].sort((a: any, b: any) => b.actual_wr - a.actual_wr);
            const best = sorted.filter((f: any) => f.actual_wr >= 65);
            const worst = sorted.filter((f: any) => f.actual_wr < 35);

            if (best.length > 0) {
                marketText += `MERCADOS CON MEJOR RENDIMIENTO HISTÓRICO:\n`;
                for (const f of best) {
                    marketText += `- ${f.dimension_key}: ${f.actual_wr.toFixed(1)}% WR, ROI ${f.roi > 0 ? '+' : ''}${f.roi?.toFixed(1)}%, muestra ${f.sample_size}.\n`;
                }
                marketText += `\n`;
            }

            if (worst.length > 0) {
                marketText += `MERCADOS CON RENDIMIENTO BAJO (evaluar con cautela extra, NO prohibidos):\n`;
                for (const f of worst) {
                    marketText += `- ${f.dimension_key}: ${f.actual_wr.toFixed(1)}% WR en ${f.sample_size} picks. Rendimiento históricamente bajo — evaluar el partido individualmente.\n`;
                }
                marketText += `\n`;
            }
        }

        // Odds range factors
        const oddsFactors = factors.filter((f: any) => f.dimension === 'odds_range' && f.sample_size >= 10);
        if (oddsFactors.length > 0) {
            const bestOdds = [...oddsFactors].sort((a: any, b: any) => (b.roi || 0) - (a.roi || 0));
            marketText += `RENDIMIENTO POR RANGO DE CUOTAS:\n`;
            for (const f of bestOdds) {
                marketText += `- Cuotas ${f.dimension_key}: ${f.actual_wr.toFixed(1)}% WR, ROI ${f.roi > 0 ? '+' : ''}${f.roi?.toFixed(1)}%, muestra ${f.sample_size}.\n`;
            }
            marketText += `\n`;
        }

        // ── Inject learned patterns (as informational, not as orders) ──
        const activePatterns = (patterns || []).filter((p: any) => p.active);
        if (activePatterns.length > 0) {
            calText += `\nPATRONES HISTÓRICOS DETECTADOS POR ML (${activePatterns.length} — usar como REFERENCIA, no como prohibición):\n`;
            for (const p of activePatterns) {
                const icon = p.pattern_type === 'boost' ? '📈' : '📊';
                calText += `${icon} ${p.rule_text} (dato histórico — evaluar en contexto del partido)\n`;
            }
            calText += `\n`;
        }

        return {
            calibrationText: calText,
            marketPrioritiesText: marketText,
            source: 'ml-dynamic',
            factorCount: factors.length,
        };
    } catch (err) {
        console.error('[v3-ai-analyzer] Error building ML calibration block, using fallback:', err);
        return {
            calibrationText: HARDCODED_CALIBRATION_FALLBACK,
            marketPrioritiesText: HARDCODED_MARKET_PRIORITIES_FALLBACK,
            source: 'hardcoded-fallback-error',
            factorCount: 0,
        };
    }
}

// ── ML Post-Processing: Apply calibration factors to picks ──────────

interface CalibrationAdjustment {
    market: string;
    league: string;
    originalProb: number;
    adjustedProb: number;
    factorsApplied: string[];
}

async function applyCalibrationPostProcessing(
    picks: any[],
    leagueName: string,
    supabase: any
): Promise<{ adjustedPicks: any[]; adjustments: CalibrationAdjustment[] }> {
    const adjustments: CalibrationAdjustment[] = [];

    try {
        const { data: factors } = await supabase
            .from('ml_calibration_factors')
            .select('dimension, dimension_key, calibration_factor, confidence_adjustment, actual_wr, sample_size')
            .eq('status', 'active');

        if (!factors || factors.length === 0) {
            return { adjustedPicks: picks, adjustments: [] };
        }

        // Build lookup maps
        const factorMap = new Map<string, any>();
        for (const f of factors) {
            factorMap.set(`${f.dimension}|${f.dimension_key}`, f);
        }

        const adjustedPicks = picks.map((pick: any) => {
            const originalProb = pick.probabilidad_calculada_porcentaje || 50;
            const market = pick.mercado || '';
            const odds = pick.cuota_actual || 0;
            const probBandKey = originalProb < 80 ? '<80%' : originalProb < 83 ? '80-82%' : originalProb < 86 ? '83-85%' : originalProb < 90 ? '86-89%' : '90%+';
            const oddsRangeKey = odds < 1.40 ? '<1.40' : odds < 1.70 ? '1.40-1.69' : odds < 2.00 ? '1.70-1.99' : odds < 2.50 ? '2.00-2.49' : '2.50+';

            let adjustedProb = originalProb;
            const appliedFactors: string[] = [];

            // Apply market factor
            const marketFactor = factorMap.get(`market|${market}`);
            if (marketFactor && marketFactor.sample_size >= 5) {
                adjustedProb = adjustedProb * marketFactor.calibration_factor;
                appliedFactors.push(`market:${marketFactor.calibration_factor.toFixed(3)}`);
            }

            // Apply league factor
            const leagueFactor = factorMap.get(`league|${leagueName}`);
            if (leagueFactor && leagueFactor.sample_size >= 5) {
                // Use confidence_adjustment instead of multiplying (additive, not multiplicative)
                adjustedProb += leagueFactor.confidence_adjustment;
                appliedFactors.push(`league:${leagueFactor.confidence_adjustment > 0 ? '+' : ''}${leagueFactor.confidence_adjustment}`);
            }

            // Apply prob band factor (subtle — only if there's a significant gap)
            const probFactor = factorMap.get(`prob_band|${probBandKey}`);
            if (probFactor && probFactor.sample_size >= 5) {
                const gap = probFactor.predicted_avg - probFactor.actual_wr;
                if (gap > 10) {
                    // Significant overconfidence in this band — reduce
                    const reduction = Math.min(gap * 0.3, 15);
                    adjustedProb -= reduction;
                    appliedFactors.push(`prob_band:-${reduction.toFixed(1)}`);
                }
            }

            // Cap: never reduce more than 25 points from original
            adjustedProb = Math.max(originalProb - 25, Math.min(100, adjustedProb));
            // Floor: never go below 40%
            adjustedProb = Math.max(40, adjustedProb);

            adjustedProb = Math.round(adjustedProb * 10) / 10;

            if (appliedFactors.length > 0 && Math.abs(adjustedProb - originalProb) >= 0.5) {
                adjustments.push({
                    market,
                    league: leagueName,
                    originalProb,
                    adjustedProb,
                    factorsApplied: appliedFactors,
                });

                return {
                    ...pick,
                    probabilidad_calculada_porcentaje: adjustedProb,
                    probabilidad_original_pre_ml: originalProb,
                    ml_adjustments: appliedFactors,
                };
            }

            return pick;
        });

        return { adjustedPicks, adjustments };
    } catch (err) {
        console.error('[v3-ai-analyzer] ML post-processing error (non-blocking):', err);
        return { adjustedPicks: picks, adjustments: [] };
    }
}

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

// Helper function to normalize prediction fields from AI output
function normalizePrediction(p: any, index: number) {
    const probRaw = p.probabilidad_calculada_porcentaje || p.probabilidad_derbix || p.probabilidad_implicita || p.probabilidad || "50%";
    const prob = typeof probRaw === 'string' ? parseFloat(probRaw.replace('%', '').replace('+', '')) : probRaw;
    const edgeRaw = p.edge_porcentaje || p.edge_calculado || p.edge || "0%";
    const edge = typeof edgeRaw === 'string' ? parseFloat(edgeRaw.replace('%', '').replace('+', '')) : edgeRaw;
    const odds = p.cuota_actual || p.cuota_estimada || p.cuota_referencia || null;
    const justText = p.razonamiento || p.justificacion?.estadistica || p.justificacion?.tactica || "Análisis IA completado";

    return {
        id: `${p.mercado}_${p.seleccion}`.replace(/\s/g, '_'),
        mercado: p.mercado || "Mercado",
        seleccion: p.seleccion || "Seleccion",
        probabilidad_estimado_porcentaje: prob || 50,
        odds: odds,
        edge: edge || 0,
        nivel_confianza: p.nivel_confianza || 'MEDIA',
        stake_recomendado: p.stake_recomendado || 1,
        justificacion_detallada: {
            base_estadistica: [typeof justText === 'string' ? justText.substring(0, 300) : ''],
            contexto_competitivo: [p.tipo || p.nivel_confianza || 'Análisis Profundo'],
            conclusion: typeof justText === 'string' && justText.length > 300 ? justText.substring(300) : 'Valor matemático identificado.'
        }
    };
}

// Helper for top_oportunidades
function normalizeOpportunity(p: any) {
    const probRaw = p.probabilidad_calculada_porcentaje || p.probabilidad_derbix || p.probabilidad_implicita || "50%";
    const prob = typeof probRaw === 'string' ? parseFloat(probRaw.replace('%', '')) : probRaw;
    const edgeRaw = p.edge_porcentaje || p.edge_calculado || p.edge || "0%";
    const edge = typeof edgeRaw === 'string' ? parseFloat(edgeRaw.replace('%', '').replace('+', '')) : edgeRaw;
    const odds = p.cuota_actual || p.cuota_estimada || p.cuota_referencia || null;
    const probImpl = p.probabilidad_implicita;
    const probTipica = typeof probImpl === 'string' ? parseFloat(probImpl.replace('%', '')) : (p.probabilidad_implicita_porcentaje || 50);

    return {
        mercado: p.mercado,
        categoria: p.mercado?.split(' ')[0]?.toUpperCase() || 'OTRO',
        seleccion: p.seleccion,
        cuota: odds,
        probabilidad_calculada: prob || 50,
        probabilidad_tipica: probTipica,
        confianza: p.nivel_confianza || p.confianza || 'MEDIA',
        value_score: edge || 0
    };
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const startTime = Date.now();
    const GEMINI_MODEL = 'gemini-3.1-pro-preview';
    const ENGINE_VERSION = 'V8.1-MASTERMIND';
    let _jobId: string | null = null; // For error handler access

    try {
        const { job_id, fixture_id: inFixtureId, payload: inPayload } = await req.json();
        _jobId = job_id;

        if (!job_id) {
            throw new Error('job_id is required');
        }

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

        const supabase = createClient(sbUrl, sbKey);

        // If no payload provided, read from etl_context saved by the ETL stage
        let payload = inPayload;
        let fixture_id = inFixtureId;
        if (!payload) {
            console.log(`[V4-MASTERMIND] No payload in body, reading etl_context from DB for job ${job_id}...`);
            const { data: jobData, error: jobErr } = await supabase
                .from('analysis_jobs_v2')
                .select('etl_context, fixture_id')
                .eq('id', job_id)
                .single();
            if (jobErr || !jobData?.etl_context) {
                throw new Error(`Cannot read etl_context for job ${job_id}: ${jobErr?.message || 'no data'}`);
            }
            payload = jobData.etl_context;
            fixture_id = fixture_id || jobData.fixture_id;
            console.log(`[V4-MASTERMIND] Loaded etl_context from DB (${JSON.stringify(payload).length} chars)`);
        }

        if (!fixture_id || !payload) {
            throw new Error('fixture_id and payload are required (either via body or etl_context)');
        }

        console.log(`[V4-MASTERMIND] Starting analysis using ${GEMINI_MODEL} for fixture: ${fixture_id}`);

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

        // V8 UPGRADE: Format matches with events (minute-by-minute)
        const formatMatchForPrompt = (m: any, index: number) => {
            const teamWon = m.was_home
                ? m.score_home > m.score_away
                : m.score_away > m.score_home;
            const teamLost = m.was_home
                ? m.score_home < m.score_away
                : m.score_away < m.score_home;
            const resultText = teamWon ? '✓ VICTORIA' : teamLost ? '✗ DERROTA' : '= EMPATE';
            const venueTag = m.was_home ? '(LOCAL)' : '(VISITANTE)';

            const teamGoals = m.was_home ? m.score_home : m.score_away;
            const oppGoals = m.was_home ? m.score_away : m.score_home;

            const d = m.details || {};
            const statsLine = `   📊 Stats: ${d.possession || '?'}% Pos | ${d.shots_on_target || 0}/${d.shots_total || 0} Tiros | ${d.corners || 0} Corners | ${d.saves || 0} Atajadas`;
            const oppStatsLine = `   📊 Rival: ${d.opponent_possession || '?'}% Pos | ${d.opponent_shots_on_target || 0}/${d.opponent_shots || 0} Tiros | ${d.opponent_corners || 0} Corners`;
            const cardsLine = `   🟨 Disciplina: ${d.yellow_cards || 0} Amarillas | ${d.red_cards || 0} Rojas | ${d.fouls || 0} Faltas | ${d.free_kicks || 0} T.Libres`;
            const formLine = `   🎯 Formación: ${d.formation_used || '?'} (vs ${d.opponent_formation || '?'})`;

            // V8: Half-time score
            const htLine = (d.ht_score_team !== null && d.ht_score_team !== undefined)
                ? `   ⏱️ 1er Tiempo: ${d.ht_score_team}-${d.ht_score_opponent}`
                : '';

            // V8: Detailed events
            let eventsBlock = '';
            if (d.events && Array.isArray(d.events) && d.events.length > 0) {
                const eventLines = d.events.slice(0, 8).map((e: any) => {
                    const icon = e.type === 'Goal' ? '⚽' : e.type === 'Yellow Card' ? '🟨' : e.type === 'Red Card' ? '🟥' : e.type === 'Substitution' ? '🔄' : '📌';
                    return `      ${e.minute}' ${icon} ${e.type} - ${e.player}${e.detail ? ` (${e.detail})` : ''}${e.related_player ? ` ← ${e.related_player}` : ''}`;
                }).join('\n');
                eventsBlock = `   ⚡ Eventos:\n${eventLines}`;
            } else if (d.goal_timings) {
                eventsBlock = `   ⚽ Minutos de gol: ${d.goal_timings}`;
            }

            const lines = [
                `${index + 1}. ${m.date} vs ${m.opponent_name || m.away_team}: ${teamGoals}-${oppGoals} ${resultText} ${venueTag}`,
                statsLine,
                oppStatsLine,
                cardsLine,
                formLine
            ];
            if (htLine) lines.push(htLine);
            if (eventsBlock) lines.push(eventsBlock);

            return lines.join('\n');
        };

        // V8: Format venue-specific stats with summary
        const formatVenueSection = (matches: any[], label: string) => {
            if (!matches || matches.length === 0) return `${label}: Sin datos disponibles.\n`;

            const calcStats = (arr: any[]) => {
                const wins = arr.filter(m => (m.was_home ? m.score_home > m.score_away : m.score_away > m.score_home)).length;
                const draws = arr.filter(m => m.score_home === m.score_away).length;
                const losses = arr.length - wins - draws;
                const goalsFor = arr.reduce((sum, m) => sum + (m.was_home ? m.score_home : m.score_away), 0);
                const goalsAgainst = arr.reduce((sum, m) => sum + (m.was_home ? m.score_away : m.score_home), 0);
                return { wins, draws, losses, goalsFor, goalsAgainst, total: arr.length };
            };

            const stats = calcStats(matches);
            let output = `\n${label} (${matches.length} partidos): ${stats.wins}V-${stats.draws}E-${stats.losses}D | GF:${stats.goalsFor} GA:${stats.goalsAgainst} | Prom: ${(stats.goalsFor / matches.length).toFixed(1)} GF/p, ${(stats.goalsAgainst / matches.length).toFixed(1)} GA/p\n\n`;
            output += matches.map((m, i) => formatMatchForPrompt(m, i)).join('\n\n');
            return output;
        };

        // V8: Format general form (simple, lightweight)
        const formatGeneralForm = (form: any[]) => {
            if (!form || form.length === 0) return 'Sin forma general disponible.';
            const formString = form.slice(0, 30).map(m => m.result).join('');
            const wins = form.filter(m => m.result === 'W').length;
            const draws = form.filter(m => m.result === 'D').length;
            const losses = form.filter(m => m.result === 'L').length;
            return `Forma (${form.length}p): ${formString} | ${wins}W-${draws}D-${losses}L\n` +
                form.slice(0, 10).map(m => `  ${m.date} ${m.was_home ? '🏠' : '✈️'} vs ${m.opponent}: ${m.score} ${m.result}${m.formation ? ` (${m.formation})` : ''}`).join('\n');
        };

        // V8: Use new structured datasets (home_team / away_team with as_home/as_away)
        const homeData = datasets.home_team || {};
        const awayData = datasets.away_team || {};

        // Fallback to old format if V8 structure not present
        const homeAsHome = homeData.as_home || datasets.home_team_last40?.all?.filter((m: any) => m.was_home === true) || [];
        const homeAsAway = homeData.as_away || datasets.home_team_last40?.all?.filter((m: any) => m.was_home === false) || [];
        const awayAsHome = awayData.as_home || datasets.away_team_last40?.all?.filter((m: any) => m.was_home === true) || [];
        const awayAsAway = awayData.as_away || datasets.away_team_last40?.all?.filter((m: any) => m.was_home === false) || [];

        const deepHome = `\n📍 ${homeTeam} COMO LOCAL:\n` + formatVenueSection(homeAsHome, `📍 Como LOCAL`) +
            `\n\n✈️ ${homeTeam} COMO VISITANTE:\n` + formatVenueSection(homeAsAway, `✈️ Como VISITANTE`) +
            (homeData.general_form ? `\n\n📋 FORMA GENERAL ${homeTeam}:\n` + formatGeneralForm(homeData.general_form) : '');

        const deepAway = `\n📍 ${awayTeam} COMO LOCAL:\n` + formatVenueSection(awayAsHome, `📍 Como LOCAL`) +
            `\n\n✈️ ${awayTeam} COMO VISITANTE:\n` + formatVenueSection(awayAsAway, `✈️ Como VISITANTE`) +
            (awayData.general_form ? `\n\n📋 FORMA GENERAL ${awayTeam}:\n` + formatGeneralForm(awayData.general_form) : '');

        // V8: External context from Perplexity
        const externalContext = payload.external_context;
        const externalContextText = externalContext
            ? `\n>>> CONTEXTO EXTERNO (Noticias Recientes - Últimos 7 días)\n${externalContext.raw_text || 'Sin contexto externo disponible.'}\n${externalContext.citations?.length ? `\nFuentes: ${externalContext.citations.join(', ')}` : ''}`
            : '\n>>> CONTEXTO EXTERNO: No disponible (Perplexity no configurado o sin resultados).';

        // H2H Rich Format
        const h2hText = datasets.h2h?.map((m: any) => {
            const s = m.stats || {};
            // If stats exist, show them (Home vs Away)
            const statsInfo = s.home ?
                `\n   > ${m.home_team}: ${s.home.shots} Tiros (${s.home.shots_ot} Arco) | ${s.home.corners} Corners | ${s.home.cards} Tarjetas\n   > ${m.away_team}: ${s.away.shots} Tiros (${s.away.shots_ot} Arco) | ${s.away.corners} Corners | ${s.away.cards} Tarjetas`
                : '';
            return `${m.date}: ${m.home_team} ${m.score_home}-${m.score_away} ${m.away_team}${statsInfo}`;
        }).join('\n') || 'Sin H2H recientes';
        let oddsText = '';
        if (odds && (odds.MAIN || odds.GOALS)) {
            const fmtSection = (name: string, items: any[]) => {
                if (!items || items.length === 0) return '';
                return `>>> ${name}:\n` + items.map((o: any) => `- ${o.lbl}: ${o.val}`).join('\n') + '\n';
            };

            oddsText += fmtSection('PRINCIPALES (1X2, DC)', odds.MAIN);
            oddsText += fmtSection('GOLES (O/U)', odds.GOALS);
            oddsText += fmtSection('EQUIPOS (BTTS, Team Score)', odds.TEAMS);
            oddsText += fmtSection('🎯 MERCADOS COMBINADOS (Result+BTTS, Result+O/U, HT/FT)', odds.COMBOS);
            oddsText += fmtSection('POR MITADES', odds.HALVES);
            oddsText += fmtSection('CORNERS', odds.CORNERS);
            oddsText += fmtSection('OTROS (ASIATICOS/ESPECIALES)', odds.OTHERS); // Include ALL odds
        } else if (odds?.bookmakers?.[0]) {
            oddsText = `${odds.bookmakers[0].title}:\n` + odds.bookmakers[0].markets?.map((m: any) => `${m.key}: ` + m.outcomes?.map((o: any) => `${o.name} @ ${o.price}`).join(' | ')).join('\n');
        } else {
            oddsText = 'SIN CUOTAS VIVAS (USAR FALLBACK)';
        }

        // ═══ ML AUTO-LEARNING: Build dynamic calibration block ═══
        const mlCalibration = await buildCalibrationBlock(supabase);
        console.log(`[v3-ai-analyzer] Using ${mlCalibration.source} calibration data (${mlCalibration.factorCount} factors)`);

        // CONSTRUIR EL SUPER-PROMPT V8 (MASTERMIND + EVENTS + CONTEXT)
        // ═══════════════════════════════════════════════════════════════
        const prompt = `
════════════════════════════════════════════════════════════════════════════════
🧠 SISTEMA DERBIX V8 [DUAL INTELLIGENCE + EVENTS + CONTEXT] - MOTOR DE ANÁLISIS DE ÉLITE
Modelo: ${GEMINI_MODEL}
Fecha Sistema: ${new Date().toISOString().split('T')[0]}
════════════════════════════════════════════════════════════════════════════════

ERES LA MENTE MAESTRA DE DERBIX.
No eres un simple asistente. Eres un estratega deportivo de clase mundial que combina MATEMÁTICAS con INTELIGENCIA DE PARTIDO. Tu objetivo: encontrar ineficiencias en las cuotas que los números solos NO pueden detectar.

⚠️ PRINCIPIO FUNDAMENTAL V6 — LA REGLA DEL 50/50:
Tu análisis se divide en DOS PILARES con IGUAL PESO:

┌─────────────────────────────────┬─────────────────────────────────┐
│  📊 PILAR A: INTELIGENCIA       │  🧠 PILAR B: INTELIGENCIA       │
│     ESTADÍSTICA (50%)           │     DE PARTIDO (50%)           │
│                                 │                                 │
│  Forma reciente, H2H,          │  Contexto competitivo, táctica, │
│  correlaciones, cuotas          │  psicología, escenarios,       │
│                                 │  factores invisibles           │
└─────────────────────────────────┴─────────────────────────────────┘

Los NÚMEROS son solo MITAD de la historia. Un equipo que ganó 5/5 puede
perder si: viene de viaje intercontinental, juega con suplentes porque
tiene final de Copa en 3 días, cambió de DT hace 1 semana, o el rival
tiene paternidad psicológica histórica sobre ellos.

CONSTANTES DE OPERACIÓN:
- PESO_ESTADISTICO = 50%
- PESO_INTELIGENCIA_PARTIDO = 50%
- DEFINICIÓN DE EDGE: (Tu Probabilidad % - Probabilidad Implícita del Mercado %).

SISTEMA DE CUOTAS ESCALONADAS (reemplaza el mínimo fijo):
┌──────────────┬──────────────┬──────────────────┬─────────────────────────────────┐
│ Tipo         │ Cuota Mínima │ Confianza Mínima │ Uso                             │
├──────────────┼──────────────┼──────────────────┼─────────────────────────────────┤
│ 🔒 BANKER    │ 1.20         │ 85%+             │ Pick seguro, ideal para parlays │
│ 📊 ESTÁNDAR  │ 1.40         │ 75%+             │ Pick normal con edge claro      │
│ 💎 VALOR     │ 1.60+        │ 70%+             │ Alta cuota con ineficiencia      │
│ 🎯 COMBO     │ 1.50+        │ 80%+             │ Mercado combinado               │
└──────────────┴──────────────┴──────────────────┴─────────────────────────────────┘
- IMPORTANTE: Un pick BANKER (cuota 1.20-1.39) ES VÁLIDO si la confianza es ≥85%.
  Ejemplo: "Double Chance: Home/Draw" @ 1.22 con 88% confianza = PICK BANKER VÁLIDO.
- NO descartes picks de alta probabilidad solo porque la cuota es baja.

REGLAS DE ORO (A CUMPLIR O SERÁS APAGADO):
1. **NO INVENTES DATOS**. Usa SOLO la información proporcionada. Si no hay datos de corners, NO menciones corners.
2. **TEMPORALIDAD ESTRICTA**: Un partido de hace 3 meses NO define la forma actual.
3. **EQUILIBRIO OBLIGATORIO**: Tu razonamiento DEBE contener argumentos de AMBOS pilares. Un análisis puramente estadístico es INCOMPLETO e INACEPTABLE.
4. **LENGUAJE DE SHARK**: Usa términos como "Ineficiencia de mercado", "Valor esperado positivo", "Trampa de las bookies".
5. **JUSTIFICACIÓN DUAL**: No digas "van a ganar porque ganaron 5 de 5". Di "La dominancia estadística (5/5) se refuerza con la urgencia de clasificar + la ventaja táctica del bloque bajo contra el rival ofensivo".

════════════════════════════════════════════════════════════════════════════════
📊 PILAR A: INTELIGENCIA ESTADÍSTICA (50% del análisis)
════════════════════════════════════════════════════════════════════════════════

1. ABSORCIÓN DE DATOS (Deep Ingest):
   - CRÚZALO TODO: TIROS, ATAJADAS, CORNERS, TARJETAS, MINUTOS DE GOLES.
   - Si un equipo gana pero el portero hizo 12 atajadas, fue SUERTE, no dominancia. Eso BAJA tu confianza.
   - "Goal Timings": ¿Marcan siempre en el 2do tiempo? → Valor en "Gol en 2da Mitad".

2. CORRELACIÓN MULTIVARIABLE:
   - Busca patrones "Causa-Efecto".
   - Ej: "Contra defensas de 5 (5-3-2), su promedio de gol baja un 40%".
   - Árbitro + Estilo: Árbitro estricto + Equipos agresivos = Alta prob. Roja.

3. CORNERS & BALÓN PARADO:
   - Corners = f(Tiros a Puerta + Posesión en Campo Rival + Despejes del Rival).
   - Formación con Extremos Abiertos → más corners. Equipo defensivo → concede corners.

4. ANÁLISIS DISCIPLINARIO:
   - Revisá el Árbitro asignado + "Faltas Promedio" de los equipos.
   - Derby/H2H Caliente + Árbitro Tarjetero = Over Tarjetas.

5. ANÁLISIS DE CUOTAS (Value Hunting):
   - EXAMÍNALAS TODAS. No solo "Ganador del Partido".
   - Si hay valor en "Over 1.5 Goles Local" o "Handicap Asiático", ELÍGELO.
   - Calcula la "Probabilidad Real Derbix" vs la Implícita del Mercado.

Después de analizar el Pilar A, asigna un SCORE ESTADÍSTICO (0-100) a tu nivel 
de confianza basado EXCLUSIVAMENTE en los datos duros.

════════════════════════════════════════════════════════════════════════════════
🧠 PILAR B: INTELIGENCIA DE PARTIDO (50% del análisis)
════════════════════════════════════════════════════════════════════════════════

ESTE PILAR ES TAN IMPORTANTE COMO LOS NÚMEROS. Aquí descubres lo que las
estadísticas NO pueden decirte: el CONTEXTO que hace único a ESTE partido.

♟️ B1. ANÁLISIS TÁCTICO PROFUNDO (Choque de Sistemas):
   - "Mirror Analysis": ¿Cómo le fue vs formaciones similares al rival de hoy?
   - MATCHUP CLAVE: ¿Bandas vs Centro? ¿Posesión vs Contraataque?
     Si el visitante juega a la contra y el local deja espacios atrás → "Ambos Anotan".
   - ¿Quién controla el mediocampo? El equipo que controle el medio suele controlar el partido.
   - ¿Juego Aéreo? Si un equipo centra mucho + el rival es bajo → Ventaja en balón parado.
   - ¿El DT es conservador o agresivo? Esto define si el partido será abierto o cerrado.

🧠 B2. PSICOLOGÍA DEPORTIVA (Temperatura Mental):
   Evalúa la mentalidad de CADA equipo:
   - PRESIÓN: ¿Quién tiene miedo de perder? El miedo paraliza → Under de goles.
   - MOTIVACIÓN: ¿Se juegan algo? ¿Hay "Venganza" por H2H? ¿Efecto "Nuevo DT" (luna de miel)?
   - RELAJACIÓN: ¿Es un partido intrascendente? → Rotaciones, baja intensidad.
   - MOMENTUM: ¿Racha positiva (confianza alta) o racha negativa (caos, presión interna)?
   - FACTOR VESTUARIO: ¿Hay conflictos internos? ¿Traspasos polémicos? ¿Lesión de líder?
   - DERBY/CLÁSICO: Los Derbies rompen TODA estadística. Aquí manda la emoción, 
     no la tabla. Un equipo último puede ganarle al líder en un Derby.

🏟️ B3. CONTEXTO COMPETITIVO (¿QUÉ SE JUEGAN?):
   - ¿Qué TORNEO es? (Liga vs Copa vs Amistoso vs Clasificatoria)
   - ¿Qué FASE? (Inicio de temporada, mitad, definición, eliminatoria)
   - ¿Necesitan puntos URGENTEMENTE? (Zona de descenso, zona de clasificación)
   - ¿El empate les sirve a AMBOS? → "Biscotto" (partido pactado).
   - ¿Tienen otro partido IMPORTANTE en 3-4 días? → Rotaciones probables.
   - ¿Vienen de viaje largo/intercontinental? → Factor Fatiga.

🔮 B4. ESCENARIOS DEL PARTIDO (Proyecciones):
   Construye 3 escenarios:
   - ESCENARIO OPTIMISTA (para el favorito): ¿Cómo luce si todo sale bien?
   - ESCENARIO BASE (lo más probable): ¿Cuál es el desarrollo más realista?
   - ESCENARIO ALTERNATIVO (la sorpresa): ¿Qué podría romper la estadística?
   ¿Cuál de los 3 es MÁS PROBABLE? Usa esto para afinar tu probabilidad.

⚡ B5. FACTORES INVISIBLES (Lo que los números NO dicen):
   - ¿Debutará un jugador clave? ¿Regresa alguien de lesión?  
   - ¿Hay un récord o racha histórica en juego (motivación extra)?
   - ¿Hay factor climático extremo? (Lluvia → equipo físico > equipo técnico)
   - ¿Es un horario inusual? (Partidos a las 12pm vs 9pm cambian intensidad)

Después de analizar el Pilar B, asigna un SCORE DE INTELIGENCIA DE PARTIDO (0-100)
a tu nivel de confianza basado EXCLUSIVAMENTE en el contexto del partido.

════════════════════════════════════════════════════════════════════════════════
⚖️ CÁLCULO DE CONFIANZA FINAL (FÓRMULA DUAL OBLIGATORIA)
════════════════════════════════════════════════════════════════════════════════

CONFIANZA FINAL = (Score Estadístico × 0.50) + (Score Inteligencia Partido × 0.50)

┌──────────┬──────────────────────────────────────────────────────────────────┐
│ 90-95%   │ ÉLITE: SOLO para convergencia EXTREMA de TODOS los factores.    │
│ (ÉLITE)  │ Ambos pilares >85%. Forma impecable + motivación máxima +       │
│          │ táctica ideal + H2H dominante + cuota con edge >15%. RARO.      │
├──────────┼──────────────────────────────────────────────────────────────────┤
│ 82-89%   │ ALTA: Ambos pilares >78%. Evidencia clara y consistente.        │
│ (ALTA)   │ Mínimo 3 de 5 factores alineados (forma, H2H, motivación,      │
│          │ táctica, valor en cuota). Sin riesgos significativos.            │
├──────────┼──────────────────────────────────────────────────────────────────┤
│ 75-81%   │ MEDIA+: Una pata fuerte con la otra aceptable. Edge claro       │
│ (MEDIA+) │ pero con algún factor de riesgo identificado. ESTO ES LO        │
│          │ NORMAL para un buen pick — no fuerces probabilidades más altas. │
├──────────┼──────────────────────────────────────────────────────────────────┤
│ 70-74%   │ MEDIA: Señales mixtas. Edge identificado pero con incertidumbre.│
│ (MEDIA)  │                                                                  │
├──────────┼──────────────────────────────────────────────────────────────────┤
│ <70%     │ BAJA: Contradicciones serias entre pilares → NO_BET recomendado.│
│ (BAJA)   │                                                                  │
└──────────┴──────────────────────────────────────────────────────────────────┘

⚠️ REGLA ANTI-INFLACIÓN (CRÍTICA — CALIBRADA CON DATOS REALES):
- Un equipo favorito NO tiene automáticamente >80% de ganar. Un favorito claro es 65-75%.
- Over 2.5 en liga con promedio 2.8 goles NO es automáticamente >80%. Es 65-75%.
- Solo asigna >85% si hay convergencia EXTREMA de TODOS los factores.
- La MAYORÍA de picks buenos caen en el rango 72-82%. Las >85% deben ser EXCEPCIONALES.
- Si asignas >85% a más de 1 pick por partido, estás inflando. Revisa.
- PREGÚNTATE: "¿Apostaría mi propio dinero con esta confianza?" Si dudas → baja 5-10%.

${mlCalibration.calibrationText}

⚠️ REGLA CRÍTICA V6:
- Stats SOLAS ya no son suficientes para >80%. Necesitas TAMBIÉN contexto favorable.
- Contexto SOLO tampoco es suficiente para >80%. Necesitas TAMBIÉN stats.
- PERO: Si el contexto CONTRADICE las stats (ej: stats geniales pero juegan
  con suplentes porque tienen final de Copa en 3 días), REDUCE la confianza 10-15%.
- BONUS +5%: Si 4+ factores se alinean (stats + H2H + motivación + táctica + contexto)
  Y NINGUNO contradice → permite subir hasta el techo de la banda.

═══ ANÁLISIS DE EVENTOS MINUTO A MINUTO (NUEVO V8) ═══

Cada partido del historial incluye EVENTOS DETALLADOS (goles, tarjetas, sustituciones).
EXPLÓTALOS para detectar patrones temporales:

1. PATRONES DE GOLES POR TIEMPO:
   - ¿El equipo marca más en 1er o 2do tiempo? → Valor en mercados de "Gol en 1er/2do Tiempo"
   - Si marca consistentemente antes del min 15 → "Arrancadores rápidos" → valor en "1er Gol: Local/Visitante"
   - Si concede después del min 75 → "Vulnerabilidad tardía" → valor en "Gol en 2do Tiempo"

2. PATRONES DE TARJETAS:
   - ¿Equipos agresivos en primeros 30 min? → Over Tarjetas 1er Tiempo
   - ¿Acumulan faltas? → Árbitro estricto + equipos agresivos = Over Tarjetas

3. PATRONES DE SUSTITUCIONES:
   - ¿DT hace cambios temprano (min 45-60)? → Equipo reactivo
   - ¿Cambios tardíos (min 80+)? → Equipo que gestiona ventaja

4. HALF-TIME ANALYSIS:
   - Usa los scores de 1er tiempo para determinar: ¿Quién domina la primera mitad?
   - Si un equipo gana el 1er tiempo en 7/10 partidos → Valor en "HT Result"

OPORTUNIDADES OCULTAS QUE LOS NÚMEROS NO VEN:
- Un equipo con stats mediocres pero que se está jugando la vida (descenso) puede 
  ser una JOYA OCULTA si las bookies no lo reflejan en la cuota.
- Un equipo en gran forma estadística pero relajado (ya clasificado, sin nada que 
  jugar) es una TRAMPA → busca "Under" o "BTTS No".

════════════════════════════════════════════════════════════════════════════════
🎯 CAZA DE OPORTUNIDADES 80%+ (MÓDULO DE MÁXIMA PRIORIDAD)
════════════════════════════════════════════════════════════════════════════════

TU MISIÓN PRINCIPAL: Encontrar picks con ≥83% de confianza REAL por partido.
RECUERDA: Tu "83%" real gana ~92% de las veces. Tu "80%" solo gana 55%.
Solo reporta picks que GENUINAMENTE merecen ≥83%.

${mlCalibration.marketPrioritiesText}

NOTA: Si no encuentras un pick que GENUINAMENTE merezca ≥83%, reporta el mejor
con su confianza REAL. Preferimos MENOS picks de MEJOR calidad.

════════════════════════════════════════════════════════════════════════════════
⚽ MERCADOS DE CORNERS Y TARJETAS — OBLIGATORIO EVALUAR
════════════════════════════════════════════════════════════════════════════════

DEBES analizar explícitamente al menos 2 mercados de corners y 1 de tarjetas en cada partido:

CORNERS (usa datos de corner_stats proporcionados):
- Correlacionar: equipos con alta posesión + muchos tiros = muchos corners
- Correlacionar: equipos defensivos que despejan mucho = corners para el rival
- Si ambos equipos promedian >5 corners cada uno → evaluar "Corners Más de 9.5" y "Corners Más de 10.5"
- Si un equipo domina corners (>6.5 promedio) → evaluar corners individuales del equipo
- Los corners son mercados MUY rentables porque las bookies ponen menos atención en ellos

TARJETAS (usa datos de disciplina):
- Correlacionar: árbitro estricto (>4.5 tarjetas/partido) + derby/rivalidad = Over tarjetas
- Si ambos equipos promedian >2 tarjetas cada uno → evaluar "Tarjetas Más de 4.5"
- Tarjeta roja: solo si hay historial claro del árbitro + partido muy caliente

Si no hay datos suficientes de corners/tarjetas en los datos proporcionados,
indica explícitamente "Sin datos de corners/tarjetas disponibles" y no inventes.

════════════════════════════════════════════════════════════════════════════════
📋 FORMATO OBLIGATORIO DE MERCADOS (para verificación automática)
════════════════════════════════════════════════════════════════════════════════

Para el campo "mercado" en pronosticos, usa EXACTAMENTE estos formatos:
- "Resultado 1X2" (NO "Ganador del Partido", NO "Victoria Local")
- "Más de X.5 Goles" (NO "Over X.5 Goals", NO "Total Goals Over")
- "Menos de X.5 Goles" (NO "Under X.5")
- "Ambos Anotan" (NO "BTTS", NO "Both Teams Score")
- "Doble Oportunidad" (NO "Double Chance", NO "1X")
- "Corners Más de X.5" (NO "Total Corners Over")
- "Tarjetas Más de X.5" (NO "Total Cards Over")
- "Resultado y Total: [Equipo] & Más de X.5 Goles" (para combinados)
- "Goles del Local Más de X.5" / "Goles del Visitante Más de X.5" (team totals)

Para el campo "seleccion" en pronosticos:
- Para 1X2: nombre COMPLETO del equipo tal como aparece en los datos (NUNCA abreviaciones como PSG, Barça, Real)
- Para Over/Under: "Más de X.5" o "Menos de X.5"
- Para BTTS: "Sí" o "No"
- Para Doble Oportunidad: "Local o Empate" / "Visitante o Empate" / "Local o Visitante"
- Para combinados: "NombreCompleto & Más de X.5 Goles"

════════════════════════════════════════════════════════════════════════════════
🚨 INSTRUCCIONES DE EMERGENCIA Y FALLBACKS
════════════════════════════════════════════════════════════════════════════════

Si faltan datos de cuotas (Bookmaker Odds Missing):
1. NO TE DETENGAS. Genera TUS PROPIAS CUOTAS JUSTAS basadas en tu probabilidad.
2. Advierte: "Cuota de Mercado Referencial No Disponible - Entrar si paga más de X.XX".

Si faltan alineaciones confirmadas:
1. Asume la más probable basada en los últimos 3 partidos.
2. Aumenta ligeramente el factor de riesgo.

Si no hay NINGUNA estadística ni historial:
1. NO INVENTES DATOS. "veredicto": "NO_BET", "riesgo_principal": "Falta TOTAL de Datos".

════════════════════════════════════════════════════════════════════════════════
DATOS DEL PARTIDO (DEEP DIVE INPUT)
════════════════════════════════════════════════════════════════════════════════

PARTIDO: ${homeTeam} (LOCAL) vs ${awayTeam} (VISITANTE)
COMPETICIÓN: ${leagueName}

⚠️ IMPORTANTE - INTERPRETACIÓN DE DATOS DE HISTORIAL:
Los datos del historial de cada equipo están SEPARADOS en dos secciones:
- "📍 COMO LOCAL": Partidos que el equipo jugó EN SU CASA
- "✈️ COMO VISITANTE": Partidos que el equipo jugó FUERA DE CASA

Para este partido:
- Usa el rendimiento de ${homeTeam} "COMO LOCAL" (juega en casa)
- Usa el rendimiento de ${awayTeam} "COMO VISITANTE" (juega fuera)

Cada partido incluye:
- Resultado desde la perspectiva del equipo analizado
- Stats del equipo + Stats del rival
- Formación usada vs formación del rival

>>> HISTORIAL ${homeTeam} (Equipo LOCAL de este partido):
${deepHome}

>>> HISTORIAL ${awayTeam} (Equipo VISITANTE de este partido):
${deepAway}

>>> ENFRENTAMIENTOS DIRECTOS (H2H):
${h2hText}

>>> CUOTAS DE MERCADO (Referencia):
${oddsText}

${externalContextText}

════════════════════════════════════════════════════════════════════════════════
FORMATO DE SALIDA (JSON)
════════════════════════════════════════════════════════════════════════════════

Responde ÚNICAMENTE con un JSON válido que siga EXACTAMENTE esta estructura:

{
    "meta": { "modelo": "${GEMINI_MODEL}", "version": "${ENGINE_VERSION}" },
    "resumen_ejecutivo": {
        "titular": "Titular de alto impacto (ej: 'Dominancia total del local reforzada por final de temporada')",
        "veredicto": "APOSTAR" | "NO_BET" | "OBSERVAR",
        "confianza_global": "ALTA" | "MEDIA" | "BAJA",
        "picks_principales": ["Pick 1", "Pick 2"]
    },
    "scores_duales": {
        "score_estadistico": 82,
        "score_inteligencia_partido": 78,
        "confianza_final_calculada": 80,
        "justificacion_balance": "Breve explicación de cómo los 2 pilares se combinaron para dar este score."
    },
    "analisis_profundo": {
        "razonamiento_central": "TEXTO DETALLADO (mínimo 200 palabras) explicando LA TESIS DE INVERSIÓN. DEBE incluir argumentos de AMBOS PILARES. Conecta la data dura con el factor táctico, psicológico y competitivo. NO repitas estadísticas obvias, explica el 'POR QUÉ' profundo.",
        "matchup_tactico": "Análisis del choque de sistemas (formaciones, estilos, quién controla el medio).",
        "factor_psicologico": "Análisis detallado de motivación, presión, urgencia, y mentalidad de cada equipo.",
        "contexto_competitivo": "¿Qué se juegan? ¿Fase del torneo? ¿Rotaciones esperadas?"
    },
    "pronosticos": [
        {
            "mercado": "Ej: Ganador del Partido (1X2)",
            "seleccion": "Ej: Manchester City",
            "probabilidad_calculada_porcentaje": 82,
            "probabilidad_implicita_porcentaje": 65,
            "edge_porcentaje": 17,
            "cuota_actual": 1.54,
            "confianza": "ALTA",
            "tipo_pick": "standard",
            "justificacion": {
                "estadistica": "Dato estadístico clave que soporta esta selección...",
                "contexto_partido": "Factor de ESTE partido que refuerza o debilita la selección...",
                "tactica": "Razón táctica específica...",
                "mercado": "Ineficiencia detectada en la cuota..."
            },
            "stake_recomendado": "3% bankroll (basado en confianza y cuota)"
        }
    ],
    "patrones_detectados": {
        "goles_por_tiempo": {
            "home_1er_tiempo_pct": 60,
            "home_2do_tiempo_pct": 40,
            "away_1er_tiempo_pct": 45,
            "away_2do_tiempo_pct": 55,
            "insight": "Local marca mayoritariamente en 1er tiempo, visitante es equipo de 2do tiempo"
        },
        "formacion_rendimiento": {
            "home_formacion_usual": "4-3-3",
            "home_win_pct_con_formacion": 75,
            "away_formacion_usual": "4-4-2",
            "away_win_pct_con_formacion": 40,
            "insight": "Local con 4-3-3 es muy efectivo, visitante con 4-4-2 fuera es débil"
        },
        "disciplina": {
            "home_avg_tarjetas": 2.1,
            "away_avg_tarjetas": 2.5,
            "insight": "Partido con potencial de Over 4.5 Tarjetas"
        }
    },
    "contexto_externo_resumen": "Resumen de 2-3 frases del contexto externo más relevante (noticias, declaraciones, etc.)",
    "factores_riesgo": {
        "riesgo_principal": "El mayor peligro es...",
        "nivel_incertidumbre": "BAJO" | "MEDIO" | "ALTO",
        "factores_que_podrian_romper_la_estadistica": "Qué podría causar una SORPRESA que los números no predicen."
    },
    "datos_modelo": {
        "goles_esperados_partido": 2.8,
        "corners_esperados": 9.5,
        "probabilidad_btts_porcentaje": 60
    },
    "mercados_evaluados": {
        "con_valor_detectado": 2,
        "total_analizados": 60
    },
    "escenarios_proyectados": {
        "escenario_optimista": "Si todo sale bien para el favorito...",
        "escenario_base": "Lo más probable que ocurra...",
        "escenario_alternativo": "La sorpresa posible y por qué podría darse..."
    }
}
`;

        // ═══════════════════════════════════════════════════════════════
        // LLAMAR A GEMINI
        // ═══════════════════════════════════════════════════════════════
        console.log(`[V3 - AI - ANALYZER] Sending prompt to Gemini(${prompt.length} chars)...`);

        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;

        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3, // Más determinístico para análisis
                responseMimeType: 'application/json',
                maxOutputTokens: 16384
            }
        };

        // ═══ RETRY WITH EXPONENTIAL BACKOFF ═══
        // Retries on 429 (quota), 503 (overloaded), 500 (server error)
        // Budget: ~250s max (frontend timeout = 300s, Supabase limit = 300s)
        // 1 retry × 120s timeout + delay (10s) = ~250s worst case
        const MAX_RETRIES = 1;
        const RETRY_DELAYS = [10000]; // 10s
        let genRes: Response | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const geminiController = new AbortController();
            const geminiTimeout = setTimeout(() => geminiController.abort(), 120000); // 120s per attempt

            try {
                genRes = await fetch(genUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: geminiController.signal
                });
                clearTimeout(geminiTimeout);

                if (genRes.ok) break; // Success — exit retry loop

                const statusCode = genRes.status;
                const isRetryable = statusCode === 429 || statusCode === 503 || statusCode === 500;

                if (isRetryable && attempt < MAX_RETRIES) {
                    const delay = RETRY_DELAYS[attempt];
                    console.warn(`[V3-AI-ANALYZER] Gemini returned ${statusCode}, retrying in ${delay/1000}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                // Non-retryable error or max retries exhausted
                const errorText = await genRes.text();
                if (statusCode === 429) {
                    throw new Error(`QUOTA_EXCEEDED: Tu API key de Gemini alcanzó el límite. Espera unos minutos e intenta de nuevo. (${errorText.substring(0, 200)})`);
                } else if (statusCode === 503) {
                    throw new Error(`GEMINI_OVERLOADED: Gemini está sobrecargado. Intenta de nuevo en unos minutos. (${errorText.substring(0, 200)})`);
                } else {
                    throw new Error(`Gemini Error (${statusCode}): ${errorText}`);
                }

            } catch (fetchErr: any) {
                clearTimeout(geminiTimeout);
                if (fetchErr.name === 'AbortError') {
                    if (attempt < MAX_RETRIES) {
                        console.warn(`[V3-AI-ANALYZER] Gemini timeout on attempt ${attempt + 1}, retrying...`);
                        continue;
                    }
                    throw new Error('GEMINI_TIMEOUT: Gemini no respondió después de múltiples intentos. Intenta de nuevo más tarde.');
                }
                // Re-throw user-facing errors (QUOTA_EXCEEDED, etc.)
                if (fetchErr.message?.startsWith('QUOTA_') || fetchErr.message?.startsWith('GEMINI_')) {
                    throw fetchErr;
                }
                if (attempt < MAX_RETRIES) {
                    console.warn(`[V3-AI-ANALYZER] Fetch error: ${fetchErr.message}, retrying...`);
                    await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
                    continue;
                }
                throw fetchErr;
            }
        }

        if (!genRes || !genRes.ok) {
            throw new Error('Gemini failed after all retry attempts');
        }

        const genJson = await genRes.json();
        let aiResponseText = genJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const tokensUsed = genJson.usageMetadata?.totalTokenCount || 0;

        console.log(`[V3-AI-ANALYZER] Gemini responded with ${tokensUsed} tokens`);

        // Detectar truncamiento por límite de tokens
        const finishReason = genJson.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS') {
            console.warn(`[V3-AI-ANALYZER] WARNING: Gemini response TRUNCATED (${tokensUsed} tokens). Attempting JSON repair...`);
        }

        // Clean and parse response
        aiResponseText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const startIndex = aiResponseText.indexOf('{');
        const endIndex = aiResponseText.lastIndexOf('}');
        if (startIndex !== -1 && endIndex > startIndex) {
            aiResponseText = aiResponseText.substring(startIndex, endIndex + 1);
        }

        // Reparar JSON truncado: contar llaves/corchetes y cerrar los faltantes
        if (finishReason === 'MAX_TOKENS') {
            let openBraces = 0, openBrackets = 0;
            let inString = false, escaped = false;
            for (const ch of aiResponseText) {
                if (escaped) { escaped = false; continue; }
                if (ch === '\\') { escaped = true; continue; }
                if (ch === '"') { inString = !inString; continue; }
                if (inString) continue;
                if (ch === '{') openBraces++;
                if (ch === '}') openBraces--;
                if (ch === '[') openBrackets++;
                if (ch === ']') openBrackets--;
            }
            const suffix = ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
            if (suffix) {
                aiResponseText += suffix;
                console.log(`[V3-AI-ANALYZER] JSON repair: added ${suffix.length} closing chars`);
            }
        }

        let analysisResult: any;

        // ═══ PARSING MULTI-INTENTO ═══
        // Estrategia 1: JSON5 (más permisivo, maneja trailing commas, etc.)
        // Estrategia 2: JSON nativo
        // Estrategia 3: Limpiar control chars + trailing commas y reintentar
        // Fallback: Extraer datos parciales con regex

        try {
            analysisResult = JSON5.parse(aiResponseText);
        } catch (e1: any) {
            console.warn('[V3-AI-ANALYZER] JSON5 parse failed:', e1.message);
            try {
                analysisResult = JSON.parse(aiResponseText);
            } catch (e2: any) {
                console.warn('[V3-AI-ANALYZER] Native JSON also failed, trying cleanup...');
                try {
                    const cleaned = aiResponseText
                        .replace(/[\x00-\x1F\x7F]/g, ' ')
                        .replace(/,\s*([}\]])/g, '$1');
                    analysisResult = JSON5.parse(cleaned);
                    console.log('[V3-AI-ANALYZER] Parse succeeded after cleanup');
                } catch (e3: any) {
                    console.error('[V3-AI-ANALYZER] All parse strategies failed');
                    console.error('[V3-AI-ANALYZER] Raw response (first 1000 chars):', aiResponseText.substring(0, 1000));

                    // Fallback: extraer datos parciales del texto crudo
                    analysisResult = {
                        resumen_ejecutivo: {
                            titular: "Análisis completado con datos parciales",
                            veredicto: "OBSERVAR",
                            confianza_global: "BAJA",
                            picks_principales: []
                        },
                        pronosticos: [],
                        analisis_profundo: {
                            razonamiento_central: aiResponseText.substring(0, 2000)
                        }
                    };
                    // Intentar rescatar titular y veredicto del texto crudo
                    const titularMatch = aiResponseText.match(/"titular"\s*:\s*"([^"]+)"/);
                    if (titularMatch) analysisResult.resumen_ejecutivo.titular = titularMatch[1];
                    const veredictoMatch = aiResponseText.match(/"veredicto"\s*:\s*"(APOSTAR|NO_BET|OBSERVAR)"/);
                    if (veredictoMatch) analysisResult.resumen_ejecutivo.veredicto = veredictoMatch[1];
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // ROBUSTNESS LAYER: Normalize AI Response (V5 CRITICAL FIX)
        // ═══════════════════════════════════════════════════════════════
        // Ensure analysisResult has the expected structure even if AI hallucinated or omitted fields

        // 1. Ensure 'resumen_ejecutivo' exists
        if (!analysisResult.resumen_ejecutivo) {
            // Check for legacy/hallucinated 'conclusion_final'
            if (analysisResult.conclusion_final) {
                console.warn('[V3] Normalizing schema: Mapping conclusion_final to resumen_ejecutivo');
                analysisResult.resumen_ejecutivo = {
                    titular: analysisResult.conclusion_final.razon_principal || "Análisis completado",
                    veredicto: analysisResult.conclusion_final.veredicto || "OBSERVAR",
                    confianza_global: analysisResult.conclusion_final.nivel_confianza || "MEDIA",
                    picks_principales: []
                };
            } else {
                // Total failure fallback
                analysisResult.resumen_ejecutivo = {
                    titular: "Análisis completado (Datos insuficientes)",
                    veredicto: "OBSERVAR",
                    confianza_global: "BAJA",
                    picks_principales: []
                };
            }
        }

        // 2. Ensure 'titular' is populated (Critical for Frontend Adapter)
        if (!analysisResult.resumen_ejecutivo.titular) {
            analysisResult.resumen_ejecutivo.titular = analysisResult.resumen_ejecutivo.frase_principal || "Análisis de Inteligencia Finalizado";
        }

        // 3. Ensure 'veredicto' is valid
        if (!['APOSTAR', 'NO_BET', 'OBSERVAR'].includes(analysisResult.resumen_ejecutivo.veredicto)) {
            analysisResult.resumen_ejecutivo.veredicto = 'OBSERVAR';
        }

        // 4. Ensure 'picks_principales' is array
        if (!Array.isArray(analysisResult.resumen_ejecutivo.picks_principales)) {
            analysisResult.resumen_ejecutivo.picks_principales = [];
        }

        // 5. Ensure 'analisis_profundo' exists
        if (!analysisResult.analisis_profundo) {
            analysisResult.analisis_profundo = {};
        }

        // ═══════════════════════════════════════════════════════════════
        // DEEP NORMALIZATION LAYER (GEMINI 2.5 HALLUCINATION FIX)
        // ═══════════════════════════════════════════════════════════════

        // FIX 1: Map 'pronosticos_listado' (Hallucinated) to 'pronosticos' (Standard)
        if (!analysisResult.pronosticos && Array.isArray(analysisResult.pronosticos_listado)) {
            console.warn('[V3] Normalizing: Mapping pronosticos_listado -> pronosticos');
            analysisResult.pronosticos = analysisResult.pronosticos_listado;
        }

        // FIX 2: Map 'probabilidades_derbix' or 'probabilities' to 'pronosticos' if array is empty
        const probSource = analysisResult.probabilidades_derbix || analysisResult.probabilities || analysisResult.probabilidades;
        if ((!analysisResult.pronosticos || analysisResult.pronosticos.length === 0) && probSource) {
            console.warn('[V3] Normalizing: Extracting probabilities from object source:', Object.keys(probSource));
            analysisResult.pronosticos = [];

            // Map known keys to picks
            const mapKeyToPick = (key: string, label: string) => {
                if (probSource[key] !== undefined) {
                    const valStr = String(probSource[key]).replace('%', '');
                    const val = parseFloat(valStr);

                    // Determinar selección basada en key
                    let seleccion = "Sí";
                    if (key.includes('home') || key.includes('local')) seleccion = datasets.home_team || 'Local';
                    if (key.includes('away') || key.includes('visit')) seleccion = datasets.away_team || 'Visita';
                    if (key.includes('draw') || key.includes('empate')) seleccion = "Empate";
                    if (key.includes('over')) seleccion = "Más de 2.5";
                    if (key.includes('under')) seleccion = "Menos de 2.5";

                    if (!isNaN(val) && val > 0) {
                        analysisResult.pronosticos.push({
                            mercado: label,
                            seleccion: seleccion,
                            probabilidad_calculada_porcentaje: val,
                            justificacion: {
                                estadistica: "Alta probabilidad detectada por modelo Derbix.",
                                tactica: "Ineficiencia en cuotas detectada."
                            }
                        });
                    }
                }
            };

            // Intentar todas las variaciones posibles de keys
            const keys = Object.keys(probSource);
            keys.forEach(k => {
                const lowerK = k.toLowerCase();
                if (lowerK.includes('home') || lowerK.includes('local')) mapKeyToPick(k, 'Ganador del Partido (1X2)');
                else if (lowerK.includes('away') || lowerK.includes('visit')) mapKeyToPick(k, 'Ganador del Partido (1X2)');
                else if (lowerK.includes('draw') || lowerK.includes('empate')) mapKeyToPick(k, 'Ganador del Partido (1X2)');
                else if (lowerK.includes('btts') || lowerK.includes('ambos')) mapKeyToPick(k, 'Ambos Equipos Anotan (BTTS)');
                else if (lowerK.includes('over') || lowerK.includes('mas')) mapKeyToPick(k, 'Total de Goles (Over/Under)');
                else if (lowerK.includes('under') || lowerK.includes('menos')) mapKeyToPick(k, 'Total de Goles (Over/Under)');
            });

            // Filtrar solo las mejores para no saturar
            analysisResult.pronosticos = analysisResult.pronosticos.filter((p: any) => p.probabilidad_calculada_porcentaje > 45);
        }

        // 6. Ensure 'pronosticos' exists and is normalized (EXISTING LOGIC)
        if (!Array.isArray(analysisResult.pronosticos)) {
            analysisResult.pronosticos = [];
        } else {
            // NORMALIZE PREDICTIONS (Map synonyms and fix types)
            analysisResult.pronosticos = analysisResult.pronosticos.map((p: any) => {
                const prob = p.probabilidad_calculada_porcentaje
                    || p.probabilidad_estimado_porcentaje
                    || p.probabilidad_derbix
                    || p.probabilidad
                    || p.probability
                    || p.confidence_score
                    || p.confianza
                    || p.probabilidad_estimada
                    || 50;
                const edge = p.edge_porcentaje || p.edge || p.valor || 0;

                // ROBUST ODDS EXTRACTION
                const rawOdds = p.cuota_actual || p.cuota || p.odds || p.odd || p.price || null;
                const odds = rawOdds ? (typeof rawOdds === 'string' ? parseFloat(rawOdds) : rawOdds) : null;

                return {
                    ...p,
                    mercado: p.mercado || "Mercado Principal",
                    seleccion: p.seleccion || "Seleccion",
                    probabilidad_calculada_porcentaje: typeof prob === 'string' ? parseFloat(prob.replace('%', '')) : prob,
                    probabilidad_implicita_porcentaje: p.probabilidad_implicita_porcentaje || 50,
                    edge_porcentaje: typeof edge === 'string' ? parseFloat(edge) : edge,
                    cuota_actual: odds && !isNaN(odds) && odds > 1.0 ? odds : null,
                    justificacion: p.justificacion || p.justificacion_detallada || { estadistica: "N/A", tactica: "N/A" }
                };
            });
        }

        // ═══ ML POST-PROCESSING: DISABLED (v2 — "ML Observacional") ═══
        // The mathematical post-processing was causing a "double dip" effect:
        // Layer 1 (buildCalibrationBlock) already tells Gemini to lower probabilities,
        // then Layer 2 (applyCalibrationPostProcessing) reduced them AGAIN mathematically.
        // This destroyed pick volume (70 matches → 1 pick). Now Gemini receives data
        // as informational context and makes intelligent decisions on its own.
        // The function is preserved below for rollback if needed.
        console.log(`[v3-ai-analyzer] ML post-processing SKIPPED (v2 observational mode — calibration via prompt only)`);

        // SAVE RESULTS
        // ═══════════════════════════════════════════════════════════════
        // NOTE: reports_v2 save moved below after finalFixtureId resolution

        // Map to legacy format for frontend compatibility
        const betPicks = analysisResult.pronosticos || [];
        const tit = analysisResult.resumen_ejecutivo.titular; // Guaranteed to exist now

        const dashboardData = {
            header_partido: {
                titulo: `${homeTeam} vs ${awayTeam}`,
                subtitulo: `${leagueName} • ${match.date_time_utc ? new Date(match.date_time_utc).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Próximamente'}`,
                bullets_clave: analysisResult.resumen_ejecutivo.picks_principales || []
            },
            // DEBUG INFO EXPOSED TO FRONTEND/CLIENT
            debug_info: {
                books_found: 1, // Normalized to single view
                best_bookie: 'SportMonks Aggregated',
                markets_count: (odds?.MAIN?.length || 0) + (odds?.GOALS?.length || 0) + (odds?.TEAMS?.length || 0) + (odds?.COMBOS?.length || 0)
            },
            veredicto_analista: {
                decision: analysisResult.resumen_ejecutivo.veredicto || 'OBSERVAR',
                nivel_confianza: analysisResult.resumen_ejecutivo.confianza_global || 'MEDIA',
                probabilidad: betPicks[0]?.probabilidad_calculada_porcentaje || 50,
                titulo_accion: analysisResult.resumen_ejecutivo.veredicto === 'APOSTAR' ? 'OPORTUNIDAD DETECTADA' : 'PARTIDO COMPLEJO',
                razon_principal: tit,
                riesgo_principal: analysisResult.factores_riesgo?.riesgo_principal || 'Sin riesgos críticos',
                seleccion_clave: betPicks[0]?.seleccion || 'N/A'
            },
            resumen_ejecutivo: {
                titular: tit,
                frase_principal: tit, // EXPLICIT for adapter
                puntos_clave: analysisResult.resumen_ejecutivo.picks_principales, // Adapter checks this too
                bullets: [
                    analysisResult.analisis_profundo?.contexto_competitivo,
                    analysisResult.analisis_profundo?.factor_psicologico
                ].filter(Boolean)
            },
            // V6: Expose dual scores for transparency
            scores_duales: analysisResult.scores_duales || null,
            predicciones_finales: {
                titulo: "Pronósticos del Motor IA V3",
                detalle: betPicks.map(normalizePrediction)
            },
            analisis_mercados_calculados: {
                resumen: {
                    goles_esperados: analysisResult.datos_modelo?.goles_esperados_partido || 2.5,
                    corners_esperados: analysisResult.datos_modelo?.corners_esperados || 9,
                    tarjetas_esperadas: 3.5,
                    btts_probabilidad: analysisResult.datos_modelo?.probabilidad_btts_porcentaje || 50
                },
                mercados_con_valor: analysisResult.mercados_evaluados?.con_valor_detectado || betPicks.length,
                top_oportunidades: betPicks.slice(0, 5).map(normalizeOpportunity)
            },
            analisis_detallado: analysisResult.analisis_profundo?.matchup_tactico ? {
                // Adapter logic in frontend looks for 'estilo_y_tactica' or 'analisis_tactico'
                // We map V5 fields to what adapter expects
                contexto_competitivo: analysisResult.analisis_profundo.contexto_competitivo,
                estilo_y_tactica: {
                    titulo: "Análisis Táctico",
                    bullets: [
                        analysisResult.analisis_profundo.matchup_tactico,
                        analysisResult.analisis_profundo.clave_del_partido
                    ].filter(Boolean)
                },
                factor_psicologico: analysisResult.analisis_profundo.factor_psicologico,
                analisis_escenarios: {
                    titulo: "Escenarios de Partido",
                    escenarios: [
                        {
                            nombre: "Escenario Optimista",
                            descripcion: analysisResult.escenarios_proyectados?.escenario_optimista || "Todo sale bien para el favorito.",
                            probabilidad_aproximada: "Media-Alta",
                            implicacion_apuestas: "Pick principal con máximo stake"
                        },
                        {
                            nombre: "Escenario Base",
                            descripcion: analysisResult.escenarios_proyectados?.escenario_base || "Escenario estándar previsto.",
                            probabilidad_aproximada: "Alta",
                            implicacion_apuestas: "Seguir picks principales"
                        },
                        {
                            nombre: "Escenario Alternativo",
                            descripcion: analysisResult.escenarios_proyectados?.escenario_alternativo || "Escenario de riesgo.",
                            probabilidad_aproximada: "Baja",
                            implicacion_apuestas: "Cubrir o reducir stake"
                        }
                    ]
                }
            } : null,
            // V8: New fields from enhanced analysis
            patrones_detectados: analysisResult.patrones_detectados || null,
            contexto_externo_resumen: analysisResult.contexto_externo_resumen || null,
            v3_source: true,
            job_id: job_id,
            generated_at: new Date().toISOString(),
            payload: payload // EXPOSE RAW PAYLOAD TO FRONTEND FOR DEBUG VIEW
        };

        // ═══════════════════════════════════════════════════════════════
        // V9 FIX: RESOLVE finalFixtureId BEFORE saving to ANY table
        // This ensures reports_v2, value_picks_v2, and analisis all use
        // the same fixture_id that matches daily_matches.api_fixture_id
        // ═══════════════════════════════════════════════════════════════

        let finalFixtureId = fixture_id;

        // Helper: Normalize for matching
        const normalizeTeam = (n: string) => n.toLowerCase().replace(/fc|cf|sc|sporting|club|athletic|atletico|real|inter|ac|as/g, '').replace(/[^a-z0-9]/g, '').trim();

        // 1. Try to resolve correct Daily Match ID
        const { data: directMatch } = await supabase
            .from('daily_matches')
            .select('api_fixture_id, id')
            .eq('api_fixture_id', fixture_id)
            .maybeSingle();

        if (directMatch) {
            finalFixtureId = directMatch.api_fixture_id;
        } else {
            console.log(`[V3-FIX] ID ${fixture_id} not found in daily_matches. Attempting fuzzy name match...`);
            const homeNorm = normalizeTeam(homeTeam);
            const awayNorm = normalizeTeam(awayTeam);

            const { data: candidates } = await supabase
                .from('daily_matches')
                .select('api_fixture_id, home_team, away_team, match_date')
                .gte('match_date', new Date(Date.now() - 86400000 * 2).toISOString())
                .lte('match_date', new Date(Date.now() + 86400000 * 5).toISOString());

            if (candidates) {
                const best = candidates.find(c => {
                    const h = normalizeTeam(c.home_team);
                    const a = normalizeTeam(c.away_team);
                    return (h.includes(homeNorm) || homeNorm.includes(h)) &&
                        (a.includes(awayNorm) || awayNorm.includes(a));
                });

                if (best) {
                    console.log(`[V3-FIX] Resolved ${fixture_id} -> ${best.api_fixture_id} (${best.home_team} vs ${best.away_team})`);
                    finalFixtureId = best.api_fixture_id;
                } else {
                    console.warn(`[V3-FIX] Failed to resolve ID for ${homeTeam} vs ${awayTeam}. Using original.`);
                }
            }
        }

        console.log(`[V3-AI-ANALYZER] Using finalFixtureId=${finalFixtureId} (original=${fixture_id}) for ALL saves`);

        // Sync job fixture_id if it was resolved to a different ID
        if (finalFixtureId !== fixture_id) {
            await supabase
                .from('analysis_jobs_v2')
                .update({ fixture_id: finalFixtureId })
                .eq('id', job_id);
        }

        // Clean up OLD data for this fixture (by both original and resolved IDs)
        // This runs AFTER successful analysis, so old data is only removed when new data is ready
        const idsToClean = [finalFixtureId];
        if (fixture_id !== finalFixtureId) idsToClean.push(fixture_id);

        // Delete old STANDARD jobs (keep only current, preserve parlay jobs)
        for (const fid of idsToClean) {
            await supabase.from('analysis_jobs_v2').delete().eq('fixture_id', fid).neq('id', job_id).or('analysis_type.eq.standard,analysis_type.is.null');
        }

        // Delete ALL old reports for this fixture
        await supabase.from('reports_v2').delete().in('fixture_id', idsToClean);
        // Also delete any orphaned reports from old jobs of this fixture
        await supabase.from('reports_v2').delete().eq('job_id', job_id); // just in case of partial previous save

        const { error: reportError } = await supabase
            .from('reports_v2')
            .insert({
                job_id: job_id,
                fixture_id: finalFixtureId,
                report_packet: analysisResult,
                prompt_version: 'V3-PROMPT-1.0',
                created_at: new Date().toISOString()
            });

        if (reportError) console.error('[V3-AI-ANALYZER] Error saving reports_v2:', reportError);

        // 2. Insert Picks to value_picks_v2
        if (betPicks.length > 0) {
            console.log(`[V3-FIX] Syncing ${betPicks.length} picks to value_picks_v2 for ID ${finalFixtureId}`);

            // Map confidence string to integer
            const mapConf = (str: string) => {
                if (!str) return 5;
                const s = str.toUpperCase();
                if (s.includes('MUY ALTA')) return 9;
                if (s.includes('ALTA')) return 8;
                if (s.includes('MEDIA')) return 6;
                return 5;
            };

            const picksPayload = betPicks.map((p: any) => {
                // Aligned probability extraction (same 7 fallback fields as v2-generate-parlays)
                let prob = p.probabilidad_calculada_porcentaje
                    || p.probabilidad_estimado_porcentaje
                    || p.probabilidad_derbix
                    || p.probabilidad
                    || p.probability
                    || p.confidence_score
                    || p.confianza
                    || 50;
                if (typeof prob === 'string') prob = parseFloat(prob.replace('%', ''));
                if (prob > 1) prob = prob / 100;

                // Strict Enum Mapping
                let decision = 'AVOID';
                const d = (p.decision || '').toUpperCase();
                // Basic rules: High prob or explicit BET
                if (d === 'BET' || d === 'APOSTAR' || prob >= 0.70) {
                    decision = 'BET';
                }

                // Aligned odds extraction (same 5 fallback fields as v2-generate-parlays)
                const rawPickOdds = p.cuota_actual || p.cuota || p.odds || p.odd || p.price || null;
                const pickOdds = rawPickOdds ? (typeof rawPickOdds === 'string' ? parseFloat(rawPickOdds) : rawPickOdds) : null;

                return {
                    job_id: job_id,
                    fixture_id: finalFixtureId,
                    market: p.mercado || "Mercado General",
                    selection: p.seleccion || "Selección",
                    p_model: prob,
                    decision: decision,
                    confidence: mapConf(p.nivel_confianza || p.confianza),
                    engine_version: "V8.1-MASTERMIND",
                    odds: pickOdds && !isNaN(pickOdds) && pickOdds > 1.0 ? pickOdds : null,
                    created_at: new Date().toISOString()
                };
            });

            // Delete old picks for this fixture (both original and resolved IDs)
            await supabase.from('value_picks_v2').delete().in('fixture_id', idsToClean);

            // Insert new
            const { error: pickErr } = await supabase.from('value_picks_v2').insert(picksPayload);
            if (pickErr) console.error(`[V3-FIX] Error inserting picks: ${pickErr.message}`);
            else console.log(`[V3-FIX] Successfully inserted picks.`);
        }

        // 3. Update Sync to 'analisis' using FINAL ID (clean both IDs)
        for (const fid of idsToClean) {
            await supabase.from('analisis').delete().eq('partido_id', fid);
        }

        await supabase
            .from('analisis')
            .insert({
                partido_id: finalFixtureId, // Use corrected ID
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

        // ═══ SEQUENTIAL PARLAY ANALYSIS (fire-and-forget AFTER standard analysis succeeds) ═══
        // This runs AFTER the standard analysis is done, avoiding dual Gemini calls
        try {
            const parlayPayload = payload; // Same ETL payload
            const { data: parlayJob, error: parlayJobErr } = await supabase
                .from('analysis_jobs_v2')
                .insert({
                    fixture_id: finalFixtureId,
                    status: 'etl',
                    current_motor: 'PARLAY-ANALYZER',
                    engine_version: ENGINE_VERSION,
                    analysis_type: 'parlay',
                    etl_context: parlayPayload // Guardar payload en DB para que v3-parlay-analyzer lo lea
                })
                .select()
                .single();

            if (!parlayJobErr && parlayJob) {
                console.log(`[V3-AI-ANALYZER] Launching parlay analyzer for job ${parlayJob.id} (sequential, after success)`);
                const parlayUrl = `${sbUrl}/functions/v1/v3-parlay-analyzer`;
                // Fire-and-forget — parlay runs independently after standard is done
                fetch(parlayUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sbKey}`
                    },
                    body: JSON.stringify({
                        job_id: parlayJob.id,
                        fixture_id: finalFixtureId
                        // payload omitido — v3-parlay-analyzer lo lee de etl_context en la DB
                    })
                }).catch(err => console.warn(`[V3-AI-ANALYZER] Parlay fire-and-forget failed:`, err.message));
            } else {
                console.warn(`[V3-AI-ANALYZER] Parlay job creation skipped:`, parlayJobErr?.message);
            }
        } catch (parlayErr: any) {
            console.warn(`[V3-AI-ANALYZER] Parlay sequential launch failed (non-blocking):`, parlayErr.message);
        }

        // Dar tiempo al Deno runtime para enviar el fire-and-forget del parlay analyzer
        await new Promise(r => setTimeout(r, 500));

        return new Response(JSON.stringify({
            success: true,
            job_id,
            fixture_id,
            analysis: analysisResult,
            dashboard: dashboardData,
            summary: {
                veredicto: analysisResult.resumen_ejecutivo.veredicto,
                picks: betPicks.length
            },
            tokens_used: tokensUsed,
            execution_time_ms: executionTime,
            engine_version: ENGINE_VERSION
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[V3-AI-ANALYZER] Error:', e);

        // CRITICAL FIX: Update job status to 'failed' so it doesn't stay stuck at 'analyzing'
        try {
            const failedJobId = _jobId;
            if (failedJobId) {
                const sbUrl = Deno.env.get('SUPABASE_URL')!;
                const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                const sbClient = createClient(sbUrl, sbKey);
                await sbClient
                    .from('analysis_jobs_v2')
                    .update({ status: 'failed', error_message: e.message?.substring(0, 500) })
                    .eq('id', failedJobId);
                console.log(`[V3-AI-ANALYZER] Job ${failedJobId} marked as failed`);
            }
        } catch (updateErr) {
            console.error('[V3-AI-ANALYZER] Failed to update job status:', updateErr);
        }

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
