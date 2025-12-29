/**
 * Servicio de Filtrado de Pronósticos por Plan
 * 
 * Reglas:
 * - FREE: Solo 1 pronóstico al día (el de menor confianza)
 *         Solo estadísticas de pronósticos de alta probabilidad (sin ver el pronóstico)
 * 
 * - STARTER (35%): 35% de los pronósticos de alta probabilidad (redondeado hacia arriba)
 * 
 * - PRO (70%): 70% de los pronósticos de alta probabilidad (redondeado hacia arriba)
 * 
 * - PREMIUM (100%): Todos los pronósticos
 */

import { supabase } from './supabaseService';
import { getUserSubscription, getUsageStats, incrementUsage } from './subscriptionCheckService';

// Interfaz para pronóstico
export interface Prediction {
    id: string;
    fixture_id: number;
    home_team: string;
    away_team: string;
    league_name: string;
    match_date: string;
    prediction_type: string;
    predicted_outcome: string;
    confidence: number;
    reasoning?: string;
    is_won?: boolean | null;
    prediction_tier?: string;
}

// Interfaz para pronóstico filtrado (puede tener datos ocultos)
export interface FilteredPrediction extends Prediction {
    isLocked: boolean;         // Si está bloqueado por el plan
    lockReason?: string;       // Razón del bloqueo
    showOnlyStats: boolean;    // Solo mostrar estadísticas, no el pronóstico
}

/**
 * Obtiene pronósticos filtrados según el plan del usuario
 */
export async function getFilteredPredictions(
    userId: string,
    orgId: string,
    matchDate: string
): Promise<{
    predictions: FilteredPrediction[];
    stats: {
        total: number;
        allowed: number;
        locked: number;
        usedToday: number;
        remainingToday: number;
    };
}> {
    // 1. Obtener plan del usuario
    const subscription = await getUserSubscription(userId, orgId);
    const usage = await getUsageStats(userId, orgId);

    if (!subscription) {
        return {
            predictions: [],
            stats: { total: 0, allowed: 0, locked: 0, usedToday: 0, remainingToday: 0 }
        };
    }

    // 2. Obtener todos los pronósticos del día
    const { data: allPredictions, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_date', matchDate)
        .order('confidence', { ascending: false });

    if (error || !allPredictions) {
        console.error('Error fetching predictions:', error);
        return {
            predictions: [],
            stats: { total: 0, allowed: 0, locked: 0, usedToday: 0, remainingToday: 0 }
        };
    }

    const total = allPredictions.length;
    if (total === 0) {
        return {
            predictions: [],
            stats: { total: 0, allowed: 0, locked: 0, usedToday: 0, remainingToday: 0 }
        };
    }

    // 3. Calcular cuántos pronósticos puede ver según plan
    const { allowedCount, dailyLimit } = calculateAllowedPredictions(
        subscription.planName,
        subscription.predictionsPercentage,
        total
    );

    const usedToday = usage?.predictionsViewed || 0;
    const remainingToday = dailyLimit !== null ? Math.max(0, dailyLimit - usedToday) : allowedCount;

    // 4. Filtrar pronósticos
    const filteredPredictions: FilteredPrediction[] = allPredictions.map((pred, index) => {
        const isWithinAllowedRange = index < allowedCount;
        const hasRemaining = dailyLimit === null || usedToday < dailyLimit;

        // Plan Free: solo estadísticas, sin ver pronóstico real
        if (subscription.planName === 'free') {
            if (index === 0 && hasRemaining) {
                // Solo el primer pronóstico (menos probable de los "top") visible
                return {
                    ...pred,
                    isLocked: false,
                    showOnlyStats: false
                };
            } else {
                // El resto: solo estadísticas
                return {
                    ...pred,
                    predicted_outcome: '🔒 Actualiza tu plan',
                    reasoning: 'Actualiza a Starter o superior para ver este pronóstico',
                    isLocked: true,
                    lockReason: 'Solo disponible con plan de pago',
                    showOnlyStats: true
                };
            }
        }

        // Otros planes
        if (isWithinAllowedRange && hasRemaining) {
            return {
                ...pred,
                isLocked: false,
                showOnlyStats: false
            };
        } else {
            return {
                ...pred,
                predicted_outcome: '🔒 Pronóstico Premium',
                reasoning: `Disponible con ${getRequiredPlan(index, total)}`,
                isLocked: true,
                lockReason: !hasRemaining
                    ? 'Límite diario alcanzado'
                    : 'Pronóstico de alta probabilidad (requiere plan superior)',
                showOnlyStats: true
            };
        }
    });

    return {
        predictions: filteredPredictions,
        stats: {
            total,
            allowed: allowedCount,
            locked: total - allowedCount,
            usedToday,
            remainingToday
        }
    };
}

/**
 * Calcula cuántos pronósticos puede ver según plan
 */
function calculateAllowedPredictions(
    planName: string,
    percentage: number,
    total: number
): { allowedCount: number; dailyLimit: number | null } {
    switch (planName) {
        case 'free':
            // Free: solo 1 al día
            return { allowedCount: 1, dailyLimit: 1 };

        case 'starter':
            // Starter: 35% redondeado hacia arriba
            return {
                allowedCount: Math.ceil(total * 0.35),
                dailyLimit: null // Sin límite diario, solo % de los disponibles
            };

        case 'pro':
            // Pro: 70% redondeado hacia arriba
            return {
                allowedCount: Math.ceil(total * 0.70),
                dailyLimit: null
            };

        case 'premium':
            // Premium: 100%
            return { allowedCount: total, dailyLimit: null };

        default:
            return { allowedCount: 0, dailyLimit: 0 };
    }
}

/**
 * Determina qué plan se necesita para ver un pronóstico según su posición
 */
function getRequiredPlan(index: number, total: number): string {
    const percentile = (index + 1) / total;

    if (percentile <= 0.35) return 'Plan Starter o superior';
    if (percentile <= 0.70) return 'Plan Pro o superior';
    return 'Plan Premium';
}

/**
 * Registra que el usuario vio un pronóstico
 */
export async function recordPredictionView(
    userId: string,
    orgId: string,
    predictionId: string
): Promise<boolean> {
    // Incrementar contador de uso
    return await incrementUsage(userId, orgId, 'predictions');
}

/**
 * Verifica si el usuario puede ver un pronóstico específico
 */
export async function canViewPrediction(
    userId: string,
    orgId: string,
    predictionConfidence: number,
    predictionRank: number, // Posición en el ranking (1 = más probable)
    totalPredictions: number
): Promise<{
    canView: boolean;
    reason?: string;
    requiredPlan?: string;
}> {
    const subscription = await getUserSubscription(userId, orgId);
    const usage = await getUsageStats(userId, orgId);

    if (!subscription) {
        return { canView: false, reason: 'Sin suscripción activa' };
    }

    const { allowedCount, dailyLimit } = calculateAllowedPredictions(
        subscription.planName,
        subscription.predictionsPercentage,
        totalPredictions
    );

    // Verificar límite diario
    if (dailyLimit !== null && (usage?.predictionsViewed || 0) >= dailyLimit) {
        return {
            canView: false,
            reason: 'Límite diario alcanzado',
            requiredPlan: 'Starter o superior para más pronósticos'
        };
    }

    // Verificar si está en el rango permitido
    if (predictionRank > allowedCount) {
        return {
            canView: false,
            reason: 'Pronóstico premium',
            requiredPlan: getRequiredPlan(predictionRank - 1, totalPredictions)
        };
    }

    return { canView: true };
}

/**
 * Obtiene estadísticas de pronósticos (sin revelar los pronósticos)
 * Para plan Free que solo puede ver stats
 */
export async function getPredictionStats(matchDate: string): Promise<{
    totalPredictions: number;
    avgConfidence: number;
    highConfidenceCount: number; // >70%
    mediumConfidenceCount: number; // 50-70%
    lowConfidenceCount: number; // <50%
    leagueBreakdown: Record<string, number>;
}> {
    const { data: predictions } = await supabase
        .from('predictions')
        .select('confidence, league_name')
        .eq('match_date', matchDate);

    if (!predictions || predictions.length === 0) {
        return {
            totalPredictions: 0,
            avgConfidence: 0,
            highConfidenceCount: 0,
            mediumConfidenceCount: 0,
            lowConfidenceCount: 0,
            leagueBreakdown: {}
        };
    }

    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    const high = predictions.filter(p => p.confidence >= 70).length;
    const medium = predictions.filter(p => p.confidence >= 50 && p.confidence < 70).length;
    const low = predictions.filter(p => p.confidence < 50).length;

    const leagueBreakdown: Record<string, number> = {};
    predictions.forEach(p => {
        leagueBreakdown[p.league_name] = (leagueBreakdown[p.league_name] || 0) + 1;
    });

    return {
        totalPredictions: predictions.length,
        avgConfidence: Math.round(avgConfidence),
        highConfidenceCount: high,
        mediumConfidenceCount: medium,
        lowConfidenceCount: low,
        leagueBreakdown
    };
}
