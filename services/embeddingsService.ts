import { GoogleGenerativeAI } from '@google/genai';
import { supabase } from './supabaseService';

/**
 * SERVICIO DE EMBEDDINGS ML
 * 
 * Propósito: Generar embeddings de contexto para predicciones
 *            y buscar predicciones históricas similares.
 */

// Inicializar cliente Gemini
const getGeminiClient = () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');
    return new GoogleGenerativeAI(apiKey);
};

/**
 * Genera un embedding de 768 dimensiones para un texto de contexto
 */
export async function generateEmbedding(contextText: string): Promise<number[]> {
    try {
        const ai = getGeminiClient();
        const model = ai.getGenerativeModel({ model: 'embedding-001' });

        const result = await model.embedContent(contextText);
        const embedding = result.embedding;

        if (!embedding || !embedding.values) {
            throw new Error('No embedding returned from Gemini');
        }

        return embedding.values;
    } catch (error: any) {
        console.error('[EMBEDDING] Error generating embedding:', error.message);
        throw error;
    }
}

/**
 * Construye el texto de contexto para una predicción
 */
export function buildContextText(predictionData: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    market: string;
    selection: string;
    homeForm?: string;
    awayForm?: string;
    h2hSummary?: string;
    homeGoalsAvg?: number;
    awayGoalsAvg?: number;
}): string {
    const parts = [
        `League: ${predictionData.league}`,
        `Match: ${predictionData.homeTeam} vs ${predictionData.awayTeam}`,
        `Market: ${predictionData.market}`,
        `Selection: ${predictionData.selection}`,
    ];

    if (predictionData.homeForm) {
        parts.push(`Home Form: ${predictionData.homeForm}`);
    }
    if (predictionData.awayForm) {
        parts.push(`Away Form: ${predictionData.awayForm}`);
    }
    if (predictionData.h2hSummary) {
        parts.push(`H2H: ${predictionData.h2hSummary}`);
    }
    if (predictionData.homeGoalsAvg !== undefined) {
        parts.push(`Home Goals Avg: ${predictionData.homeGoalsAvg}`);
    }
    if (predictionData.awayGoalsAvg !== undefined) {
        parts.push(`Away Goals Avg: ${predictionData.awayGoalsAvg}`);
    }

    return parts.join('\n');
}

/**
 * Guarda un embedding de predicción en la base de datos
 */
export async function saveEmbedding(params: {
    predictionId: string;
    predictionResultId?: string;
    contextText: string;
    embedding: number[];
    leagueName: string;
    marketType: string;
    wasCorrect?: boolean;
    confidenceError?: number;
}): Promise<boolean> {
    try {
        const { error } = await supabase.from('prediction_embeddings').insert({
            prediction_id: params.predictionId,
            prediction_result_id: params.predictionResultId,
            context_text: params.contextText,
            context_vector: params.embedding,
            league_name: params.leagueName,
            market_type: params.marketType,
            was_correct: params.wasCorrect,
            confidence_error: params.confidenceError
        });

        if (error) {
            console.error('[EMBEDDING] Error saving embedding:', error);
            return false;
        }

        return true;
    } catch (error: any) {
        console.error('[EMBEDDING] Error:', error.message);
        return false;
    }
}

/**
 * Busca predicciones similares usando embeddings
 */
export async function findSimilarPredictions(
    queryEmbedding: number[],
    options: {
        limit?: number;
        marketFilter?: string;
    } = {}
): Promise<{
    predictionId: string;
    similarity: number;
    wasCorrect: boolean;
    confidenceError: number;
    contextText: string;
    marketType: string;
}[]> {
    const { limit = 10, marketFilter } = options;

    try {
        // Llamar a la función RPC de Supabase
        const { data, error } = await supabase.rpc('find_similar_predictions', {
            query_embedding: queryEmbedding,
            match_count: limit,
            market_filter: marketFilter || null
        });

        if (error) {
            console.error('[EMBEDDING] Error finding similar predictions:', error);
            return [];
        }

        return (data || []).map((row: any) => ({
            predictionId: row.prediction_id,
            similarity: row.similarity,
            wasCorrect: row.was_correct,
            confidenceError: row.confidence_error,
            contextText: row.context_text,
            marketType: row.market_type
        }));
    } catch (error: any) {
        console.error('[EMBEDDING] Error:', error.message);
        return [];
    }
}

/**
 * Calcula el ajuste de confianza basado en predicciones históricas similares
 */
export async function calculateConfidenceAdjustment(
    contextText: string,
    baseConfidence: number
): Promise<{
    adjustedConfidence: number;
    historicalAccuracy: number;
    sampleSize: number;
    recommendation: string;
}> {
    try {
        // Generar embedding del contexto actual
        const embedding = await generateEmbedding(contextText);

        // Buscar predicciones similares
        const similar = await findSimilarPredictions(embedding, { limit: 10 });

        if (similar.length < 3) {
            // No hay suficiente historial para ajustar
            return {
                adjustedConfidence: baseConfidence,
                historicalAccuracy: 0,
                sampleSize: similar.length,
                recommendation: 'INSUFFICIENT_DATA: Not enough historical data to adjust confidence'
            };
        }

        // Calcular accuracy histórico
        const correctCount = similar.filter(s => s.wasCorrect).length;
        const historicalAccuracy = (correctCount / similar.length) * 100;

        // Ajustar confianza basándose en historial
        let adjustedConfidence = baseConfidence;
        let recommendation = '';

        if (historicalAccuracy >= 70) {
            // Historial positivo: mantener o aumentar ligeramente
            adjustedConfidence = Math.min(baseConfidence * 1.05, 95);
            recommendation = 'HIGH_CONFIDENCE: Historical accuracy supports this prediction';
        } else if (historicalAccuracy >= 50) {
            // Historial mixto: reducir ligeramente
            adjustedConfidence = baseConfidence * 0.95;
            recommendation = 'MEDIUM_CONFIDENCE: Mixed historical results, slight reduction applied';
        } else {
            // Historial negativo: reducir significativamente
            adjustedConfidence = baseConfidence * 0.80;
            recommendation = 'LOW_CONFIDENCE: Poor historical accuracy, significant reduction applied';
        }

        return {
            adjustedConfidence: Math.round(adjustedConfidence),
            historicalAccuracy: Math.round(historicalAccuracy),
            sampleSize: similar.length,
            recommendation
        };
    } catch (error: any) {
        console.error('[EMBEDDING] Error calculating adjustment:', error.message);
        return {
            adjustedConfidence: baseConfidence,
            historicalAccuracy: 0,
            sampleSize: 0,
            recommendation: 'ERROR: Could not calculate historical adjustment'
        };
    }
}

/**
 * Genera embeddings para todas las predicciones verificadas que aún no tienen embedding
 * (Script de backfill)
 */
export async function backfillEmbeddings(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
        // Obtener predicciones verificadas sin embedding
        const { data: predictions, error: fetchError } = await supabase
            .from('predictions_results')
            .select(`
        id,
        prediction_id,
        predicted_market,
        predicted_outcome,
        was_correct,
        confidence_delta,
        predictions!inner (
          selection,
          market,
          analysis_runs!inner (
            report_pre_jsonb
          )
        )
      `)
            .not('prediction_id', 'in',
                supabase.from('prediction_embeddings').select('prediction_id')
            )
            .limit(50); // Procesar en batches

        if (fetchError) {
            console.error('[BACKFILL] Error fetching predictions:', fetchError);
            return { processed: 0, errors: 1 };
        }

        for (const pred of predictions || []) {
            try {
                // Extraer contexto del reporte
                const report = pred.predictions?.analysis_runs?.report_pre_jsonb || {};
                const header = report.header_partido || {};

                const contextText = buildContextText({
                    homeTeam: header.titulo?.split(' vs ')[0] || 'Unknown',
                    awayTeam: header.titulo?.split(' vs ')[1]?.split(':')[0] || 'Unknown',
                    league: header.subtitulo || 'Unknown League',
                    market: pred.predicted_market,
                    selection: pred.predicted_outcome
                });

                const embedding = await generateEmbedding(contextText);

                const saved = await saveEmbedding({
                    predictionId: pred.prediction_id,
                    predictionResultId: pred.id,
                    contextText,
                    embedding,
                    leagueName: header.subtitulo || 'Unknown',
                    marketType: pred.predicted_market,
                    wasCorrect: pred.was_correct,
                    confidenceError: pred.confidence_delta
                });

                if (saved) {
                    processed++;
                } else {
                    errors++;
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (err: any) {
                console.error('[BACKFILL] Error processing prediction:', err.message);
                errors++;
            }
        }

        return { processed, errors };
    } catch (error: any) {
        console.error('[BACKFILL] Fatal error:', error.message);
        return { processed, errors: errors + 1 };
    }
}
