// components/admin/PlanPerformanceComparison.tsx
// Admin-only dashboard comparing performance across subscription plan tiers
// Shows inclusive metrics (all picks a plan sees) + exclusive delta metrics

import React, { useState, useEffect } from 'react';
import { getPerPlanComparison } from '../../services/resultsService';
import type { PerPlanComparisonData, PlanPerformanceSummary, PlanTier } from '../../types';
import { PLAN_TIERS, PLAN_DISPLAY_NAMES } from '../../utils/planAccessUtils';

type PeriodKey = '7d' | '30d' | '90d' | 'all';
const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: '90d', label: '90 dias' },
    { key: 'all', label: 'Todo' },
];

const SYSTEM_START_DATE = '2026-02-17';

function getDateRange(period: PeriodKey): { startDate: string; endDate: string } {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const todayStr = fmt(today);

    switch (period) {
        case '7d': {
            const d = new Date(today);
            d.setDate(d.getDate() - 7);
            return { startDate: fmt(d), endDate: todayStr };
        }
        case '30d': {
            const d = new Date(today);
            d.setDate(d.getDate() - 30);
            return { startDate: fmt(d), endDate: todayStr };
        }
        case '90d': {
            const d = new Date(today);
            d.setDate(d.getDate() - 90);
            return { startDate: fmt(d), endDate: todayStr };
        }
        case 'all':
            return { startDate: SYSTEM_START_DATE, endDate: todayStr };
    }
}

const PLAN_COLORS: Record<PlanTier, string> = {
    free: 'from-slate-500 to-slate-600',
    starter: 'from-blue-500 to-blue-600',
    pro: 'from-purple-500 to-purple-600',
    premium: 'from-emerald-500 to-emerald-600',
};

const PLAN_BORDER_COLORS: Record<PlanTier, string> = {
    free: 'border-slate-500/30',
    starter: 'border-blue-500/30',
    pro: 'border-purple-500/30',
    premium: 'border-emerald-500/30',
};

const PlanPerformanceComparison: React.FC = () => {
    const [data, setData] = useState<PerPlanComparisonData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<PeriodKey>('30d');

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const { startDate, endDate } = getDateRange(period);
            const result = await getPerPlanComparison(startDate, endDate);
            setData(result);
        } catch (err: any) {
            console.error('[PlanPerformanceComparison] Error:', err);
            setError(err.message || 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [period]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-slate-400 text-sm">Calculando rendimiento por plan...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-red-400 text-sm mb-3">{error}</p>
                <button onClick={loadData} className="px-4 py-2 bg-slate-700 text-white text-sm font-bold rounded-xl hover:bg-slate-600 transition-all">
                    Reintentar
                </button>
            </div>
        );
    }

    if (!data) return null;

    // Find best performing plan for insight
    const planEntries = PLAN_TIERS.map(t => data.plans[t]).filter(Boolean);
    const bestROI = planEntries.reduce((best, p) =>
        p.roi > best.roi ? p : best, planEntries[0]);
    const worstExclusive = planEntries
        .filter(p => p.exclusivePicks > 0)
        .reduce((worst, p) =>
            p.exclusiveWinRate < worst.exclusiveWinRate ? p : worst,
            planEntries.find(p => p.exclusivePicks > 0) || planEntries[0]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-white">Rendimiento por Plan</h3>
                    <p className="text-sm text-slate-400 mt-0.5">Comparativa de metricas entre planes de suscripcion</p>
                </div>
                <div className="flex items-center gap-2">
                    {PERIODS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                period === p.key
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button onClick={loadData} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Plan Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {PLAN_TIERS.map(tier => {
                    const plan = data.plans[tier];
                    if (!plan) return null;
                    return <PlanCard key={tier} plan={plan} isBest={plan.planName === bestROI?.planName} />;
                })}
            </div>

            {/* Exclusive Delta Section */}
            <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/5">
                    <h4 className="text-white font-bold">Metricas Exclusivas (Delta)</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Rendimiento de los picks que son unicamente visibles para cada tier y superiores
                    </p>
                </div>
                <div className="p-4 space-y-3">
                    {PLAN_TIERS.map(tier => {
                        const plan = data.plans[tier];
                        if (!plan || plan.exclusivePicks === 0) return null;
                        return <ExclusiveDeltaRow key={tier} plan={plan} />;
                    })}
                    {planEntries.every(p => p.exclusivePicks === 0) && (
                        <p className="text-slate-500 text-sm text-center py-4">Sin datos exclusivos suficientes en este periodo</p>
                    )}
                </div>
            </div>

            {/* Insight */}
            {bestROI && bestROI.picksCount > 0 && (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-white/10 rounded-xl p-4">
                    <p className="text-sm text-slate-300">
                        <span className="text-emerald-400 font-bold">Insight:</span>{' '}
                        El plan <span className="text-white font-bold">{bestROI.displayName}</span> tiene el mejor ROI ({bestROI.roi >= 0 ? '+' : ''}{bestROI.roi.toFixed(1)}%) con {bestROI.winRate.toFixed(1)}% de aciertos.
                        {worstExclusive && worstExclusive.exclusiveWinRate < 50 && worstExclusive.exclusivePicks >= 3 && (
                            <> Los picks exclusivos de <span className="text-amber-400 font-bold">{worstExclusive.displayName}</span> tienen menor rendimiento ({worstExclusive.exclusiveWinRate.toFixed(0)}% WR).</>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
};

const PlanCard: React.FC<{ plan: PlanPerformanceSummary; isBest: boolean }> = ({ plan, isBest }) => {
    const wrColor = plan.winRate >= 60 ? 'text-emerald-400' : plan.winRate >= 50 ? 'text-amber-400' : 'text-red-400';
    const profitColor = plan.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400';

    return (
        <div className={`bg-slate-900 border rounded-xl p-5 relative ${PLAN_BORDER_COLORS[plan.planName]} ${isBest ? 'ring-1 ring-emerald-500/30' : ''}`}>
            {isBest && plan.picksCount > 0 && (
                <span className="absolute -top-2 right-3 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                    Mejor ROI
                </span>
            )}

            {/* Plan Header */}
            <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${PLAN_COLORS[plan.planName]}`} />
                <span className="text-white font-bold text-sm">{plan.displayName}</span>
                <span className="text-slate-500 text-xs ml-auto">
                    {plan.predictionsPercentage >= 100 ? '100%' : plan.predictionsPercentage <= 1 ? '1/dia' : `${plan.predictionsPercentage}%`}
                </span>
            </div>

            {/* Win Rate */}
            <div className="text-center mb-3">
                <div className={`text-3xl font-black ${plan.picksCount > 0 ? wrColor : 'text-slate-600'}`}>
                    {plan.picksCount > 0 ? `${plan.winRate.toFixed(1)}%` : '—'}
                </div>
                <span className="text-[10px] text-slate-500 uppercase">Win Rate</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                    <div className={`font-bold text-sm ${profitColor}`}>
                        {plan.picksCount > 0 ? `${plan.totalProfit >= 0 ? '+' : ''}$${plan.totalProfit.toFixed(0)}` : '—'}
                    </div>
                    <span className="text-[10px] text-slate-500">Profit</span>
                </div>
                <div>
                    <div className={`font-bold text-sm ${profitColor}`}>
                        {plan.picksCount > 0 ? `${plan.roi >= 0 ? '+' : ''}${plan.roi.toFixed(1)}%` : '—'}
                    </div>
                    <span className="text-[10px] text-slate-500">ROI</span>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-xs text-slate-500">
                <span>{plan.picksCount} picks</span>
                <span>
                    <span className="text-emerald-400">{plan.won}W</span>
                    {' / '}
                    <span className="text-red-400">{plan.lost}L</span>
                </span>
                {plan.avgOdds > 0 && <span>@{plan.avgOdds.toFixed(2)}</span>}
            </div>

            {plan.pending > 0 && (
                <div className="text-center text-[10px] text-amber-400 mt-2">
                    {plan.pending} pendiente{plan.pending > 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
};

const ExclusiveDeltaRow: React.FC<{ plan: PlanPerformanceSummary }> = ({ plan }) => {
    const wrColor = plan.exclusiveWinRate >= 60 ? 'text-emerald-400' : plan.exclusiveWinRate >= 50 ? 'text-amber-400' : 'text-red-400';
    const roiColor = plan.exclusiveROI >= 0 ? 'text-emerald-400' : 'text-red-400';
    const barWidth = Math.min(100, Math.max(5, plan.exclusiveWinRate));

    return (
        <div className="flex items-center gap-4">
            <div className="w-20 flex-shrink-0">
                <span className="text-white text-xs font-bold">{plan.displayName}</span>
                <span className="text-slate-500 text-[10px] block">exclusivo</span>
            </div>
            <div className="flex-1">
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${
                            plan.exclusiveWinRate >= 60 ? 'bg-emerald-500' : plan.exclusiveWinRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${barWidth}%` }}
                    />
                </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                <span className={`font-bold ${wrColor}`}>{plan.exclusiveWinRate.toFixed(0)}%</span>
                <span className={`font-bold ${roiColor}`}>{plan.exclusiveROI >= 0 ? '+' : ''}{plan.exclusiveROI.toFixed(0)}%</span>
                <span className="text-slate-500">{plan.exclusivePicks} picks</span>
            </div>
        </div>
    );
};

export default PlanPerformanceComparison;
