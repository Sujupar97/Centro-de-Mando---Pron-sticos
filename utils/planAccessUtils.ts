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

// --- PER-PLAN PERFORMANCE TRACKING ---

export type PlanTier = 'free' | 'starter' | 'pro' | 'premium';

export const PLAN_TIERS: PlanTier[] = ['free', 'starter', 'pro', 'premium'];

export const PLAN_DISPLAY_NAMES: Record<PlanTier, string> = {
    free: 'Gratuito',
    starter: 'Starter',
    pro: 'Pro',
    premium: 'Premium',
};

export const PLAN_PREDICTIONS_PERCENTAGES: Record<PlanTier, number> = {
    free: 1,
    starter: 35,
    pro: 80,
    premium: 100,
};

export const PLAN_PARLAY_PERCENTAGES: Record<PlanTier, number> = {
    free: 0,
    starter: 0,
    pro: 30,
    premium: 80,
};

/**
 * Dado N picks totales en un dia, calcula cuantos ve cada plan.
 */
export const getPickCountPerPlan = (totalPicks: number): Record<PlanTier, number> => {
    return {
        free: getAllowedPickCount(totalPicks, PLAN_PREDICTIONS_PERCENTAGES.free, false),
        starter: getAllowedPickCount(totalPicks, PLAN_PREDICTIONS_PERCENTAGES.starter, false),
        pro: getAllowedPickCount(totalPicks, PLAN_PREDICTIONS_PERCENTAGES.pro, false),
        premium: getAllowedPickCount(totalPicks, PLAN_PREDICTIONS_PERCENTAGES.premium, false),
    };
};

/**
 * Dado N picks ordenados por p_model DESC, asigna el tier exclusivo mas bajo a cada uno.
 * Pick #1 → 'free' (todos lo ven), Picks #2..starter_count → 'starter', etc.
 * El tier exclusivo indica el plan MAS BAJO que incluye ese pick.
 */
export const assignExclusiveTiers = (totalPicks: number): PlanTier[] => {
    const counts = getPickCountPerPlan(totalPicks);
    const tiers: PlanTier[] = [];

    for (let i = 0; i < totalPicks; i++) {
        if (i < counts.free) tiers.push('free');
        else if (i < counts.starter) tiers.push('starter');
        else if (i < counts.pro) tiers.push('pro');
        else tiers.push('premium');
    }
    return tiers;
};

/**
 * Determina si un pick (por su indice 0-based en el arreglo ordenado por p_model DESC)
 * es visible para un plan dado.
 */
export const isPickVisibleForPlan = (
    pickIndex: number,
    totalPicks: number,
    planName: PlanTier
): boolean => {
    const counts = getPickCountPerPlan(totalPicks);
    return pickIndex < counts[planName];
};

/**
 * Filtra un arreglo de picks (ya ordenados por p_model DESC) para un plan especifico.
 * Retorna solo los picks que ese plan puede ver.
 */
export const filterPicksForPlan = <T>(
    picks: T[],
    planName: PlanTier
): T[] => {
    const allowedCount = getAllowedPickCount(
        picks.length,
        PLAN_PREDICTIONS_PERCENTAGES[planName],
        false
    );
    return picks.slice(0, allowedCount);
};
