
import React, { useState, useEffect } from 'react';
import { TopPickItem } from '../../types';
import { fetchTopPicks } from '../../services/liveDataService';
import { TrophyIcon, ChartBarIcon, CheckCircleIcon, XCircleIcon } from '../icons/Icons';

interface TopPicksProps {
    date: string;
    onOpenReport?: (runId: string) => void;
}

// Componente de Círculo de Probabilidad
const ProbabilityBadge: React.FC<{ probability: number }> = ({ probability }) => {
    let colorClass = 'text-red-accent border-red-accent';
    if (probability >= 80) colorClass = 'text-green-accent border-green-accent shadow-[0_0_10px_rgba(16,185,129,0.4)]';
    else if (probability >= 60) colorClass = 'text-yellow-400 border-yellow-400';

    return (
        <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-full border-4 ${colorClass} bg-gray-800 z-10`}>
            <span className="text-xl font-bold text-white">{probability}%</span>
        </div>
    );
};

export const TopPicks: React.FC<TopPicksProps> = ({ date, onOpenReport }) => {
    const [topPicks, setTopPicks] = useState<TopPickItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<'HIGH' | 'MEDIUM' | 'LOW' | 'ALL'>('HIGH');

    const filteredPicks = topPicks.filter(pick => {
        const prob = pick.bestRecommendation.probability;
        if (filter === 'HIGH') return prob >= 80;
        if (filter === 'MEDIUM') return prob >= 60 && prob < 80;
        if (filter === 'LOW') return prob < 60;
        return true;
    });

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setError('');
            setTopPicks([]);
            try {
                const data = await fetchTopPicks(date);
                if (data) setTopPicks(data);
            } catch (err: any) {
                setError(err.message || 'Error al cargar las mejores opciones.');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [date]);

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="mb-6">
                <div className="bg-green-accent/10 border border-green-accent/20 p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center">
                            <TrophyIcon className="w-6 h-6 text-green-accent mr-2" />
                            Mejores Opciones del Día
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                            Mostrando únicamente el escenario de <strong>mayor probabilidad</strong> para los partidos analizados del {new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}.
                        </p>
                        
                        {/* Filters */}
                        <div className="flex gap-2 mt-3">
                            <button onClick={() => setFilter('HIGH')} className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${filter === 'HIGH' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                                ALTA (+80%)
                            </button>
                            <button onClick={() => setFilter('MEDIUM')} className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${filter === 'MEDIUM' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                                MEDIA (60-79%)
                            </button>
                            <button onClick={() => setFilter('LOW')} className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${filter === 'LOW' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                                BAJA (-60%)
                            </button>
                             <button onClick={() => setFilter('ALL')} className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${filter === 'ALL' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                                TODAS
                            </button>
                        </div>
                    </div>

                    {/* Performance Summary */}
                    {topPicks.some(p => p.result === 'Won' || p.result === 'Lost') && (
                        <div className="flex bg-gray-900 rounded-lg p-2 border border-gray-700 shadow-lg">
                            <div className="px-4 py-1 border-r border-gray-700 text-center">
                                <span className="block text-xs text-gray-400 uppercase font-bold tracking-wider">Aciertos</span>
                                <span className="text-xl font-bold text-green-500">{filteredPicks.filter(p => p.result === 'Won').length}</span>
                            </div>
                            <div className="px-4 py-1 text-center">
                                <span className="block text-xs text-gray-400 uppercase font-bold tracking-wider">Fallos</span>
                                <span className="text-xl font-bold text-red-500">{filteredPicks.filter(p => p.result === 'Lost').length}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-accent p-4 rounded-lg text-center mb-4">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="w-12 h-12 border-4 border-green-accent border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-gray-400 animate-pulse">Buscando las mejores oportunidades...</p>
                </div>
            ) : topPicks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-gray-800/30 rounded-lg border-2 border-dashed border-gray-700">
                    <ChartBarIcon className="w-12 h-12 text-gray-600 mb-4" />
                    <h4 className="text-xl font-semibold text-gray-400">Sin Análisis para esta fecha</h4>
                    <p className="text-sm text-gray-500 mt-2 max-w-md text-center">
                        No hay partidos analizados para el {date}. Vuelve a la pestaña "Partidos" y analiza algunos juegos para ver aquí las mejores predicciones.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredPicks.length === 0 ? (
                         <div className="text-center py-10 text-gray-500">
                            <p>No hay pronósticos con confianza <strong>{filter}</strong> para esta fecha.</p>
                         </div>
                    ) : filteredPicks.map((pick) => (
                        <div
                            key={pick.gameId}
                            onClick={() => pick.analysisRunId && onOpenReport && onOpenReport(pick.analysisRunId)}
                            className="relative bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700 hover:border-green-accent/50 transition-all duration-300 group cursor-pointer hover:bg-gray-750"
                        >
                            {/* Barra lateral indicadora de confianza */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${pick.bestRecommendation.probability >= 80 ? 'bg-green-accent' : pick.bestRecommendation.probability >= 60 ? 'bg-yellow-400' : 'bg-red-500'}`}></div>

                            {/* Result Badge Overlay */}
                            {pick.result && pick.result !== 'Pending' && (
                                <div className={`absolute top-4 right-4 z-20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-md ${pick.result === 'Won' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                                    {pick.result === 'Won' ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
                                    {pick.result === 'Won' ? 'ACIERTO' : 'FALLO'}
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row items-center p-5 pl-6 gap-6">
                                {/* Sección de Equipos */}
                                <div className="flex-1 flex items-center justify-between md:justify-start gap-6 min-w-[200px]">
                                    <div className="flex flex-col items-center w-20">
                                        <img src={pick.teams.home.logo} alt={pick.teams.home.name} className="w-10 h-10 object-contain mb-2" />
                                        <span className="text-xs text-center text-gray-300 font-medium leading-tight">{pick.teams.home.name}</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-gray-500 font-bold text-xs mb-1">VS</span>
                                        <span className="text-xs text-gray-600 font-mono bg-gray-900 px-2 py-0.5 rounded">{new Date(pick.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="flex flex-col items-center w-20">
                                        <img src={pick.teams.away.logo} alt={pick.teams.away.name} className="w-10 h-10 object-contain mb-2" />
                                        <span className="text-xs text-center text-gray-300 font-medium leading-tight">{pick.teams.away.name}</span>
                                    </div>
                                </div>

                                {/* Sección de la Mejor Apuesta */}
                                <div className="flex-1 text-center md:text-left border-t md:border-t-0 md:border-l border-gray-700 pt-4 md:pt-0 md:pl-6 relative">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">{pick.bestRecommendation.market}</span>
                                        <h4 className="text-xl font-bold text-white group-hover:text-green-accent transition-colors">{pick.bestRecommendation.prediction}</h4>
                                        <p className="text-sm text-gray-400 mt-2 line-clamp-2">{pick.bestRecommendation.reasoning}</p>
                                    </div>
                                </div>

                                {/* Sección de Probabilidad */}
                                <div className="flex items-center justify-center pl-2 pt-4 md:pt-0">
                                    <ProbabilityBadge probability={pick.bestRecommendation.probability} />
                                </div>
                            </div>

                            {/* Footer informativo */}
                            <div className="bg-gray-900/50 px-4 py-2 flex justify-between items-center text-xs text-gray-500">
                                <span>{pick.league}</span>
                                <div className="flex items-center gap-2">
                                    <span className="uppercase text-[10px] font-bold tracking-widest bg-gray-800 px-2 py-0.5 rounded border border-gray-600 text-gray-300 group-hover:bg-green-accent group-hover:text-black transition-colors">Ver Informe</span>
                                    <span>Confianza IA: <span className={pick.bestRecommendation.confidence === 'Alta' ? 'text-green-500 font-bold' : 'text-yellow-500'}>{pick.bestRecommendation.confidence}</span></span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
