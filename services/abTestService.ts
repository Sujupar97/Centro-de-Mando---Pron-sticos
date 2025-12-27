import { supabase } from './supabaseService';
import { calculateConfidenceAdjustment } from './embeddingsService';

/**
 * SERVICIO DE A/B TESTING ML
 * 
 * Propósito: Gestionar versiones del modelo y realizar A/B testing
 *            para comparar rendimiento entre versiones.
 */

export interface ModelVersion {
    id: string;
    version_name: string;
    version_description: string;
    model_config: Record<string, any>;
    is_active: boolean;
    traffic_percentage: number;
}

export interface ABTestResult {
    version_name: string;
    sample_size: number;
    win_rate: number;
    avg_confidence: number;
    avg_error: number;
    is_significant: boolean;
    recommendation: string;
}

/**
 * Obtiene las versiones activas del modelo
 */
export async function getActiveVersions(): Promise<ModelVersion[]> {
    const { data, error } = await supabase
        .from('model_versions')
        .select('*')
        .eq('is_active', true)
        .order('traffic_percentage', { ascending: false });

    if (error) {
        console.error('[AB-TEST] Error fetching versions:', error);
        return [];
    }

    return data || [];
}

/**
 * Selecciona qué versión del modelo usar para una predicción
 * basándose en el traffic_percentage configurado
 */
export async function selectModelVersion(): Promise<string> {
    const versions = await getActiveVersions();

    if (versions.length === 0) {
        return 'v1-stable'; // Fallback
    }

    // Selección basada en porcentaje de tráfico
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const version of versions) {
        cumulative += version.traffic_percentage;
        if (random <= cumulative) {
            return version.version_name;
        }
    }

    return versions[0].version_name; // Fallback a la primera versión
}

/**
 * Obtiene resultados de A/B test entre dos versiones
 */
export async function getABTestResults(
    versionA: string = 'v1-stable',
    versionB: string = 'v2-learning'
): Promise<ABTestResult[]> {
    const { data, error } = await supabase.rpc('get_ab_test_results', {
        version_a: versionA,
        version_b: versionB,
        min_sample_size: 30
    });

    if (error) {
        console.error('[AB-TEST] Error fetching results:', error);
        return [];
    }

    return (data || []).map((row: any) => ({
        version_name: row.version_name,
        sample_size: row.sample_size,
        win_rate: row.win_rate,
        avg_confidence: row.avg_confidence,
        avg_error: row.avg_error,
        is_significant: row.is_significant,
        recommendation: row.recommendation
    }));
}

/**
 * Obtiene comparación de rendimiento de todos los modelos
 */
export async function getModelPerformanceComparison(): Promise<{
    version: string;
    totalPredictions: number;
    correctPredictions: number;
    winRate: number;
    avgConfidence: number;
    avgError: number;
}[]> {
    const { data, error } = await supabase
        .from('model_performance_comparison')
        .select('*');

    if (error) {
        console.error('[AB-TEST] Error fetching performance:', error);
        return [];
    }

    return (data || []).map((row: any) => ({
        version: row.model_version || 'unknown',
        totalPredictions: row.total_predictions,
        correctPredictions: row.correct_predictions,
        winRate: row.win_rate_pct,
        avgConfidence: row.avg_confidence,
        avgError: row.avg_confidence_error
    }));
}

/**
 * Actualiza el porcentaje de tráfico de una versión
 */
export async function updateTrafficPercentage(
    versionName: string,
    newPercentage: number
): Promise<boolean> {
    const { error } = await supabase
        .from('model_versions')
        .update({
            traffic_percentage: newPercentage,
            updated_at: new Date().toISOString()
        })
        .eq('version_name', versionName);

    if (error) {
        console.error('[AB-TEST] Error updating traffic:', error);
        return false;
    }

    return true;
}

/**
 * Promueve una versión al 100% del tráfico (producción)
 */
export async function promoteVersion(versionName: string): Promise<boolean> {
    // Primero, poner todas las versiones a 0%
    const { error: resetError } = await supabase
        .from('model_versions')
        .update({ traffic_percentage: 0 });

    if (resetError) {
        console.error('[AB-TEST] Error resetting traffic:', resetError);
        return false;
    }

    // Luego, poner la versión seleccionada a 100%
    const { error: promoteError } = await supabase
        .from('model_versions')
        .update({
            traffic_percentage: 100,
            updated_at: new Date().toISOString()
        })
        .eq('version_name', versionName);

    if (promoteError) {
        console.error('[AB-TEST] Error promoting version:', promoteError);
        return false;
    }

    console.log(`[AB-TEST] Promoted ${versionName} to 100% traffic`);
    return true;
}

/**
 * Inicia un A/B test entre dos versiones
 */
export async function startABTest(
    versionA: string,
    versionB: string,
    splitPercentage: number = 50
): Promise<boolean> {
    const versionAPercent = 100 - splitPercentage;
    const versionBPercent = splitPercentage;

    const successA = await updateTrafficPercentage(versionA, versionAPercent);
    const successB = await updateTrafficPercentage(versionB, versionBPercent);

    if (successA && successB) {
        console.log(`[AB-TEST] Started test: ${versionA}=${versionAPercent}%, ${versionB}=${versionBPercent}%`);
        return true;
    }

    return false;
}

/**
 * Genera una predicción usando la versión seleccionada
 * con ajustes basados en ML si es v2-learning
 */
export async function generatePredictionWithVersion(
    baseConfidence: number,
    contextText: string,
    selectedVersion?: string
): Promise<{
    adjustedConfidence: number;
    modelVersion: string;
    mlAdjustment?: {
        historicalAccuracy: number;
        sampleSize: number;
        recommendation: string;
    };
}> {
    // Seleccionar versión si no se especifica
    const version = selectedVersion || await selectModelVersion();

    if (version === 'v2-learning') {
        // Usar ajustes ML basados en historial
        const adjustment = await calculateConfidenceAdjustment(contextText, baseConfidence);

        return {
            adjustedConfidence: adjustment.adjustedConfidence,
            modelVersion: version,
            mlAdjustment: {
                historicalAccuracy: adjustment.historicalAccuracy,
                sampleSize: adjustment.sampleSize,
                recommendation: adjustment.recommendation
            }
        };
    }

    // v1-stable: usar confianza base sin ajustes
    return {
        adjustedConfidence: baseConfidence,
        modelVersion: version
    };
}
