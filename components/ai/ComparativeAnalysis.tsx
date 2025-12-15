import React, { useState, useMemo } from 'react';
import { useBets } from '../../hooks/useBets';
import { calculatePeriodicStats } from '../../utils/analysisUtils';
import { PeriodStats } from '../../types';
import { formatCurrency } from '../../utils/formatters';

type Period = 'weekly' | 'monthly';

const StatPill: React.FC<{ value: string; className?: string }> = ({ value, className }) => (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${className}`}>
      {value}
    </span>
);

export const ComparativeAnalysis: React.FC = () => {
    const { bets } = useBets();
    const [period, setPeriod] = useState<Period>('weekly');

    const data: PeriodStats[] = useMemo(() => {
        return calculatePeriodicStats(bets, period);
    }, [bets, period]);

    const headers = [
        { key: 'period', label: period === 'weekly' ? 'Semana' : 'Mes' },
        { key: 'totalBets', label: 'Apuestas Totales' },
        { key: 'combinedBets', label: 'Combinadas / Simples' },
        { key: 'winRate', label: 'Tasa Acierto (Tickets)' },
        { key: 'legWinRate', label: 'Tasa Acierto (Individual)' },
        { key: 'averageOdds', label: 'Cuota Prom.' },
        { key: 'totalStaked', label: 'Total Apostado' },
        { key: 'profitLoss', label: 'Beneficio / Pérdida' },
        { key: 'roi', label: 'ROI' },
    ];

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-xl font-semibold text-white mb-2">Análisis Comparativo de Rendimiento</h3>
            <p className="text-sm text-gray-400 mb-4">Compara tus estadísticas clave semana a semana o mes a mes para identificar tendencias.</p>

            <div className="flex items-center space-x-2 mb-4 bg-gray-900/50 p-1.5 rounded-lg self-start">
                 <button
                    onClick={() => setPeriod('weekly')}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${period === 'weekly' ? 'bg-green-accent text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                    Semanal
                </button>
                <button
                    onClick={() => setPeriod('monthly')}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${period === 'monthly' ? 'bg-green-accent text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                    Mensual
                </button>
            </div>

            <div className="flex-grow overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-700/50 sticky top-0">
                        <tr>
                            {headers.map(h => <th key={h.key} className="p-3 font-semibold">{h.label}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {data.length > 0 ? data.map(row => (
                            <tr key={row.period} className="hover:bg-gray-700/30">
                                <td className="p-3 font-bold text-white capitalize">{row.period}</td>
                                <td className="p-3 text-center">{row.totalBets}</td>
                                <td className="p-3 text-center">
                                    <div className="flex flex-col items-center justify-center">
                                        <StatPill value={`${row.combinedBets} C`} className="bg-blue-500/20 text-blue-300 mb-1" />
                                        <StatPill value={`${row.singleBets} S`} className="bg-purple-500/20 text-purple-300" />
                                    </div>
                                </td>
                                <td className="p-3 text-center">{row.winRate.toFixed(1)}%</td>
                                <td className="p-3 text-center font-medium">{row.legWinRate.toFixed(1)}%</td>
                                <td className="p-3 text-center">{row.averageOdds.toFixed(2)}</td>
                                <td className="p-3 text-right">{formatCurrency(row.totalStaked)}</td>
                                <td className={`p-3 text-right font-semibold ${row.profitLoss >= 0 ? 'text-green-accent' : 'text-red-accent'}`}>
                                    {formatCurrency(row.profitLoss)}
                                </td>
                                <td className={`p-3 text-right font-semibold ${row.roi >= 0 ? 'text-green-accent' : 'text-red-accent'}`}>
                                    {row.roi.toFixed(2)}%
                                </td>
                            </tr>
                        )) : (
                             <tr>
                                <td colSpan={headers.length} className="text-center p-8 text-gray-400">
                                    No hay suficientes datos para el análisis. Registra más apuestas.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
