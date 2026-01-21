import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseService';
import { SparklesIcon, CalendarDaysIcon, DocumentArrowDownIcon } from '../icons/Icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../hooks/useAuth';
import { getUserSubscription } from '../../services/subscriptionCheckService'; // CAMBIADO: Usar servicio con bypass
import { UpgradePlanModal } from '../pricing/UpgradePlanModal';
import { LockClosedIcon } from '../icons/Icons';

interface AutoParlayListProps {
    date: string;
}

interface AutoParlay {
    id: string;
    parlay_date: string;
    title: string;
    total_odds: number;
    win_probability: number;
    strategy: string;
    legs: any[];
    status: string;
    is_featured: boolean;
    created_at: string;
}

export const AutoParlayList: React.FC<AutoParlayListProps> = ({ date }) => {
    const [parlays, setParlays] = useState<AutoParlay[]>([]);
    const [loading, setLoading] = useState(false);

    // Subscription Check
    const { profile } = useAuth();
    const [hasAccess, setHasAccess] = useState(false);
    const [checkingAccess, setCheckingAccess] = useState(true);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    useEffect(() => {
        const checkAccess = async () => {
            if (!profile?.id) return;

            setCheckingAccess(true);
            try {
                const sub = await getUserSubscription(profile.id, profile.organization_id);

                // BYPASS: superadmin y admin tienen acceso
                // subscriptionCheckService ya retorna plan "unlimited" para admin/superadmin
                const planName = sub?.planName || 'free';
                setHasAccess(planName !== 'free');
            } catch (err) {
                console.error("Error checking subscription:", err);
                setHasAccess(false);
            } finally {
                setCheckingAccess(false);
            }
        };

        checkAccess();
    }, [profile]);

    useEffect(() => {
        if (hasAccess) {
            fetchAutoParlays();
        }
    }, [date, hasAccess]);

    const fetchAutoParlays = async () => {
        setLoading(true);
        try {
            // Buscamos parlays para la fecha seleccionada
            const { data, error } = await supabase
                .from('daily_auto_parlays')
                .select('*')
                .eq('parlay_date', date)
                .order('total_odds', { ascending: false });

            if (error) throw error;

            // Validar parlays para no mostrar basura (undefined vs undefined)
            const validParlays = (data || []).filter(p => {
                // Verificar que tenga legs
                if (!p.legs || !Array.isArray(p.legs) || p.legs.length === 0) return false;

                // Verificar que AL MENOS un leg sea válido (no undefined)
                const hasValidLegs = p.legs.every((l: any) =>
                    l.match &&
                    !l.match.includes('undefined') &&
                    l.prediction
                );

                return hasValidLegs;
            });

            // SOLO MOSTRAR EL MEJOR PARLAY (TOP 1)
            setParlays(validParlays.slice(0, 1));
        } catch (err) {
            console.error("Error fetching auto parlays:", err);
            setParlays([]);
        } finally {
            setLoading(false);
        }
    };

    const generatePDF = (parlay: AutoParlay) => {
        import('../../services/pdf/pdfGenerator').then(({ generateParlayPDF }) => {
            // Mapeo de datos para el reporte premium
            const smartParlayData: any = {
                id: parlay.id,
                parlay_type: 'Auto-Generated Parlay',
                combined_probability: parlay.win_probability || 0,
                confidence_tier: 'HIGH',
                strategy: parlay.strategy,
                picks: parlay.legs.map((leg: any) => ({
                    home_team: leg.home || leg.match?.split(' vs ')[0] || 'Local',
                    away_team: leg.away || leg.match?.split(' vs ')[1] || 'Visitante',
                    market: leg.market,
                    selection: leg.prediction,
                    p_model: 0,
                    odds: leg.odds,
                    argument: leg.reasoning
                }))
            };

            generateParlayPDF(smartParlayData, {
                fileName: `Auto_Parlay_${date}.pdf`,
                titleOverride: parlay.title
            });
        });
    };

    if (checkingAccess) {
        return (
            <div className="flex justify-center items-center h-48">
                <div className="w-8 h-8 border-4 border-green-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4 border border-gray-700 shadow-[0_0_20px_rgba(6,182,212,0.15)] group-hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all duration-500">
                        <LockClosedIcon className="w-8 h-8 text-cyan-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Parlays con IA Bloqueados</h3>
                    <p className="text-gray-400 max-w-md mx-auto mb-6">
                        Nuestra IA analiza miles de combinaciones para crear los Parlays de mayor probabilidad matemática.
                        <br /><span className="text-cyan-400 font-medium">Actualiza a Starter o superior para desbloquear.</span>
                    </p>
                    <button
                        onClick={() => setShowUpgradeModal(true)}
                        className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 px-8 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                        <SparklesIcon className="w-5 h-5 text-black" />
                        DESBLOQUEAR AHORA
                    </button>
                </div>
                {showUpgradeModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm text-left">
                        <UpgradePlanModal
                            isOpen={showUpgradeModal}
                            onClose={() => setShowUpgradeModal(false)}
                            currentPlan="free"
                        />
                    </div>
                )}
            </div>
        );
    }

    if (loading) return <div className="text-gray-400 text-sm p-4 text-center">Buscando parlays automáticos...</div>;

    if (parlays.length === 0) {
        return (
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700 text-center mb-6">
                <div className="flex justify-center mb-3">
                    <SparklesIcon className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-gray-300 font-medium mb-1">Sin Parlays Automáticos</h3>
                <p className="text-gray-500 text-sm">
                    El sistema aún no ha generado parlays para esta fecha.
                    <br />
                    Se generan automáticamente todos los días a las 4:00 AM.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
                <SparklesIcon className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-semibold text-white">Parlays del Día (Automáticos)</h2>
                <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30">
                    Generado por IA
                </span>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {parlays.map((parlay) => (
                    <div key={parlay.id} className="bg-slate-800 rounded-xl border border-cyan-500/30 overflow-hidden shadow-lg shadow-cyan-900/10">
                        {/* Header */}
                        <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                    {parlay.title}
                                    {parlay.is_featured && (
                                        <span className="text-yellow-400 text-xs">⭐ Destacado</span>
                                    )}
                                </h3>
                                <p className="text-gray-400 text-sm mt-1">{parlay.strategy}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className="bg-cyan-500/20 px-3 py-1 rounded-lg border border-cyan-500/30">
                                    <span className="block text-xs text-cyan-300 font-medium uppercase tracking-wider">Cuota Total</span>
                                    <span className="block text-xl font-bold text-cyan-400 text-center">{parlay.total_odds}</span>
                                </div>
                                <button
                                    onClick={() => generatePDF(parlay)}
                                    className="flex items-center gap-2 bg-slate-700 hover:bg-cyan-600 text-white transition-all px-3 py-1.5 rounded-lg border border-white/10 hover:border-cyan-400 shadow-lg group"
                                    title="Descargar Reporte PDF"
                                >
                                    <DocumentArrowDownIcon className="w-4 h-4 text-cyan-400 group-hover:text-white" />
                                    <span className="text-xs font-bold uppercase tracking-wide">PDF</span>
                                </button>
                            </div>
                        </div>

                        {/* Legs */}
                        <div className="divide-y divide-slate-700">
                            {parlay.legs.map((leg: any, idx: number) => (
                                <div key={idx} className="p-4 hover:bg-slate-700/30 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium text-white">
                                            {leg.match || `${leg.home} vs ${leg.away}`}
                                        </h4>
                                        <span className="text-cyan-400 font-bold bg-slate-900 px-2 py-0.5 rounded text-sm">
                                            {leg.odds}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-500 block text-xs uppercase mb-0.5">Mercado</span>
                                            <span className="text-gray-300">{leg.market}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block text-xs uppercase mb-0.5">Selección</span>
                                            <span className="text-gray-200 font-medium">{leg.prediction}</span>
                                        </div>
                                    </div>
                                    {leg.reasoning && (
                                        <div className="mt-3 text-xs text-gray-400 bg-slate-900/30 p-2 rounded border border-slate-700/50">
                                            <span className="text-cyan-500/70 font-medium mr-1">IA:</span>
                                            {leg.reasoning}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
