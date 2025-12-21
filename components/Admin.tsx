import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';
import { verifyPendingPredictions, fetchPendingVerificationRuns, resetStuckJobs, runPostMatchAnalysis, fetchMissingPostMatchRuns } from '../services/analysisService';
import { CheckCircleIcon, SparklesIcon, CalendarDaysIcon as CalendarIcon, PlayIcon, ArrowPathIcon, ChartBarIcon, TrashIcon, ExclamationTriangleIcon, CheckBadgeIcon } from './icons/Icons';
import { PerformanceReports } from './admin/PerformanceReports';
import { TeamManagement } from './admin/TeamManagement';

interface Profile {
    id: string;
    full_name: string | null;
    role: 'superadmin' | 'admin' | 'usuario';
}

export const AdminPage: React.FC = () => {
    const { profile } = useAuth();
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'superadmin' | 'admin' | 'usuario'>('usuario');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteMessage, setInviteMessage] = useState('');

    const [verifying, setVerifying] = useState(false);

    const [verifyResult, setVerifyResult] = useState('');
    const [activeTab, setActiveTab] = useState<'system' | 'team'>('system');

    // Batch Verification State
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [scanResults, setScanResults] = useState<number[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [batchStatus, setBatchStatus] = useState<'idle' | 'ready' | 'processing' | 'complete'>('idle');
    const [batchLog, setBatchLog] = useState<string[]>([]);

    // Manual Retroactive Analysis State
    const [retroStartDate, setRetroStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [retroEndDate, setRetroEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [retroCandidates, setRetroCandidates] = useState<any[]>([]);
    const [selectedRetroIds, setSelectedRetroIds] = useState<number[]>([]);
    const [retroScanning, setRetroScanning] = useState(false);
    const [retroProcessing, setRetroProcessing] = useState(false);
    const [retroLog, setRetroLog] = useState<string[]>([]);

    useEffect(() => {
        const fetchUsers = async () => {
            if (!profile || (profile.role !== 'superadmin' && profile.role !== 'admin')) {
                setError('No tienes permiso para ver esta página.');
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase.from('profiles').select('*').order('role');
                if (error) throw error;
                setUsers(data as Profile[]);
            } catch (err: any) {
                setError('Error al cargar los usuarios: ' + err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, [profile]);

    const handleInviteUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteLoading(true);
        setInviteMessage('');
        setError('');

        try {
            const { error: invokeError } = await supabase.functions.invoke('invite-user', {
                body: { email: inviteEmail, role: inviteRole },
            });

            if (invokeError) throw invokeError;

            setInviteMessage(`Invitación enviada exitosamente a ${inviteEmail}.`);
            setInviteEmail('');
        } catch (err: any) {
            setError('Error al invitar usuario: ' + (err.message || 'Error desconocido.'));
        } finally {
            setInviteLoading(false);
        }
    };

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

        const BATCH_SIZE = 1; // 1-by-1 processing for maximum feedback
        const total = scanResults.length;
        let processed = 0;

        try {
            // Chunk the array
            for (let i = 0; i < total; i += BATCH_SIZE) {
                const chunk = scanResults.slice(i, i + BATCH_SIZE);
                // setBatchLog(prev => [...prev, `Procesando partido ${i + 1} de ${total}...`]); // Less noise

                try {
                    console.log(`🚀 [BATCH START] IDs:`, chunk);
                    const res = await verifyPendingPredictions(chunk);

                    console.log("📦 [BATCH RESPONSE]", res); // Log entire object flat
                    if (res?.debug?.trace) {
                        console.log("📜 [SERVER TRACE START]");
                        res.debug.trace.forEach((l: string) => console.log(`   ${l}`));
                        console.log("📜 [SERVER TRACE END]");
                    }

                    if (res.success && res.processed > 0) {
                        processed += chunk.length;
                        setProcessedCount(processed);
                        setProgress(Math.round((processed / total) * 100));

                        // Extract names if available
                        const details = res.details?.[0];
                        const matchName = details?.teams ? `${details.teams.home} vs ${details.teams.away}` : `ID: ${chunk[0]}`;
                        setBatchLog(prev => [`✅ [${processed}/${total}] ${matchName} verificado.`, ...prev]);
                    } else {
                        setBatchLog(prev => [`⚠️ [${i + 1}/${total}] No se pudo verificar el partido ${chunk[0]}.`, ...prev]);
                    }
                } catch (err: any) {
                    console.error("Batch error:", err);
                    setBatchLog(prev => [`❌ Error en partido ${chunk[0]}: ${err.message}`, ...prev]);
                }

                // Small delay for UX and rate limiting
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

    // Legacy handler replaced/kept for fallback if needed, but UI will focus on new one.
    const handleVerifyPredictions = async () => {
        setVerifying(true);
        setVerifyResult('');
        try {
            const res = await verifyPendingPredictions();
            if (res.processed === 0) {
                setVerifyResult('No hay pronósticos pendientes de verificar (partidos terminados).');
            } else {
                setVerifyResult(`Se verificaron ${res.processed} partidos exitosamente.`);
            }
        } catch (e: any) {
            setVerifyResult(`Error: ${e.message}`);
        } finally {
            setVerifying(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: 'superadmin' | 'admin' | 'usuario') => {
        if (profile?.id === userId) {
            setError("No puedes cambiar tu propio rol.");
            return;
        }
        setUpdatingUserId(userId);
        setError('');
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            setUsers(currentUsers =>
                currentUsers.map(u => (u.id === userId ? { ...u, role: newRole } : u))
            );
        } catch (err: any) {
            setError(`Error al actualizar el rol: ${err.message}`);
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleCleanupStuckJobs = async () => {
        if (!confirm("¿Esto marcará como fallidos todos los trabajos antiguos que sigan en ejecución?")) return;
        setVerifying(true); // Reuse verifying spinner
        try {
            const count = await resetStuckJobs();
            alert(`Limpieza completada: ${count} procesos zombis eliminados.`);
        } catch (e: any) {
            alert("Error al limpiar procesos: " + e.message);
        } finally {
            setVerifying(false);
        }
    };

    if (loading) {
        return <div className="text-center">Cargando usuarios...</div>;
    }

    if (error && users.length === 0) {
        return <div className="text-center text-red-accent bg-red-500/10 p-4 rounded-lg">{error}</div>;
    }

    return (
        <div className="space-y-8 pb-20">
            <div>
                <h2 className="text-3xl font-display font-bold text-white tracking-tight">Panel de Administración</h2>
                <div className="flex gap-4 mt-6 border-b border-white/5">
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'system' ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-white'}`}
                    >
                        Sistema & IA
                    </button>
                    <button
                        onClick={() => setActiveTab('team')}
                        className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'team' ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-white'}`}
                    >
                        Gestión de Equipo
                    </button>
                </div>
            </div>

            {activeTab === 'team' ? (
                <TeamManagement />
            ) : (
                <div className="space-y-8">

                    {profile?.role === 'superadmin' && (
                        <>
                            <div className="glass p-6 rounded-xl border border-white/5 shadow-2xl">
                                <h3 className="text-xl font-display font-bold text-white mb-4">Invitar Nuevo Usuario</h3>
                                <form onSubmit={handleInviteUser} className="flex flex-col sm:flex-row gap-4 items-center">
                                    <input
                                        type="email"
                                        placeholder="Correo del nuevo usuario"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        required
                                        className="flex-grow w-full bg-slate-900/80 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand outline-none"
                                    />
                                    <select
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value as 'superadmin' | 'admin' | 'usuario')}
                                        className="w-full sm:w-auto bg-slate-900/80 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand outline-none"
                                    >
                                        <option value="usuario">Usuario</option>
                                        <option value="admin">Administrador</option>
                                        {profile?.role === 'superadmin' && <option value="superadmin">Superadministrador</option>}
                                    </select>
                                    <button
                                        type="submit"
                                        disabled={inviteLoading}
                                        className="w-full sm:w-auto bg-brand hover:bg-emerald-400 text-slate-900 font-bold py-3 px-6 rounded-lg transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
                                    >
                                        {inviteLoading ? 'Enviando...' : 'Invitar'}
                                    </button>
                                </form>
                                {inviteMessage && <p className="mt-3 text-sm text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">{inviteMessage}</p>}
                                {error && <p className="mt-3 text-sm text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">{error}</p>}
                            </div>

                            <div className="glass p-6 rounded-xl border border-white/5 shadow-2xl mb-8">
                                <h3 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-3">
                                    <ChartBarIcon className="w-6 h-6 text-emerald-500" />
                                    Informe de Rendimiento AI
                                </h3>
                                <div className="bg-slate-900/30 p-6 rounded-lg border border-white/5">
                                    <PerformanceReports />
                                </div>
                            </div>

                            <div className="glass p-6 rounded-xl border border-white/5 shadow-2xl mb-8">
                                <h2 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-3">
                                    <CheckCircleIcon className="w-6 h-6 text-purple-400" />
                                    Validación Automática de Resultados
                                </h2>

                                <div className="flex justify-end mb-4">
                                    <button
                                        onClick={handleCleanupStuckJobs}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-sm font-bold border border-red-600/50 transition-colors"
                                    >
                                        <TrashIcon className="w-4 h-4" /> Resetear Procesos Trabados
                                    </button>
                                </div>

                                <div className="bg-slate-900/30 p-6 rounded-lg border border-white/5">
                                    <h4 className="font-bold text-gray-200 mb-2">Verificación de Pronósticos por Lotes</h4>
                                    <p className="text-sm text-gray-400 mb-6">
                                        Escanea y verifica masivamente los resultados de los partidos en un rango de fechas. El sistema procesa los partidos en pequeños grupos para asegurar la estabilidad.
                                    </p>

                                    {/* Controles de Selección */}
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
                                                    className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm w-full focus:ring-green-accent focus:border-green-accent disabled:opacity-50"
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
                                                    className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm w-full focus:ring-green-accent focus:border-green-accent disabled:opacity-50"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleScanPending}
                                            disabled={isScanning || isProcessing}
                                            className="h-[38px] px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-md transition duration-300 disabled:bg-gray-600 flex items-center gap-2"
                                        >
                                            {isScanning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <ArrowPathIcon className="w-4 h-4" />}
                                            {isScanning ? 'Escaneando...' : 'Escanear Pendientes'}
                                        </button>
                                    </div>

                                    {/* Área de Estado del Proceso */}
                                    {(batchStatus === 'ready' || batchStatus === 'processing' || batchStatus === 'complete' || scanResults.length > 0) && (
                                        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 animate-fade-in">
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${batchStatus === 'complete' ? 'bg-green-500' : batchStatus === 'processing' ? 'bg-yellow-400 animate-pulse' : 'bg-blue-500'}`}></div>
                                                    <span className="text-gray-300 font-medium">
                                                        {batchStatus === 'complete' ? 'Proceso Finalizado' :
                                                            batchStatus === 'processing' ? `Procesando... (${processedCount}/${scanResults.length})` :
                                                                `Listo para procesar: ${scanResults.length} partidos`}
                                                    </span>
                                                </div>
                                                {batchStatus === 'ready' && (
                                                    <button
                                                        onClick={handleProcessQueue}
                                                        className="px-4 py-1.5 bg-green-accent hover:bg-green-600 text-white font-bold text-sm rounded-md transition duration-300 flex items-center gap-2 shadow-lg shadow-green-900/20"
                                                    >
                                                        <PlayIcon className="w-4 h-4" /> Iniciar Proceso por Lotes
                                                    </button>
                                                )}
                                            </div>

                                            {/* Barra de Progreso */}
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

                                            {/* Miniterminal de Logs */}
                                            <div className="bg-black/40 rounded p-3 h-32 overflow-y-auto font-mono text-xs border border-gray-700/50">
                                                {batchLog.length === 0 ? (
                                                    <span className="text-gray-600 italic">Esperando inicio del proceso...</span>
                                                ) : (
                                                    batchLog.map((log, i) => (
                                                        <div key={i} className="text-gray-400 mb-1 border-b border-gray-800/50 pb-0.5 last:border-0">
                                                            <span className="text-gray-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                                            {log}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {scanResults.length === 0 && batchStatus === 'idle' && batchLog.length > 0 && (
                                        <p className="mt-4 text-sm text-yellow-500 bg-yellow-500/10 p-2 rounded border border-yellow-500/20 text-center">
                                            {batchLog[0]}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="glass p-6 rounded-xl border border-white/5 shadow-2xl mb-8">
                                <h2 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-3">
                                    <SparklesIcon className="w-6 h-6 text-yellow-400" />
                                    Análisis Post-Partido Retroactivo
                                </h2>
                                <div className="bg-slate-900/30 p-6 rounded-lg border border-white/5">
                                    <p className="text-sm text-gray-400 mb-4">
                                        Escanea partidos que ya fueron verificados (tienen resultado) pero aún no tienen el "Análisis 360°" (autopsia IA).
                                    </p>

                                    {/* Controls */}
                                    <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
                                        <div className="w-full md:w-auto">
                                            <label className="block text-xs text-gray-400 mb-1 ml-1">Fecha Inicio</label>
                                            <div className="relative">
                                                <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                                <input
                                                    type="date"
                                                    value={retroStartDate}
                                                    onChange={(e) => setRetroStartDate(e.target.value)}
                                                    disabled={retroScanning || retroProcessing}
                                                    className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm w-full focus:ring-yellow-400 focus:border-yellow-400 disabled:opacity-50"
                                                />
                                            </div>
                                        </div>
                                        <div className="w-full md:w-auto">
                                            <label className="block text-xs text-gray-400 mb-1 ml-1">Fecha Fin</label>
                                            <div className="relative">
                                                <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                                <input
                                                    type="date"
                                                    value={retroEndDate}
                                                    onChange={(e) => setRetroEndDate(e.target.value)}
                                                    disabled={retroScanning || retroProcessing}
                                                    className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm w-full focus:ring-yellow-400 focus:border-yellow-400 disabled:opacity-50"
                                                />
                                            </div>
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
                                            {retroScanning ? 'Buscando...' : 'Buscar Candidatos'}
                                        </button>
                                    </div>

                                    {/* Candidates Table */}
                                    {retroCandidates.length > 0 && (
                                        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 mb-4 animate-fade-in">
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

                                    {/* Action Button & Logs */}
                                    <div className="flex flex-col gap-4">
                                        {selectedRetroIds.length > 0 && !retroProcessing && (
                                            <button
                                                onClick={async () => {
                                                    setRetroProcessing(true);
                                                    setRetroLog(prev => ['Iniciando procesamiento...', ...prev]);

                                                    // Process sequentially
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
                                                        // Small delay
                                                        await new Promise(r => setTimeout(r, 800));
                                                    }

                                                    setRetroLog(prev => [`🏁 Proceso finalizado. ${processed} éxitos.`, ...prev]);
                                                    setRetroProcessing(false);
                                                    // Refresh list
                                                    const remaining = await fetchMissingPostMatchRuns(retroStartDate, retroEndDate);
                                                    setRetroCandidates(remaining);
                                                    setSelectedRetroIds([]);
                                                }}
                                                className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white font-bold py-3 rounded-lg shadow-lg flex justify-center items-center gap-2 transform transition hover:scale-[1.01]"
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
                        </>
                    )}


                    <div className="glass rounded-xl border border-white/5 shadow-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-900/50">
                                    <tr>
                                        <th className="p-4 font-semibold">Nombre</th>
                                        <th className="p-4 font-semibold">ID de Usuario</th>
                                        <th className="p-4 font-semibold">Rol</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {users.map(user => (
                                        <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-medium text-white">{user.full_name || 'N/A'}</td>
                                            <td className="p-4 text-slate-400 font-mono text-xs">{user.id}</td>
                                            <td className="p-4">
                                                {updatingUserId === user.id ? (
                                                    <span className="text-sm text-gray-400">Actualizando...</span>
                                                ) : (
                                                    <select
                                                        value={user.role}
                                                        onChange={(e) => handleRoleChange(user.id, e.target.value as 'superadmin' | 'admin' | 'usuario')}
                                                        disabled={profile?.id === user.id || profile?.role !== 'superadmin' || updatingUserId !== null}
                                                        className={`px-2 py-1 text-xs font-semibold rounded-full border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-green-accent transition-colors
                                                    ${user.role === 'superadmin' ? 'bg-red-accent/20 text-red-accent' :
                                                                user.role === 'admin' ? 'bg-yellow-400/20 text-yellow-400' :
                                                                    'bg-blue-500/20 text-blue-300'
                                                            }
                                                    ${profile?.role === 'superadmin' && profile.id !== user.id ? 'cursor-pointer hover:border-gray-500' : 'cursor-not-allowed opacity-70'}
                                                `}
                                                    >
                                                        <option value="usuario">Usuario</option>
                                                        <option value="admin">Administrador</option>
                                                        <option value="superadmin">Superadministrador</option>
                                                    </select>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};