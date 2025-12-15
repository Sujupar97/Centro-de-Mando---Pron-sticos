import React, { useState } from 'react';
import { Game, GameDetails } from '../../types';
import { fetchGameDetails } from '../../services/liveDataService';
import { callApiV1ForTest } from '../../services/apiTestService';
import { SparklesIcon } from '../icons/Icons';

// Componente para mostrar un bloque de JSON
const JsonViewer: React.FC<{ data: any; title: string }> = ({ data, title }) => (
    <div>
        <h4 className="text-lg font-semibold text-white mb-2">{title}</h4>
        <pre className="bg-gray-900 text-sm text-green-accent p-4 rounded-lg overflow-x-auto max-h-96">
            <code>{JSON.stringify(data, null, 2)}</code>
        </pre>
    </div>
);

export const ApiTestRunner: React.FC = () => {
    const [fixtureId, setFixtureId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [processedData, setProcessedData] = useState<GameDetails | null>(null);
    const [rawFixtureData, setRawFixtureData] = useState<any | null>(null);

    const handleRunTest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fixtureId.trim()) {
            setError('Por favor, introduce un ID de fixture válido.');
            return;
        }

        setIsLoading(true);
        setError('');
        setProcessedData(null);
        setRawFixtureData(null);

        try {
            // Paso 1: Obtener la respuesta cruda de la API para el fixture
            const rawData = await callApiV1ForTest<Game[]>(`fixtures?id=${fixtureId}`);
            if (!rawData || rawData.length === 0) {
                throw new Error(`No se encontró ningún partido con el ID de fixture ${fixtureId}.`);
            }
            setRawFixtureData(rawData[0]);

            const game: Game = rawData[0];
            
            // Paso 2: Ejecutar la lógica de obtención de detalles completa
            const details = await fetchGameDetails(game);
            setProcessedData(details);

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Falló la prueba de la API. ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-xl font-semibold text-white mb-2">Herramienta de Prueba de API-Football</h3>
            <p className="text-sm text-gray-400 mb-4">
                Introduce un ID de fixture de API-Football (ej: 868207) para ejecutar la lógica completa de `fetchGameDetails` y ver los resultados.
            </p>
            <form onSubmit={handleRunTest} className="flex items-center gap-2 mb-6">
                <input
                    type="text"
                    value={fixtureId}
                    onChange={(e) => setFixtureId(e.target.value)}
                    placeholder="ID del Fixture"
                    className="flex-grow w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading || !fixtureId.trim()}
                    className="bg-green-accent hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-md transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {isLoading ? (
                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span className="ml-2">Probando...</span></>
                    ) : (
                        <><SparklesIcon className="w-5 h-5" /><span className="ml-2">Ejecutar Prueba</span></>
                    )}
                </button>
            </form>

            <div className="flex-grow bg-gray-900 rounded-lg p-4 sm:p-6 overflow-y-auto space-y-6">
                {error && <div className="bg-red-500/20 text-red-accent p-3 rounded-md text-center">{error}</div>}
                {!isLoading && !processedData && !error && (
                    <div className="text-center py-10 text-gray-500">
                        <p>Los resultados de la prueba aparecerán aquí.</p>
                    </div>
                )}
                
                {processedData && <JsonViewer data={processedData} title="1. Datos Procesados (Dossier GameDetails Final)" />}
                {rawFixtureData && <JsonViewer data={rawFixtureData} title="2. Datos Brutos (Respuesta de /fixtures?id=...)" />}
            </div>
        </div>
    );
};