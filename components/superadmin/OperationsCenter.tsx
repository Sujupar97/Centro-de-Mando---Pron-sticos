import React, { useState, useEffect } from 'react';
import { verifyPendingPredictions, fetchPendingVerificationRuns, resetStuckJobs, runPostMatchAnalysis, fetchMissingPostMatchRuns, runV2Verification } from '../../services/analysisService';
import { supabase } from '../../services/supabaseService';
import { CheckCircleIcon, SparklesIcon, CalendarDaysIcon as CalendarIcon, PlayIcon, ArrowPathIcon, TrashIcon, Cog6ToothIcon, ComputerDesktopIcon, BoltIcon, AcademicCapIcon, ShieldCheckIcon } from '../icons/Icons';

export const OperationsCenter: React.FC = () => {
    // --- SYSTEM SETTINGS STATE ---
    const [settings, setSettings] = useState<{ [key: string]: boolean }>({
        auto_analysis_enabled: true,
        auto_parlay_enabled: true,
        auto_learning_enabled: false,
        verification_v2_enabled: true // New setting
    });
    const [loadingSettings, setLoadingSettings] = useState(true);

    // --- V2 VERIFICATION STATE ---
    const [v2TargetDate, setV2TargetDate] = useState(new Date().toISOString().split('T')[0]);
    const [isV2Running, setIsV2Running] = useState(false);
    const [v2Log, setV2Log] = useState<string[]>([]);

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

    // --- LOAD SETTINGS ---
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const { data } = await supabase.from('system_settings').select('*');
            if (data) {
                const map = data.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
                setSettings(prev => ({ ...prev, ...map }));
            }
        } catch (e) {
            console.error("Error loading settings:", e);
        } finally {
            setLoadingSettings(false);
        }
    };

    const toggleSetting = async (key: string) => {
        const newValue = !settings[key];
        // Optimistic update
        setSettings(prev => ({ ...prev, [key]: newValue }));

        try {
            const { error } = await supabase
                .from('system_settings')
                .update({ value: newValue })
                .eq('key', key);

            if (error) throw error;
        } catch (e) {
            console.error(`Error updating setting ${key}:`, e);
            // Revert on error
            setSettings(prev => ({ ...prev, [key]: !newValue }));
            alert("Error al actualizar la configuración.");
        }
    };

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

            {/* --- SYSTEM AUTOMATION CONTROLS --- */}
            <div className="glass p-6 rounded-xl border border-white/5 shadow-2xl bg-gradient-to-br from-slate-900 to-slate-800">
                <h2 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-3">
                    <ComputerDesktopIcon className="w-6 h-6 text-blue-400" />
                    Control de Automatización del Sistema
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Switch 1: Auto Analysis */}
                    <div className={`p-4 rounded-xl border transition-all ${settings.auto_analysis_enabled ? 'bg-blue-900/20 border-blue-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <BoltIcon className={`w-6 h-6 ${settings.auto_analysis_enabled ? 'text-blue-400' : 'text-slate-500'}`} />
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.auto_analysis_enabled}
                                    onChange={() => toggleSetting('auto_analysis_enabled')}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                        <h3 className="font-bold text-gray-200">Análisis Diario</h3>
                        <p className="text-xs text-gray-400 mt-1">Genera automáticamente análisis para partidos del día siguiente (2:00 AM).</p>
                    </div>

                    {/* Switch 2: Auto Parlay */}
                    <div className={`p-4 rounded-xl border transition-all ${settings.auto_parlay_enabled ? 'bg-green-900/20 border-green-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 rounded-lg bg-green-500/10">
                                <SparklesIcon className={`w-6 h-6 ${settings.auto_parlay_enabled ? 'text-green-400' : 'text-slate-500'}`} />
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.auto_parlay_enabled}
                                    onChange={() => toggleSetting('auto_parlay_enabled')}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>
                        <h3 className="font-bold text-gray-200">Generador de Parlays</h3>
                        <p className="text-xs text-gray-400 mt-1">Crea combinadas automáticamente tras finalizar los análisis diarios.</p>
                    </div>

                    {/* Switch 3: Auto Learning */}
                    <div className={`p-4 rounded-xl border transition-all ${settings.auto_learning_enabled ? 'bg-purple-900/20 border-purple-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                                <AcademicCapIcon className={`w-6 h-6 ${settings.auto_learning_enabled ? 'text-purple-400' : 'text-slate-500'}`} />
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.auto_learning_enabled}
                                    onChange={() => toggleSetting('auto_learning_enabled')}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                        <h3 className="font-bold text-gray-200">Auto-Learning (ML)</h3>
                        <p className="text-xs text-gray-400 mt-1">Permite al modelo re-entrenarse automáticamente con nuevos resultados verificados.</p>
                    </div>
                </div>
            </div>

            <div className="glass p-6 rounded-xl border border-white/5 shadow-2xl">
                <h2 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-3">
                    <ShieldCheckIcon className="w-6 h-6 text-emerald-400" />
                    Juez Deportivo IA (Verificación V2)
                </h2>

                <div className="bg-slate-900/30 p-6 rounded-lg border border-white/5">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="font-bold text-gray-200 mb-2">Motor de Verificación por Interpretación</h4>
                            <p className="text-sm text-gray-400 max-w-2xl">
                                Este nuevo sistema utiliza IA (Gemini) para interpretar resultados complejos (ej. "Ganador 1ra Mitad", "Corners") leyendo estadísticas reales del partido. Reemplaza al sistema antiguo de reglas estrictas.
                            </p>
                        </div>
                        <div className="flex flex-col items-end">
                            <label className="relative inline-flex items-center cursor-pointer mb-2">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.verification_v2_enabled}
                                    onChange={() => toggleSetting('verification_v2_enabled')}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                <span className="ml-3 text-sm font-medium text-gray-300">Auto-Ejecución (11:30 PM)</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-end mb-6 bg-slate-800/40 p-4 rounded-lg">
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-gray-400 mb-1 ml-1">Fecha a Verificar</label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                <input
                                    type="date"
                                    value={v2TargetDate}
                                    onChange={(e) => setV2TargetDate(e.target.value)}
                                    disabled={isV2Running}
                                    className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm w-full focus:ring-emerald-400 focus:border-emerald-400 disabled:opacity-50"
                                />
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                setIsV2Running(true);
                                setV2Log(prev => [`🚀 Iniciando Juez IA para: ${v2TargetDate}...`, ...prev]);
                                try {
                                    const res = await runV2Verification(v2TargetDate, undefined, true);
                                    if (res.success) {
                                        const stats = res.stats || {};
                                        // Merge trace logs if present
                                        const serverTrace = res.trace || [];

                                        setV2Log(prev => [
                                            `✅ Completado.`,
                                            `   - Procesados: ${stats.processed || 0}`,
                                            `   - Parlays Act: ${stats.updated_parlays || 0}`,
                                            `   - Picks Act: ${stats.updated_picks || 0}`,
                                            `   - Errores: ${stats.errors || 0}`,
                                            ...serverTrace.map((t: string) => `   🔍 ${t}`), // Add prefix to distinguish
                                            ...prev
                                        ]);
                                    } else {
                                        setV2Log(prev => [`❌ Error: ${JSON.stringify(res)}`, ...prev]);
                                    }
                                } catch (e: any) {
                                    setV2Log(prev => [`❌ Excepción: ${e.message}`, ...prev]);
                                } finally {
                                    setIsV2Running(false);
                                }
                            }}
                            disabled={isV2Running}
                            className="h-[38px] px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-md transition duration-300 disabled:bg-gray-600 flex items-center gap-2 shadow-lg shadow-emerald-900/20"
                        >
                            {isV2Running ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <PlayIcon className="w-4 h-4" />}
                            {isV2Running ? 'Verificando...' : 'Ejecutar Verificación V2'}
                        </button>
                    </div>

                    <div className="bg-black/40 rounded p-3 h-48 overflow-y-auto font-mono text-xs border border-gray-700/50">
                        {v2Log.length === 0 ? (
                            <span className="text-gray-600 italic">Esperando ejecución...</span>
                        ) : (
                            v2Log.map((log, i) => (
                                <div key={i} className="text-gray-400 mb-1 border-b border-gray-800/50 pb-0.5 last:border-0">
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
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
                                            const result = await runPostMatchAnalysis(fid);
                                            if (result.success) {
                                                processed++;
                                                setRetroLog(prev => [`✅ [${processed}/${selectedRetroIds.length}] ID ${fid} analizado.`, ...prev]);
                                            } else {
                                                setRetroLog(prev => [`⚠️ Error en ID ${fid}: ${result.message}`, ...prev]);
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
