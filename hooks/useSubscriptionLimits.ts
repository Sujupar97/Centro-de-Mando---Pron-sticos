import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useOrganization } from '../contexts/OrganizationContext';
import {
    getUserSubscription,
    getUsageStats,
    canViewPrediction,
    canCreateParlay,
    canRunAnalysis,
    canAccessMLDashboard as checkMLAccess,
    getRecommendedUpgrade
} from '../services/subscriptionCheckService';

interface Subscription {
    planName: string;
    displayName: string;
    predictionsPercentage: number;
    monthlyParlayLimit: number;
    monthlyAnalysisLimit: number | null;
    canAccessMLDashboard: boolean;
    canAnalyzeOwnTickets: boolean;
    hasPrioritySupport: boolean;
}

interface Usage {
    predictionsViewed: number;
    parlaysCreated: number;
    analysesRan: number;
}

export function useSubscriptionLimits() {
    const { user } = useAuth();
    const { currentOrganization } = useOrganization();

    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [usage, setUsage] = useState<Usage | null>(null);
    const [loading, setLoading] = useState(true);

    // Cargar suscripción y uso
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const loadData = async () => {
            const sub = await getUserSubscription(user.id, currentOrganization?.id);
            const stats = await getUsageStats(user.id, currentOrganization?.id);

            if (sub) {
                setSubscription({
                    planName: sub.planName,
                    displayName: sub.displayName,
                    predictionsPercentage: sub.predictionsPercentage,
                    monthlyParlayLimit: sub.monthlyParlayLimit,
                    monthlyAnalysisLimit: sub.monthlyAnalysisLimit,
                    canAccessMLDashboard: sub.canAccessMLDashboard,
                    canAnalyzeOwnTickets: sub.canAnalyzeOwnTickets,
                    hasPrioritySupport: sub.hasPrioritySupport
                });
            }

            if (stats) {
                setUsage({
                    predictionsViewed: stats.predictionsViewed,
                    parlaysCreated: stats.parlaysCreated,
                    analysesRan: stats.analysesRan
                });
            }

            setLoading(false);
        };

        loadData();
    }, [user, currentOrganization]);

    // Verificación de predicción
    const checkPredictionAccess = async (probability: number) => {
        if (!user) return { allowed: false, reason: 'No autenticado' };
        return await canViewPrediction(user.id, probability, currentOrganization?.id);
    };

    // Verificación de parlay
    const checkParlayAccess = async () => {
        if (!user) return { allowed: false, remaining: 0, reason: 'No autenticado' };
        return await canCreateParlay(user.id, currentOrganization?.id);
    };

    // Verificación de análisis
    const checkAnalysisAccess = async () => {
        if (!user) return { allowed: false, remaining: 0, reason: 'No autenticado' };
        return await canRunAnalysis(user.id, currentOrganization?.id);
    };

    // Verificación de ML Dashboard
    const checkMLDashboardAccess = async () => {
        if (!user) return { allowed: false, reason: 'No autenticado' };
        return await checkMLAccess(user.id, currentOrganization?.id);
    };

    // Obtener plan recomendado
    const recommendedUpgrade = subscription
        ? getRecommendedUpgrade(subscription.planName)
        : null;

    // Stats calculados
    const parlaysRemaining = subscription && usage
        ? Math.max(0, subscription.monthlyParlayLimit - usage.parlaysCreated)
        : 0;

    const analysesRemaining = subscription && usage
        ? subscription.monthlyAnalysisLimit === null
            ? null // Ilimitado
            : Math.max(0, subscription.monthlyAnalysisLimit - usage.analysesRan)
        : 0;

    return {
        subscription,
        usage,
        loading,

        // Funciones de verificación
        checkPredictionAccess,
        checkParlayAccess,
        checkAnalysisAccess,
        checkMLDashboardAccess,

        // Stats útiles
        parlaysRemaining,
        analysesRemaining,
        recommendedUpgrade,

        // Helpers
        isPremium: subscription?.planName === 'premium',
        isPro: subscription?.planName === 'pro',
        isStarter: subscription?.planName === 'starter',
        isFree: subscription?.planName === 'free',
    };
}
