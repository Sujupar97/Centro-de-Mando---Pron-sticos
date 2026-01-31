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
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPicks = async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`[SmartParlays] Loading picks for date: ${date}`);

            // 1. Obtener jobs de la fecha
            const { data: jobs, error: jobsError } = await supabase
                .from('analysis_jobs_v2')
                .select('id, fixture_id, created_at')
                .gte('created_at', `${date}T00:00:00`)
                .lt('created_at', `${date}T23:59:59`)
                .eq('status', 'done');

            if (jobsError) throw jobsError;

            if (!jobs || jobs.length === 0) {
                console.log('[SmartParlays] No jobs found');
                setParlays([]);
                setIsLoading(false);
                return;
            }

            // Deduplicar por fixture
            const latestJobByFixture = new Map<number, any>();
            for (const job of jobs) {
                const existing = latestJobByFixture.get(job.fixture_id);
                if (!existing || new Date(job.created_at) > new Date(existing.created_at)) {
                    latestJobByFixture.set(job.fixture_id, job);
                }
            }
            const latestJobs = Array.from(latestJobByFixture.values());
            const latestJobIds = latestJobs.map(j => j.id);

            // 2. Obtener fixtures (SportMonks V2-List)
            const { data: fixtures, error: fixturesError } = await supabase.functions.invoke('v2-list-fixtures-sportmonks', {
                body: { date }
            });

            if (fixturesError) console.error('[SmartParlays] Error fetching fixtures:', fixturesError);

            const matchData = new Map<number, any>();
            (fixtures || []).forEach((m: any) => {
                if (m.fixture?.id) {
                    matchData.set(m.fixture.id, m);
                }
            });

            // 3. Obtener reports
            const { data: reports, error: reportsError } = await supabase
                .from('reports_v2')
                .select('job_id, fixture_id, report_packet')
                .in('job_id', latestJobIds);

            if (reportsError) throw reportsError;

            // 4. Extraer TODOS los picks > 80%
            const rawPicks: HighProbPick[] = [];

            for (const report of (reports || [])) {
                const packet = report.report_packet;
                if (!packet) continue;

                let homeName = 'Local';
                let awayName = 'Visitante';
                let leagueName = 'Liga';
                let homeLogo = '';
                let awayLogo = '';

                // Datos frescos
                const matchApi = matchData.get(report.fixture_id);
                if (matchApi) {
                    homeName = matchApi.teams?.home?.name || 'Local';
                    awayName = matchApi.teams?.away?.name || 'Visitante';
                    homeLogo = matchApi.teams?.home?.logo || '';
                    awayLogo = matchApi.teams?.away?.logo || '';
                    leagueName = matchApi.league?.name || 'Liga';
                } else if (packet.header_partido?.titulo) {
                    const parts = packet.header_partido.titulo.split(' vs ');
                    homeName = parts[0] || 'Local';
                    awayName = parts[1] || 'Visitante';
                }

                const pronosticos = packet.pronosticos || [];

                for (const p of pronosticos) {
                    const prob = p.probabilidad_calculada_porcentaje || p.probabilidad_calculada || p.probabilidad || 0;
                    const probDecimal = prob > 1 ? prob / 100 : prob;

                    if (probDecimal >= 0.80) {
                        rawPicks.push({
                            id: `${report.job_id}-${p.mercado}`,
                            job_id: report.job_id,
                            fixture_id: report.fixture_id,
                            market: p.mercado || 'Mercado',
                            selection: p.seleccion || 'Selección',
                            p_model: probDecimal,
                            decision: 'BET',
                            home_team: homeName,
                            away_team: awayName,
                            league: leagueName,
                            odds: p.cuota_actual || p.cuota || 0,
                            logo_home: homeLogo,
                            logo_away: awayLogo
                        });
                    }
                }
            }

            // 5. ALGORITMO SMART PARLAYS
            // A. Clasificar
            const anchors = rawPicks.filter(p => p.odds >= 1.40).sort((a, b) => b.odds - a.odds); // Sort by Odds DESC
            const complements = rawPicks.filter(p => p.odds < 1.40).sort((a, b) => b.odds - a.odds); // Sort by Odds DESC (Value priority)

            console.log(`[SmartParlays] Anchors: ${anchors.length}, Complements: ${complements.length}`);

            const generatedParlays: SmartParlay[] = [];
            const usedPickIds = new Set<string>();

            // B. Emparejar
            for (const anchor of anchors) {
                if (usedPickIds.has(anchor.id)) continue;

                // Buscar mejor complemento disponible
                // Criterio: Mejor cuota, que no sea del mismo partido (idealmente), aunque si no hay de otra se permite?
                // Preferencia: Diferente partido para diversificar riesgo.
                const bestComplement = complements.find(c =>
                    !usedPickIds.has(c.id) &&
                    c.fixture_id !== anchor.fixture_id // Evitar mismo partido si es posible
                ) || complements.find(c => !usedPickIds.has(c.id)); // Fallback: Mismo partido

                if (bestComplement) {
                    // Validar Probabilidad Conjunta > 80%
                    const combinedProb = (anchor.p_model + bestComplement.p_model) / 2;
                    if (combinedProb > 0.80) {
                        generatedParlays.push({
                            id: `parlay-${anchor.id}-${bestComplement.id}`,
                            anchor,
                            complement: bestComplement,
                            combined_odds: anchor.odds * bestComplement.odds,
                            combined_prob: combinedProb
                        });
                        usedPickIds.add(anchor.id);
                        usedPickIds.add(bestComplement.id);
                    }
                }
            }

            setParlays(generatedParlays);

        } catch (err: any) {
            console.error('[SmartParlays] Error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPicks();
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
    if (parlays.length === 0) return <EmptyState onRetry={loadPicks} />;

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
                <button onClick={loadPicks} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
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

export default HighProbPicks;
