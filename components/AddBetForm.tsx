
import React, { useState } from 'react';
import { Bet, BetStatus, BetLeg, LegStatus, ExtractedBetInfo } from '../types';
import { extractBetInfoFromImage } from '../services/geminiService';
import { DocumentArrowUpIcon, SparklesIcon } from './icons/Icons';

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

const LoadingSpinner: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex items-center justify-center space-x-2">
        <div className="w-4 h-4 rounded-full animate-pulse bg-white"></div>
        <div className="w-4 h-4 rounded-full animate-pulse bg-white delay-75"></div>
        <div className="w-4 h-4 rounded-full animate-pulse bg-white delay-150"></div>
        <span className="ml-2">{text}</span>
    </div>
);

// Helper function to determine the overall status from legs
const determineOverallStatus = (legs: BetLeg[]): BetStatus => {
    if (legs.some(leg => leg.status === LegStatus.Lost)) {
        return BetStatus.Lost;
    }
    if (legs.every(leg => leg.status === LegStatus.Won || leg.status === LegStatus.Void)) {
        return BetStatus.Won;
    }
    return BetStatus.Pending;
};


export const AddBetForm: React.FC<{ onAddBet: (bet: Omit<Bet, 'id' | 'payout' | 'user_id'>) => Promise<void>; }> = ({ onAddBet }) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [extractedData, setExtractedData] = useState<ExtractedBetInfo | null>(null);
    const [error, setError] = useState('');

    const resetState = () => {
        setImageFile(null);
        setImagePreview(null);
        setIsLoading(false);
        setExtractedData(null);
        setError('');
        const fileInput = document.getElementById('bet-image-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            resetState();
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };
    
    const handleAnalyze = async () => {
        if (!imageFile) {
            setError('Por favor, selecciona una imagen primero.');
            return;
        }
        setIsLoading(true);
        setError('');
        setExtractedData(null);

        try {
            const { base64, mimeType } = await fileToBase64(imageFile);
            const data = await extractBetInfoFromImage(base64, mimeType);
            
            // --- INICIO: LÓGICA DE POST-PROCESAMIENTO Y LIMPIEZA ---
            const formattedDate = data.date ? new Date(data.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            const truncatedOdds = Math.floor(data.totalOdds * 100) / 100;
            const overallStatus = determineOverallStatus(data.legs || []);
            // --- FIN: LÓGICA DE POST-PROCESAMIENTO ---

            setExtractedData({
                ...data,
                date: formattedDate,
                stake: Number(data.stake) || 0,
                totalOdds: truncatedOdds || 1,
                status: overallStatus, // Usar el estado calculado
            });
        } catch (e) {
            console.error(e);
            setError('No se pudo analizar la imagen. Asegúrate de que el ticket sea legible o inténtalo de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDataChange = (field: keyof Omit<ExtractedBetInfo, 'legs'>, value: string | number | BetStatus) => {
        if (extractedData) {
            setExtractedData({ ...extractedData, [field]: value });
        }
    };

    const handleLegStatusChange = (index: number, newStatus: LegStatus) => {
        if (!extractedData) return;

        const updatedLegs = [...extractedData.legs];
        updatedLegs[index] = { ...updatedLegs[index], status: newStatus };

        const newOverallStatus = determineOverallStatus(updatedLegs);

        setExtractedData({
            ...extractedData,
            legs: updatedLegs,
            status: newOverallStatus,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!extractedData) {
            setError('No hay datos de apuesta para guardar.');
            return;
        }
        
        const { date, stake, totalOdds, legs, status } = extractedData;
        if (!stake || !totalOdds || !date || !legs || legs.length === 0) {
            setError('Por favor, completa todos los campos extraídos antes de guardar.');
            return;
        }
        
        setIsLoading(true);
        setError('');

        const isCombined = legs.length > 1;
        const eventName = isCombined ? `Combinada (${legs.length} selecciones)` : legs[0].event;
        const marketDescription = legs.map(leg => `[${leg.sport}] ${leg.event} - ${leg.market}`).join('\n');

        try {
            await onAddBet({
              date,
              status,
              stake: Number(stake),
              odds: Number(totalOdds),
              event: eventName,
              market: marketDescription,
              image: imagePreview || undefined,
              legs,
            });
            resetState();
        } catch (error) {
            setError('Error al guardar la apuesta. Inténtalo de nuevo.');
            console.error(error);
            setIsLoading(false);
        }
    };

    const legStatusColorMap: { [key in LegStatus]: string } = {
        [LegStatus.Won]: 'text-green-accent',
        [LegStatus.Lost]: 'text-red-accent',
        [LegStatus.Pending]: 'text-yellow-400',
        [LegStatus.Void]: 'text-gray-400',
    };

    return (
        <div className="max-w-4xl mx-auto bg-gray-800 p-6 md:p-8 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-6">Añadir Apuesta desde Ticket</h2>
            {error && <div className="bg-red-500/20 text-red-accent p-3 rounded-md mb-4 text-sm">{error}</div>}

            {!extractedData && (
                <div className="space-y-6">
                    <p className="text-sm text-gray-400 text-center">
                        Sube una imagen de tu ticket y la IA extraerá los datos automáticamente, incluyendo apuestas combinadas.
                    </p>
                    <label htmlFor="bet-image-upload" className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700/50 hover:bg-gray-700">
                        {imagePreview ? <img src={imagePreview} alt="Vista previa del ticket" className="max-h-full max-w-full rounded-lg object-contain" /> : (
                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-400">
                                <DocumentArrowUpIcon className="w-10 h-10 mb-4" />
                                <p className="mb-2 text-sm"><span className="font-semibold">Haz clic para subir</span> o arrastra y suelta</p>
                                <p className="text-xs">PNG, JPG, WEBP, etc.</p>
                            </div>
                        )}
                        <input id="bet-image-upload" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                    </label>
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !imageFile}
                        className="w-full bg-green-accent hover:bg-green-600 text-white font-bold py-3 px-4 rounded-md transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? <LoadingSpinner text="Analizando ticket..."/> : <><SparklesIcon className="w-5 h-5"/><span className="ml-2">Analizar con IA</span></>}
                    </button>
                </div>
            )}
            
            {extractedData && (
                <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                     <h3 className="text-xl font-semibold text-white">Verifica los Datos Extraídos</h3>
                     <p className="text-sm text-gray-400">Revisa y corrige la información del ticket. El estado general se actualiza automáticamente según el resultado de las selecciones individuales.</p>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <div>
                            <label htmlFor="date" className="block text-sm font-medium text-gray-400 mb-2">Fecha</label>
                            <input type="date" id="date" value={extractedData.date} onChange={(e) => handleDataChange('date', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent"/>
                        </div>
                         <div>
                            <label htmlFor="stake" className="block text-sm font-medium text-gray-400 mb-2">Apostado (COP)</label>
                            <input type="number" id="stake" value={extractedData.stake} onChange={(e) => handleDataChange('stake', e.target.value)} step="1" min="0" className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent"/>
                        </div>
                        <div>
                            <label htmlFor="totalOdds" className="block text-sm font-medium text-gray-400 mb-2">Cuota Total</label>
                            <input type="number" id="totalOdds" value={extractedData.totalOdds} onChange={(e) => handleDataChange('totalOdds', e.target.value)} step="0.01" min="1" className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent"/>
                        </div>
                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-400 mb-2">Estado General</label>
                            <select id="status" value={extractedData.status} onChange={(e) => handleDataChange('status', e.target.value as BetStatus)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent">
                                {Object.values(BetStatus).map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-lg font-semibold text-white mb-2">Selecciones de la Apuesta</h4>
                        <div className="bg-gray-900/50 rounded-lg overflow-hidden border border-gray-700">
                          <div className="overflow-x-auto">
                           <table className="w-full text-left min-w-[600px]">
                               <thead className="bg-gray-700/50">
                                   <tr>
                                       <th className="p-3 font-semibold text-sm">Deporte</th>
                                       <th className="p-3 font-semibold text-sm">Liga/Evento</th>
                                       <th className="p-3 font-semibold text-sm">Mercado</th>
                                       <th className="p-3 font-semibold text-sm text-center">Cuota</th>
                                       <th className="p-3 font-semibold text-sm">Resultado</th>
                                   </tr>
                               </thead>
                               <tbody>
                                   {(extractedData.legs || []).map((leg, index) => (
                                       <tr key={index} className="border-t border-gray-700">
                                           <td className="p-3 text-sm">{leg.sport}</td>
                                           <td className="p-3 text-sm"><div className="font-medium">{leg.event}</div><div className="text-xs text-gray-500">{leg.league}</div></td>
                                           <td className="p-3 text-sm">{leg.market}</td>
                                           <td className="p-3 text-sm text-center font-mono">{(leg.odds || 0).toFixed(3)}</td>
                                           <td className="p-2 text-sm">
                                                <select
                                                    value={leg.status}
                                                    onChange={(e) => handleLegStatusChange(index, e.target.value as LegStatus)}
                                                    className={`w-full bg-gray-700/50 border-0 rounded-md p-1.5 font-semibold focus:ring-2 focus:ring-green-accent ${legStatusColorMap[leg.status]}`}
                                                >
                                                    {Object.values(LegStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                           </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 pt-4">
                        <button type="button" onClick={resetState} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-md transition duration-300">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isLoading} className="w-full bg-green-accent hover:bg-green-600 text-white font-bold py-3 px-4 rounded-md transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed">
                          {isLoading ? <LoadingSpinner text="Guardando..." /> : 'Confirmar y Guardar Apuesta'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};
