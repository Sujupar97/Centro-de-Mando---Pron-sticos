// components/ai/HighProbPicks.tsx
// Componente para mostrar pronósticos individuales de alta probabilidad (80%+)

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';
import { TrophyIcon, SparklesIcon, ArrowPathIcon, ChartBarIcon } from '../icons/Icons';

interface HighProbPick {
    id: string;
    job_id: string;
    fixture_id: number;
    market: string;
    selection: string;
    p_model: number;
    decision: string;
    home_team?: string;
    away_team?: string;
    league?: string;
    odds?: number;
}

interface HighProbPicksProps {
    date: string;
    onViewReport?: (jobId: string, fixtureId: number) => void;
}

const HighProbPicks: React.FC<HighProbPicksProps> = ({ date, onViewReport }) => {
    const [picks, setPicks] = useState<HighProbPick[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPicks = async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`[HighProbPicks] Loading picks for date: ${date}`);

            // 1. Obtener jobs de la fecha
            const { data: jobs, error: jobsError } = await supabase
                .from('analysis_jobs_v2')
                .select('id, fixture_id, created_at')
                .gte('created_at', `${date}T00:00:00`)
                .lt('created_at', `${date}T23:59:59`)
                .eq('status', 'done');

            if (jobsError) throw jobsError;

            if (!jobs || jobs.length === 0) {
                console.log('[HighProbPicks] No jobs found for this date');
                setPicks([]);
                setIsLoading(false);
                return;
            }

            console.log(`[HighProbPicks] Found ${jobs.length} jobs`);

            // Deduplicar por fixture (quedarse con el más reciente)
            const latestJobByFixture = new Map<number, any>();
            for (const job of jobs) {
                const existing = latestJobByFixture.get(job.fixture_id);
                if (!existing || new Date(job.created_at) > new Date(existing.created_at)) {
                    latestJobByFixture.set(job.fixture_id, job);
                }
            }
            const latestJobs = Array.from(latestJobByFixture.values());
            const latestJobIds = latestJobs.map(j => j.id);

            // 2. Obtener datos de partidos (FUENTE DE VERDAD: Edge Function via liveDataService o fetch directo)
            // En lugar de consultar daily_matches (cache parcial), invocamos la función de listado que trae TOOOODOS los partidos de la fecha.
            const { data: fixtures, error: fixturesError } = await supabase.functions.invoke('v2-list-fixtures-sportmonks', {
                body: { date }
            });

            if (fixturesError) console.error('[HighProbPicks] Error fetching fixtures:', fixturesError);

            const matchData = new Map<number, any>();
            (fixtures || []).forEach((m: any) => {
                // El objeto devuelto por normalizeSportMonksToListGame tiene estructura anidada:
                // { fixture: { id: ... }, teams: { home: { name: ... }, away: { name: ... } } }
                if (m.fixture?.id) {
                    matchData.set(m.fixture.id, m);
                }
            });

            // 3. Obtener reports_v2 con los pronósticos embebidos
            const { data: reports, error: reportsError } = await supabase
                .from('reports_v2')
                .select('job_id, fixture_id, report_packet')
                .in('job_id', latestJobIds);

            if (reportsError) throw reportsError;

            console.log(`[HighProbPicks] Found ${reports?.length || 0} reports in reports_v2`);

            // 4. Extraer picks de 80%+ del report_packet
            const allPicks: HighProbPick[] = [];

            for (const report of (reports || [])) {
                const packet = report.report_packet;
                if (!packet) continue;

                // Fallback de nombres robusto
                let homeName = 'Local';
                let awayName = 'Visitante';
                let leagueName = 'Liga';

                // PRIORIDAD 1: Datos frescos de SportMonks (API)
                const matchApi = matchData.get(report.fixture_id);

                if (matchApi) {
                    // Estructura normalizada de v2-list-fixtures
                    homeName = matchApi.teams?.home?.name || 'Local';
                    awayName = matchApi.teams?.away?.name || 'Visitante';
                    leagueName = matchApi.league?.name || 'Liga';
                }
                // PRIORIDAD 2: Header del reporte (IA)
                else if (packet.header_partido?.titulo) {
                    const parts = packet.header_partido.titulo.split(' vs ');
                    if (parts.length === 2) {
                        homeName = parts[0];
                        awayName = parts[1];
                    } else {
                        homeName = packet.header_partido.titulo;
                        awayName = '';
                    }
                    if (packet.header_partido.subtitulo) {
                        leagueName = packet.header_partido.subtitulo.split(' • ')[0] || 'Liga';
                    }
                }

                const pronosticos = packet.pronosticos || [];

                for (const p of pronosticos) {
                    const prob =
                        p.probabilidad_calculada_porcentaje ||
                        p.probabilidad_calculada ||
                        p.probabilidad ||
                        p.confianza ||
                        0;

                    const probDecimal = prob > 1 ? prob / 100 : prob;

                    if (probDecimal >= 0.80) {
                        allPicks.push({
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
                            odds: p.cuota_actual || p.cuota || 0
                        });
                    }
                }
            }

            // Ordenar por probabilidad descendente
            allPicks.sort((a, b) => b.p_model - a.p_model);

            console.log(`[HighProbPicks] Found ${allPicks.length} picks with 80%+ probability`);
            setPicks(allPicks);

        } catch (err: any) {
            console.error('[HighProbPicks] Error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPicks();
    }, [date]);

    const formatProbability = (prob: number): string => {
        return `${Math.round(prob * 100)}%`;
    };

    const translateMarket = (market: string): string => {
        const translations: Record<string, string> = {
            'over_0.5_goals': 'Más de 0.5 Goles',
            'over_1.5_goals': 'Más de 1.5 Goles',
            'over_2.5_goals': 'Más de 2.5 Goles',
            'over_3.5_goals': 'Más de 3.5 Goles',
            'btts_yes': 'Ambos Anotan: Sí',
            'btts_no': 'Ambos Anotan: No',
            'home_win': 'Victoria Local',
            'away_win': 'Victoria Visitante',
            'draw': 'Empate',
            'double_chance_1x': 'Doble Oportunidad 1X',
            'double_chance_x2': 'Doble Oportunidad X2',
            'double_chance_12': 'Doble Oportunidad 12',
            'home_over_0.5': 'Local +0.5 Goles',
            'home_over_1.5': 'Local +1.5 Goles',
            'away_over_0.5': 'Visitante +0.5 Goles',
            'away_over_1.5': 'Visitante +1.5 Goles',
            '1t_over_0.5': '1T Más de 0.5',
            '1t_over_1.5': '1T Más de 1.5',
            '2t_over_0.5': '2T Más de 0.5',
            '2t_over_1.5': '2T Más de 1.5',
        };
        return translations[market] || market.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const getProbabilityColor = (prob: number): string => {
        if (prob >= 0.90) return 'from-emerald-400 to-green-600';
        if (prob >= 0.85) return 'from-green-400 to-emerald-600';
        return 'from-teal-400 to-cyan-600';
    };

    const getProbabilityLabel = (prob: number): string => {
        if (prob >= 0.90) return 'ULTRA SEGURO';
        if (prob >= 0.85) return 'MUY SEGURO';
        return 'ALTA PROB.';
    };

    // Estado vacío
    if (!isLoading && picks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
                    <ChartBarIcon className="w-10 h-10 text-slate-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No hay pronósticos de alta probabilidad</h3>
                <p className="text-slate-400 max-w-md mb-6">
                    No se encontraron pronósticos con probabilidad ≥ 80% para esta fecha.
                    Analiza más partidos para generar oportunidades.
                </p>
                <button
                    onClick={loadPicks}
                    className="flex items-center gap-2 px-4 py-2 bg-brand text-white font-bold rounded-xl hover:bg-brand/80 transition-all"
                >
                    <ArrowPathIcon className="w-4 h-4" />
                    Actualizar
                </button>
            </div>
        );
    }

    // Loading
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400">Cargando pronósticos de alta probabilidad...</p>
            </div>
        );
    }

    // Error
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                    onClick={loadPicks}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-all"
                >
                    <ArrowPathIcon className="w-4 h-4" />
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl">
                        <TrophyIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Pronósticos de Alta Probabilidad</h3>
                        <p className="text-sm text-slate-400">Solo oportunidades con ≥ 80% de probabilidad</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-brand/20 text-brand text-sm font-bold rounded-full">
                        {picks.length} picks
                    </span>
                    <button
                        onClick={loadPicks}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                        title="Actualizar"
                    >
                        <ArrowPathIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Lista de Picks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {picks.map((pick, index) => (
                    <div
                        key={pick.id || index}
                        onClick={() => onViewReport && onViewReport(pick.job_id, pick.fixture_id)}
                        className={`glass rounded-xl p-4 border border-white/5 hover:border-brand/30 transition-all group ${onViewReport ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}
                    >
                        {/* Header del Pick */}
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-500 truncate mb-1">{pick.league}</p>
                                <p className="text-sm font-bold text-white truncate">
                                    {pick.home_team} {pick.away_team ? `vs ${pick.away_team}` : ''}
                                </p>
                            </div>
                            <span className={`ml-2 px-2 py-1 text-xs font-bold rounded-lg bg-gradient-to-r ${getProbabilityColor(pick.p_model)} text-white shadow-sm`}>
                                {getProbabilityLabel(pick.p_model)}
                            </span>
                        </div>

                        {/* Mercado y Selección */}
                        <div className="bg-slate-800/50 rounded-lg p-3 mb-3 border border-white/5">
                            <div className="flex justify-between items-start mb-1">
                                <p className="text-xs text-slate-400">MERCADO</p>
                                {pick.odds ? (
                                    <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                                        Cuota {pick.odds.toFixed(2)}
                                    </span>
                                ) : (
                                    <span className="text-xs font-bold text-slate-500 bg-slate-700/30 px-1.5 py-0.5 rounded">
                                        Cuota N/D
                                    </span>
                                )}
                            </div>
                            <p className="text-sm font-medium text-white">{translateMarket(pick.market)}</p>
                            <div className="mt-2 flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4 text-brand" />
                                <span className="text-brand font-bold">{pick.selection}</span>
                            </div>
                        </div>

                        {/* Probabilidad */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500">Probabilidad Modelo</p>
                                <p className="text-2xl font-display font-bold text-white">
                                    {formatProbability(pick.p_model)}
                                </p>
                            </div>
                            <div className="w-16 h-16 relative">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                        cx="32"
                                        cy="32"
                                        r="28"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        className="text-slate-700"
                                    />
                                    <circle
                                        cx="32"
                                        cy="32"
                                        r="28"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        strokeDasharray={`${pick.p_model * 175.93} 175.93`}
                                        className="text-brand"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HighProbPicks;
