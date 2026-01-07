import { supabase } from './supabaseService';

interface UserSubscription {
    planId: string;
    planName: string;
    displayName: string;
    predictionsPercentage: number;
    monthlyParlayLimit: number;
    monthlyAnalysisLimit: number | null;
    canAnalyzeOwnTickets: boolean;
    canAccessMLDashboard: boolean;
    canAccessFullStats: boolean;
    hasPrioritySupport: boolean;
    status: string;
    currentPeriodEnd: string;
}

interface UsageStats {
    predictionsViewed: number;
    parlaysCreated: number;
    analysesRan: number;
    periodStart: string;
    periodEnd: string;
}

/**
 * Verifica si el usuario tiene rol de administrador
 * Incluye: platform_owner (dueño) y agency_admin (empleado agencia)
 */
export async function isAdminRole(userId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data?.role === 'platform_owner' ||
            data?.role === 'agency_admin' ||
            data?.role === 'admin' ||      // Backward compatibility
            data?.role === 'superadmin';   // Backward compatibility
    } catch (error) {
        console.error('Error checking admin role:', error);
        return false;
    }
}

/**
 * Obtiene la suscripción activa del usuario
 */
export async function getUserSubscription(
    userId: string,
    orgId?: string
): Promise<UserSubscription | null> {
    try {
        // BYPASS: Si es platform_owner o agency_admin, retornar acceso ilimitado
        const isAdmin = await isAdminRole(userId);
        if (isAdmin) {
            // Obtener rol específico para display name
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            const displayName = profile?.role === 'platform_owner'
                ? 'Owner'
                : profile?.role === 'agency_admin'
                    ? 'Agencia'
                    : 'Admin'; // Backward compatibility

            return {
                planId: 'unlimited',
                planName: 'unlimited',
                displayName: `Acceso Total (${displayName})`,
                predictionsPercentage: 100,
                monthlyParlayLimit: 999999,
                monthlyAnalysisLimit: null, // NULL = ilimitado
                canAnalyzeOwnTickets: true,
                canAccessMLDashboard: true,
                canAccessFullStats: true,
                hasPrioritySupport: true,
                status: 'active',
                currentPeriodEnd: ''
            };
        }

        // Para usuarios regulares (org_owner, org_member, user), consultar get_user_plan
        const { data, error } = await supabase
            .rpc('get_user_plan', {
                p_user_id: userId,
                p_org_id: orgId || null
            });

        if (error) throw error;
        if (!data || data.length === 0) return null;

        const plan = data[0];
        return {
            planId: plan.plan_id,
            planName: plan.plan_name,
            displayName: plan.display_name,
            predictionsPercentage: plan.predictions_percentage,
            monthlyParlayLimit: plan.monthly_parlay_limit,
            monthlyAnalysisLimit: plan.monthly_analysis_limit,
            canAnalyzeOwnTickets: plan.can_analyze_own_tickets,
            canAccessMLDashboard: plan.can_access_ml_dashboard,
            canAccessFullStats: plan.can_access_full_stats,
            hasPrioritySupport: plan.has_priority_support,
            status: plan.status || 'active',
            currentPeriodEnd: plan.current_period_end || ''
        };
    } catch (error) {
        console.error('Error getting user subscription:', error);
        return null;
    }
}

/**
 * Obtiene las estadísticas de uso del mes actual
 */
export async function getUsageStats(
    userId: string,
    orgId?: string
): Promise<UsageStats | null> {
    try {
        const { data, error } = await supabase
            .rpc('get_current_usage', {
                p_user_id: userId,
                p_org_id: orgId || null
            });

        if (error) throw error;
        if (!data || data.length === 0) {
            // Usuario sin uso aún
            return {
                predictionsViewed: 0,
                parlaysCreated: 0,
                analysesRan: 0,
                periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
                periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
            };
        }

        const usage = data[0];
        return {
            predictionsViewed: usage.predictions_viewed || 0,
            parlaysCreated: usage.parlays_created || 0,
            analysesRan: usage.analyses_ran || 0,
            periodStart: usage.period_start,
            periodEnd: usage.period_end
        };
    } catch (error) {
        console.error('Error getting usage stats:', error);
        return null;
    }
}

/**
 * Verifica si el usuario puede ver un pronóstico según su probabilidad
 */
export async function canViewPrediction(
    userId: string,
    predictionProbability: number,
    orgId?: string
): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await getUserSubscription(userId, orgId);

    if (!subscription) {
        return { allowed: false, reason: 'No tienes una suscripción activa' };
    }

    // Plan gratuito: solo puede ver pronósticos básicos (1 al día)
    if (subscription.predictionsPercentage === 0) {
        return {
            allowed: predictionProbability < 60,
            reason: 'Actualiza tu plan para ver pronósticos premium'
        };
    }

    // Verificar si la probabilidad está dentro del % permitido
    // Por ejemplo: Plan Starter (35%) puede ver hasta probabilidad 70%
    // Plan Pro (70%) puede ver hasta probabilidad 85%
    // Plan Premium (100%) puede ver todo

    let maxProbabilityAllowed = 60; // Default para free

    if (subscription.predictionsPercentage === 35) {
        maxProbabilityAllowed = 70;
    } else if (subscription.predictionsPercentage === 70) {
        maxProbabilityAllowed = 85;
    } else if (subscription.predictionsPercentage === 100) {
        maxProbabilityAllowed = 100;
    }

    if (predictionProbability > maxProbabilityAllowed) {
        return {
            allowed: false,
            reason: `Actualiza a un plan superior para acceder a pronósticos de ${predictionProbability}% de probabilidad`
        };
    }

    return { allowed: true };
}

/**
 * Verifica si el usuario puede crear un parlay
 */
export async function canCreateParlay(
    userId: string,
    orgId?: string
): Promise<{ allowed: boolean; remaining: number; reason?: string }> {
    const subscription = await getUserSubscription(userId, orgId);
    const usage = await getUsageStats(userId, orgId);

    if (!subscription || !usage) {
        return { allowed: false, remaining: 0, reason: 'Error al verificar suscripción' };
    }

    // Plan gratuito no permite crear parlays
    if (subscription.monthlyParlayLimit === 0) {
        return {
            allowed: false,
            remaining: 0,
            reason: 'Actualiza tu plan para crear parlays'
        };
    }

    const parlaysUsed = usage.parlaysCreated;
    const remaining = subscription.monthlyParlayLimit - parlaysUsed;

    if (remaining <= 0) {
        return {
            allowed: false,
            remaining: 0,
            reason: `Has alcanzado tu límite mensual de ${subscription.monthlyParlayLimit} parlays`
        };
    }

    return { allowed: true, remaining };
}

/**
 * Verifica si el usuario puede ejecutar un análisis
 */
export async function canRunAnalysis(
    userId: string,
    orgId?: string
): Promise<{ allowed: boolean; remaining: number | null; reason?: string }> {
    const subscription = await getUserSubscription(userId, orgId);
    const usage = await getUsageStats(userId, orgId);

    if (!subscription || !usage) {
        return { allowed: false, remaining: 0, reason: 'Error al verificar suscripción' };
    }

    // Plan gratuito no permite análisis
    if (subscription.monthlyAnalysisLimit === 0) {
        return {
            allowed: false,
            remaining: 0,
            reason: 'Actualiza tu plan para acceder al análisis de IA'
        };
    }

    // Si es ilimitado (null)
    if (subscription.monthlyAnalysisLimit === null) {
        return { allowed: true, remaining: null };
    }

    const analysesUsed = usage.analysesRan;
    const remaining = subscription.monthlyAnalysisLimit - analysesUsed;

    if (remaining <= 0) {
        return {
            allowed: false,
            remaining: 0,
            reason: `Has alcanzado tu límite mensual de ${subscription.monthlyAnalysisLimit} análisis`
        };
    }

    return { allowed: true, remaining };
}

/**
 * Verifica si el usuario puede acceder al ML Dashboard
 */
export async function canAccessMLDashboard(
    userId: string,
    orgId?: string
): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await getUserSubscription(userId, orgId);

    if (!subscription) {
        return { allowed: false, reason: 'No tienes una suscripción activa' };
    }

    if (!subscription.canAccessMLDashboard) {
        return {
            allowed: false,
            reason: 'Actualiza a un plan Pro o Premium para acceder al ML Dashboard'
        };
    }

    return { allowed: true };
}

/**
 * Incrementa el contador de uso de una feature
 */
export async function incrementUsage(
    userId: string,
    orgId: string,
    feature: 'predictions' | 'parlays' | 'analyses'
): Promise<boolean> {
    try {
        const { error } = await supabase
            .rpc('increment_usage', {
                p_user_id: userId,
                p_org_id: orgId,
                p_feature: feature
            });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error incrementing usage:', error);
        return false;
    }
}

/**
 * Obtiene el plan recomendado para upgrade
 */
export function getRecommendedUpgrade(currentPlanName: string): {
    planName: string;
    displayName: string;
    benefits: string[];
} {
    const upgrades: Record<string, any> = {
        free: {
            planName: 'starter',
            displayName: 'Starter',
            benefits: [
                'Acceso al 35% de pronósticos premium',
                '2 parlays mensuales',
                '10 análisis de IA al mes'
            ]
        },
        starter: {
            planName: 'pro',
            displayName: 'Pro',
            benefits: [
                'Acceso al 70% de pronósticos premium',
                '8 parlays mensuales',
                'Análisis ilimitados',
                'Acceso al ML Dashboard',
                'Estadísticas completas'
            ]
        },
        pro: {
            planName: 'premium',
            displayName: 'Premium',
            benefits: [
                '100% de pronósticos premium',
                '24 parlays mensuales (ilimitados)',
                'Todo lo de Pro +',
                'Análisis de tickets propios',
                'Soporte prioritario'
            ]
        }
    };

    return upgrades[currentPlanName] || upgrades.free;
}
