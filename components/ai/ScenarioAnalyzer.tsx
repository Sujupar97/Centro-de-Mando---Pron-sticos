import React, { useState, useRef, useEffect } from 'react';
import { getScenarioAnalysis, createAnalysisChat, sendMessageToChat, analyzeBetTicket } from '../../services/geminiService';
import { VisualAnalysisResult, ChatMessage, BetTicketAnalysisResult, ConfidenceLevel, LegAnalysis, DashboardData, Game, League, Country, BettingRecommendationVisual, TacticalVisual, JugadorClave, NoticiasYFactoresEquipo, MoraleLevel, PressureLevel, GameDetails, PerformanceReportResult } from '../../types';
import { BrainIcon, PaperAirplaneIcon, TrophyIcon, PaperClipIcon, XCircleIcon, SparklesIcon, ClipboardDocumentListIcon, UsersIcon, CheckBadgeIcon, UserIcon, ArrowsPointingOutIcon, XMarkIcon, LightBulbIcon, TicketIcon, ChevronDownIcon, ChevronUpIcon, LinkIcon, CalendarDaysIcon, ShieldCheckIcon, FlagIcon, InformationCircleIcon, NewspaperIcon, WhistleIcon } from '../icons/Icons';
import { Chat, GroundingChunk } from '@google/genai';
import { marked } from 'marked';
import { fetchFixturesByDate, fetchGameDetails } from '../../services/liveDataService';
import { useAnalysisCache } from '../../hooks/useAnalysisCache';
import { getCurrentDateInBogota } from '../../utils/dateUtils';
import { useAuth } from '../../hooks/useAuth';
import { getLatestPerformanceReport } from '../../services/performanceService';


const fileToBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const mimeString = result.substring(5, result.indexOf(';'));
            const base64 = result.split(',')[1];
            resolve({ base64, mimeType: mimeString });
        };
        reader.onerror = error => reject(error);
    });
};

const LoadingState: React.FC<{text?: string}> = ({text}) => (
    <div className="text-center py-10">
        <BrainIcon className="w-12 h-12 mx-auto text-green-accent animate-pulse" />
        <p className="mt-4 text-lg font-semibold text-white">{text || 'Analizando el escenario...'}</p>
        <p className="text-sm text-gray-400">Gemini está consultando datos verificados y generando el informe y las recomendaciones.</p>
    </div>
);

const SourcesDisplay: React.FC<{ sources: GroundingChunk[] }> = ({ sources }) => (
    <div className="mt-6 pt-4 border-t border-gray-700">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Fuentes Consultadas:</h4>
        <ul className="space-y-1">
            {sources.map((source, i) => (
                <li key={i}>
                    <a
                        href={source.web?.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <LinkIcon className="w-3 h-3 mr-1.5 flex-shrink-0" />
                        <span className="truncate">{source.web?.title || source.web?.uri}</span>
                    </a>
                </li>
            ))}
        </ul>
    </div>
);

// --- INICIO: NUEVOS COMPONENTES PARA DASHBOARD INFOGRÁFICO ---

const ProbabilityCircle: React.FC<{ probability: number }> = ({ probability }) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (probability / 100) * circumference;

    const strokeColor = probability >= 75 ? '#10b981' : probability >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <div className="relative w-32 h-32 flex-shrink-0">
            <svg className="w-full h-full" viewBox="0 0 120 120">
                <circle
                    className="text-gray-700"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="60"
                    cy="60"
                />
                <circle
                    strokeWidth="10"
                    strokeLinecap="round"
                    stroke={strokeColor}
                    fill="transparent"
                    r={radius}
                    cx="60"
                    cy="60"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 60 60)"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">{probability}%</span>
            </div>
        </div>
    );
};

const RecommendationCard: React.FC<{ recommendation: BettingRecommendationVisual }> = ({ recommendation }) => {
    const confidenceStyles: {[key: string]: string} = {
        'Alta': 'border-green-accent bg-green-900/20',
        'Media': 'border-yellow-400 bg-yellow-900/20',
        'Baja': 'border-red-accent bg-red-900/20',
    };

    return (
        <div className={`border-l-4 p-4 rounded-lg bg-gray-800/50 ${confidenceStyles[recommendation.confidence]}`}>
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <ProbabilityCircle probability={recommendation.probability} />
                <div className="flex-grow text-center sm:text-left">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">{recommendation.market}</p>
                    <h4 className="text-xl font-bold text-white my-1">{recommendation.prediction}</h4>
                    <p className="text-sm text-gray-300">{recommendation.reasoning}</p>
                </div>
            </div>
        </div>
    );
};

const TacticalCard: React.FC<{ team: TacticalVisual }> = ({ team }) => (
    <div className="bg-gray-800 p-4 rounded-lg flex-1">
        <h4 className="font-bold text-white text-lg">{team.name}</h4>
        <p className="text-sm text-green-accent font-semibold mb-2">{team.formation}</p>
        <div className="space-y-2 text-sm">
            <div className="flex items-start">
                <ShieldCheckIcon className="w-5 h-5 text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
                <p><strong className="text-gray-300">Fortaleza:</strong> {team.strength}</p>
            </div>
            <div className="flex items-start">
                <FlagIcon className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                <p><strong className="text-gray-300">Debilidad:</strong> {team.weakness}</p>
            </div>
        </div>
    </div>
);

const InfoCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; }> = ({ title, icon, children }) => (
    <div className="bg-gray-800/50 p-4 rounded-lg">
        <div className="flex items-center mb-3">
            <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full mr-3">{icon}</div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="prose prose-sm prose-invert max-w-none text-gray-300">
            {children}
        </div>
    </div>
);

const StatusPill: React.FC<{ label: string; type: 'morale' | 'pressure'; level: MoraleLevel | PressureLevel }> = ({ label, type, level }) => {
    const moraleColors: { [key in MoraleLevel]: string } = {
        'Alta': 'bg-green-accent/20 text-green-accent',
        'Media': 'bg-yellow-400/20 text-yellow-400',
        'Baja': 'bg-red-accent/20 text-red-accent',
        'Neutra': 'bg-gray-500/20 text-gray-300',
    };
    const pressureColors: { [key in PressureLevel]: string } = {
        'Alta': 'bg-red-accent/20 text-red-accent',
        'Media': 'bg-yellow-400/20 text-yellow-400',
        'Baja': 'bg-green-accent/20 text-green-accent',
    };
    const colors = type === 'morale' ? moraleColors[level as MoraleLevel] : pressureColors[level as PressureLevel];
    return (
        <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{label}:</span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${colors}`}>{level}</span>
        </div>
    );
};

const TeamNewsCard: React.FC<{ teamName: string; data: NoticiasYFactoresEquipo }> = ({ teamName, data }) => (
    <div className="flex-1">
        <h5 className="font-bold text-white mb-2">{teamName}</h5>
        <div className="space-y-3 text-sm">
            <div className="flex items-center space-x-4">
                <StatusPill label="Moral" type="morale" level={data.moral} />
                <StatusPill label="Presión" type="pressure" level={data.presion} />
            </div>
            <p className="text-gray-400 italic">"{data.resumenNoticias}"</p>
            <p><strong className="text-gray-300">Impacto en Apuestas:</strong> {data.impactoApuestas}</p>
        </div>
    </div>
);

const ResultDisplay: React.FC<{ result: VisualAnalysisResult }> = ({ result }) => {
    if (!result.visualData || !result.visualData.matchSummary) {
        return (
            <div className="animate-fade-in">
                <div
                    className="prose prose-sm md:prose-base prose-invert max-w-none prose-headings:text-green-accent prose-strong:text-white"
                    dangerouslySetInnerHTML={{ __html: marked.parse(result.analysisText || '') as string }}
                ></div>
                {result.sources && result.sources.length > 0 && <SourcesDisplay sources={result.sources} />}
            </div>
        );
    }

    const { matchSummary, veredictoRapido, contextoGeneral, tacticalAnalysis, noticiasYFactores, refereeAnalysis, jugadoresClave, conclusionFinal, recommendations } = result.visualData;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white">{matchSummary.teamA} vs {matchSummary.teamB}</h2>
                <p className="text-md text-gray-400">{matchSummary.competition}</p>
            </div>

            <div>
                <h3 className="text-xl font-semibold text-white mb-4 text-center">Oportunidades Clave del Partido</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(recommendations || []).map((rec, index) => (
                        <RecommendationCard key={index} recommendation={rec} />
                    ))}
                </div>
            </div>
            
            <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white mb-2 text-center">Informe Detallado del Analista</h3>
                
                 <InfoCard title="Veredicto Rápido" icon={<TrophyIcon className="w-5 h-5 text-green-accent"/>}>
                    <p><strong>Conclusión Clave:</strong> {veredictoRapido.conclusionClave}</p>
                    <p><strong>Recomendación Principal:</strong> {veredictoRapido.recomendacionPrincipal}</p>
                    <p><strong>Confianza:</strong> {veredictoRapido.confianza}</p>
                </InfoCard>

                <InfoCard title="Contexto General del Partido" icon={<InformationCircleIcon className="w-5 h-5 text-blue-400"/>}>
                    <p>{contextoGeneral}</p>
                </InfoCard>

                <div>
                    <h3 className="text-lg font-semibold text-white mb-3 text-center">Análisis Táctico</h3>
                    <div className="flex flex-col md:flex-row gap-4 items-stretch">
                        <TacticalCard team={tacticalAnalysis.teamA} />
                        <div className="flex items-center justify-center text-gray-500 font-bold text-2xl p-2">VS</div>
                        <TacticalCard team={tacticalAnalysis.teamB} />
                    </div>
                </div>

                <InfoCard title="Noticias y Factores Psicológicos" icon={<NewspaperIcon className="w-5 h-5 text-orange-400" />}>
                    <div className="flex flex-col md:flex-row gap-6">
                        <TeamNewsCard teamName={matchSummary.teamA} data={noticiasYFactores.teamA} />
                        <div className="border-r border-gray-700 hidden md:block"></div>
                        <TeamNewsCard teamName={matchSummary.teamB} data={noticiasYFactores.teamB} />
                    </div>
                </InfoCard>

                {refereeAnalysis && (
                    <InfoCard title="Análisis del Árbitro" icon={<WhistleIcon className="w-5 h-5 text-gray-300"/>}>
                        <h4 className="font-bold text-white">{refereeAnalysis.name}</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 my-2 text-sm">
                            <div><strong>Estilo:</strong> {refereeAnalysis.style}</div>
                            <div className="text-right"><strong>Amarillas / Partido:</strong> {refereeAnalysis.avgYellowCards.toFixed(2)}</div>
                            <div></div>
                            <div className="text-right"><strong>Rojas / Partido:</strong> {refereeAnalysis.avgRedCards.toFixed(2)}</div>
                        </div>
                        <p><strong>Veredicto de Tarjetas:</strong> {refereeAnalysis.cardsVerdict}</p>
                    </InfoCard>
                )}

                <InfoCard title="Jugadores Clave" icon={<UsersIcon className="w-5 h-5 text-yellow-400"/>}>
                    <ul className="list-none p-0">
                        {(jugadoresClave || []).map((player, index) => (
                            <li key={index} className="mb-2"><strong>{player.nombre}:</strong> {player.impacto}</li>
                        ))}
                    </ul>
                </InfoCard>

                 <InfoCard title="Conclusión Final del Analista" icon={<LightBulbIcon className="w-5 h-5 text-purple-400"/>}>
                    <p>{conclusionFinal}</p>
                </InfoCard>
            </div>

            {result.sources && result.sources.length > 0 && <SourcesDisplay sources={result.sources} />}
        </div>
    );
};

// --- FIN: NUEVOS COMPONENTES ---


// --- INICIO: COMPONENTES PARA ANÁLISIS DE TICKET (se mantienen sin cambios visuales) ---
const confidenceColor = (confidence: string) => {
    switch (confidence?.toLowerCase()) {
        case 'alta': return 'border-green-accent bg-green-500/10 text-green-accent';
        case 'media': return 'border-yellow-400 bg-yellow-500/10 text-yellow-400';
        case 'baja': return 'border-red-accent bg-red-500/10 text-red-accent';
        default: return 'border-gray-600 bg-gray-700/50 text-gray-300';
    }
};

const probabilityBarColor = (prob: number) => {
    if (prob >= 75) return 'bg-green-accent';
    if (prob >= 50) return 'bg-yellow-400';
    return 'bg-red-accent';
};

const LegAnalysisCard: React.FC<{ legAnalysis: LegAnalysis }> = ({ legAnalysis }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { legSummary, analysis } = legAnalysis;

    return (
        <div className={`bg-gray-900/50 rounded-lg border ${confidenceColor(analysis.confidence)} overflow-hidden`}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex justify-between items-center p-4 text-left"
            >
                <div>
                    <h4 className="font-bold text-white">{legSummary.event}</h4>
                    <p className="text-sm text-green-accent">{legSummary.market}: <span className="text-gray-300">{legSummary.prediction || 'N/A'}</span></p>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="font-bold text-white text-lg">{analysis.probability || 'N/A'}%</span>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full`}>{analysis.confidence}</span>
                    {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
                </div>
            </button>
            {isExpanded && (
                <div className="p-4 border-t border-gray-700 bg-gray-800/50 animate-fade-in">
                    <p className="text-sm text-gray-300 mb-4 italic">"{analysis.conclusion}"</p>
                    
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-gray-400">Probabilidad de Éxito</span>
                            <span className="text-sm font-bold text-white">{analysis.probability || 'N/A'}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div className={`${probabilityBarColor(analysis.probability || 0)} h-2.5 rounded-full`} style={{ width: `${analysis.probability || 0}%` }}></div>
                        </div>
                    </div>

                    <div className="space-y-3 text-sm">
                        <div className="flex items-start">
                            <ClipboardDocumentListIcon className="w-5 h-5 text-green-accent mr-3 flex-shrink-0 mt-0.5" />
                            <div><strong className="text-white">Análisis Táctico:</strong> <span className="text-gray-400">{analysis.tacticalSynopsis}</span></div>
                        </div>
                        <div className="flex items-start">
                            <UsersIcon className="w-5 h-5 text-green-accent mr-3 flex-shrink-0 mt-0.5" />
                            <div><strong className="text-white">Impacto de Jugadores:</strong> <span className="text-gray-400">{analysis.playerImpact}</span></div>
                        </div>
                        <div>
                            <strong className="text-white flex items-center mb-1"><CheckBadgeIcon className="w-5 h-5 text-green-accent mr-2" />Datos Clave:</strong>
                            <ul className="list-disc list-inside text-gray-400 space-y-1 pl-5">
                                {(analysis.keyDataPoints || []).map((point, i) => <li key={i}>{point}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const BetTicketAnalysisDisplay: React.FC<{ result: BetTicketAnalysisResult }> = ({ result }) => (
    <div className="space-y-8 animate-fade-in">
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Veredicto del Ticket de Apuesta</h2>
            <p className="text-gray-300 max-w-3xl mx-auto">{result.overallVerdict}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-accent/10 p-4 rounded-lg border border-green-accent/50">
                <h3 className="font-semibold text-white mb-2 flex items-center"><TrophyIcon className="w-5 h-5 mr-2 text-green-accent" />Selección más Fuerte</h3>
                <p className="text-sm text-gray-300">{result.strongestPick}</p>
            </div>
            <div className="bg-red-accent/10 p-4 rounded-lg border border-red-accent/50">
                <h3 className="font-semibold text-white mb-2 flex items-center"><LightBulbIcon className="w-5 h-5 mr-2 text-red-accent" />Selección más Arriesgada</h3>
                <p className="text-sm text-gray-300">{result.riskiestPick}</p>
            </div>
        </div>

        <div>
            <h3 className="text-xl font-semibold text-white mb-4">Análisis Detallado por Selección</h3>
            <div className="space-y-4">
                {(result.legAnalyses || []).map((leg, i) => <LegAnalysisCard key={i} legAnalysis={leg} />)}
            </div>
        </div>
    </div>
);


// --- FIN: COMPONENTES DE ANÁLISIS DE TICKET ---

const ExpandedChatModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    conversation: ChatMessage[];
    followUpInput: string;
    setFollowUpInput: (value: string) => void;
    handleFollowUpSubmit: (e: React.FormEvent) => void;
    isChatLoading: boolean;
}> = ({ isOpen, onClose, conversation, followUpInput, setFollowUpInput, handleFollowUpSubmit, isChatLoading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl h-[85vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
                    <h3 className="text-lg font-semibold text-white">Continuar Conversación</h3>
                    <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-grow bg-gray-900 p-4 space-y-4 overflow-y-auto">
                    {conversation.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-green-accent flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-white" /></div>}
                            <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'model' ? 'bg-gray-700' : 'bg-blue-600 text-white'}`}><div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: marked.parse(msg.text || '') as string }}></div></div>
                            {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><UserIcon className="w-5 h-5 text-white" /></div>}
                        </div>
                    ))}
                    {isChatLoading && ( <div className="flex items-start gap-3"> <div className="w-8 h-8 rounded-full bg-green-accent flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-white" /></div> <div className="max-w-md p-3 rounded-lg bg-gray-700"> <div className="flex items-center space-x-1"> <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span> <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></span> <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></span> </div> </div> </div> )}
                </div>
                <div className="p-4 border-t border-gray-700 flex-shrink-0">
                    <form onSubmit={handleFollowUpSubmit} className="flex items-center gap-2">
                        <input type="text" value={followUpInput} onChange={(e) => setFollowUpInput(e.target.value)} placeholder="Haz una pregunta sobre el análisis..." className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent" disabled={isChatLoading} />
                        <button type="submit" disabled={isChatLoading || !followUpInput.trim()} className="bg-green-accent hover:bg-green-600 text-white font-bold p-2.5 rounded-md transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center">
                            <PaperAirplaneIcon className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean; }> = ({ checked, onChange, label, disabled = false }) => (
    <label htmlFor="toggle-switch" className={`flex items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
        <div className="relative">
            <input id="toggle-switch" type="checkbox" className="sr-only" checked={checked} onChange={(e) => !disabled && onChange(e.target.checked)} disabled={disabled} />
            <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${checked ? 'transform translate-x-6 bg-green-accent' : ''}`}></div>
        </div>
        <div className="ml-3 text-white font-medium">{label}</div>
    </label>
);

// --- INICIO: MODAL DE SELECCIÓN DE PARTIDOS ---
const FixturesModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    data: DashboardData | null;
    isLoading: boolean;
    error: string;
    onSelectGame: (game: Game) => void;
    selectedDate: string;
    onDateChange: (date: string) => void;
}> = ({ isOpen, onClose, data, isLoading, error, onSelectGame, selectedDate, onDateChange }) => {
    if (!isOpen) return null;

    const LeagueSection: React.FC<{ league: League; onSelect: (game: Game) => void; }> = ({ league, onSelect }) => (
        <div className="mb-4">
            <div className="flex items-center p-2 bg-gray-700/50 rounded-t-lg">
                <img src={league.logo} alt={league.name} className="w-6 h-6 mr-3" />
                <h4 className="font-semibold text-white truncate">{league.name}</h4>
            </div>
            <div className="bg-gray-800/50 rounded-b-lg divide-y divide-gray-700">
                {league.games.map(game => (
                    <button key={game.fixture.id} onClick={() => onSelect(game)} className="w-full text-left p-3 hover:bg-green-accent/10 transition-colors">
                        <div className="flex items-center justify-between text-sm">
                            <span className="truncate">{game.teams.home.name} vs {game.teams.away.name}</span>
                            <span className="text-xs text-gray-400 font-mono">{game.fixture.status.short}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl h-[85vh] flex flex-col border border-gray-700">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h3 className="text-lg font-semibold text-white">Seleccionar Partido</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700"><XMarkIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-4 flex-shrink-0">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => onDateChange(e.target.value)}
                        className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-green-accent outline-none border border-gray-600"
                    />
                </div>
                <div className="flex-grow p-4 overflow-y-auto">
                    {isLoading && <div className="text-center p-8"><div className="w-8 h-8 mx-auto border-4 border-green-accent border-t-transparent rounded-full animate-spin"></div></div>}
                    {error && <div className="text-center text-red-accent p-4">{error}</div>}
                    {data && (
                        <>
                            {data.importantLeagues.length > 0 && <h3 className="text-lg font-bold text-gray-300 mb-2">Ligas Principales</h3>}
                            {data.importantLeagues.map(league => <LeagueSection key={league.id} league={league} onSelect={onSelectGame} />)}
                            
                            {data.countryLeagues.length > 0 && <h3 className="text-lg font-bold text-gray-300 mt-6 mb-2">Otras Ligas</h3>}
                            {data.countryLeagues.map(country => (
                                <div key={country.name} className="mt-4">
                                     <div className="flex items-center mb-2">
                                        {country.flag && <img src={country.flag} alt={country.name} className="w-5 h-5 mr-2 rounded-full" />}
                                        <h4 className="font-semibold text-gray-400">{country.name}</h4>
                                    </div>
                                     {country.leagues.map(league => <LeagueSection key={league.id} league={league} onSelect={onSelectGame} />)}
                                </div>
                            ))}

                            {data.importantLeagues.length === 0 && data.countryLeagues.length === 0 && (
                                <div className="text-center text-gray-400 p-8">No hay partidos para la fecha seleccionada.</div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
// --- FIN: MODAL DE SELECCIÓN DE PARTIDOS ---


export const ScenarioAnalyzer: React.FC = () => {
    const { profile, user } = useAuth();
    const canAnalyze = profile?.role === 'superadmin';

    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<{ file: File; preview: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<VisualAnalysisResult | null>(null);
    const [ticketResult, setTicketResult] = useState<BetTicketAnalysisResult | null>(null);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [chat, setChat] = useState<Chat | null>(null);
    const [conversation, setConversation] = useState<ChatMessage[]>([]);
    const [followUpInput, setFollowUpInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const conversationEndRef = useRef<HTMLDivElement>(null);
    const [isChatExpanded, setIsChatExpanded] = useState(false);
    
    const [isTicketMode, setIsTicketMode] = useState(false);

    const [isFixtureModalOpen, setIsFixtureModalOpen] = useState(false);
    const [fixturesData, setFixturesData] = useState<DashboardData | null>(null);
    const [isFixturesLoading, setIsFixturesLoading] = useState(false);
    const [fixturesError, setFixturesError] = useState('');
    const [modalDate, setModalDate] = useState(getCurrentDateInBogota());
    const { saveAnalysis } = useAnalysisCache();
    const [selectedGame, setSelectedGame] = useState<Game | null>(null);
    
    const loadFixturesForModal = async (date: string) => {
        setIsFixturesLoading(true);
        setFixturesError('');
        setFixturesData(null);
        try {
            const data = await fetchFixturesByDate(date);
            setFixturesData(data);
        } catch (err) {
            setFixturesError('No se pudieron cargar los partidos.');
        } finally {
            setIsFixturesLoading(false);
        }
    };

    const handleOpenFixturesModal = () => {
        setModalDate(getCurrentDateInBogota());
        setIsFixtureModalOpen(true);
    };

    useEffect(() => {
        if (isFixtureModalOpen) {
            loadFixturesForModal(modalDate);
        }
    }, [modalDate, isFixtureModalOpen]);

    const handleSelectGame = (game: Game) => {
        setPrompt(`${game.teams.home.name} vs ${game.teams.away.name} en ${game.league.name}`);
        setSelectedGame(game);
        setIsFixtureModalOpen(false);
    };


    useEffect(() => {
        conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation, isChatExpanded]);


    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const preview = URL.createObjectURL(file);
            setImage({ file, preview });
        }
    };
    
    const handleRemoveImage = () => {
        if (image) { URL.revokeObjectURL(image.preview); }
        setImage(null);
        if (fileInputRef.current) { fileInputRef.current.value = ''; }
    };

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isTicketMode) {
            if (!image) {
                setError('Por favor, sube la imagen de un ticket para analizarlo.');
                return;
            }
        } else {
            if (!prompt.trim() || !selectedGame) {
                setError('Por favor, selecciona un partido desde el calendario para asegurar la precisión del análisis.');
                return;
            }
        }
        
        setIsLoading(true);
        setResult(null);
        setTicketResult(null);
        setError('');
        setConversation([]);
        setChat(null);
        setIsChatExpanded(false);

        try {
            if (isTicketMode && image) {
                const { base64, mimeType } = await fileToBase64(image.file);
                const analysisResult = await analyzeBetTicket({ base64, mimeType }, prompt);
                setTicketResult(analysisResult);
            } else if (selectedGame && user) {
                // Paso 1: Obtener el informe de rendimiento más reciente del usuario
                const latestReport = await getLatestPerformanceReport(user.id);
                
                // Paso 2: Obtener detalles del partido
                const gameDetails = await fetchGameDetails(selectedGame);
                
                // Paso 3: Llamar al análisis con el informe de rendimiento
                const analysisResult = await getScenarioAnalysis(prompt, gameDetails, latestReport);
                setResult(analysisResult);
                
                // Paso 4: Guardar el nuevo análisis del partido en caché
                await saveAnalysis(selectedGame, analysisResult);
                
                // Paso 5: Iniciar el chat de seguimiento
                const newChat = createAnalysisChat();
                const contextMessage = `Actúas como un guía de apuestas profesional de élite. Acabas de generar un análisis para mi consulta sobre "${prompt}". Tu personalidad es analítica, directa y basada en datos. Usa el siguiente informe, que está basado en datos verificados, para responder a mis preguntas de seguimiento. Aquí está el informe:
---
${analysisResult.analysisText}
---
Ahora, responde a mis preguntas.`;
                await newChat.sendMessage({ message: contextMessage }); 
                setChat(newChat);
            }

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`No se pudo completar el análisis. ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFollowUpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!followUpInput.trim() || !chat || isChatLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: followUpInput };
        setConversation(prev => [...prev, userMessage]);
        const currentInput = followUpInput;
        setFollowUpInput('');
        setIsChatLoading(true);

        try {
            const { text, sources } = await sendMessageToChat(chat, currentInput);
            const modelMessage: ChatMessage = { role: 'model', text, sources };
            setConversation(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error(error);
            const errorMessage: ChatMessage = { role: 'model', text: 'Lo siento, he encontrado un error al continuar la conversación.' };
            setConversation(prev => [...prev, errorMessage]);
        } finally {
            setIsChatLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-xl font-semibold text-white mb-2">Análisis Profundo</h3>
            <p className="text-sm text-gray-400 mb-4">
                {isTicketMode ? 'Sube una imagen de tu ticket para obtener un análisis detallado de cada selección.' : 'Selecciona un partido desde el calendario, adjunta una imagen (opcional) y obtén un análisis detallado.'}
            </p>
            <form onSubmit={handleAnalyze} className="space-y-3 mb-4">
                 <div className="flex flex-col md:flex-row items-center gap-2">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={isTicketMode ? "Opcional: añade contexto para el ticket" : "Selecciona un partido del calendario"}
                        className="flex-grow w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent disabled:opacity-50"
                        disabled={isLoading || !canAnalyze || !isTicketMode}
                        readOnly={!isTicketMode}
                    />
                     <button
                        type="button"
                        onClick={handleOpenFixturesModal}
                        disabled={isLoading || isTicketMode || !canAnalyze}
                        className="p-2.5 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Seleccionar partido de la jornada"
                    >
                        <CalendarDaysIcon className="w-5 h-5" />
                    </button>
                     <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading || !canAnalyze}
                        className={`p-2.5 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition duration-300 disabled:opacity-50 ${isTicketMode && !image ? 'ring-2 ring-green-accent animate-pulse' : ''}`}
                        aria-label="Adjuntar imagen"
                    >
                        <PaperClipIcon className="w-5 h-5" />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" disabled={!canAnalyze} />
                </div>
                 <div className="flex items-center space-x-4">
                    <ToggleSwitch checked={isTicketMode} onChange={setIsTicketMode} label="Analizar Ticket de Apuesta" disabled={!canAnalyze} />
                </div>
                 {canAnalyze && (
                    <button
                        type="submit"
                        disabled={isLoading || (isTicketMode ? !image : !prompt.trim())}
                        className="w-full bg-green-accent hover:bg-green-600 text-white font-bold py-2.5 rounded-md transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? ( <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span className="ml-2">Analizando</span></> ) 
                                : ( <>{isTicketMode ? <TicketIcon className="w-5 h-5" /> : <BrainIcon className="w-5 h-5" />}<span className="ml-2">{isTicketMode ? 'Analizar Ticket' : 'Analizar Escenario'}</span></> )}
                    </button>
                 )}
            </form>

            {image && ( <div className="mb-4 relative w-24 h-24"> <img src={image.preview} alt="Vista previa" className="rounded-md w-full h-full object-cover" /> <button onClick={handleRemoveImage} className="absolute -top-2 -right-2 bg-gray-900 rounded-full text-white hover:text-red-accent transition-colors" aria-label="Eliminar imagen" > <XCircleIcon className="w-6 h-6" /> </button> </div> )}

            <div className="flex-grow bg-gray-900 rounded-lg p-4 sm:p-6 overflow-y-auto">
                 {error && <div className="bg-red-500/20 text-red-accent p-3 rounded-md text-center">{error}</div>}
                 {isLoading && <LoadingState text={isTicketMode ? 'Analizando tu ticket...' : 'Analizando el escenario...'} />}
                 {result && <ResultDisplay result={result} />}
                 {ticketResult && <BetTicketAnalysisDisplay result={ticketResult} />}

                 {!isLoading && !result && !ticketResult && !error && (
                    <div className="text-center py-10 text-gray-500">
                        <p>Los resultados del análisis aparecerán aquí.</p>
                        {!canAnalyze && <p className="mt-2 text-sm text-yellow-400">Tu rol de usuario solo permite consultar análisis existentes a través de la pestaña 'Jornadas'.</p>}
                    </div>
                )}
            </div>
            
            {result && !isLoading && (
                <div className="mt-6 pt-6 border-t border-gray-700 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-white">Continuar Conversación</h3>
                        <button onClick={() => setIsChatExpanded(true)} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Expandir chat">
                            <ArrowsPointingOutIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {!isChatExpanded && (
                      <>
                        <div className="flex-grow bg-gray-900 rounded-lg p-4 space-y-4 max-h-80 overflow-y-auto mb-4">
                            {conversation.map((msg, index) => (
                                <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                    {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-green-accent flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-white" /></div>}
                                    <div className={`max-w-md p-3 rounded-lg ${msg.role === 'model' ? 'bg-gray-700' : 'bg-blue-600 text-white'}`}><div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: marked.parse(msg.text || '') as string }}></div></div>
                                    {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><UserIcon className="w-5 h-5 text-white" /></div>}
                                </div>
                            ))}
                            {isChatLoading && ( <div className="flex items-start gap-3"> <div className="w-8 h-8 rounded-full bg-green-accent flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-white" /></div> <div className="max-w-md p-3 rounded-lg bg-gray-700"> <div className="flex items-center space-x-1"> <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span> <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></span> <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></span> </div> </div> </div> )}
                            <div ref={conversationEndRef} />
                        </div>
                        <form onSubmit={handleFollowUpSubmit} className="flex items-center gap-2">
                            <input type="text" value={followUpInput} onChange={(e) => setFollowUpInput(e.target.value)} placeholder="Haz una pregunta sobre el análisis..." className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent" disabled={isChatLoading} />
                            <button type="submit" disabled={isChatLoading || !followUpInput.trim()} className="bg-green-accent hover:bg-green-600 text-white font-bold p-2.5 rounded-md transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center">
                                <PaperAirplaneIcon className="w-5 h-5" />
                            </button>
                        </form>
                      </>
                    )}
                </div>
            )}
            
            <ExpandedChatModal
                isOpen={isChatExpanded}
                onClose={() => setIsChatExpanded(false)}
                conversation={conversation}
                followUpInput={followUpInput}
                setFollowUpInput={setFollowUpInput}
                handleFollowUpSubmit={handleFollowUpSubmit}
                isChatLoading={isChatLoading}
            />
             <FixturesModal
                isOpen={isFixtureModalOpen}
                onClose={() => setIsFixtureModalOpen(false)}
                data={fixturesData}
                isLoading={isFixturesLoading}
                error={fixturesError}
                onSelectGame={handleSelectGame}
                selectedDate={modalDate}
                onDateChange={setModalDate}
            />
        </div>
    );
};