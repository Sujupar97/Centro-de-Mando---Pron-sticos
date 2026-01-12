// supabase/functions/v2-market-models/index.ts
// MOTOR C: Modelos de Probabilidad por Mercado
// Propósito: Producir probabilidades estimadas por mercado con incertidumbre

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

const ENGINE_VERSION = '2.0.0';

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const startTime = Date.now();

    try {
        const { job_id, fixture_id, metrics, quality_flags } = await req.json();
        if (!job_id || !fixture_id || !metrics) throw new Error('job_id, fixture_id, and metrics are required');

        console.log(`[V2-MODELS] Computing market probabilities for job: ${job_id}`);

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        // Update job status
        await supabase
            .from('analysis_jobs_v2')
            .update({ status: 'models', current_motor: 'C' })
            .eq('id', job_id);

        const marketProbs: any[] = [];

        // ═══════════════════════════════════════════════════════════════
        // MODEL 1: GOALS - POISSON BASELINE
        // ═══════════════════════════════════════════════════════════════
        const goals = metrics.goals;
        const lambdaHome = goals.home.as_home.scored_avg || 1.3;
        const lambdaAway = goals.away.as_away.scored_avg || 1.0;
        const lambdaTotal = lambdaHome + lambdaAway;

        // Poisson probability calculation
        const poissonPmf = (k: number, lambda: number): number => {
            return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
        };

        const factorial = (n: number): number => {
            if (n <= 1) return 1;
            let result = 1;
            for (let i = 2; i <= n; i++) result *= i;
            return result;
        };

        // Calculate total goals distribution
        const goalsDist: number[] = [];
        for (let i = 0; i <= 10; i++) {
            let prob = 0;
            for (let h = 0; h <= i; h++) {
                prob += poissonPmf(h, lambdaHome) * poissonPmf(i - h, lambdaAway);
            }
            goalsDist[i] = prob;
        }

        // Over 2.5 Goals
        const over25 = goalsDist.slice(3).reduce((a, b) => a + b, 0);
        const uncertainty25 = Math.min(0.15, goals.home.as_home.scored_std * 0.1 + goals.away.as_away.scored_std * 0.1);

        marketProbs.push({
            fixture_id,
            job_id,
            market: 'over_2.5_goals',
            selection: 'Over 2.5',
            p_model: Math.round(over25 * 10000) / 10000,
            uncertainty: Math.round(uncertainty25 * 10000) / 10000,
            model_name: 'poisson_baseline',
            model_inputs: { lambda_home: lambdaHome, lambda_away: lambdaAway, lambda_total: lambdaTotal },
            rationale: `Lambda total: ${lambdaTotal.toFixed(2)}. Expected goals distribution suggests ${(over25 * 100).toFixed(1)}% chance of 3+ goals.`,
            engine_version: ENGINE_VERSION
        });

        // Under 2.5 Goals
        const under25 = 1 - over25;
        marketProbs.push({
            fixture_id,
            job_id,
            market: 'under_2.5_goals',
            selection: 'Under 2.5',
            p_model: Math.round(under25 * 10000) / 10000,
            uncertainty: Math.round(uncertainty25 * 10000) / 10000,
            model_name: 'poisson_baseline',
            model_inputs: { lambda_home: lambdaHome, lambda_away: lambdaAway },
            rationale: `Complement of Over 2.5: ${(under25 * 100).toFixed(1)}% chance of 0-2 goals.`,
            engine_version: ENGINE_VERSION
        });

        // Over 1.5 Goals
        const over15 = goalsDist.slice(2).reduce((a, b) => a + b, 0);
        marketProbs.push({
            fixture_id,
            job_id,
            market: 'over_1.5_goals',
            selection: 'Over 1.5',
            p_model: Math.round(over15 * 10000) / 10000,
            uncertainty: Math.round(uncertainty25 * 0.8 * 10000) / 10000,
            model_name: 'poisson_baseline',
            model_inputs: { lambda_total: lambdaTotal },
            rationale: `${(over15 * 100).toFixed(1)}% probability of 2+ goals.`,
            engine_version: ENGINE_VERSION
        });

        // ═══════════════════════════════════════════════════════════════
        // MODEL 2: BTTS - HISTORICAL RATE
        // ═══════════════════════════════════════════════════════════════
        const btts = metrics.btts;
        const bttsProb = btts.home_scores_rate * btts.away_scores_rate;
        const bttsUncertainty = quality_flags?.small_sample ? 0.15 : 0.10;

        marketProbs.push({
            fixture_id,
            job_id,
            market: 'btts_yes',
            selection: 'Yes',
            p_model: Math.round(bttsProb * 10000) / 10000,
            uncertainty: Math.round(bttsUncertainty * 10000) / 10000,
            model_name: 'historical_rate',
            model_inputs: { home_scores_rate: btts.home_scores_rate, away_scores_rate: btts.away_scores_rate },
            rationale: `Home scores ${(btts.home_scores_rate * 100).toFixed(0)}% of games, Away scores ${(btts.away_scores_rate * 100).toFixed(0)}%. Combined BTTS probability: ${(bttsProb * 100).toFixed(1)}%.`,
            engine_version: ENGINE_VERSION
        });

        marketProbs.push({
            fixture_id,
            job_id,
            market: 'btts_no',
            selection: 'No',
            p_model: Math.round((1 - bttsProb) * 10000) / 10000,
            uncertainty: Math.round(bttsUncertainty * 10000) / 10000,
            model_name: 'historical_rate',
            model_inputs: { btts_prob: bttsProb },
            rationale: `${((1 - bttsProb) * 100).toFixed(1)}% probability that at least one team fails to score.`,
            engine_version: ENGINE_VERSION
        });

        // ═══════════════════════════════════════════════════════════════
        // MODEL 3: CORNERS - AVERAGE + STD
        // ═══════════════════════════════════════════════════════════════
        const corners = metrics.corners;
        const expectedCorners = corners.combined.expected_total || 9.0;
        const cornersStd = Math.sqrt((corners.home.std || 1.5) ** 2 + (corners.away.std || 1.5) ** 2);

        // Over 9.5 corners probability (using normal approximation)
        const zScore95 = (9.5 - expectedCorners) / Math.max(cornersStd, 0.1);
        const over95Corners = 1 - normalCdf(zScore95);
        const cornersUncertainty = quality_flags?.low_coverage_corners ? 0.15 : 0.12;

        marketProbs.push({
            fixture_id,
            job_id,
            market: 'corners_over_9.5',
            selection: 'Over 9.5',
            p_model: Math.round(Math.max(0, Math.min(1, over95Corners)) * 10000) / 10000,
            uncertainty: Math.round(cornersUncertainty * 10000) / 10000,
            model_name: 'normal_approximation',
            model_inputs: { expected: expectedCorners, std: cornersStd },
            rationale: `Expected corners: ${expectedCorners.toFixed(1)} ± ${cornersStd.toFixed(1)}. Z-score for 9.5: ${zScore95.toFixed(2)}.`,
            engine_version: ENGINE_VERSION
        });

        // Over 10.5 corners
        const zScore105 = (10.5 - expectedCorners) / Math.max(cornersStd, 0.1);
        const over105Corners = 1 - normalCdf(zScore105);

        marketProbs.push({
            fixture_id,
            job_id,
            market: 'corners_over_10.5',
            selection: 'Over 10.5',
            p_model: Math.round(Math.max(0, Math.min(1, over105Corners)) * 10000) / 10000,
            uncertainty: Math.round(cornersUncertainty * 10000) / 10000,
            model_name: 'normal_approximation',
            model_inputs: { expected: expectedCorners, std: cornersStd },
            rationale: `${(over105Corners * 100).toFixed(1)}% probability of 11+ corners.`,
            engine_version: ENGINE_VERSION
        });

        // ═══════════════════════════════════════════════════════════════
        // MODEL 4: CARDS - AVERAGE + REFEREE FACTOR
        // ═══════════════════════════════════════════════════════════════
        const cards = metrics.cards;
        const expectedCards = cards.combined.expected_total || 4.0;
        const cardsUncertainty = quality_flags?.low_coverage_cards ? 0.15 : 0.12;

        // Over 4.5 cards probability
        const zScore45Cards = (4.5 - expectedCards) / 1.5; // Assumed std of 1.5
        const over45Cards = 1 - normalCdf(zScore45Cards);

        marketProbs.push({
            fixture_id,
            job_id,
            market: 'cards_over_4.5',
            selection: 'Over 4.5',
            p_model: Math.round(Math.max(0, Math.min(1, over45Cards)) * 10000) / 10000,
            uncertainty: Math.round(cardsUncertainty * 10000) / 10000,
            model_name: 'normal_approximation',
            model_inputs: { expected: expectedCards, referee_factor: cards.referee_factor },
            rationale: `Expected cards: ${expectedCards.toFixed(1)} (referee factor: ${cards.referee_factor?.toFixed(2) || 1}).`,
            engine_version: ENGINE_VERSION
        });

        // ═══════════════════════════════════════════════════════════════
        // MODEL 5: 1X2 - DERIVED FROM GOALS
        // ═══════════════════════════════════════════════════════════════
        let homeWinProb = 0;
        let drawProb = 0;
        let awayWinProb = 0;

        for (let h = 0; h <= 10; h++) {
            for (let a = 0; a <= 10; a++) {
                const prob = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
                if (h > a) homeWinProb += prob;
                else if (h === a) drawProb += prob;
                else awayWinProb += prob;
            }
        }

        marketProbs.push({
            fixture_id,
            job_id,
            market: '1x2_home',
            selection: '1',
            p_model: Math.round(homeWinProb * 10000) / 10000,
            uncertainty: 0.10,
            model_name: 'poisson_1x2',
            model_inputs: { lambda_home: lambdaHome, lambda_away: lambdaAway },
            rationale: `Home win probability: ${(homeWinProb * 100).toFixed(1)}% based on Poisson distribution.`,
            engine_version: ENGINE_VERSION
        });

        marketProbs.push({
            fixture_id,
            job_id,
            market: '1x2_draw',
            selection: 'X',
            p_model: Math.round(drawProb * 10000) / 10000,
            uncertainty: 0.10,
            model_name: 'poisson_1x2',
            model_inputs: { lambda_home: lambdaHome, lambda_away: lambdaAway },
            rationale: `Draw probability: ${(drawProb * 100).toFixed(1)}%.`,
            engine_version: ENGINE_VERSION
        });

        marketProbs.push({
            fixture_id,
            job_id,
            market: '1x2_away',
            selection: '2',
            p_model: Math.round(awayWinProb * 10000) / 10000,
            uncertainty: 0.10,
            model_name: 'poisson_1x2',
            model_inputs: { lambda_home: lambdaHome, lambda_away: lambdaAway },
            rationale: `Away win probability: ${(awayWinProb * 100).toFixed(1)}%.`,
            engine_version: ENGINE_VERSION
        });

        // ═══════════════════════════════════════════════════════════════
        // SAVE TO DATABASE
        // ═══════════════════════════════════════════════════════════════
        const { error: saveError } = await supabase
            .from('market_probs_v2')
            .insert(marketProbs);

        if (saveError) throw saveError;

        // Update job status
        await supabase
            .from('analysis_jobs_v2')
            .update({ status: 'value', current_motor: 'C' })
            .eq('id', job_id);

        const executionTime = Date.now() - startTime;
        console.log(`[V2-MODELS] ✅ Generated ${marketProbs.length} market probabilities in ${executionTime}ms`);

        return new Response(JSON.stringify({
            success: true,
            job_id,
            fixture_id,
            market_probs: marketProbs,
            execution_time_ms: executionTime
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[V2-MODELS] Error:', e);
        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Helper: Normal CDF approximation
function normalCdf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
}
