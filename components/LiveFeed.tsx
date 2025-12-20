import React, { useState, useEffect, useCallback } from 'react';
import { DashboardData, League, Game, VisualAnalysisResult, Country, AnalysisJob } from '../types';
import { fetchFixturesByDate, fetchLiveFixtures } from '../services/liveDataService';
import { createAnalysisJob, getAnalysisJob, getAnalysisResult, getAnalysisResultByRunId } from '../services/analysisService';
import { useAnalysisCache } from '../hooks/useAnalysisCache';
import { BrainIcon, CalendarDaysIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, SparklesIcon, ArrowPathIcon, ListBulletIcon, TrophyIcon, SignalIcon } from './icons/Icons';
import { getCurrentDateInBogota } from '../utils/dateUtils';
import { AnalysisInProgressModal } from './ai/AnalysisInProgressModal';
import { AnalysisReportModal } from './ai/AnalysisReportModal';
import { GameCard as DetailsGameCard } from './live/GameCard';
import { TopPicks } from './ai/TopPicks';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseService';

// --- COMPONENTES AUXILIARES ---

const LoadingState: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-lg font-medium text-slate-300 animate-pulse">{text}</p>
    </div>
);

// Tarjeta de Partido Inteligente
const AnalysisGameCard: React.FC<{
    game: Game,
    onAnalyze: () => void;
    onViewReport: () => void;
    jobStatus?: 'queued' | 'ingesting' | 'data_ready' | 'analyzing' | 'done' | 'failed' | 'insufficient_data';
    hasReport: boolean;
    userRole?: string;
}> = ({ game, onAnalyze, onViewReport, jobStatus, hasReport, userRole }) => {
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
    const scoreAvailable = game.goals.home !== null && game.goals.away !== null;
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    // Determinar estado visual del botón
    const isProcessing = jobStatus && ['queued', 'ingesting', 'data_ready', 'analyzing'].includes(jobStatus);
    const isFailed = jobStatus === 'failed' || jobStatus === 'insufficient_data';

    return (
        <div className={`glass group rounded-xl overflow-hidden transition-all duration-300 hover:bg-slate-800/60 border border-white/5 ${hasReport ? 'ring-1 ring-brand/50' : ''}`}>
            <div className="p-4 flex flex-col md:flex-row items-center gap-4">

                {/* Match Info / Time */}
                <div className="flex flex-col items-center justify-center w-full md:w-20 shrink-0 text-center border-b md:border-b-0 md:border-r border-white/5 pb-2 md:pb-0 md:pr-4">
                    {game.fixture.status.short === 'FT' ? (
                        <span className="text-xs font-bold text-slate-400">FIN</span>
                    ) : game.fixture.status.elapsed ? (
                        <span className="text-xs font-bold text-red-500 animate-pulse flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            {game.fixture.status.elapsed}'
                        </span>
                    ) : (
                        <span className="text-sm font-mono text-slate-300">{new Date(game.fixture.timestamp * 1000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                    <span className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">{new Date(game.fixture.timestamp * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
                </div>

                {/* Teams & Score */}
                <div className="flex-1 flex items-center justify-between w-full gap-4">
                    <div className="flex items-center gap-3 flex-1 justify-end text-right">
                        <span className="text-white font-bold text-sm md:text-base leading-tight">{game.teams.home.name}</span>
                        <img src={game.teams.home.logo} alt={game.teams.home.name} className="w-8 h-8 object-contain" />
                    </div>

                    <div className="px-3 py-1 bg-slate-950/50 rounded-lg border border-white/5 min-w-[60px] text-center">
                        {scoreAvailable ? (
                            <span className="text-xl font-display font-bold text-white tracking-widest">{game.goals.home}-{game.goals.away}</span>
                        ) : (
                            <span className="text-lg font-display font-bold text-slate-600">VS</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 flex-1 justify-start text-left">
                        <img src={game.teams.away.logo} alt={game.teams.away.name} className="w-8 h-8 object-contain" />
                        <span className="text-white font-bold text-sm md:text-base leading-tight">{game.teams.away.name}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0 justify-end border-t md:border-t-0 border-white/5 pt-2 md:pt-0">
                    <button
                        onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                        title="Ver detalles"
                    >
                        {isDetailsExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                    </button>

                    {isProcessing ? (
                        <button disabled className="bg-slate-700/50 text-slate-400 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-wait border border-white/5">
                            <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                            analizando...
                        </button>
                    ) : hasReport ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onViewReport}
                                className="bg-brand/10 hover:bg-brand/20 text-brand border border-brand/50 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            >
                                <CheckCircleIcon className="w-4 h-4" /> INFORME
                            </button>
                            {isAdmin && (
                                <button onClick={(e) => { e.stopPropagation(); onAnalyze(); }} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
                                    <ArrowPathIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ) : isFailed ? (
                        isAdmin && (
                            <button onClick={(e) => { e.stopPropagation(); onAnalyze(); }} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                                REINTENTAR
                            </button>
                        )
                    ) : (
                        isAdmin && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-600/30"
                            >
                                <SparklesIcon className="w-4 h-4" /> ANALIZAR
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Expanded Details */}
            {isDetailsExpanded && (
                <div className="border-t border-white/5 bg-slate-900/30 p-4 animate-slide-up">
                    <DetailsGameCard game={game} />
                </div>
            )}
        </div>
    );
};

// --- LOGICA PRINCIPAL ---

export const FixturesFeed: React.FC = () => {
    const { profile } = useAuth();
    const [data, setData] = useState<DashboardData>({ importantLeagues: [], countryLeagues: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedDate, setSelectedDate] = useState(getCurrentDateInBogota());
    const [viewMode, setViewMode] = useState<'fixtures' | 'top-picks'>('fixtures');

    // GESTIÓN DE JOBS
    const [activeJobs, setActiveJobs] = useState<Record<number, string>>({});
    const [gameJobStatus, setGameJobStatus] = useState<Record<number, AnalysisJob['status']>>({});
    const [reportsAvailable, setReportsAvailable] = useState<Record<number, boolean>>({});

    // GESTIÓN DE COLA (BATCH ANALYSIS)
    const [analysisQueue, setAnalysisQueue] = useState<Game[]>([]);
    const [activeBatchJobId, setActiveBatchJobId] = useState<string | null>(null);
    const [processingFixtureId, setProcessingFixtureId] = useState<number | null>(null);

    // UI MODALS
    const [currentJob, setCurrentJob] = useState<AnalysisJob | null>(null);
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [viewingResult, setViewingResult] = useState<VisualAnalysisResult | null>(null);

    // 1. Cargar Partidos
    useEffect(() => {
        const loadFixtures = async () => {
            if (viewMode === 'top-picks') return;
            setIsLoading(true);
            try {
                // 1. Cargar Partidos
                console.log(`[DEBUG] LiveFeed: calling fetchFixturesByDate for ${selectedDate}`);
                const result = await fetchFixturesByDate(selectedDate);
                console.log(`[DEBUG] LiveFeed: received result`, result);
                setData(result);

                // 2. Cargar Estado de Análisis Existentes (Persistencia)
                const fixtureIds = [
                    ...result.importantLeagues.flatMap(l => l.games.map(g => g.fixture.id)),
                    ...result.countryLeagues.flatMap(c => c.leagues.flatMap(l => l.games.map(g => g.fixture.id)))
                ];

                if (fixtureIds.length > 0) {
                    const { data: existingJobs, error: fetchError } = await supabase
                        .from('analysis_jobs')
                        .select('api_fixture_id, status, id')
                        .in('api_fixture_id', fixtureIds)
                        .in('status', ['done', 'analyzing', 'queued', 'ingesting', 'data_ready', 'collecting_evidence']);

                    if (fetchError) {
                        console.error("Error fetching existing jobs:", fetchError);
                    }

                    if (existingJobs) {
                        const newReportsAvailable: Record<number, boolean> = {};
                        const newGameJobStatus: Record<number, AnalysisJob['status']> = {};
                        const newActiveJobs: Record<number, string> = {};

                        existingJobs.forEach(job => {
                            if (job.status === 'done') {
                                newReportsAvailable[job.api_fixture_id] = true;
                                newActiveJobs[job.api_fixture_id] = job.id;
                            } else {
                                newGameJobStatus[job.api_fixture_id] = job.status as any;
                                newActiveJobs[job.api_fixture_id] = job.id;
                            }
                        });

                        setReportsAvailable(prev => ({ ...prev, ...newReportsAvailable }));
                        setGameJobStatus(prev => ({ ...prev, ...newGameJobStatus }));
                        setActiveJobs(prev => ({ ...prev, ...newActiveJobs }));
                    }
                }

            } catch (err: any) {
                console.error(`[DEBUG] LiveFeed: error loading fixtures`, err);
                setError(err.message || 'Error al cargar partidos.');
            } finally {
                setIsLoading(false);
            }
        };
        loadFixtures();
    }, [selectedDate, viewMode]);

    // 2. Polling de Jobs Activos (MODAL)
    useEffect(() => {
        if (!isJobModalOpen || !currentJob) return;
        if (['done', 'failed', 'insufficient_data'].includes(currentJob.status)) return;

        const interval = setInterval(async () => {
            const updatedJob = await getAnalysisJob(currentJob.id);
            if (updatedJob) {
                setCurrentJob(updatedJob);
                setGameJobStatus(prev => ({ ...prev, [updatedJob.api_fixture_id]: updatedJob.status }));

                if (updatedJob.status === 'done') {
                    setReportsAvailable(prev => ({ ...prev, [updatedJob.api_fixture_id]: true }));
                    setTimeout(async () => {
                        setIsJobModalOpen(false);
                        await handleViewReport(updatedJob.id, updatedJob.api_fixture_id);
                    }, 1500);
                } else if (updatedJob.status === 'failed' || updatedJob.status === 'insufficient_data') {
                    setTimeout(() => setIsJobModalOpen(false), 3000);
                }
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [currentJob, isJobModalOpen]);

    // 2.1 Polling de Batch Jobs (COLA)
    useEffect(() => {
        const processQueue = async () => {
            if (!activeBatchJobId && analysisQueue.length > 0) {
                const nextGame = analysisQueue[0];
                setProcessingFixtureId(nextGame.fixture.id);

                try {
                    setGameJobStatus(prev => ({ ...prev, [nextGame.fixture.id]: 'queued' }));
                    const jobId = await createAnalysisJob(nextGame.fixture.id);

                    setActiveJobs(prev => ({ ...prev, [nextGame.fixture.id]: jobId }));
                    setActiveBatchJobId(jobId);

                } catch (error) {
                    console.error("Error starting batch job:", error);
                    setGameJobStatus(prev => ({ ...prev, [nextGame.fixture.id]: 'failed' }));
                    setAnalysisQueue(prev => prev.slice(1));
                    setProcessingFixtureId(null);
                }
            }
        };

        processQueue();
    }, [activeBatchJobId, analysisQueue]);

    useEffect(() => {
        if (!activeBatchJobId) return;

        const interval = setInterval(async () => {
            try {
                const updatedJob = await getAnalysisJob(activeBatchJobId);
                if (updatedJob) {
                    setGameJobStatus(prev => ({ ...prev, [updatedJob.api_fixture_id]: updatedJob.status }));

                    if (['done', 'failed', 'insufficient_data'].includes(updatedJob.status)) {
                        if (updatedJob.status === 'done') {
                            setReportsAvailable(prev => ({ ...prev, [updatedJob.api_fixture_id]: true }));
                        }
                        setActiveBatchJobId(null);
                        setProcessingFixtureId(null);
                        setAnalysisQueue(prev => prev.slice(1));
                    }
                }
            } catch (e) {
                console.error("Error polling batch job", e);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [activeBatchJobId]);


    // 3. Iniciar Análisis (Individual)
    const handleAnalyzeGame = async (game: Game) => {
        try {
            setGameJobStatus(prev => ({ ...prev, [game.fixture.id]: 'queued' }));
            const jobId = await createAnalysisJob(game.fixture.id);
            setActiveJobs(prev => ({ ...prev, [game.fixture.id]: jobId }));
            const initialJobState: AnalysisJob = {
                id: jobId,
                api_fixture_id: game.fixture.id,
                fixture_id: '',
                status: 'queued',
                completeness_score: 0,
                estimated_calls: 0,
                actual_calls: 0,
                progress_jsonb: { step: 'Encolando petición...', completeness_score: 0, fetched_items: 0, total_items: 0 },
                created_at: new Date().toISOString()
            };
            setCurrentJob(initialJobState);
            setIsJobModalOpen(true);

        } catch (err: any) {
            console.error(err);
            setGameJobStatus(prev => ({ ...prev, [game.fixture.id]: 'failed' }));
            alert("Error al iniciar job: " + err.message);
        }
    };

    // 3.1 Iniciar Análisis de Liga (Batch)
    const handleAnalyzeLeague = (league: League) => {
        const gamesToAnalyze = league.games.filter(g => {
            const hasReport = reportsAvailable[g.fixture.id];
            const isProcessing = ['queued', 'ingesting', 'data_ready', 'analyzing'].includes(gameJobStatus[g.fixture.id] || '');
            const isInQueue = analysisQueue.some(q => q.fixture.id === g.fixture.id);
            const isCurrentBatch = g.fixture.id === processingFixtureId;

            return !hasReport && !isProcessing && !isInQueue && !isCurrentBatch;
        });

        if (gamesToAnalyze.length === 0) {
            alert("No hay partidos pendientes de análisis en esta liga o ya están en proceso.");
            return;
        }

        setAnalysisQueue(prev => [...prev, ...gamesToAnalyze]);
    };

    // 4. Ver Reporte
    const handleViewReport = async (jobIdOrGameId: string | number, gameIdIfAvailable?: number) => {
        let jobId = typeof jobIdOrGameId === 'string' ? jobIdOrGameId : activeJobs[jobIdOrGameId];
        if (!jobId) return;

        const result = await getAnalysisResult(jobId);
        if (result) {
            setViewingResult(result);
        }
    };

    return (
        <div className="space-y-8 pb-20">
            <div className="flex flex-col space-y-6">
                {/* Header & Date Picker */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-3xl font-display font-bold text-white tracking-tight">Jornadas Deportivas</h2>
                        <p className="text-slate-400 mt-1">Explora los encuentros y potencia tus decisiones con IA.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                        <div className="relative w-full sm:w-auto">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full bg-slate-800 border-none text-white text-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand shadow-lg outline-none"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <CalendarDaysIcon className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="bg-slate-800 p-1 rounded-xl flex gap-1 w-full sm:w-auto">
                            <button
                                onClick={() => setViewMode('fixtures')}
                                className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'fixtures' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <ListBulletIcon className="w-5 h-5 mr-2" /> Partidos
                            </button>
                            <button
                                onClick={() => setViewMode('top-picks')}
                                className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'top-picks' ? 'bg-gradient-to-r from-brand to-emerald-600 text-white shadow-lg shadow-brand/20' : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <TrophyIcon className="w-5 h-5 mr-2" /> Oportunidades
                            </button>
                        </div>
                    </div>
                </div>

                {viewMode === 'top-picks' ? (
                    <div className="glass rounded-2xl p-6 min-h-[500px] animate-fade-in border border-white/5">
                        <TopPicks
                            date={selectedDate}
                            onOpenReport={async (runId) => {
                                if (!runId) return;
                                const result = await getAnalysisResultByRunId(runId);
                                if (result) setViewingResult(result);
                            }}
                        />
                    </div>
                ) : (
                    <>
                        {isLoading && <LoadingState text="Sincronizando fixture..." />}
                        {!isLoading && (
                            <div className="space-y-8 animate-fade-in">
                                {/* Ligas Importantes */}
                                {data.importantLeagues.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-2">
                                            <TrophyIcon className="w-6 h-6 text-yellow-500" />
                                            <h3 className="text-xl font-bold text-white tracking-wide uppercase">Competencias Destacadas</h3>
                                        </div>
                                        {data.importantLeagues.map(league => (
                                            <LeagueSection
                                                key={league.id}
                                                league={league}
                                                onAnalyzeGame={handleAnalyzeGame}
                                                onAnalyzeLeague={() => handleAnalyzeLeague(league)}
                                                onViewReport={(gameId) => handleViewReport(gameId)}
                                                gameJobStatus={gameJobStatus}
                                                reportsAvailable={reportsAvailable}
                                                userRole={profile?.role}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Paises */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-slate-400 px-2 uppercase tracking-wide">Internacional</h3>
                                    {data.countryLeagues.map((country, countryIndex) => (
                                        <CountrySection
                                            key={`${country.name}-${countryIndex}`}
                                            country={country}
                                            onAnalyzeGame={handleAnalyzeGame}
                                            onAnalyzeLeague={handleAnalyzeLeague}
                                            onViewReport={handleViewReport}
                                            gameJobStatus={gameJobStatus}
                                            reportsAvailable={reportsAvailable}
                                            userRole={profile?.role}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <AnalysisInProgressModal job={currentJob} isOpen={isJobModalOpen} />
            <AnalysisReportModal analysis={viewingResult} onClose={() => setViewingResult(null)} />
        </div>
    );
};

// --- SUB-COMPONENTES UI MEJORADOS ---

const CountrySection: React.FC<{
    country: Country;
    onAnalyzeGame: (game: Game) => void;
    onAnalyzeLeague: (league: League) => void;
    onViewReport: (gameId: number) => void;
    gameJobStatus: Record<number, AnalysisJob['status']>;
    reportsAvailable: Record<number, boolean>;
    userRole?: string;
}> = ({ country, onAnalyzeGame, onAnalyzeLeague, onViewReport, gameJobStatus, reportsAvailable, userRole }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="glass rounded-xl overflow-hidden border border-white/5 transition-all duration-300">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex justify-between items-center p-4 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-4">
                    {country.flag ? (
                        <img src={country.flag} alt={country.name} className="w-8 h-8 rounded-full object-cover shadow-sm ring-2 ring-white/10" />
                    ) : (
                        <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-slate-300">?</div>
                    )}
                    <div className="text-left">
                        <h2 className="text-lg font-bold text-white">{country.name}</h2>
                        <p className="text-xs text-slate-500">{country.leagues.length} competiciones disponibles</p>
                    </div>
                </div>
                {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-slate-400" /> : <ChevronDownIcon className="w-5 h-5 text-slate-400" />}
            </button>

            {isExpanded && (
                <div className="p-4 bg-slate-900/40 space-y-6 border-t border-white/5">
                    {country.leagues.map(league => (
                        <LeagueSection
                            key={league.id}
                            league={league}
                            onAnalyzeGame={onAnalyzeGame}
                            onAnalyzeLeague={() => onAnalyzeLeague(league)}
                            onViewReport={onViewReport}
                            gameJobStatus={gameJobStatus}
                            reportsAvailable={reportsAvailable}
                            userRole={userRole}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const LeagueSection: React.FC<{
    league: League;
    onAnalyzeGame: (game: Game) => void;
    onAnalyzeLeague?: () => void;
    onViewReport: (gameId: number) => void;
    gameJobStatus: Record<number, AnalysisJob['status']>;
    reportsAvailable: Record<number, boolean>;
    userRole?: string;
}> = ({ league, onAnalyzeGame, onAnalyzeLeague, onViewReport, gameJobStatus, reportsAvailable, userRole }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    return (
        <div className="mb-6 last:mb-0 shadow-lg shadow-black/20 rounded-xl overflow-hidden">
            <div className={`w-full flex justify-between items-center p-4 bg-gradient-to-r from-slate-800 to-slate-900 border-l-4 border-brand`}>
                <div className="flex items-center flex-grow min-w-0 cursor-pointer gap-4" onClick={() => setIsExpanded(!isExpanded)}>
                    {league.logo && <img src={league.logo} alt={league.name} className="w-10 h-10 object-contain drop-shadow-md" />}
                    <div>
                        <h3 className="text-lg font-display font-bold text-white truncate">{league.name}</h3>
                        <p className="text-xs text-slate-500 font-mono">{league.games.length} PARTIDOS</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {onAnalyzeLeague && isAdmin && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAnalyzeLeague(); }}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-lg hover:shadow-blue-500/20"
                            title="Analizar Liga Completa"
                        >
                            <SparklesIcon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">BATCH</span>
                        </button>
                    )}
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-slate-400 hover:text-white transition-colors">
                        {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>
            {isExpanded && (
                <div className="bg-slate-900/50 p-4 grid grid-cols-1 xl:grid-cols-2 gap-4 border-t border-white/5">
                    {league.games.map((game) => (
                        <AnalysisGameCard
                            key={game.fixture.id}
                            game={game}
                            onAnalyze={() => onAnalyzeGame(game)}
                            onViewReport={() => onViewReport(game.fixture.id)}
                            jobStatus={gameJobStatus[game.fixture.id]}
                            hasReport={!!reportsAvailable[game.fixture.id]}
                            userRole={userRole}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};