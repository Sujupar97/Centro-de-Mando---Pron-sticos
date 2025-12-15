import React, { useState, useEffect, useCallback } from 'react';
import { DashboardData, League, Game, VisualAnalysisResult, Country, AnalysisJob } from '../types';
import { fetchFixturesByDate, fetchLiveFixtures } from '../services/liveDataService';
import { createAnalysisJob, getAnalysisJob, getAnalysisResult } from '../services/analysisService';
import { useAnalysisCache } from '../hooks/useAnalysisCache';
import { BrainIcon, CalendarDaysIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, SparklesIcon, ArrowPathIcon, ListBulletIcon, TrophyIcon, SignalIcon } from './icons/Icons';
import { getCurrentDateInBogota } from '../../utils/dateUtils';
import { AnalysisInProgressModal } from './ai/AnalysisInProgressModal';
import { AnalysisReportModal } from './ai/AnalysisReportModal';
import { GameCard as DetailsGameCard } from './live/GameCard';
import { TopPicks } from './ai/TopPicks';

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
    hasReport: boolean 
}> = ({ game, onAnalyze, onViewReport, jobStatus, hasReport }) => {
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
    const scoreAvailable = game.goals.home !== null && game.goals.away !== null;
    
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
                      
                      {/* Botón de Acción Principal */}
                      {!hasReport && !isProcessing && (
                          <button onClick={(e) => { e.stopPropagation(); onAnalyze(); }} className="py-2 px-3 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md transition duration-200 flex items-center justify-center gap-1.5">
                              <SparklesIcon className="w-4 h-4" /> Analizar
                          </button>
                      )}
                      
                      {isProcessing && (
                          <button disabled className="py-2 px-3 text-xs bg-gray-700 text-gray-300 font-semibold rounded-md flex items-center justify-center gap-2 cursor-wait">
                              <div className="w-3 h-3 border-2 border-green-accent border-t-transparent rounded-full animate-spin"></div>
                              Procesando...
                          </button>
                      )}
                      
                      {hasReport && (
                           <button
                               onClick={onViewReport}
                               className="py-2 px-3 text-xs bg-green-accent/20 text-green-accent font-semibold rounded-md flex items-center justify-center gap-1.5 hover:bg-green-accent/30 transition-colors"
                           >
                               <CheckCircleIcon className="w-4 h-4" /> Ver Informe
                           </button>
                      )}
                      
                      {isFailed && (
                          <button onClick={(e) => { e.stopPropagation(); onAnalyze(); }} className="py-2 px-3 text-xs bg-red-500/20 text-red-400 font-semibold rounded-md flex items-center justify-center gap-1.5 hover:bg-red-500/30">
                              Reintentar
                          </button>
                      )}
                  </div>
              )}
          </div>
      </div>
    );
};

const LeagueSection: React.FC<{ 
    league: League; 
    onAnalyzeGame: (game: Game) => void;
    onViewReport: (gameId: number) => void;
    gameJobStatus: Record<number, AnalysisJob['status']>;
    reportsAvailable: Record<number, boolean>;
}> = ({ league, onAnalyzeGame, onViewReport, gameJobStatus, reportsAvailable }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="mb-6">
            <div className="w-full flex justify-between items-center p-3 bg-gray-800 rounded-t-lg border-b-2 border-green-accent">
                <div className="flex items-center flex-grow min-w-0">
                    {league.logo && <img src={league.logo} alt={league.name} className="w-8 h-8 mr-4 flex-shrink-0" />}
                    <h3 className="text-xl font-bold text-white truncate">{league.name}</h3>
                </div>
                <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 ml-2">
                    {isExpanded ? <ChevronUpIcon className="w-6 h-6 text-gray-400" /> : <ChevronDownIcon className="w-6 h-6 text-gray-400" />}
                </button>
            </div>
            {isExpanded && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-gray-800/50 rounded-b-lg">
                    {league.games.map((game) => (
                        <AnalysisGameCard 
                            key={game.fixture.id} 
                            game={game} 
                            onAnalyze={() => onAnalyzeGame(game)}
                            onViewReport={() => onViewReport(game.fixture.id)}
                            jobStatus={gameJobStatus[game.fixture.id]}
                            hasReport={!!reportsAvailable[game.fixture.id]}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- LOGICA PRINCIPAL ---

export const FixturesFeed: React.FC = () => {
    const [data, setData] = useState<DashboardData>({ importantLeagues: [], countryLeagues: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedDate, setSelectedDate] = useState(getCurrentDateInBogota());
    const [viewMode, setViewMode] = useState<'fixtures' | 'top-picks'>('fixtures');
    
    // GESTIÓN DE JOBS
    const [activeJobs, setActiveJobs] = useState<Record<number, string>>({}); // fixtureId -> jobId
    const [gameJobStatus, setGameJobStatus] = useState<Record<number, AnalysisJob['status']>>({});
    const [reportsAvailable, setReportsAvailable] = useState<Record<number, boolean>>({}); // fixtureId -> true
    
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
                // Nota: Mantenemos fetchFixturesByDate directo por ahora para la lista,
                // pero lo ideal sería también proxy.
                const result = await fetchFixturesByDate(selectedDate);
                setData(result);
                // TODO: En el futuro, consultar 'analysis_jobs' para hidratar estados de jobs existentes.
            } catch (err: any) {
                setError(err.message || 'Error al cargar partidos.');
            } finally {
                setIsLoading(false);
            }
        };
        loadFixtures();
    }, [selectedDate, viewMode]);

    // 2. Polling de Jobs Activos
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

    // 3. Iniciar Análisis
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
                <div className="bg-gray-900/30 rounded-xl p-1 min-h-[400px]"><TopPicks date={selectedDate} /></div>
            ) : (
                <>
                    {isLoading && <LoadingState text="Sincronizando fixture..." />}
                    {!isLoading && data.importantLeagues.map(league => (
                        <LeagueSection 
                            key={league.id} 
                            league={league} 
                            onAnalyzeGame={handleAnalyzeGame}
                            onViewReport={(gameId) => handleViewReport(gameId)}
                            gameJobStatus={gameJobStatus}
                            reportsAvailable={reportsAvailable}
                        />
                    ))}
                </>
            )}

            <AnalysisInProgressModal job={currentJob} isOpen={isJobModalOpen} />
            <AnalysisReportModal analysis={viewingResult} onClose={() => setViewingResult(null)} />
        </div>
    );
};