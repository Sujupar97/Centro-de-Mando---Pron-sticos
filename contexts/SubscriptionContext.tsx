/**
 * Subscription Context
 * Provee estado global de suscripción del usuario
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from './OrganizationContext';
import {
    getSubscriptionSummary,
    checkFeatureLimit,
    incrementUsage,
    FeatureLimitResult
} from '../services/subscriptionService';

interface SubscriptionState {
    plan: {
        plan_name: string;
        display_name: string;
        predictions_percentage: number;
        monthly_parlay_limit: number;
        monthly_analysis_limit: number | null;
        can_analyze_own_tickets: boolean;
        can_access_ml_dashboard: boolean;
    };
    usage: {
        predictions_used: number;
        parlays_used: number;
        analyses_used: number;
    };
    limits: {
        parlays: { used: number; limit: number; percentage: number };
        analyses: { used: number; limit: number | null; percentage: number };
    };
    isLoading: boolean;
    isPremium: boolean;
    isPro: boolean;
    isStarter: boolean;
    isFree: boolean;
}

interface SubscriptionContextType extends SubscriptionState {
    checkLimit: (feature: 'predictions' | 'parlays' | 'analyses') => Promise<FeatureLimitResult>;
    trackUsage: (feature: 'predictions' | 'parlays' | 'analyses') => Promise<boolean>;
    refreshSubscription: () => Promise<void>;
    canUseParlays: () => Promise<FeatureLimitResult>;
    canUseAnalysis: () => Promise<FeatureLimitResult>;
}

const defaultState: SubscriptionState = {
    plan: {
        plan_name: 'free',
        display_name: 'Gratis',
        predictions_percentage: 0,
        monthly_parlay_limit: 0,
        monthly_analysis_limit: 0,
        can_analyze_own_tickets: false,
        can_access_ml_dashboard: false,
    },
    usage: {
        predictions_used: 0,
        parlays_used: 0,
        analyses_used: 0,
    },
    limits: {
        parlays: { used: 0, limit: 0, percentage: 0 },
        analyses: { used: 0, limit: 0, percentage: 0 },
    },
    isLoading: true,
    isPremium: false,
    isPro: false,
    isStarter: false,
    isFree: true,
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { currentOrg } = useOrganization();
    const [state, setState] = useState<SubscriptionState>(defaultState);

    const refreshSubscription = useCallback(async () => {
        if (!user?.id || !currentOrg?.id) {
            setState(defaultState);
            return;
        }

        setState(prev => ({ ...prev, isLoading: true }));

        try {
            const summary = await getSubscriptionSummary(user.id, currentOrg.id);

            setState({
                plan: summary.plan,
                usage: summary.usage,
                limits: summary.limits,
                isLoading: false,
                isPremium: summary.plan.plan_name === 'premium',
                isPro: summary.plan.plan_name === 'pro',
                isStarter: summary.plan.plan_name === 'starter',
                isFree: summary.plan.plan_name === 'free',
            });
        } catch (error) {
            console.error('Error loading subscription:', error);
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, [user?.id, currentOrg?.id]);

    useEffect(() => {
        refreshSubscription();
    }, [refreshSubscription]);

    const checkLimit = useCallback(async (feature: 'predictions' | 'parlays' | 'analyses') => {
        if (!user?.id || !currentOrg?.id) {
            return { allowed: false, current: 0, limit: 0, message: 'Usuario no autenticado' };
        }
        return checkFeatureLimit(user.id, currentOrg.id, feature);
    }, [user?.id, currentOrg?.id]);

    const trackUsage = useCallback(async (feature: 'predictions' | 'parlays' | 'analyses') => {
        if (!user?.id || !currentOrg?.id) return false;
        const result = await incrementUsage(user.id, currentOrg.id, feature);
        if (result) {
            // Refresh stats after tracking
            await refreshSubscription();
        }
        return result;
    }, [user?.id, currentOrg?.id, refreshSubscription]);

    const canUseParlays = useCallback(() => checkLimit('parlays'), [checkLimit]);
    const canUseAnalysis = useCallback(() => checkLimit('analyses'), [checkLimit]);

    const value: SubscriptionContextType = {
        ...state,
        checkLimit,
        trackUsage,
        refreshSubscription,
        canUseParlays,
        canUseAnalysis,
    };

    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
};

export const useSubscription = (): SubscriptionContextType => {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return context;
};

export default SubscriptionContext;
