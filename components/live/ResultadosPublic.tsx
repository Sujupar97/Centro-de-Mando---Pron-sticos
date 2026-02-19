// components/live/ResultadosPublic.tsx
// Public results tab - accessible to all users
// Shows system performance: accuracy, recent results, streaks, bankroll projection

import React, { useState, useEffect } from 'react';
import { getPublicResults } from '../../services/resultsService';
import type { PublicResultsData, PickResult } from '../../types';
import { ChartBarIcon, ArrowPathIcon, TrophyIcon } from '../icons/Icons';

type PeriodKey = 'ayer' | 'hoy' | '7d' | '30d' | '90d';
type PeriodOption = { key: PeriodKey; label: string };

const PERIODS: PeriodOption[] = [
    { key: 'ayer', label: 'Ayer' },
    { key: 'hoy', label: 'Hoy' },
    { key: '7d', label: '7 días' },
    { key: '30d', label: '30 días' },
    { key: '90d', label: '90 días' },
];

function getDateRange(period: PeriodKey): { startDate: string; endDate: string } {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const todayStr = fmt(today);

    switch (period) {
        case 'hoy':
            return { startDate: todayStr, endDate: todayStr };
        case 'ayer': {
            const ayer = new Date(today);
            ayer.setDate(ayer.getDate() - 1);
            return { startDate: fmt(ayer), endDate: fmt(ayer) };
        }
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
    }
}

const ResultadosPublic: React.FC = () => {
    const [data, setData] = useState<PublicResultsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('ayer');

    const loadResults = async () => {
        setLoading(true);
        setError(null);
        try {
            const { startDate, endDate } = getDateRange(selectedPeriod);
            const results = await getPublicResults(startDate, endDate);
            setData(results);
        } catch (err: any) {
            console.error('[ResultadosPublic] Error:', err);
            setError(err.message || 'Error al cargar resultados');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadResults(); }, [selectedPeriod]);

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

    if (!data || data.totalVerified === 0) {
        return (
            <div className="space-y-6">
                {/* Header with filters even when empty */}
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

    const s = data;
    const br = s.bankroll;

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
                        <p className="text-sm text-slate-400">Pronósticos verificados del sistema</p>
                    </div>
                </div>
                <PeriodFilters selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} onRefresh={loadResults} />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Aciertos */}
                <div className="bg-slate-900 border border-white/10 rounded-xl p-5 text-center">
                    <div className={`text-3xl font-black ${s.winRate >= 55 ? 'text-emerald-400' : s.winRate >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                        {s.winRate.toFixed(1)}%
                    </div>
                    <span className="block text-xs text-slate-400 uppercase mt-1">Aciertos</span>
                    <div className="flex items-center justify-center gap-3 mt-2">
                        <span className="text-emerald-400 font-bold text-base">{s.won ?? 0} ganadas</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-red-400 font-bold text-base">{s.lost ?? 0} perdidas</span>
                    </div>
                    <span className="block text-xs text-slate-500 mt-1">de {s.totalVerified} verificadas</span>
                </div>

                {/* Ganancia */}
                {br && (
                    <div className="bg-slate-900 border border-white/10 rounded-xl p-5 text-center">
                        <div className={`text-3xl font-black ${br.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {br.profit >= 0 ? '+' : ''}${br.profit.toFixed(2)}
                        </div>
                        <span className="block text-xs text-slate-400 uppercase mt-1">Ganancia Total</span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                            Empezando con ${br.base}
                        </span>
                    </div>
                )}

                {/* Rentabilidad */}
                {br && (
                    <div className="bg-slate-900 border border-white/10 rounded-xl p-5 text-center">
                        <div className={`text-3xl font-black ${br.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {br.roi >= 0 ? '+' : ''}{br.roi.toFixed(1)}%
                        </div>
                        <span className="block text-xs text-slate-400 uppercase mt-1">Rentabilidad</span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                            Ganancia sobre lo invertido
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
                            4% por pronóstico (${(br.base * 0.04).toFixed(0)})
                        </span>
                    </div>
                )}
            </div>

            {/* Detail Banner */}
            {br && (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-sm">Acumulado desde el inicio con capital de <span className="text-white font-bold">${br.base}</span></span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-400">Apuesta: <span className="text-white font-bold">4% por pronóstico (${(br.base * 0.04).toFixed(0)})</span></span>
                        {br.periodProfit !== undefined && br.periodProfit !== br.profit && (
                            <span className={`font-bold ${br.periodProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                Periodo: {br.periodProfit >= 0 ? '+' : ''}${br.periodProfit.toFixed(2)}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Recent Results */}
            {s.recentResults.length > 0 && (
                <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                        <h4 className="text-white font-bold">Resultados Recientes</h4>
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
                                    {pick.odds && (
                                        <span className="text-amber-400 font-bold text-sm block">
                                            @{pick.odds.toFixed(2)}
                                        </span>
                                    )}
                                    <span className="text-slate-500 text-[10px]">
                                        {Math.round(pick.p_model * 100)}% prob
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Parlays Section \u2014 Placeholder */}
            <div className="bg-slate-900 border border-white/10 rounded-xl p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-lg font-bold text-white">Smart Parlays</span>
                    <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-bold uppercase">Próximamente</span>
                </div>
                <p className="text-slate-400 text-sm">
                    El seguimiento de resultados de parlays estará disponible pr\u00f3ximamente.
                </p>
            </div>
        </div>
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
