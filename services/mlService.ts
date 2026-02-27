// services/mlService.ts
// Frontend service for the ML Auto-Learning system
// Handles training status, calibration factors, patterns, and training triggers

import { supabase } from './supabaseService';

// ── Types ────────────────────────────────────────────────────────────

export interface TrainingRun {
    id: string;
    training_date: string;
    triggered_by: string | null;
    status: 'completed' | 'rolled_back';
    picks_processed: number;
    picks_won: number;
    picks_lost: number;
    picks_void: number;
    calibration_snapshot: any;
    new_calibration: any;
    created_at: string;
}

export interface CalibrationFactor {
    id: string;
    dimension: string;
    dimension_key: string;
    sample_size: number;
    wins: number;
    losses: number;
    actual_wr: number;
    predicted_avg: number;
    calibration_factor: number;
    confidence_adjustment: number;
    roi: number | null;
    status: 'active' | 'disabled';
    last_updated: string;
}

export interface LearnedPattern {
    id: string;
    pattern_type: 'blacklist' | 'boost' | 'warning' | 'insight';
    scope: string;
    scope_key: string;
    rule_text: string;
    severity: 'critical' | 'warning' | 'info';
    based_on_sample: number;
    based_on_wr: number | null;
    auto_generated: boolean;
    active: boolean;
    created_at: string;
    training_run_id: string | null;
}

export interface ParlayCalibration {
    id: string;
    legs_count: number;
    risk_level: string;
    sample_size: number;
    wins: number;
    actual_wr: number;
    avg_odds: number | null;
    roi: number | null;
    recommended_max_legs: number | null;
    recommended_min_leg_prob: number | null;
    status: string;
    last_updated: string;
}

export interface DayAuditStatus {
    date: string;
    totalPicks: number;
    pendingPicks: number;
    wonPicks: number;
    lostPicks: number;
    voidPicks: number;
    isFullyVerified: boolean;
    isAlreadyTrained: boolean;
}

export interface TrainingResult {
    success: boolean;
    daysProcessed: number;
    daysSkipped: number;
    totalPicksProcessed: number;
    factorsUpdated: number;
    patternsGenerated: number;
    summary: string;
    error?: string;
}

// ── Training Status ──────────────────────────────────────────────────

/**
 * Get audit status for each day in a date range.
 * Shows which days are fully verified, which have pending picks,
 * and which have already been used for training.
 */
export async function getDateRangeAuditStatus(startDate: string, endDate: string): Promise<DayAuditStatus[]> {
    // 1. Get all training runs (to know which days are already trained)
    const { data: trainedDays } = await supabase
        .from('ml_training_runs')
        .select('training_date, status')
        .gte('training_date', startDate)
        .lte('training_date', endDate)
        .eq('status', 'completed');

    const trainedSet = new Set((trainedDays || []).map(d => d.training_date));

    // 2. Get fixture IDs per date from daily_matches
    const { data: matches } = await supabase
        .from('daily_matches')
        .select('api_fixture_id, match_date')
        .gte('match_date', startDate)
        .lte('match_date', endDate);

    // Group fixtures by date
    const dateFixtures = new Map<string, number[]>();
    for (const m of (matches || [])) {
        const dateKey = m.match_date;
        if (!dateFixtures.has(dateKey)) dateFixtures.set(dateKey, []);
        dateFixtures.get(dateKey)!.push(m.api_fixture_id);
    }

    // 3. Get all picks for these fixtures
    const allFixtureIds = (matches || []).map(m => m.api_fixture_id);
    if (allFixtureIds.length === 0) return [];

    const { data: picks } = await supabase
        .from('value_picks_v2')
        .select('fixture_id, result')
        .in('fixture_id', allFixtureIds);

    // Group picks by fixture → date
    const fixtureToDate = new Map<number, string>();
    for (const m of (matches || [])) {
        fixtureToDate.set(m.api_fixture_id, m.match_date);
    }

    // Aggregate by date
    const dateStats = new Map<string, { total: number; pending: number; won: number; lost: number; void: number }>();
    for (const p of (picks || [])) {
        const date = fixtureToDate.get(p.fixture_id);
        if (!date) continue;
        if (!dateStats.has(date)) dateStats.set(date, { total: 0, pending: 0, won: 0, lost: 0, void: 0 });
        const s = dateStats.get(date)!;
        s.total++;
        if (p.result === 'PENDING') s.pending++;
        else if (p.result === 'WON') s.won++;
        else if (p.result === 'LOST') s.lost++;
        else if (p.result === 'VOID' || p.result === 'PUSH') s.void++;
    }

    // Build result for each date that has fixtures
    const results: DayAuditStatus[] = [];
    for (const [date, fixtureList] of dateFixtures.entries()) {
        const stats = dateStats.get(date) || { total: 0, pending: 0, won: 0, lost: 0, void: 0 };
        results.push({
            date,
            totalPicks: stats.total,
            pendingPicks: stats.pending,
            wonPicks: stats.won,
            lostPicks: stats.lost,
            voidPicks: stats.void,
            isFullyVerified: stats.total > 0 && stats.pending === 0,
            isAlreadyTrained: trainedSet.has(date),
        });
    }

    // Sort by date ascending
    results.sort((a, b) => a.date.localeCompare(b.date));
    return results;
}

// ── Calibration Factors ──────────────────────────────────────────────

/** Get all active calibration factors */
export async function getCalibrationFactors(): Promise<CalibrationFactor[]> {
    const { data, error } = await supabase
        .from('ml_calibration_factors')
        .select('*')
        .eq('status', 'active')
        .order('dimension', { ascending: true })
        .order('sample_size', { ascending: false });

    if (error) {
        console.error('[mlService] Error fetching calibration factors:', error);
        return [];
    }
    return data || [];
}

/** Toggle a calibration factor active/disabled */
export async function toggleCalibrationFactor(factorId: string, newStatus: 'active' | 'disabled'): Promise<boolean> {
    const { error } = await supabase
        .from('ml_calibration_factors')
        .update({ status: newStatus, last_updated: new Date().toISOString() })
        .eq('id', factorId);

    if (error) {
        console.error('[mlService] Error toggling factor:', error);
        return false;
    }
    return true;
}

// ── Learned Patterns ─────────────────────────────────────────────────

/** Get all learned patterns */
export async function getLearnedPatterns(): Promise<LearnedPattern[]> {
    const { data, error } = await supabase
        .from('ml_learned_patterns')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[mlService] Error fetching patterns:', error);
        return [];
    }
    return data || [];
}

/** Toggle a pattern active/inactive */
export async function togglePattern(patternId: string, active: boolean): Promise<boolean> {
    const { error } = await supabase
        .from('ml_learned_patterns')
        .update({ active })
        .eq('id', patternId);

    if (error) {
        console.error('[mlService] Error toggling pattern:', error);
        return false;
    }
    return true;
}

// ── Training Runs ────────────────────────────────────────────────────

/** Get training history */
export async function getTrainingHistory(limit = 20): Promise<TrainingRun[]> {
    const { data, error } = await supabase
        .from('ml_training_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[mlService] Error fetching training history:', error);
        return [];
    }
    return data || [];
}

/** Trigger ML training for selected dates */
export async function triggerTraining(dates: string[]): Promise<TrainingResult> {
    try {
        const { data, error } = await supabase.functions.invoke('ml-train-calibration', {
            body: { dates }
        });

        if (error) {
            console.error('[mlService] Training invocation error:', error);
            return {
                success: false,
                daysProcessed: 0,
                daysSkipped: 0,
                totalPicksProcessed: 0,
                factorsUpdated: 0,
                patternsGenerated: 0,
                summary: '',
                error: error.message || 'Error al invocar el entrenamiento'
            };
        }

        return data as TrainingResult;
    } catch (err: any) {
        console.error('[mlService] Training error:', err);
        return {
            success: false,
            daysProcessed: 0,
            daysSkipped: 0,
            totalPicksProcessed: 0,
            factorsUpdated: 0,
            patternsGenerated: 0,
            summary: '',
            error: err.message || 'Error inesperado'
        };
    }
}

/** Rollback a training run — restores calibration snapshot */
export async function rollbackTraining(trainingRunId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Get the training run with its snapshot
        const { data: run, error: fetchErr } = await supabase
            .from('ml_training_runs')
            .select('*')
            .eq('id', trainingRunId)
            .single();

        if (fetchErr || !run) {
            return { success: false, error: 'Training run no encontrado' };
        }

        if (run.status === 'rolled_back') {
            return { success: false, error: 'Este entrenamiento ya fue revertido' };
        }

        // 2. Restore calibration factors from snapshot
        const snapshot = run.calibration_snapshot as CalibrationFactor[];
        if (Array.isArray(snapshot) && snapshot.length > 0) {
            for (const factor of snapshot) {
                await supabase
                    .from('ml_calibration_factors')
                    .upsert({
                        dimension: factor.dimension,
                        dimension_key: factor.dimension_key,
                        sample_size: factor.sample_size,
                        wins: factor.wins,
                        losses: factor.losses,
                        actual_wr: factor.actual_wr,
                        predicted_avg: factor.predicted_avg,
                        calibration_factor: factor.calibration_factor,
                        confidence_adjustment: factor.confidence_adjustment,
                        roi: factor.roi,
                        status: factor.status,
                        last_updated: new Date().toISOString(),
                    }, { onConflict: 'dimension,dimension_key' });
            }
        }

        // 3. Deactivate patterns generated by this run
        await supabase
            .from('ml_learned_patterns')
            .update({ active: false })
            .eq('training_run_id', trainingRunId);

        // 4. Mark the training run as rolled back
        await supabase
            .from('ml_training_runs')
            .update({ status: 'rolled_back' })
            .eq('id', trainingRunId);

        return { success: true };
    } catch (err: any) {
        console.error('[mlService] Rollback error:', err);
        return { success: false, error: err.message || 'Error al revertir' };
    }
}

// ── Parlay Calibration ───────────────────────────────────────────────

/** Get parlay calibration data */
export async function getParlayCalibration(): Promise<ParlayCalibration[]> {
    const { data, error } = await supabase
        .from('ml_parlay_calibration')
        .select('*')
        .eq('status', 'active')
        .order('legs_count', { ascending: true });

    if (error) {
        console.error('[mlService] Error fetching parlay calibration:', error);
        return [];
    }
    return data || [];
}

// ── ML System Status ─────────────────────────────────────────────────

/** Get a summary of the ML system status */
export async function getMLSystemStatus(): Promise<{
    isEnabled: boolean;
    totalTrainingRuns: number;
    activeFactors: number;
    activePatterns: number;
    lastTrainingDate: string | null;
    totalPicksTrained: number;
}> {
    // Check if ML is enabled
    const { data: settingData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'ml_auto_learning_enabled')
        .single();

    const isEnabled = settingData?.value === true;

    // Count active factors
    const { count: activeFactors } = await supabase
        .from('ml_calibration_factors')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');

    // Count active patterns
    const { count: activePatterns } = await supabase
        .from('ml_learned_patterns')
        .select('id', { count: 'exact', head: true })
        .eq('active', true);

    // Get training runs summary
    const { data: runs } = await supabase
        .from('ml_training_runs')
        .select('training_date, picks_processed')
        .eq('status', 'completed')
        .order('training_date', { ascending: false });

    const totalTrainingRuns = runs?.length || 0;
    const lastTrainingDate = runs?.[0]?.training_date || null;
    const totalPicksTrained = (runs || []).reduce((sum, r) => sum + (r.picks_processed || 0), 0);

    return {
        isEnabled,
        totalTrainingRuns,
        activeFactors: activeFactors || 0,
        activePatterns: activePatterns || 0,
        lastTrainingDate,
        totalPicksTrained,
    };
}
