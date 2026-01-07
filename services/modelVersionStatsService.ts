import { supabase } from './supabaseService';

/**
 * SERVICIO DE ESTADÍSTICAS POR VERSIÓN DEL MODELO
 * 
 * Obtiene métricas separadas para v1-stable vs v2-learning
 * para validar efectividad del ML
 */

export interface ModelVersionStats {
    version: string;
    total: number;
    verified: number;
    won: number;
    lost: number;
    pending: number;
    accuracy: number; // Porcentaje
}

/**
 * Obtiene estadísticas de todas las versiones del modelo
 */
export async function getStatsByModelVersion(): Promise<ModelVersionStats[]> {
    try {
        // Obtener todas las predicciones con model_version
        const { data, error } = await supabase
            .from('predictions')
            .select('model_version, is_won')
            .not('model_version', 'is', null);

        if (error) {
            console.error('[STATS] Error fetching predictions:', error);
            return [];
        }

        if (!data || data.length === 0) {
            return [];
        }

        // Agrupar por versión
        const statsByVersion: Record<string, ModelVersionStats> = {};

        data.forEach((pred) => {
            const version = pred.model_version || 'unknown';

            if (!statsByVersion[version]) {
                statsByVersion[version] = {
                    version,
                    total: 0,
                    verified: 0,
                    won: 0,
                    lost: 0,
                    pending: 0,
                    accuracy: 0
                };
            }

            const stats = statsByVersion[version];
            stats.total++;

            if (pred.is_won === null) {
                stats.pending++;
            } else {
                stats.verified++;
                if (pred.is_won) {
                    stats.won++;
                } else {
                    stats.lost++;
                }
            }
        });

        // Calcular accuracy
        Object.values(statsByVersion).forEach((stats) => {
            if (stats.verified > 0) {
                stats.accuracy = (stats.won / stats.verified) * 100;
            }
        });

        // Convertir a array y ordenar por total descendente
        return Object.values(statsByVersion).sort((a, b) => b.total - a.total);
    } catch (error) {
        console.error('[STATS] Unexpected error:', error);
        return [];
    }
}

/**
 * Obtiene comparación lado a lado de v1 vs v2
 */
export async function getV1VsV2Comparison(): Promise<{
    v1: ModelVersionStats | null;
    v2: ModelVersionStats | null;
    difference: {
        accuracyDiff: number;
        betterVersion: 'v1-stable' | 'v2-learning' | 'tie';
        isSignificant: boolean; // Si la diferencia es > 5%
    };
}> {
    const allStats = await getStatsByModelVersion();

    const v1 = allStats.find((s) => s.version === 'v1-stable') || null;
    const v2 = allStats.find((s) => s.version === 'v2-learning') || null;

    let accuracyDiff = 0;
    let betterVersion: 'v1-stable' | 'v2-learning' | 'tie' = 'tie';
    let isSignificant = false;

    if (v1 && v2) {
        accuracyDiff = v2.accuracy - v1.accuracy;
        isSignificant = Math.abs(accuracyDiff) > 5;

        if (accuracyDiff > 0) {
            betterVersion = 'v2-learning';
        } else if (accuracyDiff < 0) {
            betterVersion = 'v1-stable';
        }
    }

    return {
        v1,
        v2,
        difference: {
            accuracyDiff,
            betterVersion,
            isSignificant
        }
    };
}

/**
 * Verifica si hay suficientes datos para comparación confiable
 */
export function hasEnoughDataForComparison(
    v1Stats: ModelVersionStats | null,
    v2Stats: ModelVersionStats | null,
    minSampleSize: number = 50
): boolean {
    if (!v1Stats || !v2Stats) return false;
    return v1Stats.verified >= minSampleSize && v2Stats.verified >= minSampleSize;
}
