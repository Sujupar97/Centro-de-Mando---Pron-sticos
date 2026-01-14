// supabase/functions/v2-value-engine/index.ts
// MOTOR D: Value Engine / Juez
// Propósito: Decidir BET/WATCH/AVOID basado en edge vs odds

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

const ENGINE_VERSION = '2.0.0';

// Umbrales por mercado - FASE 2: RELAJADOS para más diversidad
// (más varianza = más edge requerido)
const DEFAULT_THRESHOLDS: Record<string, { min_edge: number; min_confidence: number }> = {
    // Goles totales
    'over_0.5_goals': { min_edge: 0.005, min_confidence: 50 },   // Casi seguro
    'over_1.5_goals': { min_edge: 0.01, min_confidence: 50 },    // RELAJADO
    'over_2.5_goals': { min_edge: 0.015, min_confidence: 50 },   // RELAJADO
    'over_3.5_goals': { min_edge: 0.02, min_confidence: 50 },
    'over_4.5_goals': { min_edge: 0.03, min_confidence: 50 },
    'over_5.5_goals': { min_edge: 0.04, min_confidence: 50 },
    'under_2.5_goals': { min_edge: 0.015, min_confidence: 50 },
    // BTTS
    'btts_yes': { min_edge: 0.02, min_confidence: 45 },          // RELAJADO
    'btts_no': { min_edge: 0.02, min_confidence: 45 },
    // 1X2 - FASE 2: UMBRALES BAJOS
    '1x2_home': { min_edge: 0.01, min_confidence: 50 },          // ANTES: 0.04
    '1x2_draw': { min_edge: 0.02, min_confidence: 45 },          // ANTES: 0.05
    '1x2_away': { min_edge: 0.01, min_confidence: 50 },          // ANTES: 0.04
    // FASE 2: DOBLE OPORTUNIDAD (umbrales bajos, mercado conservador)
    'double_chance_1x': { min_edge: 0.005, min_confidence: 50 },
    'double_chance_x2': { min_edge: 0.005, min_confidence: 50 },
    'double_chance_12': { min_edge: 0.005, min_confidence: 50 },
    // FASE 2: HANDICAPS
    'handicap_home_-0.5': { min_edge: 0.01, min_confidence: 50 },
    'handicap_home_-1.5': { min_edge: 0.02, min_confidence: 50 },
    'handicap_away_+0.5': { min_edge: 0.01, min_confidence: 50 },
    // FASE 2: GOLES POR EQUIPO
    'home_over_0.5': { min_edge: 0.01, min_confidence: 50 },
    'home_over_1.5': { min_edge: 0.02, min_confidence: 50 },
    'away_over_0.5': { min_edge: 0.01, min_confidence: 50 },
    'away_over_1.5': { min_edge: 0.02, min_confidence: 50 },
    // Corners
    'corners_over_8.5': { min_edge: 0.03, min_confidence: 45 },
    'corners_over_9.5': { min_edge: 0.04, min_confidence: 45 },
    'corners_over_10.5': { min_edge: 0.05, min_confidence: 45 },
    'corners_over_12.5': { min_edge: 0.06, min_confidence: 45 },
    // Tarjetas
    'cards_over_3.5': { min_edge: 0.04, min_confidence: 45 },
    'cards_over_4.5': { min_edge: 0.05, min_confidence: 45 },
    'cards_over_5.5': { min_edge: 0.06, min_confidence: 45 },
    // FASE 1: Primer/Segundo Tiempo
    '1t_over_0.5': { min_edge: 0.01, min_confidence: 50 },
    '1t_over_1.5': { min_edge: 0.02, min_confidence: 50 },
    '2t_over_0.5': { min_edge: 0.01, min_confidence: 50 },
    '2t_over_1.5': { min_edge: 0.02, min_confidence: 50 },
    // Marcador exacto
    'correct_score_0_0': { min_edge: 0.05, min_confidence: 45 }
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const startTime = Date.now();

    try {
        const { job_id, fixture_id, market_probs, quality_flags, odds_data } = await req.json();
        if (!job_id || !fixture_id || !market_probs) throw new Error('job_id, fixture_id, and market_probs are required');

        console.log(`[V2-VALUE] Evaluating ${market_probs.length} markets for job: ${job_id}`);

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        // Update job status
        await supabase
            .from('analysis_jobs_v2')
            .update({ status: 'value', current_motor: 'D' })
            .eq('id', job_id);

        // Get thresholds from config (or use defaults)
        const { data: configData } = await supabase
            .from('system_config_v2')
            .select('value')
            .eq('key', 'V2_MARKET_THRESHOLDS')
            .single();

        const thresholds = configData?.value || DEFAULT_THRESHOLDS;

        // Parse odds data into lookup
        const oddsLookup = new Map<string, number>();
        if (odds_data?.markets) {
            for (const market of odds_data.markets) {
                const marketName = (market.name || '').toLowerCase();
                for (const bet of market.values || []) {
                    const key = normalizeMarketKey(marketName, bet.value);
                    if (key && bet.odd) {
                        oddsLookup.set(key, parseFloat(bet.odd));
                    }
                }
            }
        }

        const allPicks: any[] = [];

        // ═══════════════════════════════════════════════════════════════
        // EVALUATE EACH MARKET PROBABILITY
        // ═══════════════════════════════════════════════════════════════
        for (const prob of market_probs) {
            const { market, selection, p_model, uncertainty } = prob;

            // Get odds for this market
            const odds = oddsLookup.get(market) || null;
            const p_implied = odds ? 1 / odds : null;
            const edge = p_implied ? p_model - p_implied : null;

            // Get threshold for this market type
            const threshold = thresholds[market] || { min_edge: 0.08, min_confidence: 55 };

            // Calculate confidence (based on p_model, uncertainty, and edge)
            let confidence = Math.round(p_model * 100);
            if (uncertainty) {
                confidence = Math.round(confidence * (1 - uncertainty));
            }

            // ═══════════════════════════════════════════════════════════════
            // DECISION LOGIC
            // ═══════════════════════════════════════════════════════════════
            let decision = 'WATCH';
            const risks: string[] = [];
            const reasons: string[] = [];

            // Check data quality flags
            if (quality_flags?.high_variance_goals && market.includes('goal')) {
                risks.push('Alta varianza en goles históricos');
            }
            if (quality_flags?.low_coverage_corners && market.includes('corner')) {
                risks.push('Cobertura de datos de corners limitada');
            }
            if (quality_flags?.low_coverage_cards && market.includes('card')) {
                risks.push('Cobertura de datos de tarjetas limitada');
            }
            if (quality_flags?.small_sample) {
                risks.push('Muestra pequeña (< 5 partidos)');
            }

            // ════════════════════════════════════════════════════════
            // SIN CUOTAS = SKIP (no mostrar este mercado)
            // ════════════════════════════════════════════════════════
            if (!odds) {
                decision = 'SKIP';  // No incluir en resultados
                reasons.push('Sin odds disponibles - mercado no evaluable');
                // NO hacer push a allPicks, continuar al siguiente
                console.log(`[V2-VALUE] ⚠️ Skipping ${market} - no odds available`);
                continue; // Saltar este mercado completamente
            }

            // Solo evaluar si hay cuotas
            if (edge && edge >= threshold.min_edge && confidence >= threshold.min_confidence) {
                // Check for disqualifying flags
                const hasDisqualifyingFlag =
                    (quality_flags?.high_variance_goals && market.includes('goal')) ||
                    (quality_flags?.small_sample);

                if (hasDisqualifyingFlag) {
                    decision = 'WATCH';
                    reasons.push('Edge positivo pero flags de calidad presentes');
                } else {
                    decision = 'BET';
                    reasons.push(`Edge de ${(edge * 100).toFixed(1)}% supera umbral de ${(threshold.min_edge * 100).toFixed(1)}%`);
                    reasons.push(`Confianza ${confidence}% supera mínimo de ${threshold.min_confidence}%`);
                }
            } else if (edge && edge < -0.10) {
                decision = 'AVOID';
                reasons.push(`Edge negativo de ${(edge * 100).toFixed(1)}% - valor en contra`);
            } else {
                decision = 'WATCH';
                if (edge !== null && edge < threshold.min_edge) {
                    reasons.push(`Edge de ${(edge * 100).toFixed(1)}% insuficiente (mínimo: ${(threshold.min_edge * 100).toFixed(1)}%)`);
                }
                if (confidence < threshold.min_confidence) {
                    reasons.push(`Confianza ${confidence}% por debajo del mínimo ${threshold.min_confidence}%`);
                }
            }

            allPicks.push({
                job_id,
                fixture_id,
                market,
                selection,
                odds,
                p_implied: p_implied ? Math.round(p_implied * 10000) / 10000 : null,
                p_model,
                edge: edge ? Math.round(edge * 10000) / 10000 : null,
                decision,
                confidence,
                risk_notes: { risks, reasons, data_gaps: quality_flags?.small_sample || false },
                is_primary_pick: false,
                rank: null,
                engine_version: ENGINE_VERSION
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // RANK AND LIMIT BET PICKS (Max 3)
        // ═══════════════════════════════════════════════════════════════
        const betPicks = allPicks
            .filter(p => p.decision === 'BET')
            .sort((a, b) => (b.edge || 0) - (a.edge || 0))
            .slice(0, 3);

        // Mark ranks
        betPicks.forEach((pick, idx) => {
            pick.rank = idx + 1;
            if (idx === 0) pick.is_primary_pick = true;
        });

        // Demote excess BET picks to WATCH
        const betMarkets = new Set(betPicks.map(p => p.market));
        allPicks.forEach(pick => {
            if (pick.decision === 'BET' && !betMarkets.has(pick.market)) {
                pick.decision = 'WATCH';
                pick.risk_notes.reasons.push('Excede límite de 3 picks');
            }
        });

        // ═══════════════════════════════════════════════════════════════
        // SAVE TO DATABASE
        // ═══════════════════════════════════════════════════════════════
        const { error: saveError } = await supabase
            .from('value_picks_v2')
            .insert(allPicks);

        if (saveError) throw saveError;

        // Update job status
        await supabase
            .from('analysis_jobs_v2')
            .update({ status: 'interpret', current_motor: 'D' })
            .eq('id', job_id);

        // Summary
        const summary = {
            total_markets: allPicks.length,
            bet_picks: allPicks.filter(p => p.decision === 'BET').length,
            watch_picks: allPicks.filter(p => p.decision === 'WATCH').length,
            avoid_picks: allPicks.filter(p => p.decision === 'AVOID').length,
            primary_pick: betPicks[0] || null
        };

        const executionTime = Date.now() - startTime;
        console.log(`[V2-VALUE] ✅ ${summary.bet_picks} BET, ${summary.watch_picks} WATCH, ${summary.avoid_picks} AVOID in ${executionTime}ms`);

        return new Response(JSON.stringify({
            success: true,
            job_id,
            fixture_id,
            summary,
            picks: allPicks,
            execution_time_ms: executionTime
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[V2-VALUE] Error:', e);
        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Helper: Normalize market names to match our internal keys
function normalizeMarketKey(marketName: string, selection: string): string | null {
    const s = selection.toLowerCase();

    if (marketName.includes('over') || marketName.includes('under')) {
        if (s.includes('over 2.5')) return 'over_2.5_goals';
        if (s.includes('under 2.5')) return 'under_2.5_goals';
        if (s.includes('over 1.5')) return 'over_1.5_goals';
    }

    if (marketName.includes('both teams') || marketName.includes('btts')) {
        if (s === 'yes') return 'btts_yes';
        if (s === 'no') return 'btts_no';
    }

    if (marketName.includes('winner') || marketName.includes('1x2')) {
        if (s === 'home' || s === '1') return '1x2_home';
        if (s === 'draw' || s === 'x') return '1x2_draw';
        if (s === 'away' || s === '2') return '1x2_away';
    }

    return null;
}
