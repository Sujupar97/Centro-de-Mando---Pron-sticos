import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

/**
 * EDGE FUNCTION: migrate-verified-predictions
 * 
 * Propósito: Migrar predicciones ya verificadas (is_won != null)
 *            que NO están en predictions_results al sistema ML.
 * 
 * Esto asegura que TODAS las predicciones históricas alimenten
 * el sistema de aprendizaje.
 */

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        console.log('[MIGRATE] Starting migration of verified predictions...');

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        // 1. Obtener IDs ya migrados
        const { data: existingResults } = await supabase
            .from('predictions_results')
            .select('prediction_id');

        const existingIds = new Set((existingResults || []).map(r => r.prediction_id));
        console.log(`[MIGRATE] Already migrated: ${existingIds.size}`);

        // 2. Obtener predicciones verificadas que NO están migradas
        const { data: verifiedPredictions, error: fetchError } = await supabase
            .from('predictions')
            .select('id, fixture_id, market, selection, probability, confidence, is_won, created_at')
            .not('is_won', 'is', null)
            .order('created_at', { ascending: true });

        if (fetchError) throw fetchError;

        // Filtrar las que no están migradas
        const toMigrate = (verifiedPredictions || []).filter(p => !existingIds.has(p.id));
        console.log(`[MIGRATE] Found ${toMigrate.length} predictions to migrate`);

        let migrated = 0;
        let errors = 0;

        for (const pred of toMigrate) {
            try {
                // Calcular confidence_delta aproximado
                const predictedProb = pred.probability || 50;
                const idealProb = pred.is_won ? 100 : 0;
                const confidenceDelta = Math.abs(predictedProb - idealProb);

                const { error: insertError } = await supabase
                    .from('predictions_results')
                    .insert({
                        prediction_id: pred.id,
                        fixture_id: pred.fixture_id || 0,
                        predicted_market: pred.market || 'Unknown',
                        predicted_outcome: pred.selection || 'Unknown',
                        predicted_probability: predictedProb,
                        predicted_confidence: pred.confidence,
                        actual_outcome: pred.is_won ? 'Correct' : 'Incorrect',
                        actual_score: 'N/A (migrated)',
                        was_correct: pred.is_won,
                        confidence_delta: confidenceDelta,
                        verified_at: new Date().toISOString(),
                        verification_source: 'Migration from existing is_won'
                    });

                if (insertError) {
                    console.error(`[MIGRATE] Error for ${pred.id}:`, insertError.message);
                    errors++;
                } else {
                    migrated++;
                }
            } catch (err: any) {
                console.error(`[MIGRATE] Exception for ${pred.id}:`, err.message);
                errors++;
            }
        }

        console.log(`[MIGRATE] Completed: ${migrated} migrated, ${errors} errors`);

        return new Response(
            JSON.stringify({
                success: true,
                total_found: toMigrate.length,
                migrated,
                errors,
                timestamp: new Date().toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('[MIGRATE] Fatal error:', err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
