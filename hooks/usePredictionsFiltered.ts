/**
 * Hook para obtener pronósticos filtrados según el plan del usuario
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useOrganization } from '../contexts/OrganizationContext';
import {
    getFilteredPredictions,
    recordPredictionView,
    getPredictionStats,
    FilteredPrediction
} from '../services/predictionFilterService';

interface UsePredictionsFiltered {
    predictions: FilteredPrediction[];
    stats: {
        total: number;
        allowed: number;
        locked: number;
        usedToday: number;
        remainingToday: number;
    };
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    recordView: (predictionId: string) => Promise<void>;
}

export function usePredictionsFiltered(matchDate: string): UsePredictionsFiltered {
    const { user } = useAuth();
    const { currentOrganization } = useOrganization();

    const [predictions, setPredictions] = useState<FilteredPrediction[]>([]);
    const [stats, setStats] = useState({
        total: 0,
        allowed: 0,
        locked: 0,
        usedToday: 0,
        remainingToday: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPredictions = useCallback(async () => {
        if (!user?.id || !currentOrganization?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await getFilteredPredictions(
                user.id,
                currentOrganization.id,
                matchDate
            );

            setPredictions(result.predictions);
            setStats(result.stats);
        } catch (err: any) {
            console.error('Error fetching filtered predictions:', err);
            setError(err.message || 'Error al cargar pronósticos');
        } finally {
            setLoading(false);
        }
    }, [user?.id, currentOrganization?.id, matchDate]);

    useEffect(() => {
        fetchPredictions();
    }, [fetchPredictions]);

    const recordView = useCallback(async (predictionId: string) => {
        if (!user?.id || !currentOrganization?.id) return;

        await recordPredictionView(user.id, currentOrganization.id, predictionId);
        // Refrescar después de registrar
        await fetchPredictions();
    }, [user?.id, currentOrganization?.id, fetchPredictions]);

    return {
        predictions,
        stats,
        loading,
        error,
        refetch: fetchPredictions,
        recordView
    };
}

/**
 * Hook para estadísticas de pronósticos (para plan Free)
 */
export function usePredictionStats(matchDate: string) {
    const [stats, setStats] = useState<{
        totalPredictions: number;
        avgConfidence: number;
        highConfidenceCount: number;
        mediumConfidenceCount: number;
        lowConfidenceCount: number;
        leagueBreakdown: Record<string, number>;
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const result = await getPredictionStats(matchDate);
                setStats(result);
            } catch (err) {
                console.error('Error fetching prediction stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [matchDate]);

    return { stats, loading };
}
