// components/ai/SmartParlays.tsx
// Componente para mostrar y generar Parlays (combinaciones multi-partido)

import React, { useState, useEffect } from 'react';
import {
    generateSmartParlays,
    getSmartParlays,
    ParlayCombo,
    translateMarket,
    getRiskColor,
    getRiskLabel
} from '../../services/smartParlayService';
import { getCurrentDateInBogota } from '../../utils/dateUtils';

interface SmartParlaysProps {
    date?: string;
}

const SmartParlays: React.FC<SmartParlaysProps> = ({ date }) => {
    const [parlays, setParlays] = useState<ParlayCombo[]>([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(date || getCurrentDateInBogota());

    useEffect(() => {
        loadParlays();
    }, [selectedDate]);

    const loadParlays = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getSmartParlays(selectedDate);
            setParlays(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        setStats(null);

        try {
            const result = await generateSmartParlays(selectedDate);

            if (result.success) {
                setStats(result.stats);
                await loadParlays();
            } else {
                setError(result.error || result.message || 'Error desconocido');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setGenerating(false);
        }
    };

    const formatProbability = (prob: number) => `${Math.round(prob * 100)}%`;

    return (
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-2xl">🎯</span>
                        Parlays
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Combinaciones de 3 picks de alto valor de diferentes partidos
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-gray-400 text-sm">Fecha:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${generating
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700'
                            }`}
                    >
                        {generating ? (
                            <>
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Generando...
                            </>
                        ) : (
                            <>
                                <span>✨</span>
                                Generar Parlays
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <p className="text-emerald-400 text-sm">
                        Generados {stats.combos_saved} parlays a partir de {stats.total_picks} picks
                        de {stats.fixtures_with_picks} partidos ({stats.combinations_evaluated} combinaciones evaluadas).
                    </p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                </div>
            )}

            {/* Empty state */}
            {!loading && parlays.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                    <p className="text-4xl mb-3">🎰</p>
                    <p>No hay Parlays para esta fecha.</p>
                    <p className="text-sm mt-1">Analiza al menos 3 partidos y luego presiona "Generar Parlays".</p>
                </div>
            )}

            {/* Parlay combos list */}
            {!loading && parlays.length > 0 && (
                <div className="space-y-4">
                    {parlays.map((combo, index) => (
                        <div
                            key={combo.id}
                            className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden"
                        >
                            {/* Combo Header */}
                            <div className={`bg-gradient-to-r ${getRiskColor(combo.risk_tier)} p-4`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-white/80 text-xs font-medium uppercase tracking-wider">
                                            {getRiskLabel(combo.risk_tier)}
                                        </span>
                                        <h3 className="text-white font-bold text-lg">
                                            Parlay #{index + 1}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-white/80 text-xs">Cuota Combinada</div>
                                            <div className="text-white font-bold text-2xl">
                                                x{combo.combined_odds?.toFixed(2) || '---'}
                                            </div>
                                        </div>
                                        <div className="text-right border-l border-white/20 pl-4">
                                            <div className="text-white/80 text-xs">Probabilidad</div>
                                            <div className="text-white font-bold text-2xl">
                                                {formatProbability(combo.combined_probability)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Picks detail */}
                            <div className="p-4 space-y-3">
                                {combo.picks.map((pick, pickIndex) => (
                                    <div
                                        key={pickIndex}
                                        className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700/30"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="text-gray-400 text-xs mb-1 truncate">
                                                {pick.league}
                                            </div>
                                            <div className="text-white font-medium text-sm">
                                                {pick.home_team} vs {pick.away_team}
                                            </div>
                                            <div className="text-emerald-400 text-sm mt-1 font-bold">
                                                {translateMarket(pick.market)}: <span className="text-white">{pick.selection}</span>
                                            </div>
                                        </div>
                                        <div className="text-right ml-4 flex-shrink-0">
                                            <div className="text-emerald-400 font-bold text-lg">
                                                x{pick.odds?.toFixed(2) || '---'}
                                            </div>
                                            <div className="text-gray-400 text-xs">
                                                {formatProbability(pick.p_model)} prob
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer with EV indicator */}
                            <div className="px-4 pb-4">
                                <div className="flex items-center justify-between p-3 bg-gray-900/80 rounded-lg border border-gray-700/50">
                                    <span className="text-gray-400 text-sm">
                                        {combo.pick_count} selecciones de diferentes partidos
                                    </span>
                                    <span className="text-emerald-400 font-medium text-sm">
                                        EV: {(combo.combined_odds * combo.combined_probability).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SmartParlays;
