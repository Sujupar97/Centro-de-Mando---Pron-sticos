
import React, { useState, useEffect } from 'react';
import { TopPickItem } from '../../types';
import { fetchTopPicks } from '../../services/liveDataService';
import { supabase } from '../../services/supabaseService';
import { mapLeagueToSportKey, fastBatchOddsCheck, findPriceInEvent } from '../../services/oddsService';
import { TrophyIcon, ChartBarIcon, CheckCircleIcon, XCircleIcon, LockClosedIcon } from '../icons/Icons';
import { useAuth } from '../../hooks/useAuth';
import { getUserSubscription } from '../../services/subscriptionCheckService'; // CAMBIADO: Usar servicio con bypass de admin
import { UpgradePlanModal } from '../pricing/UpgradePlanModal';

interface TopPicksProps {
    date: string;
    onOpenReport?: (runId: string | null, fixtureId: number) => void;
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
    const [showOnlyHighConfidence, setShowOnlyHighConfidence] = useState(false);

    // Subscription State
    const { profile } = useAuth();
    const [subscription, setSubscription] = useState<any>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    useEffect(() => {
        const loadSubscription = async () => {
            if (profile?.id) {
                // Usar subscriptionCheckService que tiene bypass de admin
                const sub = await getUserSubscription(profile.id, profile.organization_id);
                setSubscription(sub);
            }
        };
        loadSubscription();
    }, [profile]);

    // Calcular cuántos picks puede ver
    const getAllowedCount = () => {
        if (!subscription) return 1; // Default Free: 1 pick

        // BYPASS: Si es admin/superadmin o plan unlimited, acceso total
        if (profile?.role === 'admin' || profile?.role === 'superadmin' || subscription.planName === 'unlimited') {
            return 999999; // Ilimitado
        }

        const planName = subscription.planName || 'free';

        switch (planName) {
            case 'free': return 1;
            case 'starter': return 3;
            case 'pro': return 10;
            case 'premium': return 1000;
            default: return 1;
        }
    };

    const allowedCount = getAllowedCount();

    // ═══════════════════════════════════════════════════════════════
    // FILTRO ESTRICTO: Solo alta probabilidad o media con alta confianza
    // ═══════════════════════════════════════════════════════════════
    const filteredPicks = topPicks.filter(pick => {
        const prob = pick.bestRecommendation.probability;
        const conf = pick.bestRecommendation.confidence?.toLowerCase() || '';

        // HIGH (>= 80%): Siempre mostrar
        if (filter === 'HIGH') return prob >= 80;

        // MEDIUM (60-79%): Solo si tiene ALTA confianza
        if (filter === 'MEDIUM') {
            const inRange = prob >= 60 && prob < 80;
            if (showOnlyHighConfidence) {
                return inRange && (conf === 'alta' || conf === 'high');
            }
            return inRange && (conf === 'alta' || conf === 'high'); // Siempre requiere alta confianza
        }

        // ALL: Solo HIGH + MEDIUM con alta confianza (NO incluye LOW)
        if (filter === 'ALL') {
            if (prob >= 80) return true; // HIGH siempre
            if (prob >= 60 && (conf === 'alta' || conf === 'high')) return true; // MEDIUM + Alta
            return false; // LOW nunca
        }

        // LOW: NO mostrar (se deshabilita en UI, pero por seguridad)
        return false;
    });

    // Reset secondary filter when changing main filter
    useEffect(() => {
        if (filter !== 'MEDIUM') setShowOnlyHighConfidence(false);
    }, [filter]);

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

    // EFECTO: Buscar Cuotas Reales si faltan (Post-Load)
    useEffect(() => {
        if (isLoading || topPicks.length === 0) return;

        const checkAndFetchOdds = async () => {
            const picksMissingOdds = topPicks.filter(p => !p.odds && p.result === 'Pending'); // Solo pendientes

            if (picksMissingOdds.length === 0) return;

            console.log(`Buscando cuotas reales para ${picksMissingOdds.length} top picks...`);

            // 1. Preparar items para el batch
            const checkItems = picksMissingOdds.map(p => ({
                fixtureId: p.gameId,
                sportKey: mapLeagueToSportKey(p.league),
                home: p.teams.home.name,
                away: p.teams.away.name,
                date: p.date // ISO string
            }));

            try {
                // 2. Ejecutar Batch Check
                const realOddsMap = await fastBatchOddsCheck(checkItems);

                if (realOddsMap.size > 0) {
                    let updatesCount = 0;
                    const updatedPicks = [...topPicks];

                    for (const pick of updatedPicks) {
                        if (!pick.odds && realOddsMap.has(pick.gameId)) {
                            const event = realOddsMap.get(pick.gameId);
                            const realPrice = findPriceInEvent(event!, pick.bestRecommendation.market, pick.bestRecommendation.prediction);

                            if (realPrice) {
                                pick.odds = realPrice;
                                updatesCount++;

                                if (pick.analysisRunId) {
                                    await supabase
                                        .from('predictions')
                                        .update({ odds: realPrice })
                                        .eq('analysis_run_id', pick.analysisRunId)
                                        .eq('selection', pick.bestRecommendation.prediction); // Match selection text
                                }
                            }
                        }
                    }

                    if (updatesCount > 0) {
                        setTopPicks(updatedPicks);
                        console.log(`Actualizadas ${updatesCount} cuotas en Top Picks.`);
                    }
                }

            } catch (e) {
                console.error("Error fetching Top Pick odds:", e);
            }
        };

        checkAndFetchOdds();
    }, [topPicks.length, isLoading]); // Run once after load

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
                            Mostrando únicamente pronósticos de <strong>alta probabilidad</strong> y valor para los partidos analizados del {new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}.
                        </p>

                        {/* Filters - Solo HIGH, MEDIUM y TODAS (sin LOW) */}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <button onClick={() => setFilter('HIGH')} className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${filter === 'HIGH' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                                ALTA (+80%)
                            </button>
                            <button onClick={() => setFilter('MEDIUM')} className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${filter === 'MEDIUM' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                                MEDIA + CONFIANZA
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
                            <p>No hay pronósticos con confianza <strong>{filter}</strong> {showOnlyHighConfidence ? 'y ALTA CONFIANZA' : ''} para esta fecha.</p>
                        </div>
                    ) : filteredPicks.map((pick, index) => {
                        const isLocked = index >= allowedCount;

                        return (
                            <div
                                key={`${pick.gameId}-${pick.bestRecommendation.prediction}`}
                                onClick={() => {
                                    if (isLocked) {
                                        setShowUpgradeModal(true);
                                    } else {
                                        onOpenReport && onOpenReport(pick.analysisRunId || null, pick.gameId);
                                    }
                                }}
                                className={`relative bg-gray-800 rounded-xl shadow-lg overflow-hidden border transition-all duration-300 group cursor-pointer 
                                ${isLocked
                                        ? 'border-gray-700 hover:border-gray-600 opacity-90'
                                        : 'border-gray-700 hover:border-green-accent/50 hover:bg-gray-750'
                                    }`}
                            >
                                {/* Barra lateral indicadora de confianza */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${pick.bestRecommendation.probability >= 80 ? 'bg-green-accent' : pick.bestRecommendation.probability >= 60 ? 'bg-yellow-400' : 'bg-red-500'}`}></div>

                                {/* Result Badge Overlay */}
                                {pick.result && pick.result !== 'Pending' && !isLocked && (
                                    <div className={`absolute top-4 right-4 z-20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-md ${pick.result === 'Won' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                                        {pick.result === 'Won' ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
                                        {pick.result === 'Won' ? 'ACIERTO' : 'FALLO'}
                                    </div>
                                )}

                                {/* Live Odds Badge (Si hay cuota real) */}
                                {pick.odds && pick.result === 'Pending' && !isLocked && (
                                    <div className="absolute top-4 right-4 z-20 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-3 py-1.5 rounded-md text-sm font-black shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse-slow border border-blue-400 flex flex-col items-center leading-none">
                                        <span className="text-[10px] font-normal opacity-80 mb-0.5">CUOTA</span>
                                        <span>@{pick.odds.toFixed(2)}</span>
                                    </div>
                                )}

                                {/* LOCK OVERLAY */}
                                {isLocked && (
                                    <div className="absolute inset-0 z-30 backdrop-blur-sm bg-gray-900/60 flex flex-col items-center justify-center p-6 text-center">
                                        <div className="w-12 h-12 rounded-full bg-gray-800 border items-center justify-center flex mb-3 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                                            <LockClosedIcon className="w-6 h-6 text-gray-400" />
                                        </div>
                                        <h5 className="text-white font-bold text-lg mb-1">Pronóstico Bloqueado</h5>
                                        <p className="text-gray-300 text-xs mb-3 max-w-[200px]">Actualiza tu plan para ver este pronóstico de alta probabilidad.</p>
                                        <button className="bg-brand text-slate-900 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-emerald-400 transition-colors">
                                            Desbloquear
                                        </button>
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
                                        <div className={`flex flex-col ${isLocked ? 'blur-sm opacity-50' : ''}`}>
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
                                        <span className="uppercase text-[10px] font-bold tracking-widest bg-gray-800 px-2 py-0.5 rounded border border-gray-600 text-gray-300 group-hover:bg-green-accent group-hover:text-black transition-colors">
                                            {isLocked ? 'Bloqueado' : 'Ver Informe'}
                                        </span>
                                        <span>Confianza IA: <span className={pick.bestRecommendation.confidence === 'Alta' ? 'text-green-500 font-bold' : 'text-yellow-500'}>{pick.bestRecommendation.confidence}</span></span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showUpgradeModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <UpgradePlanModal
                        isOpen={showUpgradeModal}
                        onClose={() => setShowUpgradeModal(false)}
                        currentPlan={subscription?.plan?.name || 'free'}
                    />
                </div>
            )}
        </div>
    );
};
