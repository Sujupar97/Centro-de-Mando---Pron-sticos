import React, { useState } from 'react';
import { generateParlayAnalysis } from '../../services/geminiService';
import { ParlayAnalysisResult, ParlayLeg } from '../../types';
import { BrainIcon, PuzzlePieceIcon, TrophyIcon } from '../icons/Icons';

const LoadingState: React.FC = () => (
    <div className="text-center py-10">
        <BrainIcon className="w-12 h-12 mx-auto text-green-accent animate-pulse" />
        <p className="mt-4 text-lg font-semibold text-white">Construyendo el parlay de la jornada...</p>
        <p className="text-sm text-gray-400">Gemini está investigando mercados de nicho y correlacionando estadísticas.</p>
    </div>
);

const ResultDisplay: React.FC<{ result: ParlayAnalysisResult }> = ({ result }) => (
    <div className="space-y-6 animate-fade-in">
        <div>
            <h2 className="text-2xl font-bold text-center text-white">{result.parlayTitle}</h2>
            <p className="text-sm text-center text-gray-400 mt-1">{result.overallStrategy}</p>
        </div>

        <div className="bg-gray-900/50 p-4 rounded-lg border border-green-accent/50 text-center">
            <h3 className="font-semibold text-white text-sm">Cuota Final Estimada</h3>
            <p className="text-5xl font-bold text-green-accent my-1">x{(result.finalOdds || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-400">Una apuesta de $10.000 COP podría retornar {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(10000 * (result.finalOdds || 0))}.</p>
        </div>

        <div>
            <h3 className="font-semibold text-white mb-3 text-lg">Selecciones del Parlay</h3>
            <div className="space-y-4">
                {(result.legs || []).map((leg: ParlayLeg, i) => (
                    <div key={i} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 hover:border-green-accent/50 transition-colors">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-2">
                             <h4 className="font-bold text-white text-base">{leg.game}</h4>
                             <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-gray-700 text-white mt-1 sm:mt-0">Cuota: {(leg.odds || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-start">
                             <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-accent/20 flex items-center justify-center mr-3 mt-1">
                                <TrophyIcon className="w-5 h-5 text-green-accent" />
                             </div>
                             <div>
                                <p className="font-semibold text-green-accent text-lg">{leg.market}: <span className="text-white">{leg.prediction}</span></p>
                                <p className="text-sm text-gray-400 mt-1">{leg.reasoning}</p>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export const ParlayBuilder: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ParlayAnalysisResult | null>(null);
    const [error, setError] = useState('');

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) {
            setError('Por favor, introduce una jornada para analizar (ej: "Partidos de hoy").');
            return;
        }
        setIsLoading(true);
        setResult(null);
        setError('');

        try {
            const analysisResult = await generateParlayAnalysis(prompt, selectedDate);
            setResult(analysisResult);
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`No se pudo generar el parlay. ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-xl font-semibold text-white mb-2">Constructor de Parlays de Alto Potencial</h3>
            <p className="text-sm text-gray-400 mb-4">
                La IA buscará en la jornada seleccionada para construir un parlay de 5+ selecciones, basado en mercados de nicho con alto valor estadístico.
            </p>
            <form onSubmit={handleAnalyze} className="space-y-3 mb-4">
                 <div className="flex flex-col md:flex-row items-center gap-2">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ej: 'Jornada de Champions y NBA'"
                        className="flex-grow w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent"
                        disabled={isLoading}
                    />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full md:w-auto bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent"
                        disabled={isLoading}
                    />
                </div>
                <button
                    type="submit"
                    disabled={isLoading || !prompt.trim()}
                    className="w-full bg-green-accent hover:bg-green-600 text-white font-bold py-2.5 rounded-md transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {isLoading ? ( <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span className="ml-2">Buscando Valor...</span></> ) 
                               : ( <><PuzzlePieceIcon className="w-5 h-5" /><span className="ml-2">Generar Parlay</span></> )}
                </button>
            </form>
            
            <div className="flex-grow bg-gray-900 rounded-lg p-4 sm:p-6 overflow-y-auto">
                 {error && <div className="bg-red-500/20 text-red-accent p-3 rounded-md text-center">{error}</div>}
                 {isLoading && <LoadingState />}
                 {result && <ResultDisplay result={result} />}
                 {!isLoading && !result && !error && ( <div className="text-center py-10 text-gray-500"> <p>El parlay de la jornada aparecerá aquí.</p> </div> )}
            </div>
        </div>
    );
};