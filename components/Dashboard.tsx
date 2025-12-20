import React from 'react';
import { useBets } from '../hooks/useBets';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/formatters';
import { BetStatus } from '../types';
import { ChartBarIcon, CurrencyDollarIcon, ScaleIcon, TrophyIcon, ArrowPathIcon } from './icons/Icons';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; trend?: string; color: string }> = ({ title, value, icon, trend, color }) => (
    <div className="glass p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
            <div className={`w-24 h-24 rounded-full bg-${color}-500 blur-2xl`}></div>
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex justify-between items-start">
                <div className={`p-3 rounded-xl bg-gradient-to-br from-${color}-500/20 to-transparent border border-${color}-500/20 text-${color}-400`}>
                    {icon}
                </div>
                {trend && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {trend}
                    </span>
                )}
            </div>

            <div>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">{title}</p>
                <h3 className="text-3xl font-display font-bold text-white mt-1 tracking-tight">{value}</h3>
            </div>
        </div>
    </div>
);

export const Dashboard: React.FC = () => {
    const { bets } = useBets();
    const { initialCapital } = useSettings();

    const totalStaked = bets.reduce((acc, bet) => acc + bet.stake, 0);
    const totalPayout = bets.reduce((acc, bet) => acc + (bet.status === BetStatus.Won ? bet.payout : 0), 0);

    const settledBets = bets.filter(b => b.status === BetStatus.Won || b.status === BetStatus.Lost);
    const settledStaked = settledBets.reduce((acc, bet) => acc + bet.stake, 0);
    const wonBetsCount = bets.filter(b => b.status === BetStatus.Won).length;

    const profitLoss = totalPayout - settledStaked;
    const balance = initialCapital + profitLoss;
    const roi = settledStaked > 0 ? (profitLoss / settledStaked) * 100 : 0;
    const winRate = settledBets.length > 0 ? (wonBetsCount / settledBets.length) * 100 : 0;

    const pendingBets = bets.filter(bet => bet.status === BetStatus.Pending).slice(0, 5);

    if (bets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh] glass rounded-3xl animate-fade-in border border-white/5 mx-4 mt-8">
                <div className="w-24 h-24 bg-brand/10 rounded-full flex items-center justify-center mb-6 animate-pulse-slow">
                    <ChartBarIcon className="w-12 h-12 text-brand" />
                </div>
                <h2 className="text-4xl font-display font-bold text-white mb-4">Bienvenido al Centro de Mando</h2>
                <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
                    Tu plataforma de inteligencia deportiva está lista. Comienza añadiendo una apuesta o analizando la jornada con nuestra IA.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl md:text-4xl font-display font-bold text-white">Rendimiento General</h2>
                    <p className="text-slate-400 mt-2 text-lg">Resumen de actividad y métricas clave.</p>
                </div>
                <div className="text-right hidden md:block">
                    <p className="text-xs text-slate-500 font-mono">ÚLTIMA ACTUALIZACIÓN</p>
                    <p className="text-base text-brand font-medium">EN TIEMPO REAL</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Balance Total"
                    value={formatCurrency(balance)}
                    icon={<CurrencyDollarIcon className="w-6 h-6" />}
                    color="brand"
                    trend={profitLoss >= 0 ? '+ Profit' : '- Loss'}
                />
                <StatCard
                    title="P/L Neto"
                    value={formatCurrency(profitLoss)}
                    icon={<TrophyIcon className="w-6 h-6" />}
                    color={profitLoss >= 0 ? "emerald" : "red"}
                />
                <StatCard
                    title="ROI (Retorno)"
                    value={`${roi.toFixed(2)}%`}
                    icon={<ScaleIcon className="w-6 h-6" />}
                    color="blue"
                />
                <StatCard
                    title="Efectividad"
                    value={`${winRate.toFixed(1)}%`}
                    icon={<ChartBarIcon className="w-6 h-6" />}
                    color="purple"
                    trend={winRate > 50 ? 'Strong' : 'Weak'}
                />
            </div>

            <div>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-display font-bold text-white flex items-center">
                        <ArrowPathIcon className="w-5 h-5 mr-2 text-slate-400" />
                        Apuestas en Curso
                    </h3>
                    <span className="text-xs font-bold px-3 py-1 bg-slate-800 rounded-full text-slate-400 border border-white/5">{pendingBets.length} ACTIVAS</span>
                </div>

                {pendingBets.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {pendingBets.map(bet => (
                            <div key={bet.id} className="glass p-4 rounded-xl flex flex-col md:flex-row items-center justify-between group hover:bg-slate-800/60 transition-colors border-l-4 border-brand/50">
                                <div className="flex-1 w-full md:w-auto mb-4 md:mb-0">
                                    <div className="flex items-center space-x-3 mb-1">
                                        <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded uppercase tracking-wider">Pendiente</span>
                                        <span className="text-xs text-slate-500 font-mono">{new Date(bet.date).toLocaleDateString()}</span>
                                    </div>
                                    <h4 className="font-bold text-white text-lg group-hover:text-brand transition-colors">{bet.event}</h4>
                                    <p className="text-sm text-slate-400 mt-1">{bet.market}</p>
                                </div>

                                <div className="flex items-center space-x-6 w-full md:w-auto justify-between md:justify-end bg-slate-900/40 p-3 rounded-lg md:bg-transparent md:p-0">
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 uppercase font-bold">Inversión</p>
                                        <p className="font-mono font-bold text-white">{formatCurrency(bet.stake)}</p>
                                    </div>
                                    <div className="w-px h-8 bg-white/10 hidden md:block"></div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 uppercase font-bold">Cuota</p>
                                        <p className="font-mono font-bold text-brand text-lg">{bet.odds.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="glass p-8 rounded-xl text-center border-dashed border-2 border-slate-700">
                        <p className="text-slate-400">No hay actividad pendiente. El mercado está tranquilo.</p>
                    </div>
                )}
            </div>
        </div>
    );
};