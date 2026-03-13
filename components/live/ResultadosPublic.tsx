// components/live/ResultadosPublic.tsx
// Public results tab - accessible to all users
// Shows system performance: accuracy, recent results, streaks, bankroll projection
// Includes Smart Parlay results with filtering (Todos / Pronósticos / Parlays)

import React, { useState, useEffect } from 'react';
import { getPublicResults, getResultsByPlan } from '../../services/resultsService';
import type { PublicResultsData, ParlayResultData, PickResult, PlanTier } from '../../types';
import { ChartBarIcon, ArrowPathIcon, TrophyIcon } from '../icons/Icons';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PLAN_DISPLAY_NAMES, PLAN_PREDICTIONS_PERCENTAGES, getRecommendedUpgradePlan } from '../../utils/planAccessUtils';
import { getCurrentDateInBogota } from '../../utils/dateUtils';
import { getFilterStakingLabel, getStakingLabel } from '../../services/stakingService';

type PeriodKey = 'ayer' | 'hoy' | '7d' | '30d' | '90d' | 'all';
type PeriodOption = { key: PeriodKey; label: string };
type ResultFilter = 'all' | 'picks' | 'parlays';

const PERIODS: PeriodOption[] = [
    { key: 'ayer', label: 'Ayer' },
    { key: 'hoy', label: 'Hoy' },
    { key: '7d', label: '7 días' },
    { key: '30d', label: '30 días' },
    { key: '90d', label: '90 días' },
    { key: 'all', label: 'Todo' },
];

const RESULT_FILTERS: { key: ResultFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'picks', label: 'Pronósticos' },
    { key: 'parlays', label: 'Parlays' },
];

function getDateRange(period: PeriodKey): { startDate: string; endDate: string } {
    // Use Bogotá timezone to match Oportunidades date handling
    const todayStr = getCurrentDateInBogota();
    const [y, m, d] = todayStr.split('-').map(Number);
    const bogotaToday = new Date(y, m - 1, d);
    const fmt = (date: Date) => {
        const yr = date.getFullYear();
        const mo = String(date.getMonth() + 1).padStart(2, '0');
        const dy = String(date.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${dy}`;
    };

    switch (period) {
        case 'hoy':
            return { startDate: todayStr, endDate: todayStr };
        case 'ayer': {
            const ayer = new Date(bogotaToday);
            ayer.setDate(ayer.getDate() - 1);
            return { startDate: fmt(ayer), endDate: fmt(ayer) };
        }
        case '7d': {
            const start = new Date(bogotaToday);
            start.setDate(start.getDate() - 7);
            return { startDate: fmt(start), endDate: todayStr };
        }
        case '30d': {
            const start = new Date(bogotaToday);
            start.setDate(start.getDate() - 30);
            return { startDate: fmt(start), endDate: todayStr };
        }
        case '90d': {
            const start = new Date(bogotaToday);
            start.setDate(start.getDate() - 90);
            return { startDate: fmt(start), endDate: todayStr };
        }
        case 'all':
            return { startDate: '2026-02-17', endDate: todayStr };
    }
}

const RISK_COLORS: Record<string, string> = {
    conservative: 'from-emerald-500 to-green-600',
    balanced: 'from-amber-500 to-orange-600',
    aggressive: 'from-red-500 to-rose-600',
};

const RISK_LABELS: Record<string, string> = {
    conservative: 'Conservador',
    balanced: 'Equilibrado',
    aggressive: 'Agresivo',
};

type ViewMode = 'plan' | 'global';

const ResultadosPublic: React.FC<{ refreshTrigger?: number }> = ({ refreshTrigger }) => {
    const [data, setData] = useState<PublicResultsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('7d');
    const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('plan');

    const { plan, isAdmin } = useSubscription();
    const planName = plan.plan_name as PlanTier;
    const isUnlimited = planName === 'premium' || isAdmin;
    const effectiveViewMode = isUnlimited ? 'global' : viewMode;

    const loadResults = async (retryCount = 0) => {
        setLoading(true);
        setError(null);

        // Check sessionStorage cache (TTL 5 min)
        const cacheKey = `results_${selectedPeriod}_${resultFilter}_${effectiveViewMode}_${planName}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached && retryCount === 0) {
            try {
                const { data: cachedData, ts } = JSON.parse(cached);
                if (Date.now() - ts < 5 * 60 * 1000) {
                    setData(cachedData);
                    setLoading(false);
                    return;
                }
            } catch { /* ignore corrupt cache */ }
        }

        try {
            const { startDate, endDate } = getDateRange(selectedPeriod);
            let results: PublicResultsData;
            if (effectiveViewMode === 'plan' && !isUnlimited) {
                results = await getResultsByPlan(startDate, endDate, planName, resultFilter);
            } else {
                results = await getPublicResults(startDate, endDate, resultFilter);
            }
            setData(results);
            // Cache result
            try { sessionStorage.setItem(cacheKey, JSON.stringify({ data: results, ts: Date.now() })); } catch { /* quota exceeded */ }
        } catch (err: any) {
            console.error('[ResultadosPublic] Error:', err);
            // Auto-retry once on network error
            if (retryCount === 0) {
                console.log('[ResultadosPublic] Retrying...');
                return loadResults(1);
            }
            setError(err.message || 'Error al cargar resultados');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadResults(); }, [selectedPeriod, resultFilter, refreshTrigger, effectiveViewMode]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-300 font-medium">Cargando Resultados...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-red-400 mb-4 bg-red-900/20 px-4 py-2 rounded-lg border border-red-500/30">{error}</p>
                <button onClick={loadResults} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-all">
                    <ArrowPathIcon className="w-4 h-4" /> Reintentar
                </button>
            </div>
        );
    }

    const hasPickResults = data && data.totalVerified > 0;
    const hasParlayResults = data?.parlays && data.parlays.totalVerified > 0;
    const hasAnyResults = hasPickResults || hasParlayResults;

    if (!hasAnyResults) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl shadow-lg shadow-emerald-500/20">
                            <TrophyIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">Resultados</h3>
                            <p className="text-sm text-slate-400">Pronósticos verificados del sistema</p>
                        </div>
                    </div>
                    <PeriodFilters selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} onRefresh={loadResults} />
                </div>
                <ResultFilterButtons selected={resultFilter} onSelect={setResultFilter} />
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-white/5">
                        <ChartBarIcon className="w-12 h-12 text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Sin Resultados Verificados</h3>
                    <p className="text-slate-400 max-w-md leading-relaxed">
                        Los resultados aparecen cuando se verifican los pronósticos después de que los partidos terminan.
                    </p>
                </div>
            </div>
        );
    }

    const s = data!;
    const br = s.bankroll;
    const pl = s.parlays;

    // Determine which stats to show based on filter
    const showPicks = resultFilter !== 'parlays';
    const showParlays = resultFilter !== 'picks';

    // Compute display KPIs based on filter
    const displayWon = resultFilter === 'parlays' ? (pl?.won ?? 0) : resultFilter === 'picks' ? s.won : s.won + (pl?.won ?? 0);
    const displayLost = resultFilter === 'parlays' ? (pl?.lost ?? 0) : resultFilter === 'picks' ? s.lost : s.lost + (pl?.lost ?? 0);
    const displayTotal = displayWon + displayLost;
    const displayWinRate = displayTotal > 0 ? (displayWon / displayTotal) * 100 : 0;
    const displayPending = resultFilter === 'parlays' ? (pl?.totalPending ?? 0) : resultFilter === 'picks' ? s.totalPending : s.totalPending + (pl?.totalPending ?? 0);
    const stakingLabel = getFilterStakingLabel(resultFilter);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl shadow-lg shadow-emerald-500/20">
                        <TrophyIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white tracking-tight">Resultados</h3>
                        <p className="text-sm text-slate-400">
                            {displayPending > 0
                                ? `${displayTotal} verificados de ${displayTotal + displayPending} pronósticos`
                                : 'Pronósticos verificados del sistema'}
                        </p>
                    </div>
                </div>
                <PeriodFilters selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} onRefresh={loadResults} />
            </div>

            {/* View Mode Toggle (Mi Plan / Global) — only for non-admin users */}
            {!isUnlimited && (
                <div className="flex items-center gap-2">
                    <ViewModeToggle selected={effectiveViewMode} onSelect={setViewMode} planDisplayName={PLAN_DISPLAY_NAMES[planName] || plan.display_name} />
                </div>
            )}

            {/* Plan Value Banner — only in plan view mode for non-admin users */}
            {effectiveViewMode === 'plan' && !isUnlimited && data && data.totalVerified > 0 && (
                <PlanValueBanner
                    data={data}
                    planName={planName}
                    planDisplayName={PLAN_DISPLAY_NAMES[planName] || plan.display_name}
                    predictionsPercentage={PLAN_PREDICTIONS_PERCENTAGES[planName] || plan.predictions_percentage}
                />
            )}

            {/* Result Type Filter */}
            <ResultFilterButtons selected={resultFilter} onSelect={setResultFilter} />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Aciertos */}
                <div className="bg-slate-900 border border-white/10 rounded-xl p-5 text-center">
                    <div className={`text-3xl font-black ${displayWinRate >= 55 ? 'text-emerald-400' : displayWinRate >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                        {displayWinRate.toFixed(1)}%
                    </div>
                    <span className="block text-xs text-slate-400 uppercase mt-1">Aciertos</span>
                    <div className="flex items-center justify-center gap-3 mt-2">
                        <span className="text-emerald-400 font-bold text-base">{displayWon} ganadas</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-red-400 font-bold text-base">{displayLost} perdidas</span>
                    </div>
                    <span className="block text-xs text-slate-500 mt-1">de {displayTotal} verificadas</span>
                    {displayPending > 0 && (
                        <span className="block text-xs text-amber-400 mt-1">
                            {displayPending} pendiente{displayPending > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* Resultado del Periodo */}
                {br && (
                    <div className="bg-slate-900 border border-white/10 rounded-xl p-5 text-center">
                        <div className={`text-3xl font-black ${(br.periodProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(br.periodProfit ?? 0) >= 0 ? '+' : ''}${(br.periodProfit ?? 0).toFixed(2)}
                        </div>
                        <span className="block text-xs text-slate-400 uppercase mt-1">Resultado</span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                            ${(br.periodStaked ?? 0).toFixed(0)} apostado
                        </span>
                    </div>
                )}

                {/* Rentabilidad del Periodo */}
                {br && (
                    <div className="bg-slate-900 border border-white/10 rounded-xl p-5 text-center">
                        <div className={`text-3xl font-black ${(br.periodROI ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(br.periodROI ?? 0) >= 0 ? '+' : ''}{(br.periodROI ?? 0).toFixed(1)}%
                        </div>
                        <span className="block text-xs text-slate-400 uppercase mt-1">Rentabilidad</span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                            Rendimiento del periodo
                        </span>
                    </div>
                )}

                {/* Capital Actual */}
                {br && (
                    <div className="bg-slate-900 border border-white/10 rounded-xl p-5 text-center">
                        <div className="text-3xl font-black text-white">
                            ${br.current.toFixed(2)}
                        </div>
                        <span className="block text-xs text-slate-400 uppercase mt-1">Capital Actual</span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                            {stakingLabel}
                        </span>
                    </div>
                )}
            </div>

            {/* Professional Metrics Row */}
            {(s.units || s.maxDrawdown !== undefined || s.avgOdds) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {s.units && (
                        <div className="bg-slate-800/50 border border-white/5 rounded-lg p-3 text-center">
                            <div className={`text-lg font-bold ${s.units.periodYield >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {s.units.periodYield >= 0 ? '+' : ''}{s.units.periodYield.toFixed(1)}%
                            </div>
                            <span className="text-[10px] text-slate-500 uppercase">Yield</span>
                        </div>
                    )}
                    {s.units && (
                        <div className="bg-slate-800/50 border border-white/5 rounded-lg p-3 text-center">
                            <div className={`text-lg font-bold ${s.units.periodUnitsProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {s.units.periodUnitsProfit >= 0 ? '+' : ''}{s.units.periodUnitsProfit.toFixed(1)}u
                            </div>
                            <span className="text-[10px] text-slate-500 uppercase">Profit (u)</span>
                        </div>
                    )}
                    {s.maxDrawdown !== undefined && (
                        <div className="bg-slate-800/50 border border-white/5 rounded-lg p-3 text-center">
                            <div className={`text-lg font-bold ${s.maxDrawdown > 10 ? 'text-red-400' : s.maxDrawdown > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                -{s.maxDrawdown.toFixed(1)}%
                            </div>
                            <span className="text-[10px] text-slate-500 uppercase">Max Drawdown</span>
                        </div>
                    )}
                    {(s.bestStreak || s.worstStreak) && (
                        <div className="bg-slate-800/50 border border-white/5 rounded-lg p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-emerald-400 font-bold text-lg">{s.bestStreak || 0}</span>
                                <span className="text-slate-600">/</span>
                                <span className="text-red-400 font-bold text-lg">{s.worstStreak || 0}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 uppercase">Rachas W/L</span>
                        </div>
                    )}
                    {s.avgOdds !== undefined && s.avgOdds > 0 && (
                        <div className="bg-slate-800/50 border border-white/5 rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-amber-400">
                                @{s.avgOdds.toFixed(2)}
                            </div>
                            <span className="text-[10px] text-slate-500 uppercase">Odds Prom</span>
                        </div>
                    )}
                </div>
            )}

            {/* Acumulado Banner */}
            {br && (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-sm">
                        <span className="text-slate-500">Acumulado desde inicio:</span>
                        <span className={`font-bold ${br.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {br.profit >= 0 ? '+' : ''}${br.profit.toFixed(2)} ({br.roi >= 0 ? '+' : ''}{br.roi.toFixed(1)}%)
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-500">Capital: <span className="text-white font-bold">${br.base}</span></span>
                        <span className="text-slate-500">Stake: <span className="text-white font-bold">{stakingLabel}</span></span>
                    </div>
                </div>
            )}

            {/* Recent Pick Results */}
            {showPicks && s.recentResults.length > 0 && (
                <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                        <h4 className="text-white font-bold">Resultados Recientes — Pronósticos</h4>
                    </div>
                    <div className="divide-y divide-white/5">
                        {s.recentResults.map((pick) => (
                            <div key={pick.id} className={`p-4 flex items-center justify-between ${pick.result === 'LOST' ? 'opacity-60' : ''}`}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ResultIcon result={pick.result} />
                                        <span className="text-white font-medium text-sm truncate">
                                            {pick.home_team} vs {pick.away_team}
                                        </span>
                                        {pick.actual_score && (
                                            <span className="text-slate-500 text-xs">({pick.actual_score})</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-slate-500">{translateMarket(pick.market)}</span>
                                        <span className="text-slate-400 font-medium">{pick.selection}</span>
                                        {pick.league && <span className="text-slate-600">{'\u2022'} {pick.league}</span>}
                                        {pick.match_date && <span className="text-slate-600">{'\u2022'} {pick.match_date}</span>}
                                    </div>
                                </div>
                                <div className="text-right ml-4 flex-shrink-0">
                                    <span className={`font-bold text-sm block ${pick.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {pick.profit_loss >= 0 ? '+' : ''}${pick.profit_loss.toFixed(0)}
                                    </span>
                                    <span className="text-slate-500 text-[10px]">
                                        {pick.units ? `${pick.units}u` : ''}{pick.odds ? ` @${pick.odds.toFixed(2)}` : ''}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Parlay Results */}
            {showParlays && (
                <ParlayResultsSection parlays={pl} baseBankroll={br?.base || 100} />
            )}
        </div>
    );
};

// ─── Plan View Sub-components ────────────────────────────────

const ViewModeToggle: React.FC<{
    selected: ViewMode;
    onSelect: (m: ViewMode) => void;
    planDisplayName: string;
}> = ({ selected, onSelect, planDisplayName }) => (
    <div className="flex items-center bg-slate-800 rounded-lg border border-white/10 p-0.5">
        <button
            onClick={() => onSelect('plan')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                selected === 'plan'
                    ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                    : 'text-slate-400 hover:text-white'
            }`}
        >
            Mi Plan ({planDisplayName})
        </button>
        <button
            onClick={() => onSelect('global')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                selected === 'global'
                    ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                    : 'text-slate-400 hover:text-white'
            }`}
        >
            Global
        </button>
    </div>
);

const PlanValueBanner: React.FC<{
    data: PublicResultsData;
    planName: PlanTier;
    planDisplayName: string;
    predictionsPercentage: number;
}> = ({ data, planName, planDisplayName, predictionsPercentage }) => {
    const br = data.bankroll;
    const periodProfit = br?.periodProfit ?? 0;
    const isPositive = periodProfit >= 0;
    const upgradePlan = getRecommendedUpgradePlan(planName);
    const upgradeDisplayName = upgradePlan ? (PLAN_DISPLAY_NAMES[upgradePlan as PlanTier] || upgradePlan) : null;

    return (
        <div className={`rounded-xl border p-4 ${
            isPositive
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-red-500/5 border-red-500/20'
        }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isPositive ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                        <ChartBarIcon className={`w-5 h-5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-sm">
                            Tu Plan {planDisplayName}
                            <span className="text-slate-500 font-normal ml-2 text-xs">
                                {predictionsPercentage >= 100 ? '100%' : predictionsPercentage <= 1 ? '1 pick/dia' : `${predictionsPercentage}%`} de los picks
                            </span>
                        </h4>
                        <div className="flex items-center gap-4 mt-1">
                            <span className={`font-bold text-lg ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isPositive ? '+' : ''}${periodProfit.toFixed(2)}
                            </span>
                            <span className="text-slate-400 text-xs">
                                {data.winRate.toFixed(1)}% aciertos
                            </span>
                            <span className="text-slate-400 text-xs">
                                {data.totalVerified} picks
                            </span>
                        </div>
                    </div>
                </div>
                {upgradePlan && upgradeDisplayName && (
                    <a
                        href="/app/pricing"
                        className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium whitespace-nowrap"
                    >
                        Desbloquea mas con {upgradeDisplayName} →
                    </a>
                )}
            </div>
        </div>
    );
};

// ─── Sub-components ──────────────────────────────────────────

const ResultFilterButtons: React.FC<{ selected: ResultFilter; onSelect: (f: ResultFilter) => void }> = ({ selected, onSelect }) => (
    <div className="flex items-center gap-2">
        {RESULT_FILTERS.map(f => (
            <button
                key={f.key}
                onClick={() => onSelect(f.key)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    selected === f.key
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
            >
                {f.label}
            </button>
        ))}
    </div>
);

const ParlayResultsSection: React.FC<{ parlays?: PublicResultsData['parlays']; baseBankroll?: number }> = ({ parlays, baseBankroll = 100 }) => {
    if (!parlays || parlays.recentResults.length === 0) {
        if (parlays && parlays.totalPending > 0) {
            return (
                <div className="bg-slate-900 border border-white/10 rounded-xl p-6 text-center">
                    <h4 className="text-white font-bold mb-2">Smart Parlays</h4>
                    <p className="text-amber-400 text-sm">
                        {parlays.totalPending} parlay{parlays.totalPending > 1 ? 's' : ''} pendiente{parlays.totalPending > 1 ? 's' : ''} de verificación
                    </p>
                </div>
            );
        }
        return (
            <div className="bg-slate-900 border border-white/10 rounded-xl p-6 text-center">
                <h4 className="text-white font-bold mb-2">Smart Parlays</h4>
                <p className="text-slate-400 text-sm">
                    Sin parlays verificados en este periodo.
                </p>
            </div>
        );
    }

    // Calculate financial summary
    const stakePerParlay = baseBankroll * 0.01;
    const wonParlays = parlays.recentResults.filter(p => p.status === 'WON');
    const lostParlays = parlays.recentResults.filter(p => p.status === 'LOST');
    const totalGains = wonParlays.reduce((sum, p) => sum + (stakePerParlay * ((p.combined_odds || 1) - 1)), 0);
    const totalLosses = lostParlays.length * stakePerParlay;
    const netResult = totalGains - totalLosses;
    const netPct = baseBankroll > 0 ? (netResult / baseBankroll) * 100 : 0;
    const gainsPct = baseBankroll > 0 ? (totalGains / baseBankroll) * 100 : 0;
    const lossesPct = baseBankroll > 0 ? (totalLosses / baseBankroll) * 100 : 0;
    const parlayROI = parlays.periodStaked > 0 ? (parlays.periodProfit / parlays.periodStaked) * 100 : 0;

    return (
        <div className="space-y-4">
            {/* Financial Summary Card */}
            <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h4 className="text-white font-bold">Rendimiento Parlays</h4>
                    <span className="text-xs text-slate-500">0.25-1u por parlay</span>
                </div>
                <div className="p-4 space-y-3">
                    {/* Net Result - Hero Number */}
                    <div className="text-center py-2">
                        <div className={`text-3xl font-black ${netResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {netResult >= 0 ? '+' : ''}{netPct.toFixed(1)}%
                        </div>
                        <span className="text-xs text-slate-400">
                            {netResult >= 0 ? '+' : ''}${netResult.toFixed(2)} resultado neto
                        </span>
                    </div>

                    {/* Gains vs Losses Breakdown */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                            <div className="text-emerald-400 font-bold text-lg">
                                {parlays.won} ganado{parlays.won !== 1 ? 's' : ''}
                            </div>
                            <span className="text-emerald-300/70 text-xs block">
                                +${totalGains.toFixed(2)} (+{gainsPct.toFixed(1)}%)
                            </span>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                            <div className="text-red-400 font-bold text-lg">
                                {parlays.lost} perdido{parlays.lost !== 1 ? 's' : ''}
                            </div>
                            <span className="text-red-300/70 text-xs block">
                                -${totalLosses.toFixed(2)} (-{lossesPct.toFixed(1)}%)
                            </span>
                        </div>
                    </div>

                    {/* Detail Row */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                        <span>Apostado: ${parlays.periodStaked.toFixed(2)} ({parlays.totalVerified} parlay{parlays.totalVerified !== 1 ? 's' : ''})</span>
                        <span>ROI: <span className={parlayROI >= 0 ? 'text-emerald-400' : 'text-red-400'}>{parlayROI >= 0 ? '+' : ''}{parlayROI.toFixed(0)}%</span></span>
                    </div>

                    {parlays.totalPending > 0 && (
                        <div className="text-center text-xs text-amber-400 pt-1">
                            {parlays.totalPending} parlay{parlays.totalPending > 1 ? 's' : ''} pendiente{parlays.totalPending > 1 ? 's' : ''} de verificación
                        </div>
                    )}
                </div>
            </div>

            {/* Individual Parlay Cards */}
            <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h4 className="text-white font-bold">Detalle por Parlay</h4>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-emerald-400 font-bold">{parlays.won}W</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-red-400 font-bold">{parlays.lost}L</span>
                    </div>
                </div>
                <div className="divide-y divide-white/5">
                    {parlays.recentResults.map((parlay) => (
                        <ParlayCard key={parlay.id} parlay={parlay} />
                    ))}
                </div>
            </div>
        </div>
    );
};

const ParlayCard: React.FC<{ parlay: ParlayResultData }> = ({ parlay }) => {
    const isWon = parlay.status === 'WON';
    const isLost = parlay.status === 'LOST';
    const riskGradient = RISK_COLORS[parlay.risk_tier] || RISK_COLORS.balanced;
    const riskLabel = RISK_LABELS[parlay.risk_tier] || parlay.risk_tier;

    return (
        <div className={`p-4 ${isLost ? 'opacity-60' : ''}`}>
            {/* Parlay Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <ResultIcon result={parlay.status} />
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold bg-gradient-to-r ${riskGradient} text-white`}>
                        {riskLabel}
                    </span>
                    <span className="text-amber-400 font-bold text-sm">
                        @{parlay.combined_odds.toFixed(2)}
                    </span>
                </div>
                <div className="text-right">
                    <span className={`font-bold text-sm ${parlay.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {parlay.profit_loss >= 0 ? '+' : ''}${parlay.profit_loss.toFixed(2)}
                    </span>
                    {parlay.date && (
                        <span className="block text-[10px] text-slate-500">{parlay.date}</span>
                    )}
                </div>
            </div>

            {/* Legs */}
            <div className="space-y-1.5 ml-7">
                {parlay.picks.map((leg, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <LegResultIcon result={leg.result} />
                        <span className="text-slate-300 truncate">
                            {leg.home_team} vs {leg.away_team}
                        </span>
                        <span className="text-slate-500 flex-shrink-0">{translateMarket(leg.market)}</span>
                        <span className="text-slate-400 font-medium flex-shrink-0">{leg.selection}</span>
                        {leg.odds > 0 && (
                            <span className="text-amber-400/60 text-[10px] flex-shrink-0">@{leg.odds.toFixed(2)}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const LegResultIcon: React.FC<{ result: PickResult }> = ({ result }) => {
    if (result === 'WON') {
        return (
            <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
            </span>
        );
    }
    if (result === 'LOST') {
        return (
            <span className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </span>
        );
    }
    return (
        <span className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
        </span>
    );
};

const PeriodFilters: React.FC<{ selectedPeriod: PeriodKey; onSelect: (p: PeriodKey) => void; onRefresh: () => void }> = ({ selectedPeriod, onSelect, onRefresh }) => (
    <div className="flex items-center gap-2 flex-wrap">
        {PERIODS.map(p => (
            <button
                key={p.key}
                onClick={() => onSelect(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    selectedPeriod === p.key
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
            >
                {p.label}
            </button>
        ))}
        <button onClick={onRefresh} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <ArrowPathIcon className="w-5 h-5" />
        </button>
    </div>
);

const ResultIcon: React.FC<{ result: PickResult }> = ({ result }) => {
    if (result === 'WON') {
        return (
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
            </span>
        );
    }
    if (result === 'LOST') {
        return (
            <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </span>
        );
    }
    return (
        <span className="w-5 h-5 rounded-full bg-slate-500/20 flex items-center justify-center flex-shrink-0">
            <span className="w-2 h-0.5 bg-slate-400 rounded"></span>
        </span>
    );
};

const translateMarket = (market: string): string => {
    const translations: Record<string, string> = {
        'over_0.5_goals': '+0.5 Goles',
        'over_1.5_goals': '+1.5 Goles',
        'over_2.5_goals': '+2.5 Goles',
        'over_3.5_goals': '+3.5 Goles',
        'btts_yes': 'Ambos Anotan',
        'btts_no': 'Ambos No Anotan',
        'home_win': 'Gana Local',
        'away_win': 'Gana Visitante',
        'draw': 'Empate',
        'double_chance_1x': 'Local o Empate',
        'double_chance_x2': 'Empate o Visitante',
        'home_over_0.5': 'Local Anota',
        'away_over_0.5': 'Visita Anota',
    };
    return translations[market] || market.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default ResultadosPublic;
