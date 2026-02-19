
// components/ai/HighProbPicks.tsx
// Componente para mostrar Oportunidades (Picks Individuales >= 80% con cuota real)
// Updated: Removed Smart Parlays logic as per user request.

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';
import { manualOverridePick } from '../../services/resultsService';
import { useAuth } from '../../hooks/useAuth';
import { TrophyIcon, ChartBarIcon, ArrowPathIcon, ArrowTopRightOnSquareIcon } from '../icons/Icons';

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
    result?: string;
    verified_at?: string;
    actual_score?: string;
}

interface HighProbPicksProps {
    date: string;
    onViewReport?: (jobId: string, fixtureId: number) => void;
}

const HighProbPicks: React.FC<HighProbPicksProps> = ({ date, onViewReport }) => {
    const { profile } = useAuth();
    const isAdmin = profile?.role && ['platform_owner', 'agency_admin', 'superadmin'].includes(profile.role);
    const [singles, setSingles] = useState<HighProbPick[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showLowOdds, setShowLowOdds] = useState(false);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [inProgress, setInProgress] = useState(0);

    const loadPicks = async (forceRegenerate = false) => {
        setIsLoading(true);
        setError(null);
        setInfoMessage(null);

        try {
            console.log(`[HighProbPicks] Requesting picks for date: ${date} (Force: ${forceRegenerate})`);

            const { data, error: fnError } = await supabase.functions.invoke('v2-generate-parlays', {
                body: { date, force_regenerate: forceRegenerate }
            });

            if (fnError) throw fnError;
            if (!data.success) {
                const backendError = data.error || 'Error fetching picks';
                throw new Error(backendError);
            }

            console.log('[HighProbPicks] Response:', data.stats);
            setSingles(data.singles || []);
            setInProgress(data.stats?.in_progress || 0);

            // Show info message if no picks but analysis exists or is in progress
            if ((!data.singles || data.singles.length === 0) && data.message) {
                setInfoMessage(data.message);
            }

        } catch (err: any) {
            console.error('[HighProbPicks] Error:', err);
            setError(typeof err === 'string' ? err : err.message || JSON.stringify(err));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPicks(false);
    }, [date]);

    // Filtering Logic: picks with odds >= 1.40 are "main", odds < 1.40 OR no odds are "low/complementary"
    const mainPicks = singles.filter(p => p.odds && p.odds >= 1.40);
    const lowOddsPicks = singles.filter(p => !p.odds || p.odds < 1.40);
    
    // Display Logic
    const displayPicks = mainPicks; // Cuotas bajas ocultas temporalmente

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
    if (error) return <ErrorState error={error} onRetry={() => loadPicks(true)} />;

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                        <ChartBarIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white tracking-tight">Oportunidades de Valor</h3>
                        <p className="text-sm text-slate-400">Picks Individuales (Prob {'\u2265'} 80%)</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* TEMPORARILY HIDDEN — Cuotas bajas ocultas
                    {lowOddsPicks.length > 0 && (
                        <button
                            onClick={() => setShowLowOdds(!showLowOdds)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                showLowOdds
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                        >
                            {showLowOdds ? 'Ocultar' : 'Ver'} Cuotas Bajas ({lowOddsPicks.length})
                        </button>
                    )}
                    */}
                    
                    <button onClick={() => loadPicks(true)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Actualizar Oportunidades">
                        <ArrowPathIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {displayPicks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayPicks.map((pick) => (
                        <SinglePickCard
                            key={pick.id}
                            pick={pick}
                            translateMarket={translateMarket}
                            onView={() => onViewReport?.(pick.job_id, pick.fixture_id)}
                            isAdmin={!!isAdmin}
                            onOverride={async (result) => {
                                try {
                                    await manualOverridePick(pick.id, result, {
                                        fixture_id: pick.fixture_id,
                                        market: pick.market,
                                        selection: pick.selection,
                                        p_model: pick.p_model,
                                        odds: pick.odds,
                                        job_id: pick.job_id,
                                    });
                                    setSingles(prev => prev.map(p =>
                                        p.id === pick.id ? { ...p, result, actual_score: `Manual: ${result}`, verified_at: new Date().toISOString() } : p
                                    ));
                                } catch (err: any) {
                                    console.error('[HighProbPicks] Override error:', err);
                                    alert(`Error: ${err.message}`);
                                }
                            }}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState onRetry={() => loadPicks(true)} message={infoMessage} inProgress={inProgress} />
            )}
        </div>
    );
};

// --- SUB-COMPONENTS ---

const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]"></div>
        <p className="text-slate-300 font-medium animate-pulse">Buscando Oportunidades...</p>
        <p className="text-slate-500 text-sm mt-1">Filtrando mejores probabilidades</p>
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

const EmptyState: React.FC<{ onRetry: () => void; message?: string | null; inProgress?: number }> = ({ onRetry, message, inProgress }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-white/5">
            {inProgress && inProgress > 0 ? (
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
                <TrophyIcon className="w-12 h-12 text-slate-600" />
            )}
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
            {inProgress && inProgress > 0 ? 'Análisis en Progreso...' : 'Sin Oportunidades Claras'}
        </h3>
        <p className="text-slate-400 max-w-md mb-6 leading-relaxed">
            {message || (
                <>No encontramos picks con <span className="text-amber-400 font-bold">Probabilidad {'\u2265'} 80%</span> para esta fecha. Intenta revisar otras jornadas.</>
            )}
        </p>
        <button onClick={onRetry} className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white font-bold rounded-xl hover:bg-brand/80 transition-all shadow-lg hover:shadow-brand/20">
            <ArrowPathIcon className="w-4 h-4" /> {inProgress && inProgress > 0 ? 'Verificar de Nuevo' : 'Actualizar'}
        </button>
    </div>
);

const ResultBadge: React.FC<{ result?: string; actualScore?: string }> = ({ result, actualScore }) => {
    if (!result || result === 'PENDING') return null;

    const config: Record<string, { bg: string; text: string; label: string; border: string }> = {
        WON: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'GANADA', border: 'border-emerald-500/50' },
        LOST: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'PERDIDA', border: 'border-red-500/50' },
        VOID: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'NULA', border: 'border-slate-500/50' },
        PUSH: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'PUSH', border: 'border-slate-500/50' },
    };

    const c = config[result] || config.VOID;

    return (
        <div className={`absolute top-0 left-0 p-1.5 px-2.5 ${c.bg} rounded-br-xl border-b border-r ${c.border} z-10`}>
            <span className={`${c.text} font-black text-[10px] tracking-wider`}>{c.label}</span>
            {actualScore && <span className={`${c.text} text-[9px] ml-1 opacity-70`}>({actualScore})</span>}
        </div>
    );
};

const SinglePickCard: React.FC<{
    pick: HighProbPick;
    translateMarket: (m: string) => string;
    onView: () => void;
    isAdmin: boolean;
    onOverride: (result: 'WON' | 'LOST') => Promise<void>;
}> = ({ pick, translateMarket, onView, isAdmin, onOverride }) => {
    const [overriding, setOverriding] = useState(false);
    const isVerified = pick.result && pick.result !== 'PENDING';
    const isLost = pick.result === 'LOST';
    const isWon = pick.result === 'WON';
    const canOverride = isAdmin && (!isVerified || pick.actual_score?.startsWith('Manual'));

    const handleOverride = async (e: React.MouseEvent, result: 'WON' | 'LOST') => {
        e.stopPropagation();
        if (overriding) return;
        setOverriding(true);
        try {
            await onOverride(result);
        } finally {
            setOverriding(false);
        }
    };

    return (
        <div
            className={`bg-slate-900 border rounded-xl p-4 hover:bg-slate-800 transition-all cursor-pointer group relative overflow-hidden ${
                isWon ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/5' :
                isLost ? 'border-red-500/20 opacity-60' :
                'border-white/10'
            }`}
            onClick={onView}
        >
            <ResultBadge result={pick.result} actualScore={pick.actual_score} />

            <div className="absolute top-0 right-0 p-2 bg-blue-600/20 rounded-bl-xl border-b border-l border-blue-500/20">
                <span className="text-blue-400 font-bold text-xs">{Math.round(pick.p_model * 100)}% Prob</span>
            </div>

            <div className={`flex items-center gap-3 mb-4 ${isVerified ? 'mt-2' : ''}`}>
                <div className="flex -space-x-2">
                    <img src={pick.logo_home || ''} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 object-contain p-1" />
                    <img src={pick.logo_away || ''} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 object-contain p-1" />
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
                    <span className={`block text-xl font-black ${pick.odds ? 'text-amber-400' : 'text-slate-500'}`}>
                        {pick.odds ? `@${pick.odds.toFixed(2)}` : 'Sin cuota'}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase">{pick.odds ? 'Cuota' : 'Estimada'}</span>
                </div>
            </div>

            {canOverride ? (
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => handleOverride(e, 'WON')}
                        disabled={overriding}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                    >
                        {overriding ? '...' : 'GANADA'}
                    </button>
                    <button
                        onClick={(e) => handleOverride(e, 'LOST')}
                        disabled={overriding}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50"
                    >
                        {overriding ? '...' : 'PERDIDA'}
                    </button>
                </div>
            ) : (
                <div className="w-full py-1.5 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 group-hover:text-white transition-colors">
                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                    Ver Análisis Completo
                </div>
            )}
        </div>
    );
};

export default HighProbPicks;
