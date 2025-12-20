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
        <div className="w-8 h-8 border-4 border-green-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-lg font-semibold text-white">{text}</p>
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
        <div className={`bg-gray-800 rounded-lg shadow-md border border-gray-700 transition-all duration-300 flex flex-col ${hasReport ? 'hover:border-green-accent' : ''}`}>
            <div className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <img src={game.teams.home.logo} alt={game.teams.home.name} className="w-8 h-8" />
                        <span className="text-white font-bold truncate text-base">{game.teams.home.name}</span>
                    </div>
                    <div className="text-center px-2">
                        {scoreAvailable ? (
                            <p className="text-2xl font-bold text-white tracking-wider">{game.goals.home} - {game.goals.away}</p>
                        ) : (
                            <p className="text-xl font-mono text-gray-300">{new Date(game.fixture.timestamp * 1000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
                        )}
                        {game.fixture.status.elapsed && <span className="text-xs text-red-accent animate-pulse">En vivo {game.fixture.status.elapsed}'</span>}
                    </div>
                    <div className="flex items-center space-x-3 flex-1 min-w-0 justify-end">
                        <span className="text-white font-bold truncate text-right text-base">{game.teams.away.name}</span>
                        <img src={game.teams.away.logo} alt={game.teams.away.name} className="w-8 h-8" />
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-700 p-3 mt-auto">
                {isDetailsExpanded ? (
                    <div className="animate-fade-in">
                        <DetailsGameCard game={game} />
                        <button onClick={() => setIsDetailsExpanded(false)} className="w-full mt-2 py-2 text-xs bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition duration-200">
                            Ocultar Detalles
                        </button>
                    </div>
                ) : (
                    <div className="flex items-stretch gap-2">
                        <button onClick={() => setIsDetailsExpanded(true)} className="flex-grow py-2 text-xs bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-md transition duration-200">
                            Ver Detalles
                        </button>

                        {/* Lógica de Botones Mutuamente Excluyente */}
                        {isProcessing ? (
                            <button disabled className="py-2 px-3 text-xs bg-gray-700 text-gray-300 font-semibold rounded-md flex items-center justify-center gap-2 cursor-wait flex-grow">
                                <div className="w-3 h-3 border-2 border-green-accent border-t-transparent rounded-full animate-spin"></div>
                                Procesando...
                            </button>
                        ) : hasReport ? (
                            <div className="flex gap-2 flex-grow">
                                <button
                                    onClick={onViewReport}
                                    className="py-2 px-3 text-xs bg-green-accent/20 text-green-accent font-semibold rounded-md flex items-center justify-center gap-1.5 hover:bg-green-accent/30 transition-colors flex-grow"
                                >
                                    <CheckCircleIcon className="w-4 h-4" /> Ver Informe
                                </button>
                                {isAdmin && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
                                        title="Regenerar Análisis"
                                        className="p-2 text-xs bg-gray-700 text-gray-300 hover:text-white hover:bg-gray-600 font-semibold rounded-md transition-colors"
                                    >
                                        <ArrowPathIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ) : isFailed ? (
                            isAdmin ? (
                                <button onClick={(e) => { e.stopPropagation(); onAnalyze(); }} className="py-2 px-3 text-xs bg-red-500/20 text-red-400 font-semibold rounded-md flex items-center justify-center gap-1.5 hover:bg-red-500/30 flex-grow">
                                    Reintentar
                                </button>
                            ) : null
                        ) : (
                            isAdmin ? (
                                <button onClick={(e) => { e.stopPropagation(); onAnalyze(); }} className="py-2 px-3 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md transition duration-200 flex items-center justify-center gap-1.5 flex-grow">
                                    <SparklesIcon className="w-4 h-4" /> Analizar
                                </button>
                            ) : null
                        )}
                    </div>
                )}
            </div>
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
    const [activeJobs, setActiveJobs] = useState<Record<number, string>>({}); // fixtureId -> jobId
    const [gameJobStatus, setGameJobStatus] = useState<Record<number, AnalysisJob['status']>>({});
    const [reportsAvailable, setReportsAvailable] = useState<Record<number, boolean>>({}); // fixtureId -> true

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
                // Obtenemos todos los jobs 'done' para los partidos cargados
                const fixtureIds = [
                    ...result.importantLeagues.flatMap(l => l.games.map(g => g.fixture.id)),
                    ...result.countryLeagues.flatMap(c => c.leagues.flatMap(l => l.games.map(g => g.fixture.id)))
                ];

                if (fixtureIds.length > 0) {
                    // FIX: Use static supabase instance directly instead of dynamic import to avoid bundling issues
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
                                newActiveJobs[job.api_fixture_id] = job.id; // Guardar ID para ver informe
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
        // Solo hacemos polling si el modal está abierto y hay un job activo en él
        if (!isJobModalOpen || !currentJob) return;

        // Si el job ya terminó (éxito o fallo), dejar de hacer polling
        if (['done', 'failed', 'insufficient_data'].includes(currentJob.status)) return;

        const interval = setInterval(async () => {
            const updatedJob = await getAnalysisJob(currentJob.id);
            if (updatedJob) {
                setCurrentJob(updatedJob);
                setGameJobStatus(prev => ({ ...prev, [updatedJob.api_fixture_id]: updatedJob.status }));

                if (updatedJob.status === 'done') {
                    setReportsAvailable(prev => ({ ...prev, [updatedJob.api_fixture_id]: true }));

                    // Cerrar modal y abrir reporte automáticamente tras éxito
                    setTimeout(async () => {
                        setIsJobModalOpen(false);
                        await handleViewReport(updatedJob.id, updatedJob.api_fixture_id);
                    }, 1500);
                } else if (updatedJob.status === 'failed' || updatedJob.status === 'insufficient_data') {
                    // Mantener modal abierto un momento para ver el error
                    setTimeout(() => setIsJobModalOpen(false), 3000);
                }
            }
        }, 2000); // Poll cada 2s

        return () => clearInterval(interval);
    }, [currentJob, isJobModalOpen]);

    // 2.1 Polling de Batch Jobs (COLA)
    useEffect(() => {
        // Gestión de la cola: Si no hay job activo pero hay cola, arrancar el siguiente
        const processQueue = async () => {
            if (!activeBatchJobId && analysisQueue.length > 0) {
                const nextGame = analysisQueue[0];
                setProcessingFixtureId(nextGame.fixture.id);

                try {
                    // Iniciar Job
                    setGameJobStatus(prev => ({ ...prev, [nextGame.fixture.id]: 'queued' }));
                    const jobId = await createAnalysisJob(nextGame.fixture.id);

                    setActiveJobs(prev => ({ ...prev, [nextGame.fixture.id]: jobId }));
                    setActiveBatchJobId(jobId);

                } catch (error) {
                    console.error("Error starting batch job:", error);
                    // Si falla el arranque, lo sacamos de la cola y marcamos error
                    setGameJobStatus(prev => ({ ...prev, [nextGame.fixture.id]: 'failed' }));
                    setAnalysisQueue(prev => prev.slice(1));
                    setProcessingFixtureId(null);
                }
            }
        };

        processQueue();
    }, [activeBatchJobId, analysisQueue]);

    useEffect(() => {
        // Polling del job batch activo
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

                        // Job terminado, limpiar y permitir que el efecto de arriba tome el siguiente
                        setActiveBatchJobId(null);
                        setProcessingFixtureId(null);
                        setAnalysisQueue(prev => prev.slice(1)); // Remover de la cola
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
            // Actualizar UI optimista
            setGameJobStatus(prev => ({ ...prev, [game.fixture.id]: 'queued' }));

            // Invocar Edge Function
            const jobId = await createAnalysisJob(game.fixture.id);

            // Guardar referencia
            setActiveJobs(prev => ({ ...prev, [game.fixture.id]: jobId }));

            // Inicializar Modal
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
        // Filtrar juegos que no tienen reporte y no están ya en la cola ni procesándose
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

        // Añadir a la cola
        setAnalysisQueue(prev => [...prev, ...gamesToAnalyze]);
    };

    // 4. Ver Reporte
    const handleViewReport = async (jobIdOrGameId: string | number, gameIdIfAvailable?: number) => {
        let jobId = typeof jobIdOrGameId === 'string' ? jobIdOrGameId : activeJobs[jobIdOrGameId];

        // Si no tenemos jobId en memoria, deberíamos buscarlo. 
        // Por simplicidad en este refactor, asumimos que viene del flujo actual.
        if (!jobId) return;

        const result = await getAnalysisResult(jobId);
        if (result) {
            setViewingResult(result);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-white">Centro de Mando</h2>
                        <p className="text-gray-400 text-sm mt-1">Gestión profesional de análisis mediante Jobs asíncronos.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-lg">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-green-accent outline-none border border-gray-600 text-white"
                        />
                    </div>
                </div>

                <div className="flex p-1 space-x-1 bg-gray-800 rounded-xl self-start">
                    <button onClick={() => setViewMode('fixtures')} className={`flex items-center px-4 py-2.5 text-sm font-bold rounded-lg ${viewMode === 'fixtures' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>
                        <ListBulletIcon className="w-5 h-5 mr-2" /> Partidos
                    </button>
                    <button onClick={() => setViewMode('top-picks')} className={`flex items-center px-4 py-2.5 text-sm font-bold rounded-lg ${viewMode === 'top-picks' ? 'bg-green-accent text-white' : 'text-gray-400'}`}>
                        <TrophyIcon className="w-5 h-5 mr-2" /> Oportunidades
                    </button>
                </div>
            </div>

            {viewMode === 'top-picks' ? (
                <div className="bg-gray-900/30 rounded-xl p-1 min-h-[400px]">
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
                        <>
                            {/* Ligas Importantes */}
                            {data.importantLeagues.length > 0 && (
                                <div className="mb-8">
                                    <h2 className="text-xl font-bold text-green-accent mb-4 px-2 flex items-center gap-2">
                                        <TrophyIcon className="w-6 h-6" /> Destacados
                                    </h2>
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
                                {data.countryLeagues.map(country => (
                                    <CountrySection
                                        key={country.name}
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
                        </>
                    )}
                </>
            )}

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
        <div className="bg-gray-800/40 rounded-lg border border-gray-700/50 overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex justify-between items-center p-4 bg-gray-800 hover:bg-gray-750 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {country.flag ? (
                        <img src={country.flag} alt={country.name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                        <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-xs">?</div>
                    )}
                    <h2 className="text-lg font-bold text-white">{country.name}</h2>
                    <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-gray-300">
                        {country.leagues.length} ligas
                    </span>
                </div>
                {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
            </button>

            {isExpanded && (
                <div className="p-2 space-y-4 border-t border-gray-700">
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
        <div className="mb-2 last:mb-0">
            <div className="w-full flex justify-between items-center p-3 bg-gray-800 rounded-t-lg border-b-2 border-green-accent">
                <div className="flex items-center flex-grow min-w-0 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    {league.logo && <img src={league.logo} alt={league.name} className="w-8 h-8 mr-4 flex-shrink-0" />}
                    <h3 className="text-xl font-bold text-white truncate">{league.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                    {onAnalyzeLeague && isAdmin && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAnalyzeLeague(); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors shadow-sm"
                            title="Analizar todos los partidos secuencialmente"
                        >
                            <SparklesIcon className="w-3.5 h-3.5" />
                            Analizar Liga
                        </button>
                    )}
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 ml-2">
                        {isExpanded ? <ChevronUpIcon className="w-6 h-6 text-gray-400" /> : <ChevronDownIcon className="w-6 h-6 text-gray-400" />}
                    </button>
                </div>
            </div>
            {isExpanded && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-gray-800/50 rounded-b-lg border-x border-b border-gray-700">
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