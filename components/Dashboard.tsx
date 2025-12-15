import React from 'react';
import { useBets } from '../hooks/useBets';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/formatters';
import { BetStatus } from '../types';
import { ChartBarIcon, CurrencyDollarIcon, ScaleIcon, TrophyIcon } from './icons/Icons';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; className?: string }> = ({ title, value, icon, className = '' }) => (
    <div className={`bg-gray-800 p-6 rounded-lg shadow-lg flex items-center space-x-4 ${className}`}>
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-700 rounded-full">
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
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
             <div className="text-center p-12 bg-gray-800 rounded-lg">
                <h2 className="text-3xl font-bold text-white">Bienvenido a BetCommand</h2>
                <p className="text-gray-400 mt-2 max-w-2xl mx-auto">
                    Este es tu centro de mando. Empieza por añadir tu primera apuesta desde un ticket en la pestaña 'Añadir' o explora las jornadas para analizar partidos con IA.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-white">Dashboard de Rendimiento</h2>
                <p className="text-gray-400 text-sm mt-1">Un resumen de tu actividad y rendimiento en las apuestas.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Balance Actual" 
                    value={formatCurrency(balance)} 
                    icon={<CurrencyDollarIcon className="w-6 h-6 text-green-accent" />}
                />
                <StatCard 
                    title="Beneficio / Pérdida" 
                    value={formatCurrency(profitLoss)} 
                    icon={<TrophyIcon className={`w-6 h-6 ${profitLoss >= 0 ? 'text-green-accent' : 'text-red-accent'}`}/>}
                    className={profitLoss < 0 ? 'border-b-2 border-red-accent' : 'border-b-2 border-green-accent'}
                />
                <StatCard 
                    title="ROI (Retorno)" 
                    value={`${roi.toFixed(2)}%`} 
                    icon={<ScaleIcon className={`w-6 h-6 ${roi >= 0 ? 'text-green-accent' : 'text-red-accent'}`}/>}
                />
                <StatCard 
                    title="Tasa de Acierto" 
                    value={`${winRate.toFixed(1)}%`} 
                    icon={<ChartBarIcon className="w-6 h-6 text-green-accent" />}
                />
            </div>

            <div>
                <h3 className="text-xl font-bold text-white mb-4">Próximas Apuestas Pendientes</h3>
                {pendingBets.length > 0 ? (
                    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                        <ul className="divide-y divide-gray-700">
                            {pendingBets.map(bet => (
                                <li key={bet.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-gray-700/50">
                                    <div>
                                        <p className="font-bold text-white">{bet.event}</p>
                                        <p className="text-sm text-gray-400">{bet.market.split('\n')[0]}</p>
                                    </div>
                                    <div className="flex items-center space-x-4 mt-2 sm:mt-0">
                                        <span className="text-sm text-gray-300">Apostado: <span className="font-semibold text-white">{formatCurrency(bet.stake)}</span></span>
                                        <span className="text-sm text-gray-300">Cuota: <span className="font-semibold text-white">{(bet.odds || 0).toFixed(2)}</span></span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="text-center p-8 bg-gray-800 rounded-lg">
                        <p className="text-gray-400">No tienes apuestas pendientes en este momento.</p>
                    </div>
                )}
            </div>
        </div>
    );
};