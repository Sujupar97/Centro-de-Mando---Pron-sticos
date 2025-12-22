import React, { useState } from 'react';
import { verifyPendingPredictions, fetchPendingVerificationRuns, resetStuckJobs, runPostMatchAnalysis, fetchMissingPostMatchRuns } from '../../services/analysisService';
import { CheckCircleIcon, SparklesIcon, CalendarDaysIcon as CalendarIcon, PlayIcon, ArrowPathIcon, TrashIcon } from '../icons/Icons';

export const OperationsCenter: React.FC = () => {
    // --- BATCH VERIFICATION STATE ---
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [scanResults, setScanResults] = useState<number[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [batchStatus, setBatchStatus] = useState<'idle' | 'ready' | 'processing' | 'complete'>('idle');
    const [batchLog, setBatchLog] = useState<string[]>([]);

    // --- RETRO ANALYSIS STATE ---
    const [retroStartDate, setRetroStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [retroEndDate, setRetroEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [retroCandidates, setRetroCandidates] = useState<any[]>([]);
    const [selectedRetroIds, setSelectedRetroIds] = useState<number[]>([]);
    const [retroScanning, setRetroScanning] = useState(false);
    const [retroProcessing, setRetroProcessing] = useState(false);
    const [retroLog, setRetroLog] = useState<string[]>([]);

    const [verifying, setVerifying] = useState(false);

    // --- BATCH HANDLERS ---
    const handleScanPending = async () => {
        setIsScanning(true);
        setBatchStatus('idle');
        setScanResults([]);
        setBatchLog([]);
        try {
            const ids = await fetchPendingVerificationRuns(startDate, endDate);
            setScanResults(ids);
            setBatchStatus(ids.length > 0 ? 'ready' : 'idle');
            setBatchLog(prev => [`Escaneo completado. ${ids.length} partidos pendientes encontrados.`]);
        } catch (e: any) {
            setBatchLog(prev => [`Error al escanear: ${e.message}`]);
        } finally {
            setIsScanning(false);
        }
    };

    const handleProcessQueue = async () => {
        if (scanResults.length === 0) return;

        setIsProcessing(true);
        setBatchStatus('processing');
        setProgress(0);
        setProcessedCount(0);
        setBatchLog(prev => [...prev, 'Iniciando procesamiento por lotes...', '--------------------------------']);

        const BATCH_SIZE = 1; // 1-by-1 processing
        const total = scanResults.length;
        let processed = 0;

        try {
            for (let i = 0; i < total; i += BATCH_SIZE) {
                const chunk = scanResults.slice(i, i + BATCH_SIZE);
                try {
                    console.log(`🚀 [BATCH START] IDs:`, chunk);
                    const res = await verifyPendingPredictions(chunk);

                    if (res.success && res.processed > 0) {
                        processed += chunk.length;
                        setProcessedCount(processed);
                        setProgress(Math.round((processed / total) * 100));
                        const details = res.details?.[0];
                        const matchName = details?.teams ? `${details.teams.home} vs ${details.teams.away}` : `ID: ${chunk[0]}`;
                        setBatchLog(prev => [`✅ [${processed}/${total}] ${matchName} verificado.`, ...prev]);
                    } else {
                        setBatchLog(prev => [`⚠️ [${i + 1}/${total}] No se pudo verificar el partido ${chunk[0]}.`, ...prev]);
                    }
                } catch (err: any) {
                    setBatchLog(prev => [`❌ Error en partido ${chunk[0]}: ${err.message}`, ...prev]);
                }
                await new Promise(r => setTimeout(r, 800));
            }

            setBatchStatus('complete');
            setBatchLog(prev => [...prev, '--------------------------------', '🎉 Procesamiento finalizado completamente.']);

        } catch (globalErr: any) {
            setBatchLog(prev => [...prev, `Error Crítico: ${globalErr.message}`]);
            setBatchStatus('idle');
        } finally {
            setIsProcessing(false);
        }
    };

    // --- RETRO HANDLERS ---
    const handleCleanupStuckJobs = async () => {
        if (!confirm("¿Esto marcará como fallidos todos los trabajos antiguos que sigan en ejecución?")) return;
        setVerifying(true);
        try {
            const count = await resetStuckJobs();
            alert(`Limpieza completada: ${count} procesos zombis eliminados.`);
        } catch (e: any) {
            alert("Error al limpiar procesos: " + e.message);
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="glass p-6 rounded-xl border border-white/5 shadow-2xl">
                <h2 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-3">
                    <CheckCircleIcon className="w-6 h-6 text-purple-400" />
                    Validación Automática de Resultados
                </h2>

                <div className="flex justify-end mb-4">
                    <button
                        onClick={handleCleanupStuckJobs}
                        disabled={verifying}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-sm font-bold border border-red-600/50 transition-colors"
                    >
                        <TrashIcon className="w-4 h-4" /> Resetear Procesos Trabados
                    </button>
                </div>

                <div className="bg-slate-900/30 p-6 rounded-lg border border-white/5">
                    <h4 className="font-bold text-gray-200 mb-2">Verificación de Pronósticos por Lotes</h4>
                    <p className="text-sm text-gray-400 mb-6">
                        Escanea y verifica masivamente los resultados de los partidos en un rango de fechas.
                    </p>

                    <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-gray-400 mb-1 ml-1">Fecha Inicio</label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    disabled={isScanning || isProcessing}
                                    className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm w-full focus:ring-green-400 focus:border-green-400 disabled:opacity-50"
                                />
                            </div>
                        </div>
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-gray-400 mb-1 ml-1">Fecha Fin</label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    disabled={isScanning || isProcessing}
                                    className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm w-full focus:ring-green-400 focus:border-green-400 disabled:opacity-50"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleScanPending}
                            disabled={isScanning || isProcessing}
                            className="h-[38px] px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-md transition duration-300 disabled:bg-gray-600 flex items-center gap-2"
                        >
                            {isScanning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <ArrowPathIcon className="w-4 h-4" />}
                            {isScanning ? 'Escaneando...' : 'Escanear'}
                        </button>
                    </div>

                    {(batchStatus === 'ready' || batchStatus === 'processing' || batchStatus === 'complete' || scanResults.length > 0) && (
                        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${batchStatus === 'complete' ? 'bg-green-500' : batchStatus === 'processing' ? 'bg-yellow-400 animate-pulse' : 'bg-blue-500'}`}></div>
                                    <span className="text-gray-300 font-medium">
                                        {batchStatus === 'complete' ? 'Proceso Finalizado' :
                                            batchStatus === 'processing' ? `Procesando... (${processedCount}/${scanResults.length})` :
                                                `Listo: ${scanResults.length} partidos`}
                                    </span>
                                </div>
                                {batchStatus === 'ready' && (
                                    <button
                                        onClick={handleProcessQueue}
                                        className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white font-bold text-sm rounded-md transition flex items-center gap-2 shadow-lg shadow-green-900/20"
                                    >
                                        <PlayIcon className="w-4 h-4" /> Iniciar
                                    </button>
                                )}
                            </div>

                            {(batchStatus === 'processing' || batchStatus === 'complete') && (
                                <div className="w-full bg-gray-900 rounded-full h-4 mb-4 overflow-hidden border border-gray-700 relative">
                                    <div
                                        className="bg-gradient-to-r from-green-600 to-green-400 h-full transition-all duration-500 ease-out flex items-center justify-center"
                                        style={{ width: `${progress}%` }}
                                    >
                                    </div>
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm drop-shadow-md">{progress}%</span>
                                </div>
                            )}

                            <div className="bg-black/40 rounded p-3 h-32 overflow-y-auto font-mono text-xs border border-gray-700/50">
                                {batchLog.length === 0 ? (
                                    <span className="text-gray-600 italic">Esperando inicio...</span>
                                ) : (
                                    batchLog.map((log, i) => (
                                        <div key={i} className="text-gray-400 mb-1 border-b border-gray-800/50 pb-0.5 last:border-0">
                                            {log}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="glass p-6 rounded-xl border border-white/5 shadow-2xl">
                <h2 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-3">
                    <SparklesIcon className="w-6 h-6 text-yellow-400" />
                    Análisis Post-Partido Retroactivo
                </h2>
                <div className="bg-slate-900/30 p-6 rounded-lg border border-white/5">
                    <p className="text-sm text-gray-400 mb-4">
                        Escanea partidos verificados sin "Análisis 360°".
                    </p>

                    <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-gray-400 mb-1 ml-1">Desde</label>
                            <input
                                type="date"
                                value={retroStartDate}
                                onChange={(e) => setRetroStartDate(e.target.value)}
                                disabled={retroScanning || retroProcessing}
                                className="pl-4 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm w-full focus:ring-yellow-400 focus:border-yellow-400 disabled:opacity-50"
                            />
                        </div>
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-gray-400 mb-1 ml-1">Hasta</label>
                            <input
                                type="date"
                                value={retroEndDate}
                                onChange={(e) => setRetroEndDate(e.target.value)}
                                disabled={retroScanning || retroProcessing}
                                className="pl-4 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm w-full focus:ring-yellow-400 focus:border-yellow-400 disabled:opacity-50"
                            />
                        </div>
                        <button
                            onClick={async () => {
                                setRetroScanning(true);
                                setRetroCandidates([]);
                                setSelectedRetroIds([]);
                                setRetroLog([]);
                                try {
                                    const runs = await fetchMissingPostMatchRuns(retroStartDate, retroEndDate);
                                    setRetroCandidates(runs);
                                    setRetroLog([`Escaneo completado. ${runs.length} partidos candidatos encontrados.`]);
                                } catch (e: any) {
                                    setRetroLog([`Error: ${e.message}`]);
                                } finally {
                                    setRetroScanning(false);
                                }
                            }}
                            disabled={retroScanning || retroProcessing}
                            className="h-[38px] px-6 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-md transition duration-300 disabled:bg-gray-600 flex items-center gap-2"
                        >
                            {retroScanning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <ArrowPathIcon className="w-4 h-4" />}
                            Buscar
                        </button>
                    </div>

                    {retroCandidates.length > 0 && (
                        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 mb-4">
                            <div className="p-3 bg-gray-700/50 flex justify-between items-center border-b border-gray-600">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        className="rounded bg-gray-600 border-gray-500 text-yellow-500"
                                        checked={selectedRetroIds.length === retroCandidates.length}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedRetroIds(retroCandidates.map(c => c.fixture_id));
                                            else setSelectedRetroIds([]);
                                        }}
                                    />
                                    <span className="text-sm text-gray-300 font-medium">Seleccionar Todos ({retroCandidates.length})</span>
                                </div>
                                <span className="text-xs text-yellow-400 font-mono">Seleccionados: {selectedRetroIds.length}</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-gray-700/30 text-gray-400 sticky top-0 backdrop-blur-sm">
                                        <tr>
                                            <th className="px-4 py-2 w-10"></th>
                                            <th className="px-4 py-2">Fecha</th>
                                            <th className="px-4 py-2">Partido</th>
                                            <th className="px-4 py-2">Resultado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {retroCandidates.map(c => (
                                            <tr key={c.run_id} className="hover:bg-gray-700/20">
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded bg-gray-600 border-gray-500 text-yellow-500"
                                                        checked={selectedRetroIds.includes(c.fixture_id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedRetroIds(prev => [...prev, c.fixture_id]);
                                                            else setSelectedRetroIds(prev => prev.filter(id => id !== c.fixture_id));
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-gray-400 font-mono text-xs">{new Date(c.date).toLocaleDateString()}</td>
                                                <td className="px-4 py-2 text-white font-medium">{c.home} vs {c.away}</td>
                                                <td className="px-4 py-2">
                                                    <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs">{c.outcome?.score?.home}-{c.outcome?.score?.away}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        {selectedRetroIds.length > 0 && !retroProcessing && (
                            <button
                                onClick={async () => {
                                    setRetroProcessing(true);
                                    setRetroLog(prev => ['Iniciando procesamiento...', ...prev]);
                                    let processed = 0;
                                    for (const fid of selectedRetroIds) {
                                        try {
                                            const success = await runPostMatchAnalysis(fid);
                                            if (success) {
                                                processed++;
                                                setRetroLog(prev => [`✅ [${processed}/${selectedRetroIds.length}] ID ${fid} analizado.`, ...prev]);
                                            } else {
                                                setRetroLog(prev => [`⚠️ Error en ID ${fid}.`, ...prev]);
                                            }
                                        } catch (err: any) {
                                            setRetroLog(prev => [`❌ Excepción ID ${fid}: ${err.message}`, ...prev]);
                                        }
                                        await new Promise(r => setTimeout(r, 800));
                                    }
                                    setRetroLog(prev => [`🏁 Proceso finalizado. ${processed} éxitos.`, ...prev]);
                                    setRetroProcessing(false);
                                    const remaining = await fetchMissingPostMatchRuns(retroStartDate, retroEndDate);
                                    setRetroCandidates(remaining);
                                    setSelectedRetroIds([]);
                                }}
                                className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white font-bold py-3 rounded-lg shadow-lg flex justify-center items-center gap-2"
                            >
                                <SparklesIcon className="w-5 h-5 animate-pulse" />
                                Generar Análisis 360° para {selectedRetroIds.length} Partidos
                            </button>
                        )}
                        {retroLog.length > 0 && (
                            <div className="bg-black/40 rounded p-3 h-32 overflow-y-auto font-mono text-xs border border-gray-700/50">
                                {retroLog.map((log, i) => (
                                    <div key={i} className="text-gray-400 mb-1 border-b border-gray-800/50 pb-0.5 last:border-0">{log}</div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
