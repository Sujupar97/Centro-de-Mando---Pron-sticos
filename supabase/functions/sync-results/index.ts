import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

/**
 * EDGE FUNCTION: sync-results
 * 
 * Propósito: Verificar automáticamente resultados de predicciones
 *            comparándolas con resultados reales de partidos finalizados.
 * 
 * Ejecución: Cron job diario (2 AM UTC) o manual
 * 
 * Flujo:
 * 1. Buscar predicciones sin verificar de partidos finalizados
 * 2. Consultar resultado real a API-Football
 * 3. Evaluar si predicción fue correcta
 * 4. Almacenar resultado en predictions_results
 * 5. Actualizar predicción original (is_won)
 */

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        console.log('[SYNC-RESULTS] Starting verification process...');

        // Setup
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        const footballKeys = Deno.env.get('API_FOOTBALL_KEYS');
        if (!footballKeys) throw new Error("Missing API_FOOTBALL_KEYS");

        const apiKeys = footballKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);

        // Helper: Fetch from API-Football
        const fetchFootball = async (path: string) => {
            for (const key of apiKeys) {
                try {
                    const res = await fetch(`https://v3.football.api-sports.io/${path}`, {
                        headers: { 'x-apisports-key': key }
                    });
                    if (res.ok) {
                        const json = await res.json();
                        if (!json.errors || Object.keys(json.errors).length === 0) {
                            return json.response;
                        }
                    }
                } catch (e) {
                    console.error('API Football error:', e);
                }
            }
            return null;
        };

        // 1. ENCONTRAR PREDICCIONES PENDIENTES
        // Criterio: Predicciones sin verificar cuyo partido ya finalizó (>3 horas desde fecha)
        const cutoffDate = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3h ago

        const { data: pendingPredictions, error: fetchError } = await supabase
            .from('predictions')
            .select(`
        *,
        analysis_runs!inner (
          id,
          fixture_id,
          job_id,
          analysis_jobs!inner (
            api_fixture_id
          )
        )
      `)
            .is('is_won', null) // No verificado
            .lt('created_at', cutoffDate); // Predicción creada hace más de 3 horas

        if (fetchError) throw fetchError;

        console.log(`[SYNC-RESULTS] Found ${pendingPredictions?.length || 0} predictions to verify`);

        let verified = 0;
        let errors = 0;

        for (const prediction of pendingPredictions || []) {
            try {
                // 2. OBTENER API FIXTURE ID
                const fixtureId = prediction.analysis_runs?.analysis_jobs?.api_fixture_id || prediction.fixture_id;

                if (!fixtureId) {
                    console.warn(`[SYNC-RESULTS] No fixture_id for prediction ${prediction.id}`);
                    continue;
                }

                // 3. CONSULTAR RESULTADO REAL DEL PARTIDO
                const fixtureData = await fetchFootball(`fixtures?id=${fixtureId}`);

                if (!fixtureData || fixtureData.length === 0) {
                    console.warn(`[SYNC-RESULTS] No data for fixture ${fixtureId}`);
                    continue;
                }

                const fixture = fixtureData[0];

                // 4. VERIFICAR QUE EL PARTIDO FINALIZÓ
                if (fixture.fixture.status.short !== 'FT') {
                    console.log(`[SYNC-RESULTS] Fixture ${fixtureId} not finished yet (${fixture.fixture.status.short})`);
                    continue;
                }

                // 5. EVALUAR SI LA PREDICCIÓN FUE CORRECTA
                const isCorrect = evaluatePrediction(prediction, fixture);
                const confidenceDelta = calculateConfidenceDelta(prediction, fixture, isCorrect);

                // 6. GUARDAR RESULTADO
                const { error: insertError } = await supabase
                    .from('predictions_results')
                    .insert({
                        prediction_id: prediction.id,
                        analysis_run_id: prediction.analysis_run_id,
                        fixture_id: fixtureId,

                        predicted_market: prediction.market || prediction.market_code || 'Unknown',
                        predicted_outcome: prediction.selection,
                        predicted_probability: prediction.probability || 50,
                        predicted_confidence: prediction.confidence,

                        actual_outcome: getActualOutcome(fixture, prediction.market_code),
                        actual_score: `${fixture.goals.home}-${fixture.goals.away}`,

                        was_correct: isCorrect,
                        confidence_delta: confidenceDelta,

                        verified_at: new Date().toISOString(),
                        verification_source: 'API-Football'
                    });

                if (insertError) {
                    console.error(`[SYNC-RESULTS] Error inserting result for ${prediction.id}:`, insertError);
                    errors++;
                    continue;
                }

                // 7. ACTUALIZAR PREDICCIÓN ORIGINAL
                const { error: updateError } = await supabase
                    .from('predictions')
                    .update({ is_won: isCorrect })
                    .eq('id', prediction.id);

                if (updateError) {
                    console.error(`[SYNC-RESULTS] Error updating prediction ${prediction.id}:`, updateError);
                }

                verified++;
                console.log(`[SYNC-RESULTS] ✓ Verified prediction ${prediction.id}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);

            } catch (err: any) {
                console.error(`[SYNC-RESULTS] Error processing prediction ${prediction.id}:`, err.message);
                errors++;
            }
        }

        console.log(`[SYNC-RESULTS] Completed: ${verified} verified, ${errors} errors`);

        return new Response(
            JSON.stringify({
                success: true,
                verified,
                errors,
                timestamp: new Date().toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('[SYNC-RESULTS] Fatal error:', err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

/**
 * Evalúa si una predicción fue correcta comparándola con el resultado real
 */
function evaluatePrediction(prediction: any, fixture: any): boolean {
    const market = prediction.market_code || prediction.market || '';
    const selection = (prediction.selection || '').toLowerCase();

    const homeGoals = fixture.goals.home || 0;
    const awayGoals = fixture.goals.away || 0;
    const totalGoals = homeGoals + awayGoals;

    // 1X2 / Ganador
    if (market.includes('1X2') || market.includes('Ganador') || market.includes('Winner')) {
        const homeTeam = fixture.teams.home.name.toLowerCase();
        const awayTeam = fixture.teams.away.name.toLowerCase();

        if (homeGoals > awayGoals) {
            return selection.includes(homeTeam) || selection.includes('local') || selection.includes('home');
        } else if (awayGoals > homeGoals) {
            return selection.includes(awayTeam) || selection.includes('visit') || selection.includes('away');
        } else {
            return selection.includes('empate') || selection.includes('draw');
        }
    }

    // Over/Under
    if (market.includes('Total') || market.includes('Over') || market.includes('Under')) {
        const matchLine = selection.match(/(\d+\.?\d*)/);
        const line = matchLine ? parseFloat(matchLine[1]) : 2.5;

        if (selection.includes('over') || selection.includes('más') || selection.includes('mayor')) {
            return totalGoals > line;
        } else if (selection.includes('under') || selection.includes('menos') || selection.includes('menor')) {
            return totalGoals < line;
        }
    }

    // BTTS (Ambos Marcan)
    if (market.includes('BTTS') || market.includes('Ambos')) {
        const bothScored = homeGoals > 0 && awayGoals > 0;
        const wantsYes = selection.includes('sí') || selection.includes('si') || selection.includes('yes');
        return wantsYes ? bothScored : !bothScored;
    }

    // Fallback: considerar incorrecta si no podemos evaluar
    console.warn(`[EVAL] Unknown market type: ${market}`);
    return false;
}

/**
 * Calcula qué tan "equivocada" estuvo la confianza de la predicción
 */
function calculateConfidenceDelta(prediction: any, fixture: any, wasCorrect: boolean): number {
    const predictedProb = prediction.probability || 50;

    // Si acertó, la confianza ideal era 100%
    // Si falló, la confianza ideal era 0%
    const idealProb = wasCorrect ? 100 : 0;

    // Delta = diferencia absoluta
    return Math.abs(predictedProb - idealProb);
}

/**
 * Obtiene el resultado real del mercado específico
 */
function getActualOutcome(fixture: any, marketCode: string): string {
    const homeGoals = fixture.goals.home || 0;
    const awayGoals = fixture.goals.away || 0;

    if (marketCode?.includes('1X2')) {
        if (homeGoals > awayGoals) return fixture.teams.home.name;
        if (awayGoals > homeGoals) return fixture.teams.away.name;
        return 'Draw';
    }

    if (marketCode?.includes('Total')) {
        return `${homeGoals + awayGoals} goals`;
    }

    if (marketCode?.includes('BTTS')) {
        return (homeGoals > 0 && awayGoals > 0) ? 'Yes' : 'No';
    }

    return `${homeGoals}-${awayGoals}`;
}
