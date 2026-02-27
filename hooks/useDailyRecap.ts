// hooks/useDailyRecap.ts
// Manages Daily Recap state: fetches data, controls visibility, persists "seen" state in localStorage.

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentDateInBogota } from '../utils/dateUtils';
import { fetchDailyRecapData } from '../services/recapService';
import type { DailyRecapData, RecapTier } from '../types';

const STORAGE_KEY = 'derbix_recap_last_seen';
const FETCH_DELAY_MS = 2000;

function getRecapTier(planName: string, isAdmin: boolean): RecapTier {
    if (isAdmin) return 'admin';
    if (planName === 'premium') return 'premium';
    if (planName === 'pro') return 'pro';
    if (planName === 'starter') return 'starter';
    return 'free';
}

function wasSeenToday(): boolean {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    const today = getCurrentDateInBogota();
    return lastSeen === today;
}

function markSeenToday(): void {
    const today = getCurrentDateInBogota();
    localStorage.setItem(STORAGE_KEY, today);
}

export interface UseDailyRecapReturn {
    isVisible: boolean;
    hasUnseen: boolean;
    hasData: boolean;
    data: DailyRecapData | null;
    tier: RecapTier;
    loading: boolean;
    dismiss: () => void;
    reopen: () => void;
}

export function useDailyRecap(
    planName: string,
    isAdmin: boolean,
    isAuthenticated: boolean,
    isImpersonating: boolean
): UseDailyRecapReturn {
    const [isVisible, setIsVisible] = useState(false);
    const [hasUnseen, setHasUnseen] = useState(false);
    const [data, setData] = useState<DailyRecapData | null>(null);
    const [loading, setLoading] = useState(false);
    const fetchedRef = useRef(false);

    const tier = getRecapTier(planName, isAdmin);

    const dismiss = useCallback(() => {
        setIsVisible(false);
        markSeenToday();
        setHasUnseen(false);
    }, []);

    const reopen = useCallback(() => {
        if (data && data.hasData) {
            setIsVisible(true);
        }
    }, [data]);

    useEffect(() => {
        if (!isAuthenticated || isImpersonating || fetchedRef.current) return;

        const timer = setTimeout(async () => {
            fetchedRef.current = true;
            setLoading(true);
            try {
                const recapData = await fetchDailyRecapData(tier);
                setData(recapData);

                if (recapData.hasData && !wasSeenToday()) {
                    setIsVisible(true);
                    setHasUnseen(true);
                }
            } catch (err) {
                console.error('[useDailyRecap] Error:', err);
            } finally {
                setLoading(false);
            }
        }, FETCH_DELAY_MS);

        return () => clearTimeout(timer);
    }, [isAuthenticated, isImpersonating, tier]);

    return {
        isVisible,
        hasUnseen,
        hasData: data?.hasData ?? false,
        data,
        tier,
        loading,
        dismiss,
        reopen,
    };
}
