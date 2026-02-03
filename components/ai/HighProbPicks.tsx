// components/ai/HighProbPicks.tsx
// Componente para mostrar Oportunidades (Smart Parlays) con Cuota > 1.40
// Algoritmo: Anchors (Odds >= 1.40) + Complements (Odds < 1.40)

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';
import { TrophyIcon, SparklesIcon, ArrowPathIcon, ChartBarIcon, ArrowTopRightOnSquareIcon, PlusIcon } from '../icons/Icons';

interface HighProbPick {
    id: string;
    job_id: string;
    fixture_id: number;
    market: string;
    selection: string;
    p_model: number;
    decision: string;
    home_team: string;
    away_team: string;
    league: string;
    odds: number;
    logo_home?: string;
    logo_away?: string;
}

interface SmartParlay {
    id: string;
    anchor: HighProbPick;
    complement: HighProbPick;
    combined_odds: number;
    combined_prob: number;
}

interface HighProbPicksProps {
    date: string;
    onViewReport?: (jobId: string, fixtureId: number) => void;
}

const HighProbPicks: React.FC<HighProbPicksProps> = ({ date, onViewReport }) => {
    const [parlays, setParlays] = useState<SmartParlay[]>([]);
    const [singles, setSingles] = useState<HighProbPick[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPicks = async (forceRegenerate = false) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`[SmartParlays] Requesting parlays for date: ${date} (Force: ${forceRegenerate})`);

            const { data, error: fnError } = await supabase.functions.invoke('v2-generate-parlays', {
                body: { date, force_regenerate: forceRegenerate }
            });

            if (fnError) throw fnError;
            if (!data.success) throw new Error(data.message || 'Error generating parlays');

            console.log('[SmartParlays] Response:', data.stats);

            setParlays(data.parlays || []);
            setSingles(data.singles || []); // Backend now returns singles if parlays are empty

        } catch (err: any) {
            console.error('[SmartParlays] Error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPicks(false);
    }, [date]);

    // Helpers UI
    const translateMarket = (market: string): string => {
        const translations: Record<string, string> = {
            'over_0.5_goals': 'Más de 0.5 Goles',
            'over_1.5_goals': 'Más de 1.5 Goles',
            'over_2.5_goals': 'Más de 2.5 Goles',
            'over_3.5_goals': 'Más de 3.5 Goles',
            'btts_yes': 'Ambos Anotan: Sí',
            'btts_no': 'Ambos Anotan: No',
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

    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState error={error} onRetry={loadPicks} />;

    // CASO 1: HAY PARLAYS (Prioridad)
    if (parlays.length > 0) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-brand to-emerald-600 rounded-xl shadow-lg shadow-brand/20">
                            <SparklesIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">Oportunidades Maestras</h3>
                            <p className="text-sm text-slate-400">Mezclas de Alto Valor (Cuota {'>'} 1.40)</p>
                        </div>
                    </div>
                    <button onClick={() => loadPicks(true)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Regenerar Oportunidades">
                        <ArrowPathIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {parlays.map((parlay, idx) => (
                        <SmartParlayCard
                            key={parlay.id}
                            parlay={parlay}
                            index={idx}
                            onViewReport={onViewReport}
                            translateMarket={translateMarket}
                        />
                    ))}
                </div>
            </div>
        );
    }

    // CASO 2: NO HAY PARLAYS PERO HAY SINGLES (Fallback de Valor)
    if (singles.length > 0) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                            <SparklesIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">Mejores Individuales</h3>
                            <p className="text-sm text-slate-400">Picks de Valor (Cuota {'>='} 1.50) sin combinar</p>
                        </div>
                    </div>
                    <button onClick={() => loadPicks(true)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Regenerar Oportunidades">
                        <ArrowPathIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {singles.map((pick) => (
                        <SinglePickCard
                            key={pick.id}
                            pick={pick}
                            translateMarket={translateMarket}
                            onView={() => onViewReport?.(pick.job_id, pick.fixture_id)}
                        />
                    ))}
                </div>
            </div>
        );
    }

    // CASO 3: NADA (Empty)
    return <EmptyState onRetry={() => loadPicks(true)} />;
};

// --- SUB-COMPONENTS ---

const SmartParlayCard: React.FC<{
    parlay: SmartParlay;
    index: number;
    onViewReport?: (jobId: string, fixtureId: number) => void;
    translateMarket: (m: string) => string;
}> = ({ parlay, index, onViewReport, translateMarket }) => {
    return (
        <div className="relative group">
            {/* Background Glow Effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-brand to-emerald-600 rounded-2xl opacity-30 group-hover:opacity-50 blur transition duration-500"></div>

            <div className="relative bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
                {/* Header: Combined Stats */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-white/5 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="bg-brand text-white text-xs font-black px-2 py-1 rounded">PARLAY #{index + 1}</span>
                        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Probabilidad Combinada</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <span className="block text-2xl font-black text-white leading-none">
                                @{parlay.combined_odds.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest">Cuota Total</span>
                        </div>
                        <div className="w-px h-8 bg-white/10"></div>
                        <div className="text-right">
                            <span className="block text-2xl font-black text-brand leading-none">
                                {Math.round(parlay.combined_prob * 100)}%
                            </span>
                            <span className="text-[10px] text-brand/80 uppercase font-bold tracking-widest">Probabilidad</span>
                        </div>
                    </div>
                </div>

                {/* Grid of 2 Legs */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
                    {/* Leg 1: Anchor */}
                    <LegCard
                        role="ANCHOR"
                        pick={parlay.anchor}
                        translate={translateMarket}
                        onView={() => onViewReport?.(parlay.anchor.job_id, parlay.anchor.fixture_id)}
                    />

                    {/* Leg 2: Complement */}
                    <LegCard
                        role="COMPLEMENT"
                        pick={parlay.complement}
                        translate={translateMarket}
                        onView={() => onViewReport?.(parlay.complement.job_id, parlay.complement.fixture_id)}
                    />
                </div>

                {/* Footer / Smart Tag */}
                <div className="bg-slate-950/50 p-3 flex justify-between items-center text-xs text-slate-500 px-4">
                    <span className="flex items-center gap-1.5">
                        <SparklesIcon className="w-3.5 h-3.5 text-yellow-500" />
                        <span>Recomendación Inteligente V4</span>
                    </span>
                    <span className="opacity-50">Gemini-3-Pro Analysis</span>
                </div>
            </div>

            {/* Plus Icon Overlay */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex w-8 h-8 bg-slate-800 border-2 border-slate-700 rounded-full items-center justify-center z-10 shadow-xl text-slate-400">
                <PlusIcon className="w-4 h-4" />
            </div>
        </div>
    );
};

const LegCard: React.FC<{
    role: 'ANCHOR' | 'COMPLEMENT';
    pick: HighProbPick;
    translate: (m: string) => string;
    onView: () => void;
}> = ({ role, pick, translate, onView }) => {
    const isAnchor = role === 'ANCHOR';

    return (
        <div className={`p-5 transition-colors hover:bg-white/5 ${isAnchor ? 'bg-gradient-to-br from-slate-800/50 to-transparent' : ''}`}>
            {/* Header Badge */}
            <div className="flex justify-between items-start mb-4">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${isAnchor ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                    {isAnchor ? 'BASE (Cuota > 1.40)' : 'REFUERZO'}
                </span>
                <span className={`text-sm font-bold ${isAnchor ? 'text-amber-400' : 'text-blue-400'}`}>
                    @{pick.odds.toFixed(2)}
                </span>
            </div>

            {/* Match Info */}
            <div className="flex items-center gap-3 mb-3">
                <div className="flex -space-x-2">
                    {pick.logo_home ? <img src={pick.logo_home} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-700 object-contain p-0.5" /> : <div className="w-8 h-8 rounded-full bg-slate-700" />}
                    {pick.logo_away ? <img src={pick.logo_away} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-700 object-contain p-0.5" /> : <div className="w-8 h-8 rounded-full bg-slate-700" />}
                </div>
                <div className="min-w-0">
                    <p className="text-white font-bold text-sm truncate leading-tight">{pick.home_team}</p>
                    <p className="text-slate-400 text-xs truncate">vs {pick.away_team}</p>
                </div>
            </div>

            {/* Selection */}
            <div className="bg-black/30 rounded-lg p-3 border border-white/5 mb-3">
                <p className="text-[10px] text-slate-500 uppercase mb-0.5">{translate(pick.market)}</p>
                <div className="flex items-center gap-2">
                    <ChartBarIcon className="w-4 h-4 text-white" />
                    <p className="text-white font-bold text-sm">{pick.selection}</p>
                </div>
            </div>

            {/* Action */}
            <button
                onClick={(e) => { e.stopPropagation(); onView(); }}
                className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all border border-transparent hover:border-white/10"
            >
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                VER ANÁLISIS
            </button>
        </div>
    );
};

const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]"></div>
        <p className="text-slate-300 font-medium animate-pulse">Buscando Oportunidades Maestras...</p>
        <p className="text-slate-500 text-sm mt-1">Calculando mezclas óptimas</p>
    </div>
);

const ErrorState: React.FC<{ error: string, onRetry: () => void }> = ({ error, onRetry }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-red-400 mb-4 bg-red-900/20 px-4 py-2 rounded-lg border border-red-500/30">{error}</p>
        <button onClick={onRetry} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-all">
            <ArrowPathIcon className="w-4 h-4" /> Reintentar
        </button>
    </div>
);

const EmptyState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-white/5">
            <TrophyIcon className="w-12 h-12 text-slate-600" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Sin Oportunidades Maestras</h3>
        <p className="text-slate-400 max-w-md mb-6 leading-relaxed">
            No encontramos combinaciones que cumplan el criterio de <span className="text-amber-400 font-bold">Cuota {'>'} 1.40 + Prob {'>'} 80%</span>.
            Intenta analizar más ligas para encontrar valor.
        </p>
        <button onClick={onRetry} className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white font-bold rounded-xl hover:bg-brand/80 transition-all shadow-lg hover:shadow-brand/20">
            <ArrowPathIcon className="w-4 h-4" /> Actualizar
        </button>
    </div>
);

// --- SUB-COMPONENTS ---
const SinglePickCard: React.FC<{
    pick: HighProbPick;
    translateMarket: (m: string) => string;
    onView: () => void;
}> = ({ pick, translateMarket, onView }) => {
    return (
        <div className="bg-slate-900 border border-white/10 rounded-xl p-4 hover:bg-slate-800 transition-all cursor-pointer group relative overflow-hidden" onClick={onView}>
            <div className="absolute top-0 right-0 p-2 bg-blue-600/20 rounded-bl-xl border-b border-l border-blue-500/20">
                <span className="text-blue-400 font-bold text-xs">{Math.round(pick.p_model * 100)}% Prob</span>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="flex -space-x-2">
                    <img src={pick.logo_home || ''} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700" />
                    <img src={pick.logo_away || ''} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700" />
                </div>
                <div>
                    <h4 className="text-white font-bold text-sm leading-tight">{pick.home_team}</h4>
                    <span className="text-xs text-slate-400">vs {pick.away_team}</span>
                </div>
            </div>

            <div className="bg-black/40 rounded-lg p-3 border border-white/5 flex justify-between items-center mb-3">
                <div>
                    <p className="text-[10px] uppercase text-slate-500">{translateMarket(pick.market)}</p>
                    <p className="text-white font-bold text-sm">{pick.selection}</p>
                </div>
                <div className="text-right">
                    <span className="block text-xl font-black text-amber-400">@{pick.odds.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500 uppercase">Cuota</span>
                </div>
            </div>

            <div className="w-full py-1.5 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 group-hover:text-white transition-colors">
                <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                Ver Análisis Completo
            </div>
        </div>
    );
};

export default HighProbPicks;

// Force Deploy: Trigger Netlify Build (Integrity Check)
