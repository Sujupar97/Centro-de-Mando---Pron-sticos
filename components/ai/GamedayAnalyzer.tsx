import React, { useState } from 'react';
import { getGamedayAnalysis } from '../../services/geminiService';
import { GamedayAnalysisResult, GameAnalysis, GamedayBettingOpportunity, ConfidenceLevel } from '../../types';
import { BrainIcon, CalendarDaysIcon } from '../icons/Icons';

const LoadingState: React.FC = () => (
    <div className="text-center py-10">
        <BrainIcon className="w-12 h-12 mx-auto text-green-accent animate-pulse" />
        <p className="mt-4 text-lg font-semibold text-white">Analizando la jornada...</p>
        <p className="text-sm text-gray-400">El faro de la IA está escaneando todos los partidos en busca de las mejores oportunidades.</p>
    </div>
);

const confidenceColor = (confidence: ConfidenceLevel) => {
    switch (confidence) {
        case 'Alta': return 'border-green-accent bg-green-500/10 text-green-accent';
        case 'Media': return 'border-yellow-400 bg-yellow-500/10 text-yellow-400';
        case 'Baja': return 'border-red-accent bg-red-500/10 text-red-accent';
        default: return 'border-gray-600 bg-gray-700/50 text-gray-300';
    }
};

const probabilityBarColor = (prob: number) => {
    if (prob >= 75) return 'bg-green-accent';
    if (prob >= 50) return 'bg-yellow-400';
    return 'bg-red-accent';
};

const OpportunityCard: React.FC<{ opp: GamedayBettingOpportunity }> = ({ opp }) => (
    <div className={`p-4 rounded-lg border ${confidenceColor(opp.confidence)}`}>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-2">
            <h4 className="font-bold text-white text-base">{opp.market}: <span className="text-green-accent">{opp.prediction}</span></h4>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full mt-1 sm:mt-0">{opp.confidence}</span>
        </div>
        <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-400">Probabilidad</span>
                <span className="text-sm font-bold text-white">{opp.probability}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div className={`${probabilityBarColor(opp.probability)} h-2.5 rounded-full`} style={{ width: `${opp.probability}%` }}></div>
            </div>
        </div>
        <p className="text-sm text-gray-400">{opp.reasoning}</p>
    </div>
);


const GameCard: React.FC<{ game: GameAnalysis }> = ({ game }) => (
    <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 bg-gray-700/30 border-b border-gray-700">
            <p className="text-xs text-green-accent font-semibold uppercase tracking-wider">{game.league}</p>
            <h3 className="text-lg font-bold text-white mt-1">{game.matchup}</h3>
            <p className="text-sm text-gray-400">{game.time}</p>
        </div>
        <div className="p-4">
            <p className="text-sm text-gray-300 mb-4 italic">"{game.overallContext}"</p>
            <h4 className="font-semibold text-white mb-3">Oportunidades Destacadas</h4>
            <div className="space-y-3">
                {(game.topOpportunities || []).map((opp, index) => (
                    <OpportunityCard key={index} opp={opp} />
                ))}
            </div>
        </div>
    </div>
);


const ResultDisplay: React.FC<{ result: GamedayAnalysisResult }> = ({ result }) => (
    <div className="space-y-6 animate-fade-in">
        {result.map((game, index) => (
            <GameCard key={index} game={game} />
        ))}
    </div>
);

export const GamedayAnalyzer: React.FC = () => {
    const [selectedSport, setSelectedSport] = useState<'Fútbol' | 'NBA' | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<GamedayAnalysisResult | null>(null);
    const [error, setError] = useState('');

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSport) {
            setError('Por favor, selecciona un deporte para analizar.');
            return;
        }
        setIsLoading(true);
        setResult(null);
        setError('');

        try {
            const analysisResult = await getGamedayAnalysis(selectedSport, selectedDate);
            setResult(analysisResult);
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`No se pudo completar el análisis de la jornada. ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-xl font-semibold text-white mb-2">Análisis de Jornadas</h3>
            <p className="text-sm text-gray-400 mb-4">
                Selecciona un deporte y una fecha para que la IA actúe como un faro, identificando las oportunidades más valiosas del día.
            </p>
            
            <form onSubmit={handleAnalyze} className="space-y-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button type="button" onClick={() => setSelectedSport('Fútbol')} className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${selectedSport === 'Fútbol' ? 'bg-green-accent/20 border-green-accent' : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'}`}>
                        <span className="text-4xl">⚽</span>
                        <h4 className="font-bold text-lg mt-2 text-white">Fútbol</h4>
                        <p className="text-xs text-gray-400">Champions, LaLiga, Premier, Serie A y más.</p>
                    </button>
                    <button type="button" onClick={() => setSelectedSport('NBA')} className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${selectedSport === 'NBA' ? 'bg-green-accent/20 border-green-accent' : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'}`}>
                        <span className="text-4xl">🏀</span>
                        <h4 className="font-bold text-lg mt-2 text-white">NBA</h4>
                        <p className="text-xs text-gray-400">Todos los partidos de la jornada.</p>
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full sm:w-auto bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !selectedSport}
                        className="w-full flex-grow bg-green-accent hover:bg-green-600 text-white font-bold py-2.5 rounded-md transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? ( <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span className="ml-2">Analizando Jornada...</span></> ) 
                                   : ( <><CalendarDaysIcon className="w-5 h-5" /><span className="ml-2">Analizar Jornada de {selectedSport || '...'}</span></> )}
                    </button>
                </div>
            </form>
            
            <div className="flex-grow bg-gray-900 rounded-lg p-4 sm:p-6 overflow-y-auto">
                 {error && <div className="bg-red-500/20 text-red-accent p-3 rounded-md text-center">{error}</div>}
                 {isLoading && <LoadingState />}
                 {result && result.length > 0 && <ResultDisplay result={result} />}
                 {result && result.length === 0 && !isLoading && (
                    <div className="text-center py-10 text-gray-500">
                        <p className="font-semibold">No se encontraron partidos importantes</p>
                        <p className="text-sm mt-1">La IA no ha identificado partidos en ligas principales para la fecha seleccionada.</p>
                    </div>
                 )}
                 {!isLoading && !result && !error && ( <div className="text-center py-10 text-gray-500"> <p>Los resultados del análisis de la jornada aparecerán aquí.</p> </div> )}
            </div>
        </div>
    );
};