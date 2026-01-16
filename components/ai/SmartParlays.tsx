// components/ai/SmartParlays.tsx
// Componente para mostrar y generar Smart Parlays (combinaciones multi-partido)

import React, { useState, useEffect } from 'react';
import {
    generateSmartParlays,
    getSmartParlays,
    SmartParlay,
    translateMarket,
    getConfidenceColor,
    getConfidenceLabel
} from '../../services/smartParlayService';
import { getCurrentDateInBogota } from '../../utils/dateUtils';

interface SmartParlaysProps {
    date?: string;
}

const SmartParlays: React.FC<SmartParlaysProps> = ({ date }) => {
    const [parlays, setParlays] = useState<SmartParlay[]>([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastGenerated, setLastGenerated] = useState<string | null>(null);
    const [stats, setStats] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(date || getCurrentDateInBogota());

    // Cargar parlays cuando cambia la fecha
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
                setLastGenerated(new Date().toLocaleTimeString());
                // Recargar parlays
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
            {/* Header con Selector de Fecha */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-2xl">🎯</span>
                        Smart Parlays
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Combinaciones inteligentes de diferentes partidos
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Selector de Fecha */}
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

            {/* Stats de la última generación */}
            {stats && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <p className="text-emerald-400 text-sm">
                        ✅ Generados {stats.total_generated} parlays ({stats.parlays_2_picks} de 2 picks, {stats.parlays_3_picks} de 3 picks)
                        a partir de {stats.picks_enriched} picks de {stats.jobs_found} partidos analizados.
                        {lastGenerated && <span className="text-gray-400 ml-2">({lastGenerated})</span>}
                    </p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm">❌ {error}</p>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                </div>
            )}

            {/* Lista de Parlays */}
            {!loading && parlays.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                    <p className="text-4xl mb-3">🎰</p>
                    <p>No hay Smart Parlays para esta fecha.</p>
                    <p className="text-sm mt-1">Analiza algunos partidos y luego presiona "Generar Parlays".</p>
                </div>
            )}

            {!loading && parlays.length > 0 && (
                <div className="space-y-4">
                    {parlays.map((parlay, index) => (
                        <div
                            key={parlay.id}
                            className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden"
                        >
                            {/* Parlay Header */}
                            <div className={`bg-gradient-to-r ${getConfidenceColor(parlay.confidence_tier)} p-4`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-white/80 text-sm font-medium">
                                            {getConfidenceLabel(parlay.confidence_tier)}
                                        </span>
                                        <h3 className="text-white font-bold text-lg">
                                            Parlay {parlay.pick_count} Picks #{index + 1}
                                        </h3>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-white/80 text-sm">Probabilidad Combinada</div>
                                        <div className="text-white font-bold text-2xl">
                                            {formatProbability(parlay.combined_probability)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Picks */}
                            <div className="p-4 space-y-3">
                                {parlay.picks.map((pick, pickIndex) => (
                                    <div
                                        key={pickIndex}
                                        className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                                    >
                                        <div className="flex-1">
                                            <div className="text-gray-400 text-xs mb-1">
                                                {pick.league}
                                            </div>
                                            <div className="text-white font-medium">
                                                {pick.home_team} vs {pick.away_team}
                                            </div>
                                            <div className="text-emerald-400 text-sm mt-1">
                                                {translateMarket(pick.market)}
                                            </div>
                                        </div>
                                        <div className="text-right ml-4">
                                            <div className="text-white font-bold">
                                                {formatProbability(pick.p_model)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer simplificado - SIN CUOTAS */}
                            <div className="px-4 pb-4">
                                <div className="flex items-center justify-center p-3 bg-gray-900/80 rounded-lg border border-gray-700/50">
                                    <span className="text-emerald-400 font-medium">
                                        💡 {parlay.pick_count} selecciones de diferentes partidos
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
