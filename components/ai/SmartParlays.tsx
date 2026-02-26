// components/ai/SmartParlays.tsx
// Componente para mostrar y generar Parlays (combinaciones multi-partido)
// Usa la fecha global pasada desde LiveFeed via prop
// Incluye subscription gating + transparencia historica

import React, { useState, useEffect, useMemo } from 'react';
import {
    generateSmartParlays,
    getSmartParlays,
    ParlayCombo,
    translateMarket,
    getRiskColor,
    getRiskLabel
} from '../../services/smartParlayService';
import { manualOverrideParlayLeg } from '../../services/resultsService';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { isHistoricalDate, canViewParlays, getAllowedParlayCount } from '../../utils/planAccessUtils';
import { usePresentationMode } from '../../hooks/usePresentationMode';
import { useAuth } from '../../hooks/useAuth';
import { isAgencyRole } from '../../utils/roles';
import { useOrganization } from '../../contexts/OrganizationContext';

interface SmartParlaysProps {
    date: string;
}

const SmartParlays: React.FC<SmartParlaysProps> = ({ date }) => {
    const [parlays, setParlays] = useState<ParlayCombo[]>([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<any>(null);
    const { profile } = useAuth();
    const {
        plan,
        usage,
        limits,
        isAdmin,
        isFree,
    } = useSubscription();
    const { presentationMode } = usePresentationMode();
    const { isImpersonating } = useOrganization();
    const isAgency = isAgencyRole(profile?.role) && !isImpersonating;

    const historical = useMemo(() => isHistoricalDate(date), [date]);
    const parlayAccess = useMemo(
        () => canViewParlays(plan.parlay_percentage, historical),
        [plan.parlay_percentage, historical]
    );

    useEffect(() => {
        if (parlayAccess || isAdmin) {
            loadParlays();
        } else {
            setParlays([]);
        }
    }, [date, parlayAccess, isAdmin]);

    const loadParlays = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getSmartParlays(date);
            setParlays(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Solo la agencia puede generar — botón solo visible para isAgency
    const handleGenerate = async () => {
        if (historical) {
            setError('No se pueden generar parlays para fechas anteriores.');
            return;
        }

        setGenerating(true);
        setError(null);
        setStats(null);

        try {
            const result = await generateSmartParlays(date);

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

    // Limitar parlays visibles según plan (agencia ve todo, clientes según porcentaje)
    const visibleParlays = useMemo(() => {
        if (isAgency || isAdmin) return parlays;
        if (historical) return parlays; // Transparencia histórica
        const allowed = getAllowedParlayCount(parlays.length, plan.parlay_percentage, false);
        return parlays.slice(0, allowed);
    }, [parlays, isAgency, isAdmin, historical, plan.parlay_percentage]);

    const hiddenParlayCount = parlays.length - visibleParlays.length;

    // --- Plan Free sin acceso a parlays del dia actual ---
    if (!parlayAccess && !isAdmin) {
        return (
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
                <div className="text-center py-12">
                    <div className="text-5xl mb-4">🔒</div>
                    <h3 className="text-xl font-bold text-white mb-2">
                        Parlays no disponibles en tu plan
                    </h3>
                    <p className="text-gray-400 mb-6 max-w-md mx-auto">
                        {isFree
                            ? 'Los Parlays están disponibles a partir del plan Pro. Actualiza para acceder a combinaciones inteligentes.'
                            : 'Los Parlays no están incluidos en tu plan actual. Actualiza para ver combinaciones de alto valor.'}
                    </p>
                    <a
                        href="/pricing"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all"
                    >
                        <span>⚡</span>
                        Ver planes
                    </a>
                    {!isFree && (
                        <p className="text-gray-500 text-xs mt-4">
                            Los parlays de días anteriores son visibles para todos los planes.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Info de porcentaje de vista para clientes (no agencia)
    const parlayPercentageDisplay = (isAdmin || isAgency || plan.parlay_percentage >= 100)
        ? null
        : plan.parlay_percentage;

    return (
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-3 sm:p-4 md:p-6">
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
                    {/* Indicador de porcentaje de vista (solo clientes con limite) */}
                    {!historical && parlayPercentageDisplay !== null && parlayPercentageDisplay > 0 && (
                        <div className="text-right">
                            <div className="text-gray-400 text-xs">Tu plan</div>
                            <div className="text-sm font-medium text-emerald-400">
                                {parlayPercentageDisplay}% parlays
                            </div>
                        </div>
                    )}

                    {/* Badge historico */}
                    {historical && (
                        <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 text-xs font-medium">
                            Histórico
                        </span>
                    )}

                    {/* Boton generar (solo agencia, dia actual) */}
                    {!historical && isAgency && (
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
                    )}
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
            {!loading && visibleParlays.length === 0 && parlays.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                    <p className="text-4xl mb-3">🎰</p>
                    <p>No hay Parlays para esta fecha.</p>
                    {!historical && isAgency && (
                        <p className="text-sm mt-1">Analiza al menos 3 partidos y luego presiona "Generar Parlays".</p>
                    )}
                    {!historical && !isAgency && (
                        <p className="text-sm mt-1">Los Parlays son generados por el equipo de analistas. Vuelve pronto.</p>
                    )}
                </div>
            )}

            {/* Parlay combos list */}
            {!loading && visibleParlays.length > 0 && (
                <div className="space-y-4">
                    {visibleParlays.map((combo, index) => (
                        <div
                            key={combo.id}
                            className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden"
                        >
                            {/* Combo Header */}
                            <div className={`bg-gradient-to-r ${getRiskColor(combo.risk_tier)} p-4 relative`}>
                                {!presentationMode && combo.status && combo.status !== 'pending' && (
                                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                                        combo.status === 'won' ? 'bg-emerald-500 text-white' :
                                        combo.status === 'lost' ? 'bg-red-500 text-white' :
                                        combo.status === 'partial' ? 'bg-amber-500 text-white' :
                                        'bg-slate-500 text-white'
                                    }`}>
                                        {combo.status === 'won' ? 'GANADO' :
                                         combo.status === 'lost' ? 'PERDIDO' :
                                         combo.status === 'partial' ? 'PARCIAL' : 'NULO'}
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <div className={combo.status && combo.status !== 'pending' ? 'mt-4' : ''}>
                                        <span className="text-white/80 text-xs font-medium uppercase tracking-wider">
                                            {getRiskLabel(combo.risk_tier)}
                                        </span>
                                        <h3 className="text-white font-bold text-lg">
                                            Parlay #{index + 1}
                                        </h3>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                        <div className="text-right">
                                            <div className="text-white/80 text-xs">Cuota Combinada</div>
                                            <div className="text-white font-bold text-lg sm:text-2xl">
                                                x{combo.combined_odds?.toFixed(2) || '---'}
                                            </div>
                                        </div>
                                        <div className="text-right border-l border-white/20 pl-4">
                                            <div className="text-white/80 text-xs">Probabilidad</div>
                                            <div className="text-white font-bold text-lg sm:text-2xl">
                                                {formatProbability(combo.combined_probability)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Picks detail — each leg with result + admin override */}
                            <div className="p-4 space-y-3">
                                {combo.picks.map((pick, pickIndex) => {
                                    const legResult = (pick as any).result as string | undefined;
                                    const isLegWon = !presentationMode && legResult === 'WON';
                                    const isLegLost = !presentationMode && legResult === 'LOST';
                                    const isLegVoid = !presentationMode && legResult === 'VOID';
                                    const isLegResolved = isLegWon || isLegLost || isLegVoid;

                                    return (
                                        <div
                                            key={pickIndex}
                                            className={`p-3 bg-gray-900/50 rounded-lg border ${
                                                isLegWon ? 'border-emerald-500/30' :
                                                isLegLost ? 'border-red-500/30 opacity-70' :
                                                'border-gray-700/30'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
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
                                                <div className="text-right ml-4 flex-shrink-0 flex items-center gap-2">
                                                    {/* Result badge */}
                                                    {!presentationMode && isLegResolved && (
                                                        <span className={`text-xs font-black px-2 py-1 rounded ${
                                                            isLegWon ? 'bg-emerald-500/20 text-emerald-400' :
                                                            isLegLost ? 'bg-red-500/20 text-red-400' :
                                                            'bg-slate-500/20 text-slate-400'
                                                        }`}>
                                                            {isLegWon ? 'GANADA' : isLegLost ? 'PERDIDA' : 'NULA'}
                                                        </span>
                                                    )}
                                                    <div>
                                                        <div className="text-emerald-400 font-bold text-base sm:text-lg">
                                                            x{pick.odds?.toFixed(2) || '---'}
                                                        </div>
                                                        <div className="text-gray-400 text-xs">
                                                            {formatProbability(pick.p_model)} prob
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Admin per-leg override buttons */}
                                            {isAdmin && (
                                                <LegOverrideButtons
                                                    parlayId={combo.id}
                                                    legIndex={pickIndex}
                                                    currentResult={legResult}
                                                    onOverrideComplete={loadParlays}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
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

            {/* Banner de parlays ocultos por plan */}
            {!loading && hiddenParlayCount > 0 && (
                <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl text-center">
                    <p className="text-gray-300 text-sm mb-2">
                        Mostrando {visibleParlays.length} de {parlays.length} parlays disponibles.
                    </p>
                    <a
                        href="/pricing"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all"
                    >
                        Actualiza tu plan para ver todos
                    </a>
                </div>
            )}

        </div>
    );
};

// --- Admin Per-Leg Override Buttons ---
const LegOverrideButtons: React.FC<{
    parlayId: string;
    legIndex: number;
    currentResult?: string;
    onOverrideComplete: () => void;
}> = ({ parlayId, legIndex, currentResult, onOverrideComplete }) => {
    const [overriding, setOverriding] = useState(false);

    const handleLegOverride = async (result: 'WON' | 'LOST' | 'VOID') => {
        if (overriding) return;
        setOverriding(true);
        try {
            await manualOverrideParlayLeg(parlayId, legIndex, result);
            onOverrideComplete();
        } catch (e: any) {
            console.error('[Parlays] Leg override error:', e);
        } finally {
            setOverriding(false);
        }
    };

    return (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700/30">
            <span className="text-gray-500 text-[10px] uppercase tracking-wide mr-1">Resultado:</span>
            <button
                onClick={() => handleLegOverride('WON')}
                disabled={overriding}
                className={`flex-1 py-1.5 rounded text-xs font-bold border transition-all disabled:opacity-50 ${
                    currentResult === 'WON'
                        ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                }`}
            >
                {overriding ? '...' : 'GANADA'}
            </button>
            <button
                onClick={() => handleLegOverride('LOST')}
                disabled={overriding}
                className={`flex-1 py-1.5 rounded text-xs font-bold border transition-all disabled:opacity-50 ${
                    currentResult === 'LOST'
                        ? 'bg-red-500/30 text-red-300 border-red-500/50'
                        : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                }`}
            >
                {overriding ? '...' : 'PERDIDA'}
            </button>
            <button
                onClick={() => handleLegOverride('VOID')}
                disabled={overriding}
                className={`py-1.5 px-2.5 rounded text-xs font-bold border transition-all disabled:opacity-50 ${
                    currentResult === 'VOID'
                        ? 'bg-slate-500/30 text-slate-300 border-slate-500/50'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20'
                }`}
            >
                {overriding ? '...' : 'NULA'}
            </button>
        </div>
    );
};

export default SmartParlays;
