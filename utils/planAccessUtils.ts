/**
 * Plan Access Utilities
 * Helpers centralizados para determinar acceso a features segun plan + regla de transparencia historica
 */

import { getCurrentDateInBogota } from './dateUtils';

/**
 * Determina si una fecha es "historica" (anterior a hoy en zona Bogota).
 * Datos historicos son visibles para TODOS los planes sin restriccion.
 */
export const isHistoricalDate = (date: string): boolean => {
    const today = getCurrentDateInBogota();
    return date < today;
};

/**
 * Calcula cuantos picks puede ver el usuario segun su plan.
 * - Historico: todos visibles
 * - Free (percentage=1): 1 pick diario
 * - Starter/Pro/Premium: porcentaje del total
 */
export const getAllowedPickCount = (
    totalPicks: number,
    predictionsPercentage: number,
    isHistorical: boolean
): number => {
    if (isHistorical) return totalPicks;
    if (predictionsPercentage >= 100) return totalPicks;
    if (predictionsPercentage <= 1) return Math.min(1, totalPicks); // Free: 1 daily
    return Math.ceil(totalPicks * (predictionsPercentage / 100));
};

/**
 * Determina si el usuario puede ver parlays de una fecha especifica.
 * - Historico: siempre true
 * - Free/Starter (percentage=0): no ve parlays del dia actual
 */
export const canViewParlays = (
    parlayPercentage: number,
    isHistorical: boolean
): boolean => {
    if (isHistorical) return true;
    return parlayPercentage > 0;
};

/**
 * Calcula cuantos parlays puede ver el usuario segun su plan.
 * - Historico: todos visibles
 * - Free/Starter (percentage=0): 0 parlays
 * - Pro (30%): 30% del total
 * - Premium (80%): 80% del total
 */
export const getAllowedParlayCount = (
    totalParlays: number,
    parlayPercentage: number,
    isHistorical: boolean
): number => {
    if (isHistorical) return totalParlays;
    if (parlayPercentage >= 100) return totalParlays;
    if (parlayPercentage <= 0) return 0;
    return Math.ceil(totalParlays * (parlayPercentage / 100));
};

/**
 * Determina si el usuario puede ver/generar analisis de una fecha.
 * - Historico: siempre true
 * - Free (percentage=0): no puede analizar hoy
 */
export const canViewAnalysis = (
    analysisPercentage: number,
    isHistorical: boolean
): boolean => {
    if (isHistorical) return true;
    return analysisPercentage > 0;
};

/**
 * Calcula cuantos partidos puede analizar hoy segun su plan.
 * - Free: 0
 * - Starter (50%): mitad de los partidos
 * - Pro (90%): 90% de los partidos
 * - Premium (100%): todos
 */
export const getAllowedAnalysisCount = (
    totalMatches: number,
    analysisPercentage: number,
    isHistorical: boolean
): number => {
    if (isHistorical) return totalMatches;
    if (analysisPercentage >= 100) return totalMatches;
    if (analysisPercentage === 0) return 0;
    return Math.ceil(totalMatches * (analysisPercentage / 100));
};

/**
 * Determina si un parlay limit es "ilimitado"
 * -1 = ilimitado (Premium), 999999 = admin bypass
 */
export const isUnlimitedParlays = (limit: number): boolean => {
    return limit === -1 || limit >= 999999;
};

/**
 * Obtiene el nombre del plan recomendado para upgrade
 */
export const getRecommendedUpgradePlan = (currentPlan: string): string | null => {
    const upgradeMap: Record<string, string> = {
        free: 'starter',
        starter: 'pro',
        pro: 'premium',
    };
    return upgradeMap[currentPlan] || null;
};
