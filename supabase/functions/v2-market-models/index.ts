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
        // MODEL 3: CORNERS - SOLO SI HAY DATOS SUFICIENTES
        // ═══════════════════════════════════════════════════════════════
        const corners = metrics.corners;
        const expectedCorners = corners?.combined?.expected_total || 0;
        const hasGoodCornersData = expectedCorners > 5 && !quality_flags?.low_coverage_corners;

        if (hasGoodCornersData) {
            const cornersStd = Math.sqrt((corners.home?.std || 2.0) ** 2 + (corners.away?.std || 2.0) ** 2);
            const cornersUncertainty = quality_flags?.low_coverage_corners ? 0.20 : 0.12;

            // Over 9.5 corners probability (using normal approximation)
            const zScore95 = (9.5 - expectedCorners) / Math.max(cornersStd, 1.5);
            const over95Corners = 1 - normalCdf(zScore95);

            // Solo añadir si la probabilidad es razonable (>10%)
            if (over95Corners > 0.10) {
                marketProbs.push({
                    fixture_id,
                    job_id,
                    market: 'corners_over_9.5',
                    selection: 'Over 9.5',
                    p_model: Math.round(Math.max(0.10, Math.min(0.95, over95Corners)) * 10000) / 10000,
                    uncertainty: Math.round(cornersUncertainty * 10000) / 10000,
                    model_name: 'normal_approximation',
                    model_inputs: { expected: expectedCorners, std: cornersStd },
                    rationale: `Expected corners: ${expectedCorners.toFixed(1)} ± ${cornersStd.toFixed(1)}. Probability: ${(over95Corners * 100).toFixed(1)}%.`,
                    engine_version: ENGINE_VERSION
                });
            }

            // Over 10.5 corners
            const zScore105 = (10.5 - expectedCorners) / Math.max(cornersStd, 1.5);
            const over105Corners = 1 - normalCdf(zScore105);

            if (over105Corners > 0.10) {
                marketProbs.push({
                    fixture_id,
                    job_id,
                    market: 'corners_over_10.5',
                    selection: 'Over 10.5',
                    p_model: Math.round(Math.max(0.10, Math.min(0.95, over105Corners)) * 10000) / 10000,
                    uncertainty: Math.round(cornersUncertainty * 10000) / 10000,
                    model_name: 'normal_approximation',
                    model_inputs: { expected: expectedCorners, std: cornersStd },
                    rationale: `${(over105Corners * 100).toFixed(1)}% probability of 11+ corners.`,
                    engine_version: ENGINE_VERSION
                });
            }
        } else {
            console.log(`[V2-MODELS] ⚠️ Corners data insufficient (expected: ${expectedCorners}), skipping corners markets`);
        }

        // ═══════════════════════════════════════════════════════════════
        // MODEL 4: CARDS - SOLO SI HAY DATOS SUFICIENTES
        // ═══════════════════════════════════════════════════════════════
        const cards = metrics.cards;
        const expectedCards = cards?.combined?.expected_total || 0;
        const hasGoodCardsData = expectedCards > 2 && !quality_flags?.low_coverage_cards;

        if (hasGoodCardsData) {
            const cardsUncertainty = quality_flags?.low_coverage_cards ? 0.20 : 0.12;
            const cardsStd = 1.5; // Standard deviation assumption

            // Over 4.5 cards probability
            const zScore45Cards = (4.5 - expectedCards) / cardsStd;
            const over45Cards = 1 - normalCdf(zScore45Cards);

            if (over45Cards > 0.10) {
                marketProbs.push({
                    fixture_id,
                    job_id,
                    market: 'cards_over_4.5',
                    selection: 'Over 4.5',
                    p_model: Math.round(Math.max(0.10, Math.min(0.95, over45Cards)) * 10000) / 10000,
                    uncertainty: Math.round(cardsUncertainty * 10000) / 10000,
                    model_name: 'normal_approximation',
                    model_inputs: { expected: expectedCards, referee_factor: cards.referee_factor },
                    rationale: `Expected cards: ${expectedCards.toFixed(1)} (referee factor: ${cards.referee_factor?.toFixed(2) || 1}).`,
                    engine_version: ENGINE_VERSION
                });
            }
        } else {
            console.log(`[V2-MODELS] ⚠️ Cards data insufficient (expected: ${expectedCards}), skipping cards markets`);
        }

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
        // MODEL 6: DOBLE OPORTUNIDAD (1X, X2, 12)
        // ═══════════════════════════════════════════════════════════════
        const dobleOp1X = homeWinProb + drawProb;
        const dobleOpX2 = drawProb + awayWinProb;
        const dobleOp12 = homeWinProb + awayWinProb;

        marketProbs.push({
            fixture_id, job_id,
            market: 'double_chance_1x',
            selection: '1X',
            p_model: Math.round(dobleOp1X * 10000) / 10000,
            uncertainty: 0.08,
            model_name: 'derived_1x2',
            model_inputs: { home: homeWinProb, draw: drawProb },
            rationale: `Doble oportunidad 1X: ${(dobleOp1X * 100).toFixed(1)}% (local o empate).`,
            engine_version: ENGINE_VERSION
        });

        marketProbs.push({
            fixture_id, job_id,
            market: 'double_chance_x2',
            selection: 'X2',
            p_model: Math.round(dobleOpX2 * 10000) / 10000,
            uncertainty: 0.08,
            model_name: 'derived_1x2',
            model_inputs: { draw: drawProb, away: awayWinProb },
            rationale: `Doble oportunidad X2: ${(dobleOpX2 * 100).toFixed(1)}% (empate o visitante).`,
            engine_version: ENGINE_VERSION
        });

        marketProbs.push({
            fixture_id, job_id,
            market: 'double_chance_12',
            selection: '12',
            p_model: Math.round(dobleOp12 * 10000) / 10000,
            uncertainty: 0.08,
            model_name: 'derived_1x2',
            model_inputs: { home: homeWinProb, away: awayWinProb },
            rationale: `Doble oportunidad 12: ${(dobleOp12 * 100).toFixed(1)}% (sin empate).`,
            engine_version: ENGINE_VERSION
        });

        // ═══════════════════════════════════════════════════════════════
        // MODEL 7: OVER/UNDER EXTENDIDOS (0.5, 4.5, 5.5)
        // ═══════════════════════════════════════════════════════════════
        const over05 = goalsDist.slice(1).reduce((a, b) => a + b, 0);
        const over45 = goalsDist.slice(5).reduce((a, b) => a + b, 0);
        const over55 = goalsDist.slice(6).reduce((a, b) => a + b, 0);

        marketProbs.push({
            fixture_id, job_id,
            market: 'over_0.5_goals',
            selection: 'Over 0.5',
            p_model: Math.round(over05 * 10000) / 10000,
            uncertainty: 0.05,
            model_name: 'poisson_baseline',
            model_inputs: { lambda_total: lambdaTotal },
            rationale: `Probabilidad de al menos 1 gol: ${(over05 * 100).toFixed(1)}%.`,
            engine_version: ENGINE_VERSION
        });

        if (over45 > 0.10) {
            marketProbs.push({
                fixture_id, job_id,
                market: 'over_4.5_goals',
                selection: 'Over 4.5',
                p_model: Math.round(over45 * 10000) / 10000,
                uncertainty: 0.12,
                model_name: 'poisson_baseline',
                model_inputs: { lambda_total: lambdaTotal },
                rationale: `Probabilidad de 5+ goles: ${(over45 * 100).toFixed(1)}%.`,
                engine_version: ENGINE_VERSION
            });
        }

        if (over55 > 0.05) {
            marketProbs.push({
                fixture_id, job_id,
                market: 'over_5.5_goals',
                selection: 'Over 5.5',
                p_model: Math.round(over55 * 10000) / 10000,
                uncertainty: 0.15,
                model_name: 'poisson_baseline',
                model_inputs: { lambda_total: lambdaTotal },
                rationale: `Probabilidad de 6+ goles: ${(over55 * 100).toFixed(1)}%.`,
                engine_version: ENGINE_VERSION
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // MODEL 8: GOLES POR EQUIPO (Local Over 0.5/1.5, Visitante Over 0.5/1.5)
        // ═══════════════════════════════════════════════════════════════
        const homeScores = 1 - poissonPmf(0, lambdaHome);
        const homeScores2 = 1 - poissonPmf(0, lambdaHome) - poissonPmf(1, lambdaHome);
        const awayScores = 1 - poissonPmf(0, lambdaAway);
        const awayScores2 = 1 - poissonPmf(0, lambdaAway) - poissonPmf(1, lambdaAway);

        marketProbs.push({
            fixture_id, job_id,
            market: 'home_over_0.5',
            selection: 'Local +0.5 Goles',
            p_model: Math.round(homeScores * 10000) / 10000,
            uncertainty: 0.08,
            model_name: 'poisson_team',
            model_inputs: { lambda_home: lambdaHome },
            rationale: `Local marca al menos 1 gol: ${(homeScores * 100).toFixed(1)}%.`,
            engine_version: ENGINE_VERSION
        });

        marketProbs.push({
            fixture_id, job_id,
            market: 'home_over_1.5',
            selection: 'Local +1.5 Goles',
            p_model: Math.round(homeScores2 * 10000) / 10000,
            uncertainty: 0.10,
            model_name: 'poisson_team',
            model_inputs: { lambda_home: lambdaHome },
            rationale: `Local marca 2+ goles: ${(homeScores2 * 100).toFixed(1)}%.`,
            engine_version: ENGINE_VERSION
        });

        marketProbs.push({
            fixture_id, job_id,
            market: 'away_over_0.5',
            selection: 'Visitante +0.5 Goles',
            p_model: Math.round(awayScores * 10000) / 10000,
            uncertainty: 0.08,
            model_name: 'poisson_team',
            model_inputs: { lambda_away: lambdaAway },
            rationale: `Visitante marca al menos 1 gol: ${(awayScores * 100).toFixed(1)}%.`,
            engine_version: ENGINE_VERSION
        });

        marketProbs.push({
            fixture_id, job_id,
            market: 'away_over_1.5',
            selection: 'Visitante +1.5 Goles',
            p_model: Math.round(awayScores2 * 10000) / 10000,
            uncertainty: 0.10,
            model_name: 'poisson_team',
            model_inputs: { lambda_away: lambdaAway },
            rationale: `Visitante marca 2+ goles: ${(awayScores2 * 100).toFixed(1)}%.`,
            engine_version: ENGINE_VERSION
        });

        // ═══════════════════════════════════════════════════════════════
        // MODEL 9: HANDICAP ASIÁTICO (-0.5, -1.5)
        // ═══════════════════════════════════════════════════════════════
        // Handicap -0.5 = Victoria del equipo
        // Handicap -1.5 = Victoria por 2+ goles
        let homeWinBy2Plus = 0;
        let awayWinBy2Plus = 0;

        for (let h = 0; h <= 10; h++) {
            for (let a = 0; a <= 10; a++) {
                const prob = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
                if (h - a >= 2) homeWinBy2Plus += prob;
                if (a - h >= 2) awayWinBy2Plus += prob;
            }
        }

        marketProbs.push({
            fixture_id, job_id,
            market: 'handicap_home_-0.5',
            selection: 'Local -0.5',
            p_model: Math.round(homeWinProb * 10000) / 10000,
            uncertainty: 0.10,
            model_name: 'poisson_handicap',
            model_inputs: { handicap: -0.5 },
            rationale: `Local gana (handicap -0.5): ${(homeWinProb * 100).toFixed(1)}%.`,
            engine_version: ENGINE_VERSION
        });

        marketProbs.push({
            fixture_id, job_id,
            market: 'handicap_home_-1.5',
            selection: 'Local -1.5',
            p_model: Math.round(homeWinBy2Plus * 10000) / 10000,
            uncertainty: 0.12,
            model_name: 'poisson_handicap',
            model_inputs: { handicap: -1.5 },
            rationale: `Local gana por 2+ goles: ${(homeWinBy2Plus * 100).toFixed(1)}%.`,
            engine_version: ENGINE_VERSION
        });

        marketProbs.push({
            fixture_id, job_id,
            market: 'handicap_away_+0.5',
            selection: 'Visitante +0.5',
            p_model: Math.round((1 - homeWinProb) * 10000) / 10000,
            uncertainty: 0.10,
            model_name: 'poisson_handicap',
            model_inputs: { handicap: 0.5 },
            rationale: `Visitante no pierde (handicap +0.5): ${((1 - homeWinProb) * 100).toFixed(1)}%.`,
            engine_version: ENGINE_VERSION
        });

        // ═══════════════════════════════════════════════════════════════
        // MODEL 10: CORNERS EXTENDIDOS
        // ═══════════════════════════════════════════════════════════════
        if (hasGoodCornersData && expectedCorners > 8) {
            const cornersStdVal = Math.sqrt((corners.home?.std || 2.0) ** 2 + (corners.away?.std || 2.0) ** 2);

            // Over 12.5 corners
            const zScore125 = (12.5 - expectedCorners) / Math.max(cornersStdVal, 1.5);
            const over125Corners = 1 - normalCdf(zScore125);

            if (over125Corners > 0.05) {
                marketProbs.push({
                    fixture_id, job_id,
                    market: 'corners_over_12.5',
                    selection: 'Over 12.5 Corners',
                    p_model: Math.round(over125Corners * 10000) / 10000,
                    uncertainty: 0.15,
                    model_name: 'normal_approximation',
                    model_inputs: { expected: expectedCorners },
                    rationale: `Probabilidad de 13+ corners: ${(over125Corners * 100).toFixed(1)}%.`,
                    engine_version: ENGINE_VERSION
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // MODEL 11: CARDS EXTENDIDOS (3.5, 5.5)
        // ═══════════════════════════════════════════════════════════════
        if (hasGoodCardsData) {
            const cardsStdVal = 1.5;

            // Over 3.5 cards
            const zScore35Cards = (3.5 - expectedCards) / cardsStdVal;
            const over35Cards = 1 - normalCdf(zScore35Cards);

            if (over35Cards > 0.15) {
                marketProbs.push({
                    fixture_id, job_id,
                    market: 'cards_over_3.5',
                    selection: 'Over 3.5 Tarjetas',
                    p_model: Math.round(over35Cards * 10000) / 10000,
                    uncertainty: 0.12,
                    model_name: 'normal_approximation',
                    model_inputs: { expected: expectedCards },
                    rationale: `Probabilidad de 4+ tarjetas: ${(over35Cards * 100).toFixed(1)}%.`,
                    engine_version: ENGINE_VERSION
                });
            }

            // Over 5.5 cards
            const zScore55Cards = (5.5 - expectedCards) / cardsStdVal;
            const over55Cards = 1 - normalCdf(zScore55Cards);

            if (over55Cards > 0.10) {
                marketProbs.push({
                    fixture_id, job_id,
                    market: 'cards_over_5.5',
                    selection: 'Over 5.5 Tarjetas',
                    p_model: Math.round(over55Cards * 10000) / 10000,
                    uncertainty: 0.15,
                    model_name: 'normal_approximation',
                    model_inputs: { expected: expectedCards },
                    rationale: `Probabilidad de 6+ tarjetas: ${(over55Cards * 100).toFixed(1)}%.`,
                    engine_version: ENGINE_VERSION
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // MODEL 12: SIN GOLES (0-0) y AMBOS NO MARCAN
        // ═══════════════════════════════════════════════════════════════
        const noGoals = poissonPmf(0, lambdaHome) * poissonPmf(0, lambdaAway);
        const bttsNo = 1 - (1 - poissonPmf(0, lambdaHome)) * (1 - poissonPmf(0, lambdaAway));

        marketProbs.push({
            fixture_id, job_id,
            market: 'correct_score_0_0',
            selection: '0-0',
            p_model: Math.round(noGoals * 10000) / 10000,
            uncertainty: 0.15,
            model_name: 'poisson_exact',
            model_inputs: { lambda_home: lambdaHome, lambda_away: lambdaAway },
            rationale: `Probabilidad de 0-0: ${(noGoals * 100).toFixed(1)}%.`,
            engine_version: ENGINE_VERSION
        });

        // ═══════════════════════════════════════════════════════════════
        // MODEL 13: GOLES PRIMER TIEMPO (1T)
        // ═══════════════════════════════════════════════════════════════
        // Lambda 1T ≈ 0.42-0.45 del total (estadísticamente ~45% goles en 1T)
        const lambda1T_home = (goals.home?.as_home?.scored_1t_avg) || (lambdaHome * 0.45);
        const lambda1T_away = (goals.away?.as_away?.scored_1t_avg) || (lambdaAway * 0.45);
        const lambda1T_total = lambda1T_home + lambda1T_away;

        // Over 0.5 1T
        const over05_1T = 1 - (poissonPmf(0, lambda1T_home) * poissonPmf(0, lambda1T_away));
        marketProbs.push({
            fixture_id, job_id,
            market: '1t_over_0.5',
            selection: '1T Over 0.5',
            p_model: Math.round(over05_1T * 10000) / 10000,
            uncertainty: 0.10,
            model_name: 'poisson_1t',
            model_inputs: { lambda_1t: lambda1T_total },
            rationale: `Probabilidad de gol en 1T: ${(over05_1T * 100).toFixed(1)}% (λ1T: ${lambda1T_total.toFixed(2)}).`,
            engine_version: ENGINE_VERSION
        });

        // Over 1.5 1T (si probable)
        const over15_1T = 1 - (poissonPmf(0, lambda1T_home) * poissonPmf(0, lambda1T_away))
            - (poissonPmf(1, lambda1T_home) * poissonPmf(0, lambda1T_away))
            - (poissonPmf(0, lambda1T_home) * poissonPmf(1, lambda1T_away));
        if (over15_1T > 0.20) {
            marketProbs.push({
                fixture_id, job_id,
                market: '1t_over_1.5',
                selection: '1T Over 1.5',
                p_model: Math.round(Math.max(0.10, over15_1T) * 10000) / 10000,
                uncertainty: 0.12,
                model_name: 'poisson_1t',
                model_inputs: { lambda_1t: lambda1T_total },
                rationale: `Probabilidad de 2+ goles en 1T: ${(over15_1T * 100).toFixed(1)}%.`,
                engine_version: ENGINE_VERSION
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // MODEL 14: GOLES SEGUNDO TIEMPO (2T)
        // ═══════════════════════════════════════════════════════════════
        // Lambda 2T ≈ 0.55 del total (estadísticamente ~55% goles en 2T)
        const lambda2T_home = (goals.home?.as_home?.scored_2t_avg) || (lambdaHome * 0.55);
        const lambda2T_away = (goals.away?.as_away?.scored_2t_avg) || (lambdaAway * 0.55);
        const lambda2T_total = lambda2T_home + lambda2T_away;

        // Over 0.5 2T
        const over05_2T = 1 - (poissonPmf(0, lambda2T_home) * poissonPmf(0, lambda2T_away));
        marketProbs.push({
            fixture_id, job_id,
            market: '2t_over_0.5',
            selection: '2T Over 0.5',
            p_model: Math.round(over05_2T * 10000) / 10000,
            uncertainty: 0.10,
            model_name: 'poisson_2t',
            model_inputs: { lambda_2t: lambda2T_total },
            rationale: `Probabilidad de gol en 2T: ${(over05_2T * 100).toFixed(1)}% (λ2T: ${lambda2T_total.toFixed(2)}).`,
            engine_version: ENGINE_VERSION
        });

        // Over 1.5 2T (más probable que 1T)
        const over15_2T = 1 - (poissonPmf(0, lambda2T_home) * poissonPmf(0, lambda2T_away))
            - (poissonPmf(1, lambda2T_home) * poissonPmf(0, lambda2T_away))
            - (poissonPmf(0, lambda2T_home) * poissonPmf(1, lambda2T_away));
        if (over15_2T > 0.20) {
            marketProbs.push({
                fixture_id, job_id,
                market: '2t_over_1.5',
                selection: '2T Over 1.5',
                p_model: Math.round(Math.max(0.10, over15_2T) * 10000) / 10000,
                uncertainty: 0.12,
                model_name: 'poisson_2t',
                model_inputs: { lambda_2t: lambda2T_total },
                rationale: `Probabilidad de 2+ goles en 2T: ${(over15_2T * 100).toFixed(1)}%.`,
                engine_version: ENGINE_VERSION
            });
        }

        console.log(`[V2-MODELS] 🚀 Generated ${marketProbs.length} market probabilities (PREMIUM + 1T/2T)`);


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
