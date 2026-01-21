import React, { useState, useEffect } from 'react';
import { getCurrentDateInBogota } from '../../utils/dateUtils';
import { getAnalysesByDate } from '../../services/analysisService';
import { getParlaysByDate, saveParlays, verifyParlays, deleteParlaysForDate, ParlayDB } from '../../services/parlayService';
import { ParlayAnalysisResult } from '../../types';
import { fetchFixturesList } from '../../services/liveDataService';
import { fastBatchOddsCheck, mapLeagueToSportKey, findPriceInEvent } from '../../services/oddsService';
import { PuzzlePieceIcon, SparklesIcon, CalendarDaysIcon, ArrowPathIcon, DocumentArrowDownIcon, TrashIcon, LockClosedIcon } from '../icons/Icons';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useSubscriptionLimits } from '../../hooks/useSubscriptionLimits';
import { UpgradePlanModal } from '../pricing/UpgradePlanModal';
import { useAuth } from '../../hooks/useAuth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AutoParlayList } from './AutoParlayList';

export const ParlayBuilder: React.FC = () => {
    const { currentOrg: organization } = useOrganization();
    const { user } = useAuth();
    const { subscription, checkParlayAccess, parlaysRemaining, recommendedUpgrade } = useSubscriptionLimits();

    // Usar la misma función de fecha que Jornadas para sincronización
    const [selectedDate, setSelectedDate] = useState<string>(getCurrentDateInBogota());
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [parlays, setParlays] = useState<ParlayAnalysisResult[]>([]);
    const [statusMessage, setStatusMessage] = useState('');
    const [matchCount, setMatchCount] = useState(0);

    // Modal de upgrade
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [upgradeReason, setUpgradeReason] = useState('');

    // Initial Load & Date Change
    useEffect(() => {
        if (!organization?.id) return;
        loadSavedParlays();
    }, [selectedDate, organization?.id]);

    const loadSavedParlays = async () => {
        if (!organization?.id) return;
        setLoading(true);
        try {
            const saved = await getParlaysByDate(selectedDate, organization.id);
            if (saved && saved.length > 0) {
                const mapped: ParlayAnalysisResult[] = saved.map(s => ({
                    parlayTitle: s.title,
                    finalOdds: s.total_odds,
                    overallStrategy: s.strategy || s.justification || '',
                    legs: s.legs,
                    winProbability: s.win_probability || 0 // Default to 0 if not present
                }));
                setParlays(mapped);
            } else {
                setParlays([]);
            }
        } catch (e) {
            console.warn("No se pudo cargar historial (posiblemente falta migración):", e);
            // Don't block usage, just show empty
            setParlays([]);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (!organization?.id) return;
        setLoading(true);
        setStatusMessage('Verificando resultados oficiales y actualizando estados...');
        try {
            const result = await verifyParlays(organization.id);
            if (result.updated > 0) {
                alert(`Se han verificado ${result.checked} parlays y actualizado ${result.updated} con nuevos resultados.`);
            } else {
                alert(`Se verificaron ${result.checked} parlays pendientes, pero no hubo cambios de estado (quizás los partidos aun no terminan).`);
            }
            await loadSavedParlays(); // Reload to see green checks
        } catch (e) {
            console.error("Error verifying parlays:", e);
            alert("Error al verificar parlays.");
        } finally {
            setLoading(false);
            setStatusMessage('');
        }
    };

    const handleGenerate = async () => {
        if (!organization?.id) return;

        // Verificar límite de parlays por plan
        const accessCheck = await checkParlayAccess();

        if (!accessCheck.allowed) {
            setUpgradeReason(accessCheck.reason || 'Actualiza tu plan para crear más parlays');
            setIsUpgradeModalOpen(true);
            return;
        }

        setLoading(true);
        setStatusMessage('Conectando con el motor Premium de Parlays...');
        setParlays([]);

        try {
            // Llamar directamente a Edge Function v2-premium-parlay-engine
            // La verificación de análisis se hace en el servidor (consulta todas las tablas V2)
            setAnalyzing(true);
            setStatusMessage('Motor V3: Análisis independiente con 60+ mercados...');

            // Call Premium Parlay Engine V3 (Independent Analysis + 60+ Markets)
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nokejmhlpsaoerhddcyc.supabase.co';
            const edgeFunctionUrl = `${supabaseUrl}/functions/v1/v3-premium-parlay-engine`;
            console.log('[ParlayBuilder] Calling V3 Engine:', edgeFunctionUrl);
            console.log('[ParlayBuilder] Selected date:', selectedDate);

            const response = await fetch(edgeFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ date: selectedDate })
            });

            console.log('[ParlayBuilder] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[ParlayBuilder] Edge Function error:', errorText);
                throw new Error(`Error del servidor: ${errorText}`);
            }

            const responseData = await response.json();
            console.log('[ParlayBuilder] Response data:', responseData);

            // Verificar si el backend devolvió un error (como pocos candidatos)
            if (responseData.success === false || responseData.error) {
                const errorMessage = responseData.error || 'No se pudieron generar parlays';
                console.warn('[ParlayBuilder] Backend error:', errorMessage);
                setStatusMessage(`⚠️ ${errorMessage}`);
                setLoading(false);
                return; // Salir sin lanzar excepción - es un resultado esperado, no un error
            }

            const { parlays: rawParlays } = responseData;

            // Mapear formato V3 a ParlayAnalysisResult (compatible con guardado y UI)
            const results: ParlayAnalysisResult[] = (rawParlays || []).map((p: any) => ({
                parlayTitle: p.name || p.parlayTitle || 'Premium Parlay',
                legs: (p.picks || p.legs || []).map((pick: any) => {
                    const homeTeam = pick.home_team || pick.home || 'Local';
                    const awayTeam = pick.away_team || pick.away || 'Visitante';
                    return {
                        fixtureId: pick.fixture_id || pick.fixtureId,
                        game: `${homeTeam} vs ${awayTeam}`,  // Campo que usa la UI
                        home: homeTeam,
                        away: awayTeam,
                        market: pick.market || 'over_1.5',
                        prediction: pick.selection || pick.prediction || pick.market,
                        odds: pick.odds || 1.5,
                        probability: pick.probability || 0.6,
                        reasoning: pick.reasoning || ''
                    };
                }),
                finalOdds: p.combined_odds || p.finalOdds || 1.0,
                overallStrategy: p.strategy || p.overallStrategy || '',
                winProbability: p.combined_probability || p.winProbability || 0.3
            }));

            if (results && results.length > 0) {
                // MOSTRAR PARLAYS INMEDIATAMENTE (antes del enriquecimiento de odds)
                setParlays(results);
                console.log('[ParlayBuilder] ✅ Parlays generados exitosamente:', results.length);

                // --- ENRIQUECIMIENTO CON ODDS REALES (Proceso en background, no crítico) ---
                // Este proceso es complementario. Si falla, los parlays siguen siendo válidos.
                try {
                    setStatusMessage('Buscando cuotas reales...');

                    const fixtureIds = new Set<number>();
                    results.forEach(p => p.legs.forEach(l => {
                        // Solo agregar si es número válido (no UUID)
                        if (l.fixtureId && typeof l.fixtureId === 'number') {
                            fixtureIds.add(l.fixtureId);
                        }
                    }));

                    if (fixtureIds.size > 0) {
                        const fixtures = await fetchFixturesList(Array.from(fixtureIds));

                        if (fixtures && fixtures.length > 0) {
                            const checkItems = fixtures.map(f => ({
                                fixtureId: f.fixture.id,
                                sportKey: mapLeagueToSportKey(f.league.name),
                                home: f.teams.home.name,
                                away: f.teams.away.name,
                                date: f.fixture.date
                            }));

                            const realOddsMap = await fastBatchOddsCheck(checkItems);
                            let realOddsFound = 0;

                            results.forEach(parlay => {
                                parlay.legs.forEach(leg => {
                                    if (leg.fixtureId && realOddsMap.has(leg.fixtureId)) {
                                        const event = realOddsMap.get(leg.fixtureId);
                                        const realPrice = findPriceInEvent(event!, leg.market, leg.prediction);

                                        if (realPrice) {
                                            leg.odds = realPrice;
                                            realOddsFound++;
                                        }
                                    }
                                });

                                const totalOdds = parlay.legs.reduce((acc, l) => acc * (l.odds || 1.5), 1);
                                parlay.finalOdds = parseFloat(totalOdds.toFixed(2));
                            });

                            // Actualizar UI solo si encontramos odds reales
                            if (realOddsFound > 0) {
                                setParlays([...results]); // Trigger re-render
                                console.log(`[ParlayBuilder] ${realOddsFound} cuotas reales encontradas.`);
                            }
                        }
                    }
                } catch (oddsError) {
                    // Silencioso - no afecta al usuario
                    console.warn('[ParlayBuilder] Odds enrichment skipped:', oddsError);
                }

                setStatusMessage(''); // Limpiar mensaje

                // 3. Try to Save to DB (Non-blocking)
                setStatusMessage('Guardando en historial...');
                try {
                    await saveParlays(selectedDate, organization.id, results);
                    setStatusMessage(''); // Clear message on success
                } catch (saveError) {
                    console.error("Persistencia falló, pero se muestran resultados:", saveError);
                    setStatusMessage('Nota: Los parlays se generaron pero no se pudieron guardar en el historial.');
                }
            } else {
                setStatusMessage('La IA no encontró combinaciones de alto valor con los partidos actuales.');
            }

        } catch (error) {
            console.error(error);
            setStatusMessage('Error generando Parlays. Intenta nuevamente.');
            alert('Ocurrió un error al generar los parlays. Revisa la consola para más detalles.');
        } finally {
            setLoading(false);
            setAnalyzing(false);
        }
    };

    const handleDelete = async () => {
        if (!organization?.id) return;
        if (!confirm('¿Estás seguro de que quieres eliminar todos los Parlays de esta fecha? Esta acción no se puede deshacer.')) return;

        setLoading(true);
        setStatusMessage('Eliminando parlays...');
        try {
            await deleteParlaysForDate(selectedDate, organization.id);
            setParlays([]);
            setStatusMessage('');
        } catch (error) {
            console.error(error);
            alert('Error al eliminar los parlays.');
        } finally {
            setLoading(false);
        }
    };

    const generatePDF = (parlay: ParlayAnalysisResult) => {
        import('../../services/pdf/pdfGenerator').then(({ generateParlayPDF }) => {
            // Mapear ParlayAnalysisResult a SmartParlay (formato esperado por el generador)
            // Necesitamos extraer home/away de "Home vs Away" si no están explícitos
            // Pero en loadSavedParlays (línea 140 aprox) ya tenemos home/away en los legs aunque la interface diga 'game'.
            // Vamos a intentar usarlos.

            const mappedParlay: any = {
                id: 'manual-parlay',
                combined_probability: parlay.winProbability / 100, // De 0-100 a 0-1
                parlay_type: `${parlay.legs.length} Picks`,
                confidence_tier: parlay.winProbability > 70 ? 'HIGH' : parlay.winProbability > 50 ? 'MEDIUM' : 'LOW',
                picks: parlay.legs.map(leg => {
                    const [home, away] = leg.game.split(' vs ');
                    return {
                        home_team: (leg as any).home || home || 'Home',
                        away_team: (leg as any).away || away || 'Away',
                        league: 'General', // No lo tenemos a mano siempre
                        market: leg.market,
                        selection: leg.prediction,
                        p_model: (leg as any).probability || 0,
                        argument: leg.reasoning
                    };
                }),
                is_manual: true // Flag opcional por si queremos diferenciar
            };

            generateParlayPDF(mappedParlay, {
                fileName: `Derbix_Parlay_${selectedDate}.pdf`,
                titleOverride: parlay.parlayTitle || "Parlay Personalizado"
            });
        });
    };

    return (
        <>
            <div className="h-full flex flex-col space-y-6 animate-fade-in">
                {/* Control Bar */}
                <div className="bg-gray-800/50 p-6 rounded-xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
                    <div className="flex items-center space-x-4 w-full md:w-auto">
                        <div className="bg-brand/10 p-3 rounded-lg text-brand">
                            <PuzzlePieceIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white font-display">Constructor de Parlays</h3>
                            <p className="text-sm text-gray-400">Inteligencia Artificial aplicada a combinadas multi-partido.</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3 w-full md:w-auto bg-gray-900/50 p-2 rounded-lg border border-white/10">
                        <CalendarDaysIcon className="w-5 h-5 text-gray-400 ml-2" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-white focus:outline-none font-mono text-sm"
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={loading || analyzing}
                            className={`
                            px-6 py-2 rounded-lg font-bold text-sm shadow-lg transition-all flex items-center gap-2
                            ${loading || analyzing
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-brand to-emerald-500 text-slate-900 hover:scale-105 hover:shadow-brand/20'
                                }
                        `}
                        >
                            {loading ? (
                                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                            ) : (
                                <SparklesIcon className="w-5 h-5" />
                            )}
                            {loading ? 'Procesando...' : 'Generar Parlays'}
                        </button>
                        <button
                            onClick={handleVerify}
                            disabled={loading || analyzing}
                            className="px-4 py-2 rounded-lg font-bold text-xs bg-slate-800 text-gray-300 hover:text-white border border-white/10 hover:border-brand/40 transition-all flex items-center gap-2"
                            title="Chequear si los partidos ya terminaron y actualizar ganadores"
                        >
                            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        {parlays.length > 0 && (
                            <button
                                onClick={handleGenerate}
                                disabled={loading || analyzing}
                                className="px-4 py-2 rounded-lg font-bold text-xs bg-red-900/30 text-red-400 hover:text-white hover:bg-red-600 border border-red-500/20 transition-all flex items-center gap-2"
                                title="Borrar actuales y generar nueva estrategia"
                            >
                                <SparklesIcon className="w-4 h-4" /> Regenerar Estrategia
                            </button>
                        )}
                        {parlays.length > 0 && (
                            <button
                                onClick={handleDelete}
                                disabled={loading || analyzing}
                                className="px-4 py-2 rounded-lg font-bold text-xs bg-red-600 text-white hover:bg-red-700 border border-red-500 transition-all flex items-center gap-2"
                                title="Eliminar todos los parlays de esta fecha"
                            >
                                <TrashIcon className="w-4 h-4" /> Eliminar
                            </button>
                        )}
                    </div>
                </div>

                {/* Automatic Parlays Section */}
                <AutoParlayList date={selectedDate} />

                {/* Status / Results Area (Manual) */}
                <div className="flex-grow overflow-y-auto">
                    {statusMessage && !parlays.length && (
                        <div className={`text-center py-20 ${analyzing ? 'animate-pulse' : ''}`}>
                            {analyzing ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
                                    <h3 className="text-xl font-bold text-brand animate-pulse">Consultando al Oráculo...</h3>
                                    <p className="text-gray-400 max-w-md">{statusMessage}</p>
                                </div>
                            ) : (
                                <div className="text-gray-500 flex flex-col items-center">
                                    {loading ? null : <PuzzlePieceIcon className="w-16 h-16 mb-4 opacity-20" />}
                                    <p>{statusMessage}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Parlay Grid */}
                    {parlays.length > 0 && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {parlays.map((parlay, idx) => (
                                <div key={idx} className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col hover:border-brand/30 transition-colors group">
                                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 border-b border-white/5 flex justify-between items-start relative overflow-hidden">
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="bg-brand text-slate-900 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                                    {parlay.finalOdds < 3 ? 'SEGURO' : parlay.finalOdds < 6 ? 'VALOR' : 'BOMBA'}
                                                </span>
                                                {(parlay as any).status && (parlay as any).status !== 'pending' && (
                                                    <span className={`px-2 py-0.5 rounded uppercase tracking-wider text-[10px] font-black ${(parlay as any).status === 'won' ? 'bg-green-500 text-white' :
                                                        (parlay as any).status === 'lost' ? 'bg-red-500 text-white' : 'bg-gray-500 text-white'
                                                        }`}>
                                                        {(parlay as any).status}
                                                    </span>
                                                )}
                                                <h4 className="text-lg font-bold text-white">{parlay.parlayTitle}</h4>
                                            </div>
                                            <p className="text-xs text-gray-400 italic font-medium w-full max-w-md">"{parlay.overallStrategy}"</p>
                                        </div>
                                        <div className="flex flex-col items-end relative z-10 gap-2">
                                            {/* Cuota total ocultada - se mantiene para cálculos internos */}
                                            {parlay.winProbability !== undefined && (
                                                <div className="text-right bg-black/30 px-2 py-1 rounded">
                                                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Prob. Promedio</div>
                                                    <div className={`text-sm font-bold ${parlay.winProbability > 70 ? 'text-green-400' : 'text-yellow-400'}`}>
                                                        {parlay.winProbability}%
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {/* Deco Background */}
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                    </div>

                                    {/* Legs List */}
                                    <div className="p-0 divide-y divide-white/5 bg-slate-900/50 flex-grow">
                                        {parlay.legs.map((leg, legIdx) => (
                                            <div key={legIdx} className="p-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors">
                                                <div className="flex flex-col items-center justify-center min-w-[50px]">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-400 mb-1">
                                                        {legIdx + 1}
                                                    </div>
                                                    <span className="text-[10px] text-gray-600 font-mono">LEG</span>
                                                    {leg.status && leg.status !== 'pending' && (
                                                        <div className={`mt-1 w-2 h-2 rounded-full ${leg.status === 'won' ? 'bg-green-500' : leg.status === 'lost' ? 'bg-red-500' : 'bg-gray-500'}`}></div>
                                                    )}
                                                </div>
                                                <div className="flex-grow">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h5 className="font-bold text-white text-sm">{leg.game}</h5>
                                                        {/* Cuota individual ocultada - se mantiene para cálculos internos */}
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-xs font-bold text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                            {leg.market}
                                                        </span>
                                                        <span className="text-sm font-medium text-gray-300">
                                                            👉 {leg.prediction}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 leading-relaxed border-l-2 border-slate-700 pl-2">
                                                        {leg.reasoning}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Ticket Footer */}
                                    <div className="p-4 bg-black/20 border-t border-white/5 flex justify-between items-center">
                                        <div className="text-xs text-gray-600 font-mono">
                                            Generated by Derbix AI
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => generatePDF(parlay)}
                                                className="text-xs font-bold text-gray-400 hover:text-white transition-colors flex items-center gap-1 uppercase tracking-wider bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg"
                                            >
                                                <DocumentArrowDownIcon className="w-4 h-4" /> Download PDF
                                            </button>
                                            <button className="text-xs font-bold text-brand hover:text-white transition-colors flex items-center gap-1 uppercase tracking-wider px-3 py-1.5 rounded-lg">
                                                <SparklesIcon className="w-3 h-3" /> Copiar Ticket
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Upgrade */}
            <UpgradePlanModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                currentPlan={{
                    name: subscription?.planName || 'free',
                    displayName: subscription?.displayName || 'Gratis'
                }}
                recommendedPlan={recommendedUpgrade}
                reason={upgradeReason}
            />
        </>
    );
};