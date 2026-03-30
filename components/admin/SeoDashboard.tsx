import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';
import { ArrowTopRightOnSquareIcon, ChartBarIcon } from '../icons/Icons';

interface SeoPage {
    id: string;
    fixture_id: number;
    full_path: string;
    home_team: string;
    away_team: string;
    league_name: string;
    league_slug: string;
    match_date: string;
    has_analysis: boolean;
    has_results: boolean;
    result_correct: boolean | null;
    home_score: number | null;
    away_score: number | null;
    published_at: string;
    updated_at: string;
}

interface SeoStats {
    totalPages: number;
    withAnalysis: number;
    withResults: number;
    correct: number;
    incorrect: number;
    pending: number;
    leagueBreakdown: { league: string; count: number }[];
    recentPages: SeoPage[];
    publishedThisWeek: number;
    publishedThisMonth: number;
}

export const SeoDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [stats, setStats] = useState<SeoStats | null>(null);
    const [allPages, setAllPages] = useState<SeoPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'overview' | 'pages'>('overview');
    const [pageFilter, setPageFilter] = useState<'all' | 'pending' | 'correct' | 'incorrect'>('all');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);

        // Fetch all seo_pages
        const { data: pages } = await supabase
            .from('seo_pages')
            .select('*')
            .order('match_date', { ascending: false });

        const allP = pages || [];
        setAllPages(allP);

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 86400000);

        const withAnalysis = allP.filter(p => p.has_analysis).length;
        const withResults = allP.filter(p => p.has_results).length;
        const correct = allP.filter(p => p.result_correct === true).length;
        const incorrect = allP.filter(p => p.result_correct === false).length;
        const pending = allP.filter(p => p.has_analysis && !p.has_results).length;

        const publishedThisWeek = allP.filter(p => new Date(p.published_at) >= oneWeekAgo).length;
        const publishedThisMonth = allP.filter(p => new Date(p.published_at) >= oneMonthAgo).length;

        // League breakdown
        const leagueMap: Record<string, number> = {};
        allP.forEach(p => {
            leagueMap[p.league_name] = (leagueMap[p.league_name] || 0) + 1;
        });
        const leagueBreakdown = Object.entries(leagueMap)
            .map(([league, count]) => ({ league, count }))
            .sort((a, b) => b.count - a.count);

        setStats({
            totalPages: allP.length,
            withAnalysis,
            withResults,
            correct,
            incorrect,
            pending,
            leagueBreakdown,
            recentPages: allP.slice(0, 10),
            publishedThisWeek,
            publishedThisMonth,
        });

        setLoading(false);
    }

    const filteredPages = allPages.filter(p => {
        if (pageFilter === 'pending') return !p.has_results;
        if (pageFilter === 'correct') return p.result_correct === true;
        if (pageFilter === 'incorrect') return p.result_correct === false;
        return true;
    });

    const winRate = stats && stats.correct + stats.incorrect > 0
        ? Math.round((stats.correct / (stats.correct + stats.incorrect)) * 1000) / 10
        : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div>
                    <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-2 flex items-center gap-1">
                        ← Volver a Admin
                    </button>
                    <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
                        <ChartBarIcon className="w-7 h-7 text-blue-400" />
                        Dashboard SEO
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Track record de páginas SEO programáticas</p>
                </div>
                <div className="flex gap-2">
                    <a
                        href="https://derbix.co/predicciones"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-xl text-sm font-medium border border-blue-500/20 hover:bg-blue-500/20 transition"
                    >
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        Ver Predicciones Públicas
                    </a>
                    <a
                        href="https://derbix.co/estadisticas"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-sm font-medium border border-emerald-500/20 hover:bg-emerald-500/20 transition"
                    >
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        Ver Estadísticas Públicas
                    </a>
                </div>
            </div>

            {/* View toggle */}
            <div className="flex gap-2">
                <button
                    onClick={() => setView('overview')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === 'overview' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    Resumen
                </button>
                <button
                    onClick={() => setView('pages')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === 'pages' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    Todas las Páginas ({stats?.totalPages || 0})
                </button>
            </div>

            {view === 'overview' && stats && (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        <KPICard label="Total Páginas" value={stats.totalPages} color="white" />
                        <KPICard label="Esta Semana" value={stats.publishedThisWeek} color="blue" />
                        <KPICard label="Este Mes" value={stats.publishedThisMonth} color="blue" />
                        <KPICard label="Con Resultado" value={stats.withResults} color="white" />
                        <KPICard label="Acertadas" value={stats.correct} subtext={`${winRate}%`} color="emerald" />
                        <KPICard label="Falladas" value={stats.incorrect} color="red" />
                    </div>

                    {/* Projections */}
                    <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Proyección de Crecimiento</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <ProjectionCard
                                period="Mes 3"
                                pages={Math.round(stats.publishedThisMonth * 3)}
                                traffic="3K-8K"
                                current={stats.totalPages}
                            />
                            <ProjectionCard
                                period="Mes 6"
                                pages={Math.round(stats.publishedThisMonth * 6)}
                                traffic="10K-25K"
                                current={stats.totalPages}
                            />
                            <ProjectionCard
                                period="Año 1"
                                pages={Math.round(stats.publishedThisMonth * 12)}
                                traffic="30K-80K"
                                current={stats.totalPages}
                            />
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                                <p className="text-emerald-400 text-xs font-bold uppercase mb-1">Win Rate SEO</p>
                                <p className="text-3xl font-black text-emerald-400">{winRate}%</p>
                                <p className="text-slate-500 text-xs mt-1">Efectividad verificada en páginas</p>
                            </div>
                        </div>
                    </div>

                    {/* League breakdown */}
                    <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Páginas por Liga</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {stats.leagueBreakdown.map(l => (
                                <div key={l.league} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3 border border-white/5">
                                    <span className="text-slate-300 text-sm truncate mr-2">{l.league}</span>
                                    <span className="text-white font-bold text-sm flex-shrink-0">{l.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent pages */}
                    <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Páginas Recientes</h3>
                        <PageTable pages={stats.recentPages} />
                    </div>
                </>
            )}

            {view === 'pages' && (
                <>
                    {/* Filter */}
                    <div className="flex gap-2">
                        {(['all', 'pending', 'correct', 'incorrect'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setPageFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                    pageFilter === f ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'
                                }`}
                            >
                                {f === 'all' ? `Todas (${allPages.length})` :
                                 f === 'pending' ? `Pendientes (${allPages.filter(p => !p.has_results).length})` :
                                 f === 'correct' ? `Acertadas (${allPages.filter(p => p.result_correct === true).length})` :
                                 `Falladas (${allPages.filter(p => p.result_correct === false).length})`}
                            </button>
                        ))}
                    </div>

                    <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-6">
                        <PageTable pages={filteredPages} />
                    </div>
                </>
            )}
        </div>
    );
};

// --- Sub-components ---

const KPICard: React.FC<{ label: string; value: number; subtext?: string; color: string }> = ({ label, value, subtext, color }) => {
    const colorMap: Record<string, string> = {
        white: 'text-white',
        blue: 'text-blue-400',
        emerald: 'text-emerald-400',
        red: 'text-red-400',
        amber: 'text-amber-400',
    };
    return (
        <div className="bg-slate-900/80 border border-white/5 rounded-xl p-4">
            <p className="text-slate-500 text-xs font-medium uppercase">{label}</p>
            <p className={`text-2xl font-black ${colorMap[color] || 'text-white'}`}>
                {value}
                {subtext && <span className="text-sm font-bold ml-1 opacity-70">{subtext}</span>}
            </p>
        </div>
    );
};

const ProjectionCard: React.FC<{ period: string; pages: number; traffic: string; current: number }> = ({ period, pages, traffic, current }) => (
    <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
        <p className="text-blue-400 text-xs font-bold uppercase mb-1">{period}</p>
        <p className="text-xl font-black text-white">{pages} pág.</p>
        <p className="text-slate-500 text-xs mt-1">~{traffic} visitas/mes</p>
        <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5">
            <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, (current / Math.max(pages, 1)) * 100)}%` }}
            />
        </div>
        <p className="text-slate-600 text-[10px] mt-1">{current}/{pages} actual</p>
    </div>
);

const PageTable: React.FC<{ pages: SeoPage[] }> = ({ pages }) => {
    if (!pages.length) {
        return <p className="text-slate-500 text-center py-8">No hay páginas en esta categoría.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-slate-500 text-xs uppercase border-b border-white/5">
                        <th className="pb-3 pr-4">Partido</th>
                        <th className="pb-3 pr-4">Liga</th>
                        <th className="pb-3 pr-4">Fecha</th>
                        <th className="pb-3 pr-4">Resultado</th>
                        <th className="pb-3 pr-4">Predicción</th>
                        <th className="pb-3">Acciones</th>
                    </tr>
                </thead>
                <tbody className="text-slate-300">
                    {pages.map(p => (
                        <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="py-3 pr-4">
                                <span className="text-white font-medium">{p.home_team}</span>
                                <span className="text-slate-500 mx-1">vs</span>
                                <span className="text-white font-medium">{p.away_team}</span>
                            </td>
                            <td className="py-3 pr-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                    {p.league_name}
                                </span>
                            </td>
                            <td className="py-3 pr-4 text-slate-400 text-xs">{p.match_date}</td>
                            <td className="py-3 pr-4">
                                {p.has_results ? (
                                    <span className="text-white font-bold">{p.home_score} - {p.away_score}</span>
                                ) : (
                                    <span className="text-slate-600 text-xs">Pendiente</span>
                                )}
                            </td>
                            <td className="py-3 pr-4">
                                {p.result_correct === true && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                        ✓ Acertada
                                    </span>
                                )}
                                {p.result_correct === false && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                                        ✗ Fallada
                                    </span>
                                )}
                                {p.result_correct === null && !p.has_results && (
                                    <span className="text-slate-600 text-xs">—</span>
                                )}
                            </td>
                            <td className="py-3">
                                <a
                                    href={`https://derbix.co${p.full_path}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium"
                                >
                                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                                    Ver
                                </a>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
