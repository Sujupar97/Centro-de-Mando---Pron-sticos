// components/admin/ProfitabilityDashboard.tsx
// Admin-only dashboard showing ROI, yield, accuracy, and bankroll evolution

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';
import { ChartBarIcon, ArrowPathIcon, TrophyIcon } from '../icons/Icons';

interface ProfitStats {
    summary: {
        total_picks: number;
        verified_picks: number;
        pending_picks: number;
        won: number;
        lost: number;
        accuracy: number;
        total_staked: number;
        total_profit: number;
        roi: number;
        yield: number;
        current_bankroll: number;
    };
    by_market: Record<string, { won: number; lost: number; profit: number; staked: number }>;
    bankroll_history: { date: string; bankroll: number; profit: number }[];
}

const ProfitabilityDashboard: React.FC = () => {
    const [stats, setStats] = useState<Record<string, ProfitStats | null>>({});
    const [loading, setLoading] = useState(true);
    const [activePeriod, setActivePeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');

    const loadStats = async () => {
        setLoading(true);
        try {
            const periods: Array<'today' | 'week' | 'month' | 'all'> = ['today', 'week', 'month', 'all'];
            const results: Record<string, ProfitStats | null> = {};

            for (const period of periods) {
                const { data, error } = await supabase.functions.invoke('v2-track-profitability', {
                    body: { action: 'stats', period }
                });
                if (!error && data?.success) {
                    results[period] = data;
                }
            }
            setStats(results);
        } catch (err) {
            console.error('[ProfitDashboard] Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadStats(); }, []);

    const current = stats[activePeriod];
    const s = current?.summary;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-300 font-medium">Cargando Dashboard de Rentabilidad...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl shadow-lg shadow-amber-500/20">
                        <ChartBarIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white tracking-tight">Dashboard de Rentabilidad</h3>
                        <p className="text-sm text-slate-400">Tracking de ROI y rendimiento del sistema</p>
                    </div>
                </div>
                <button onClick={loadStats} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                    <ArrowPathIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Period Tabs */}
            <div className="flex gap-2">
                {(['today', 'week', 'month', 'all'] as const).map(period => (
                    <button
                        key={period}
                        onClick={() => setActivePeriod(period)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activePeriod === period
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                        }`}
                    >
                        {period === 'today' ? 'Hoy' : period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Total'}
                    </button>
                ))}
            </div>

            {/* Summary Cards */}
            {s && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Profit/Loss" value={`${s.total_profit >= 0 ? '+' : ''}$${s.total_profit.toFixed(2)}`} color={s.total_profit >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                        <StatCard label="ROI" value={`${s.roi >= 0 ? '+' : ''}${s.roi.toFixed(1)}%`} color={s.roi >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                        <StatCard label="Accuracy" value={`${s.accuracy.toFixed(1)}%`} color={s.accuracy >= 70 ? 'text-emerald-400' : 'text-amber-400'} sub={`${s.won}W / ${s.lost}L`} />
                        <StatCard label="Bankroll" value={`$${s.current_bankroll.toFixed(2)}`} color="text-white" sub={`${s.total_picks} picks (${s.pending_picks} pending)`} />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <StatCard label="Total Staked" value={`$${s.total_staked.toFixed(2)}`} color="text-blue-400" />
                        <StatCard label="Yield" value={`${s.yield >= 0 ? '+' : ''}${s.yield.toFixed(1)}%`} color={s.yield >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                        <StatCard label="Picks Verificados" value={`${s.verified_picks}`} color="text-white" sub={`de ${s.total_picks}`} />
                    </div>
                </>
            )}

            {/* Bankroll Evolution */}
            {current?.bankroll_history && current.bankroll_history.length > 0 && (
                <div className="bg-slate-900 border border-white/10 rounded-xl p-5">
                    <h4 className="text-white font-bold mb-4">Bankroll Evolution</h4>
                    <div className="flex items-end gap-1 h-40">
                        {current.bankroll_history.map((point, idx) => {
                            const maxBr = Math.max(...current.bankroll_history.map(p => p.bankroll));
                            const minBr = Math.min(...current.bankroll_history.map(p => p.bankroll));
                            const range = maxBr - minBr || 1;
                            const height = ((point.bankroll - minBr) / range) * 100;
                            return (
                                <div
                                    key={idx}
                                    className={`flex-1 rounded-t transition-all ${point.profit >= 0 ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                                    style={{ height: `${Math.max(height, 5)}%` }}
                                    title={`${point.date}: $${point.bankroll.toFixed(2)} (${point.profit >= 0 ? '+' : ''}${point.profit.toFixed(2)})`}
                                />
                            );
                        })}
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                        <span>{current.bankroll_history[0]?.date}</span>
                        <span>{current.bankroll_history[current.bankroll_history.length - 1]?.date}</span>
                    </div>
                </div>
            )}

            {/* Market Breakdown */}
            {current?.by_market && Object.keys(current.by_market).length > 0 && (
                <div className="bg-slate-900 border border-white/10 rounded-xl p-5">
                    <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                        <TrophyIcon className="w-5 h-5 text-amber-400" />
                        Rendimiento por Mercado
                    </h4>
                    <div className="space-y-3">
                        {Object.entries(current.by_market)
                            .sort(([, a], [, b]) => b.profit - a.profit)
                            .map(([market, data]) => {
                                const total = data.won + data.lost;
                                const accuracy = total > 0 ? (data.won / total) * 100 : 0;
                                const roi = data.staked > 0 ? (data.profit / data.staked) * 100 : 0;
                                return (
                                    <div key={market} className="flex items-center justify-between bg-black/30 p-3 rounded-lg border border-white/5">
                                        <div>
                                            <span className="text-white font-medium text-sm">{market}</span>
                                            <span className="text-slate-500 text-xs ml-2">{data.won}W/{data.lost}L ({accuracy.toFixed(0)}%)</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`font-bold text-sm ${data.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {data.profit >= 0 ? '+' : ''}${data.profit.toFixed(2)}
                                            </span>
                                            <span className={`text-xs px-2 py-1 rounded ${roi >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                                                ROI: {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {(!s || s.total_picks === 0) && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-white/5">
                        <ChartBarIcon className="w-12 h-12 text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Sin Datos de Rentabilidad</h3>
                    <p className="text-slate-400 max-w-md leading-relaxed">
                        Los datos aparecen cuando se generan oportunidades y se verifican resultados.
                    </p>
                </div>
            )}
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: string; color: string; sub?: string }> = ({ label, value, color, sub }) => (
    <div className="bg-slate-900 border border-white/10 rounded-xl p-4 text-center">
        <span className={`text-2xl font-black ${color}`}>{value}</span>
        <span className="block text-xs text-slate-400 uppercase mt-1">{label}</span>
        {sub && <span className="block text-xs text-slate-500 mt-0.5">{sub}</span>}
    </div>
);

export default ProfitabilityDashboard;
