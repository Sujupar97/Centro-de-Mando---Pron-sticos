import React, { useState } from 'react';
import { Bet, BetStatus, LegStatus } from '../types';
import { formatCurrency } from '../utils/formatters';
import { TrashIcon, ChevronDownIcon, ChevronUpIcon, CurrencyDollarIcon, ScaleIcon, TrophyIcon } from './icons/Icons';

interface BetTableProps {
    bets: Bet[];
    onDeleteBet: (betId: number) => void;
    onAddBetClick: () => void;
}

const statusStyles: { [key in BetStatus]: { text: string; bg: string; border: string; } } = {
    [BetStatus.Won]: { text: 'text-green-accent', bg: 'bg-green-500/10', border: 'border-green-accent/30' },
    [BetStatus.Lost]: { text: 'text-red-accent', bg: 'bg-red-500/10', border: 'border-red-accent/30' },
    [BetStatus.Pending]: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-400/30' },
};

const legStatusColorMap: { [key in LegStatus]: string } = {
    [LegStatus.Won]: 'text-green-accent',
    [LegStatus.Lost]: 'text-red-accent',
    [LegStatus.Pending]: 'text-yellow-400',
    [LegStatus.Void]: 'text-gray-400',
};

const BetCard: React.FC<{ bet: Bet; onDelete: (id: number) => void }> = ({ bet, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const styles = statusStyles[bet.status];

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('¿Estás seguro de que quieres eliminar esta apuesta? Los datos se perderán permanentemente.')) {
            onDelete(bet.id);
        }
    };

    const isCombined = bet.legs && bet.legs.length > 1;

    return (
        <div className={`bg-gray-800 rounded-lg shadow-md border ${styles.border} transition-all duration-300 hover:shadow-green-accent/10 hover:border-green-accent/50`}>
            {/* Header de la tarjeta */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm text-gray-400">{new Date(bet.date).toLocaleDateString('es-ES', { year: '2-digit', month: '2-digit', day: '2-digit' })}</span>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${styles.bg} ${styles.text}`}>
                        {bet.status}
                    </span>
                </div>
                <div className="flex items-center space-x-2">
                    {isCombined && (
                        <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Expandir detalles">
                            {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                        </button>
                    )}
                    <button onClick={handleDelete} className="p-2 rounded-full text-gray-400 hover:bg-red-500/20 hover:text-red-accent transition-colors" aria-label="Eliminar apuesta">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Cuerpo de la tarjeta */}
            <div className="p-5">
                <h3 className="text-lg font-bold text-white truncate">{bet.event}</h3>
                <p className="text-sm text-gray-400 capitalize">{isCombined ? 'Apuesta Combinada' : bet.market.split('\n')[0]}</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-center border-t border-gray-700 pt-4">
                    <div className="flex flex-col items-center">
                        <div className="flex items-center text-gray-400 text-sm"><CurrencyDollarIcon className="w-4 h-4 mr-1.5" /><span>Apostado (COP)</span></div>
                        <p className="text-lg font-semibold text-white">{formatCurrency(bet.stake)}</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="flex items-center text-gray-400 text-sm"><ScaleIcon className="w-4 h-4 mr-1.5" /><span>Cuota Total</span></div>
                        <p className="text-lg font-semibold text-white">{(bet.odds || 0).toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="flex items-center text-gray-400 text-sm"><TrophyIcon className="w-4 h-4 mr-1.5" /><span>Ganancia (COP)</span></div>
                        <p className={`text-lg font-bold ${styles.text}`}>{formatCurrency(bet.payout)}</p>
                    </div>
                </div>
            </div>

            {/* Detalles expandibles */}
            {isExpanded && (
                <div className="border-t border-gray-700 bg-gray-900/50 rounded-b-lg p-4 animate-fade-in">
                    <h4 className="font-semibold mb-2 text-white text-sm">Detalle de Selecciones</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[500px]">
                            <thead className="text-gray-400">
                                <tr>
                                    <th className="p-2 text-left font-medium">Deporte/Evento</th>
                                    <th className="p-2 text-left font-medium">Mercado</th>
                                    <th className="p-2 text-center font-medium">Cuota</th>
                                    <th className="p-2 text-left font-medium">Resultado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(bet.legs || []).map((leg, index) => (
                                    <tr key={index} className="border-t border-gray-700">
                                        <td className="p-2">
                                            <div className="font-medium">{leg.event}</div>
                                            <div className="text-xs text-gray-500">{leg.sport} - {leg.league}</div>
                                        </td>
                                        <td className="p-2">{leg.market}</td>
                                        <td className="p-2 text-center font-mono">{(leg.odds || 0).toFixed(3)}</td>
                                        <td className={`p-2 font-semibold ${legStatusColorMap[leg.status]}`}>{leg.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};


export const BetTable: React.FC<BetTableProps> = ({ bets, onDeleteBet, onAddBetClick }) => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 sm:mb-0">Mis Apuestas</h2>
                <div className="flex items-center gap-4">
                    <span className="text-base md:text-lg font-medium text-gray-400 bg-gray-800 px-3 py-1 rounded-md">{bets.length} Apuestas</span>
                    <button
                        onClick={onAddBetClick}
                        className="bg-green-accent hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 flex items-center gap-2"
                    >
                        <span className="text-xl">+</span> Nueva Apuesta
                    </button>
                </div>
            </div>

            {bets.length > 0 ? (
                <div className="space-y-4">
                    {bets.map((bet) => (
                        <BetCard key={bet.id} bet={bet} onDelete={onDeleteBet} />
                    ))}
                </div>
            ) : (
                <div className="text-center p-8 md:p-12 bg-gray-800 rounded-lg shadow-inner border border-dashed border-gray-700">
                    <h3 className="text-xl font-semibold text-white">No hay apuestas registradas</h3>
                    <p className="text-gray-400 mt-2 mb-4">Haz clic en "Añadir Apuesta" para empezar a registrar tus tickets.</p>
                    <button
                        onClick={onAddBetClick}
                        className="bg-green-accent hover:bg-green-600 text-white font-bold py-2 px-6 rounded-md transition duration-300"
                    >
                        Añadir Primera Apuesta
                    </button>
                </div>
            )}
        </div>
    );
};