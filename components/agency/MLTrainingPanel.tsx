import React, { useState, useEffect, useCallback } from 'react';
import {
    BrainIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    XCircleIcon,
} from '../icons/Icons';
import {
    getDateRangeAuditStatus,
    getCalibrationFactors,
    getLearnedPatterns,
    getTrainingHistory,
    getMLSystemStatus,
    getParlayCalibration,
    getPlattParameters,
    triggerTraining,
    rollbackTraining,
    toggleCalibrationFactor,
    togglePattern,
} from '../../services/mlService';
import type {
    DayAuditStatus,
    CalibrationFactor,
    LearnedPattern,
    TrainingRun,
    TrainingResult,
    ParlayCalibration,
    PlattMetrics,
} from '../../services/mlService';

type ActiveTab = 'audit' | 'calibration' | 'patterns' | 'parlays' | 'history';

const MLTrainingPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('audit');
    const [loading, setLoading] = useState(true);

    // Audit state
    const [auditDays, setAuditDays] = useState<DayAuditStatus[]>([]);
    const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
    const [auditRange, setAuditRange] = useState({ start: '', end: '' });

    // Calibration state
    const [factors, setFactors] = useState<CalibrationFactor[]>([]);
    const [factorFilter, setFactorFilter] = useState<string>('all');

    // Patterns state
    const [patterns, setPatterns] = useState<LearnedPattern[]>([]);

    // Parlay state
    const [parlayCalibration, setParlayCalibration] = useState<ParlayCalibration[]>([]);

    // History state
    const [history, setHistory] = useState<TrainingRun[]>([]);

    // System status
    const [systemStatus, setSystemStatus] = useState<{
        isEnabled: boolean;
        totalTrainingRuns: number;
        activeFactors: number;
        activePatterns: number;
        lastTrainingDate: string | null;
        totalPicksTrained: number;
    } | null>(null);

    // Platt state
    const [plattParams, setPlattParams] = useState<{ hasPlatt: boolean; A: number; B: number; sampleSize: number } | null>(null);

    // Training state
    const [isTraining, setIsTraining] = useState(false);
    const [trainingResult, setTrainingResult] = useState<TrainingResult | null>(null);
    const [rollbackingId, setRollbackingId] = useState<string | null>(null);

    // Default range: last 14 days
    useEffect(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 14);
        setAuditRange({
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
        });
    }, []);

    // Load data when tab or range changes
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const statusPromise = getMLSystemStatus();

            if (activeTab === 'audit' && auditRange.start && auditRange.end) {
                const [days, status] = await Promise.all([
                    getDateRangeAuditStatus(auditRange.start, auditRange.end),
                    statusPromise,
                ]);
                setAuditDays(days);
                setSystemStatus(status);
            } else if (activeTab === 'calibration') {
                const [f, status, pp] = await Promise.all([getCalibrationFactors(), statusPromise, getPlattParameters()]);
                setFactors(f);
                setSystemStatus(status);
                setPlattParams(pp);
            } else if (activeTab === 'patterns') {
                const [p, status] = await Promise.all([getLearnedPatterns(), statusPromise]);
                setPatterns(p);
                setSystemStatus(status);
            } else if (activeTab === 'parlays') {
                const [pc, status] = await Promise.all([getParlayCalibration(), statusPromise]);
                setParlayCalibration(pc);
                setSystemStatus(status);
            } else if (activeTab === 'history') {
                const [h, status] = await Promise.all([getTrainingHistory(), statusPromise]);
                setHistory(h);
                setSystemStatus(status);
            } else {
                setSystemStatus(await statusPromise);
            }
        } catch (err) {
            console.error('[MLTrainingPanel] Error loading data:', err);
        } finally {
            setLoading(false);
        }
    }, [activeTab, auditRange]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ── Date Selection ───────────────────────────────────────────────

    const toggleDateSelection = (date: string) => {
        setSelectedDates(prev => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date);
            else next.add(date);
            return next;
        });
    };

    const selectAllTrainable = () => {
        const trainable = auditDays
            .filter(d => d.isFullyVerified && !d.isAlreadyTrained && d.totalPicks > 0)
            .map(d => d.date);
        setSelectedDates(new Set(trainable));
    };

    // ── Training ─────────────────────────────────────────────────────

    const handleTrain = async () => {
        if (selectedDates.size === 0) return;
        setIsTraining(true);
        setTrainingResult(null);

        const result = await triggerTraining(Array.from(selectedDates));
        setTrainingResult(result);
        setIsTraining(false);

        if (result.success) {
            setSelectedDates(new Set());
            loadData();
        }
    };

    // ── Rollback ─────────────────────────────────────────────────────

    const handleRollback = async (runId: string) => {
        if (!confirm('Esto revertira los factores de calibracion al estado anterior a este entrenamiento. Continuar?')) return;
        setRollbackingId(runId);
        const result = await rollbackTraining(runId);
        setRollbackingId(null);
        if (result.success) {
            loadData();
        } else {
            alert(result.error || 'Error al revertir');
        }
    };

    // ── Render Helpers ───────────────────────────────────────────────

    const getDayBadge = (day: DayAuditStatus) => {
        if (day.isAlreadyTrained) {
            return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">Entrenado</span>;
        }
        if (day.totalPicks === 0) {
            return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">Sin picks</span>;
        }
        if (day.isFullyVerified) {
            return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Verificado</span>;
        }
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">{day.pendingPicks} pendiente{day.pendingPicks > 1 ? 's' : ''}</span>;
    };

    const getPatternBadge = (type: string) => {
        const map: Record<string, { bg: string; text: string; label: string }> = {
            blacklist: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Blacklist' },
            boost: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Boost' },
            warning: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Warning' },
            insight: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Insight' },
        };
        const style = map[type] || map.insight;
        return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>{style.label}</span>;
    };

    const getSeverityIcon = (severity: string) => {
        if (severity === 'critical') return <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />;
        if (severity === 'warning') return <ExclamationTriangleIcon className="w-4 h-4 text-amber-400" />;
        return <CheckCircleIcon className="w-4 h-4 text-blue-400" />;
    };

    const filteredFactors = factorFilter === 'all'
        ? factors
        : factors.filter(f => f.dimension === factorFilter);

    const dimensions = [...new Set(factors.map(f => f.dimension))];

    const trainableDays = auditDays.filter(d => d.isFullyVerified && !d.isAlreadyTrained && d.totalPicks > 0);
    const selectedTrainable = Array.from(selectedDates).filter(date => {
        const day = auditDays.find(d => d.date === date);
        return day?.isFullyVerified && !day?.isAlreadyTrained;
    });

    const tabs: { id: ActiveTab; label: string }[] = [
        { id: 'audit', label: 'Auditoria' },
        { id: 'calibration', label: 'Calibracion' },
        { id: 'patterns', label: 'Patrones' },
        { id: 'parlays', label: 'Parlays' },
        { id: 'history', label: 'Historial' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header + Status */}
            <div className="glass p-6 rounded-xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-800">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-display font-bold text-white flex items-center gap-3">
                        <BrainIcon className="w-6 h-6 text-cyan-400" />
                        ML Auto-Learning
                        <span className="text-xs font-normal text-slate-500 ml-2">(Audit: Picks {'\u2265'} 83%)</span>
                    </h2>
                    <button onClick={loadData} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Refrescar">
                        <ArrowPathIcon className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {systemStatus && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Entrenamientos</p>
                            <p className="text-lg font-bold text-white">{systemStatus.totalTrainingRuns}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Factores Activos</p>
                            <p className="text-lg font-bold text-cyan-400">{systemStatus.activeFactors}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Patrones</p>
                            <p className="text-lg font-bold text-amber-400">{systemStatus.activePatterns}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Picks Entrenados</p>
                            <p className="text-lg font-bold text-emerald-400">{systemStatus.totalPicksTrained}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Ultimo Entren.</p>
                            <p className="text-sm font-bold text-white">
                                {systemStatus.lastTrainingDate
                                    ? new Date(systemStatus.lastTrainingDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                                    : 'Nunca'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            activeTab === tab.id
                                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {loading ? (
                <div className="glass p-12 rounded-xl border border-white/5 text-center">
                    <ArrowPathIcon className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
                    <p className="text-slate-400">Cargando datos...</p>
                </div>
            ) : (
                <>
                    {/* ═══ AUDIT TAB ═══ */}
                    {activeTab === 'audit' && (
                        <div className="space-y-4">
                            {/* Date range selector */}
                            <div className="glass p-4 rounded-xl border border-white/5 flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-slate-400">Desde:</label>
                                    <input
                                        type="date"
                                        value={auditRange.start}
                                        onChange={e => setAuditRange(prev => ({ ...prev, start: e.target.value }))}
                                        className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:border-cyan-500 outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-slate-400">Hasta:</label>
                                    <input
                                        type="date"
                                        value={auditRange.end}
                                        onChange={e => setAuditRange(prev => ({ ...prev, end: e.target.value }))}
                                        className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:border-cyan-500 outline-none"
                                    />
                                </div>
                                <button
                                    onClick={selectAllTrainable}
                                    className="text-sm text-cyan-400 hover:text-cyan-300 underline transition-colors"
                                >
                                    Seleccionar todos los entrenables ({trainableDays.length})
                                </button>
                            </div>

                            {/* Day list */}
                            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 p-3 border-b border-white/5 bg-slate-800/50">
                                    <div className="w-8"></div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Fecha</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase text-center">Picks</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase text-center">WR</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase text-center">Estado</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase text-center">Entrenar</p>
                                </div>
                                {auditDays.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">No hay datos para este rango de fechas</div>
                                ) : (
                                    auditDays.map(day => {
                                        const isSelectable = day.isFullyVerified && !day.isAlreadyTrained && day.totalPicks > 0;
                                        const isSelected = selectedDates.has(day.date);
                                        const wr = (day.wonPicks + day.lostPicks) > 0
                                            ? ((day.wonPicks / (day.wonPicks + day.lostPicks)) * 100).toFixed(1)
                                            : '-';
                                        return (
                                            <div
                                                key={day.date}
                                                className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 items-center p-3 border-b border-white/5 last:border-0 transition-colors ${
                                                    isSelected ? 'bg-cyan-900/10' : 'hover:bg-white/2'
                                                }`}
                                            >
                                                <div className="w-8 flex justify-center">
                                                    {day.isAlreadyTrained ? (
                                                        <ShieldCheckIcon className="w-5 h-5 text-blue-400" />
                                                    ) : day.isFullyVerified ? (
                                                        <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                                                    ) : day.totalPicks > 0 ? (
                                                        <ClockIcon className="w-5 h-5 text-amber-400" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full bg-slate-700" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">
                                                        {new Date(day.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {day.wonPicks}W / {day.lostPicks}L / {day.voidPicks}V
                                                    </p>
                                                </div>
                                                <p className="text-sm text-center text-slate-300 min-w-[40px]">{day.totalPicks}</p>
                                                <p className={`text-sm text-center font-bold min-w-[50px] ${
                                                    parseFloat(wr) >= 65 ? 'text-emerald-400' :
                                                    parseFloat(wr) >= 50 ? 'text-amber-400' :
                                                    wr === '-' ? 'text-slate-500' : 'text-red-400'
                                                }`}>
                                                    {wr === '-' ? '-' : `${wr}%`}
                                                </p>
                                                <div className="flex justify-center">{getDayBadge(day)}</div>
                                                <div className="flex justify-center">
                                                    {isSelectable ? (
                                                        <button
                                                            onClick={() => toggleDateSelection(day.date)}
                                                            className={`w-6 h-6 rounded border-2 transition-all flex items-center justify-center ${
                                                                isSelected
                                                                    ? 'bg-cyan-500 border-cyan-400'
                                                                    : 'border-slate-600 hover:border-cyan-500'
                                                            }`}
                                                        >
                                                            {isSelected && (
                                                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <div className="w-6 h-6" />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Train Button */}
                            <div className="glass p-4 rounded-xl border border-white/5">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm text-slate-300">
                                            <span className="font-bold text-cyan-400">{selectedTrainable.length}</span> dia{selectedTrainable.length !== 1 ? 's' : ''} seleccionado{selectedTrainable.length !== 1 ? 's' : ''} para entrenamiento
                                        </p>
                                        {selectedTrainable.length > 0 && (
                                            <p className="text-xs text-slate-500 mt-1">
                                                Solo se procesaran dias completamente verificados que no hayan sido entrenados antes.
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleTrain}
                                        disabled={selectedTrainable.length === 0 || isTraining}
                                        className={`px-6 py-3 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                                            selectedTrainable.length > 0 && !isTraining
                                                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-500/20'
                                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        }`}
                                    >
                                        {isTraining ? (
                                            <>
                                                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                                Entrenando...
                                            </>
                                        ) : (
                                            <>
                                                <BrainIcon className="w-5 h-5" />
                                                Entrenar con datos seleccionados
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Training Result */}
                                {trainingResult && (
                                    <div className={`mt-4 p-4 rounded-lg border ${
                                        trainingResult.success
                                            ? 'bg-emerald-900/20 border-emerald-500/30'
                                            : 'bg-red-900/20 border-red-500/30'
                                    }`}>
                                        <div className="flex items-start gap-2">
                                            {trainingResult.success ? (
                                                <CheckCircleIcon className="w-5 h-5 text-emerald-400 mt-0.5" />
                                            ) : (
                                                <XCircleIcon className="w-5 h-5 text-red-400 mt-0.5" />
                                            )}
                                            <div>
                                                <p className={`font-bold text-sm ${trainingResult.success ? 'text-emerald-300' : 'text-red-300'}`}>
                                                    {trainingResult.success ? 'Entrenamiento completado' : 'Error en el entrenamiento'}
                                                </p>
                                                {trainingResult.success ? (
                                                    <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                                                        <p>{trainingResult.daysProcessed} dia{trainingResult.daysProcessed !== 1 ? 's' : ''} procesado{trainingResult.daysProcessed !== 1 ? 's' : ''}, {trainingResult.daysSkipped} omitido{trainingResult.daysSkipped !== 1 ? 's' : ''}</p>
                                                        <p>{trainingResult.totalPicksProcessed} picks analizados</p>
                                                        <p>{trainingResult.factorsUpdated} factores actualizados, {trainingResult.patternsGenerated} patrones generados</p>
                                                        {trainingResult.platt && trainingResult.platt.samples > 0 && (
                                                            <div className="mt-2 p-2 bg-slate-800/50 rounded border border-white/5">
                                                                <p className="font-bold text-cyan-300 mb-1">Platt Scaling (ventana 60 dias)</p>
                                                                <p>Parametros: A={trainingResult.platt.A.toFixed(4)}, B={trainingResult.platt.B.toFixed(4)} ({trainingResult.platt.samples} picks)</p>
                                                                <p>Brier Score: {trainingResult.platt.brier_before.toFixed(4)} → {trainingResult.platt.brier_after.toFixed(4)} {trainingResult.platt.brier_after < trainingResult.platt.brier_before ? '(mejora)' : '(sin cambio)'}</p>
                                                                <p>ECE: {(trainingResult.platt.ece_before * 100).toFixed(1)}% → {(trainingResult.platt.ece_after * 100).toFixed(1)}% {trainingResult.platt.ece_after < trainingResult.platt.ece_before ? '(mejora)' : '(sin cambio)'}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-red-400 mt-1">{trainingResult.error}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══ CALIBRATION TAB ═══ */}
                    {activeTab === 'calibration' && (
                        <div className="space-y-4">
                            {/* Platt Scaling Card */}
                            <div className="glass p-4 rounded-xl border border-white/5 bg-gradient-to-br from-cyan-950/30 to-slate-900">
                                <h3 className="text-sm font-bold text-cyan-300 mb-3 flex items-center gap-2">
                                    <ChartBarIcon className="w-4 h-4" />
                                    Platt Scaling V4 (Calibracion Bidireccional)
                                </h3>
                                {plattParams ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                                            <p className="text-xs text-slate-500 uppercase">Param A</p>
                                            <p className="text-lg font-bold text-white">{plattParams.A.toFixed(4)}</p>
                                            <p className="text-xs text-slate-500">{plattParams.A > 1.05 ? 'Comprime probs' : plattParams.A < 0.95 ? 'Expande probs' : 'Neutro'}</p>
                                        </div>
                                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                                            <p className="text-xs text-slate-500 uppercase">Param B</p>
                                            <p className="text-lg font-bold text-white">{plattParams.B.toFixed(4)}</p>
                                            <p className="text-xs text-slate-500">{plattParams.B > 0.05 ? 'Reduce todas' : plattParams.B < -0.05 ? 'Sube todas' : 'Neutro'}</p>
                                        </div>
                                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                                            <p className="text-xs text-slate-500 uppercase">Picks en ventana</p>
                                            <p className="text-lg font-bold text-cyan-400">{plattParams.sampleSize}</p>
                                            <p className="text-xs text-slate-500">{plattParams.sampleSize >= 50 ? 'Platt ACTIVO' : `Faltan ${50 - plattParams.sampleSize} picks`}</p>
                                        </div>
                                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                                            <p className="text-xs text-slate-500 uppercase">Estado</p>
                                            <p className={`text-lg font-bold ${plattParams.sampleSize >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                {plattParams.sampleSize >= 50 ? 'Activo' : 'Acumulando'}
                                            </p>
                                            <p className="text-xs text-slate-500">Ventana: 60 dias</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-500 p-3 bg-slate-800/30 rounded-lg">
                                        Sin parametros Platt. Ejecuta un entrenamiento con al menos 50 picks verificados para activar la calibracion bidireccional.
                                    </div>
                                )}

                                {plattParams && plattParams.sampleSize >= 50 && (
                                    <div className="mt-3 p-3 bg-slate-800/30 rounded-lg">
                                        <p className="text-xs text-slate-400 mb-2 font-bold">Simulacion de impacto (Platt puro, sin dimensiones):</p>
                                        <div className="flex flex-wrap gap-3">
                                            {[75, 80, 83, 85, 88, 90, 95].map(prob => {
                                                const epsilon = 1e-7;
                                                const p = Math.max(epsilon, Math.min(1 - epsilon, prob / 100));
                                                const logit = Math.log(p / (1 - p));
                                                const expVal = Math.exp(Math.max(-50, Math.min(50, plattParams.A * logit + plattParams.B)));
                                                const calibrated = Math.max(1, Math.min(99, (1 / (1 + expVal)) * 100));
                                                const delta = calibrated - prob;
                                                const cappedDelta = Math.max(-8, Math.min(8, delta));
                                                const final_ = Math.round((prob + cappedDelta) * 10) / 10;
                                                return (
                                                    <div key={prob} className="text-center">
                                                        <p className="text-xs text-slate-500">{prob}%</p>
                                                        <p className={`text-sm font-bold ${cappedDelta > 0.3 ? 'text-emerald-400' : cappedDelta < -0.3 ? 'text-amber-400' : 'text-slate-300'}`}>
                                                            {cappedDelta >= 0 ? '+' : ''}{cappedDelta.toFixed(1)}
                                                        </p>
                                                        <p className="text-xs text-white font-medium">{final_}%</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Dimension filter */}
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setFactorFilter('all')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        factorFilter === 'all' ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:bg-white/5 border border-transparent'
                                    }`}
                                >
                                    Todas ({factors.length})
                                </button>
                                {dimensions.map(dim => (
                                    <button
                                        key={dim}
                                        onClick={() => setFactorFilter(dim)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            factorFilter === dim ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:bg-white/5 border border-transparent'
                                        }`}
                                    >
                                        {dim} ({factors.filter(f => f.dimension === dim).length})
                                    </button>
                                ))}
                            </div>

                            {/* Factors table */}
                            <div className="glass rounded-xl border border-white/5 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-slate-800/50">
                                            <th className="text-left p-3 text-xs text-slate-400 uppercase">Dimension</th>
                                            <th className="text-left p-3 text-xs text-slate-400 uppercase">Clave</th>
                                            <th className="text-center p-3 text-xs text-slate-400 uppercase">Muestra</th>
                                            <th className="text-center p-3 text-xs text-slate-400 uppercase">WR Real</th>
                                            <th className="text-center p-3 text-xs text-slate-400 uppercase">WR Predicho</th>
                                            <th className="text-center p-3 text-xs text-slate-400 uppercase">Gap</th>
                                            <th className="text-center p-3 text-xs text-slate-400 uppercase">Direccion</th>
                                            <th className="text-center p-3 text-xs text-slate-400 uppercase">ROI</th>
                                            <th className="text-center p-3 text-xs text-slate-400 uppercase">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredFactors.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="p-8 text-center text-slate-500">
                                                    {factors.length === 0
                                                        ? 'No hay factores de calibracion. Ejecuta el primer entrenamiento para generarlos.'
                                                        : 'No hay factores en esta dimension.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredFactors.filter(f => f.dimension !== 'platt').map(f => {
                                                const gap = f.predicted_avg - f.actual_wr;
                                                const absGap = Math.abs(gap);
                                                const isOverconfident = gap > 0;
                                                const gapColor = absGap < 3 ? 'text-emerald-400'
                                                    : absGap < 8 ? 'text-amber-400'
                                                    : 'text-red-400';
                                                // Direction: overconfident→will reduce, underconfident→will INCREASE
                                                const dirLabel = absGap < 3 ? 'Neutro'
                                                    : isOverconfident ? 'Reducira'
                                                    : 'Subira';
                                                const dirColor = absGap < 3 ? 'text-slate-400'
                                                    : isOverconfident ? 'text-amber-400'
                                                    : 'text-emerald-400';
                                                const dirArrow = absGap < 3 ? '=' : isOverconfident ? '\u2193' : '\u2191';
                                                return (
                                                    <tr key={f.id} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                                                        <td className="p-3 text-slate-400 text-xs">{f.dimension}</td>
                                                        <td className="p-3 text-white font-medium">{f.dimension_key}</td>
                                                        <td className="p-3 text-center text-slate-300">{f.sample_size}</td>
                                                        <td className={`p-3 text-center font-bold ${f.actual_wr >= 65 ? 'text-emerald-400' : f.actual_wr >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                                            {f.actual_wr.toFixed(1)}%
                                                        </td>
                                                        <td className="p-3 text-center text-slate-300">{f.predicted_avg.toFixed(1)}%</td>
                                                        <td className={`p-3 text-center font-bold ${gapColor}`}>
                                                            {gap > 0 ? '+' : ''}{gap.toFixed(1)}pts
                                                        </td>
                                                        <td className={`p-3 text-center font-bold ${dirColor}`}>
                                                            <span className="text-lg">{dirArrow}</span> <span className="text-xs">{dirLabel}</span>
                                                        </td>
                                                        <td className={`p-3 text-center font-medium ${(f.roi || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {f.roi != null ? `${f.roi > 0 ? '+' : ''}${f.roi.toFixed(1)}%` : '-'}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <button
                                                                onClick={() => toggleCalibrationFactor(f.id, f.status === 'active' ? 'disabled' : 'active').then(() => loadData())}
                                                                className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                                                                    f.status === 'active'
                                                                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-red-500/20 hover:text-red-300'
                                                                        : 'bg-slate-600/20 text-slate-500 hover:bg-emerald-500/20 hover:text-emerald-300'
                                                                }`}
                                                            >
                                                                {f.status === 'active' ? 'Activo' : 'Inactivo'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ═══ PATTERNS TAB ═══ */}
                    {activeTab === 'patterns' && (
                        <div className="space-y-3">
                            {patterns.length === 0 ? (
                                <div className="glass p-8 rounded-xl border border-white/5 text-center text-slate-500">
                                    No hay patrones aprendidos. Los patrones se generan automaticamente durante el entrenamiento.
                                </div>
                            ) : (
                                patterns.map(p => (
                                    <div key={p.id} className={`glass p-4 rounded-xl border transition-all ${
                                        p.active ? 'border-white/10' : 'border-white/5 opacity-50'
                                    }`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3 flex-1">
                                                {getSeverityIcon(p.severity)}
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {getPatternBadge(p.pattern_type)}
                                                        <span className="text-xs text-slate-500">{p.scope}: {p.scope_key}</span>
                                                    </div>
                                                    <p className="text-sm text-white">{p.rule_text}</p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Muestra: {p.based_on_sample} picks
                                                        {p.based_on_wr != null && ` | WR: ${p.based_on_wr.toFixed(1)}%`}
                                                        {' | '}
                                                        {new Date(p.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => togglePattern(p.id, !p.active).then(() => loadData())}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                                    p.active
                                                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-red-500/20 hover:text-red-300'
                                                        : 'bg-slate-600/20 text-slate-500 hover:bg-emerald-500/20 hover:text-emerald-300'
                                                }`}
                                            >
                                                {p.active ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* ═══ PARLAYS TAB ═══ */}
                    {activeTab === 'parlays' && (
                        <div className="glass rounded-xl border border-white/5 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5 bg-slate-800/50">
                                        <th className="text-left p-3 text-xs text-slate-400 uppercase">Legs</th>
                                        <th className="text-left p-3 text-xs text-slate-400 uppercase">Riesgo</th>
                                        <th className="text-center p-3 text-xs text-slate-400 uppercase">Muestra</th>
                                        <th className="text-center p-3 text-xs text-slate-400 uppercase">WR</th>
                                        <th className="text-center p-3 text-xs text-slate-400 uppercase">Cuota Prom</th>
                                        <th className="text-center p-3 text-xs text-slate-400 uppercase">ROI</th>
                                        <th className="text-center p-3 text-xs text-slate-400 uppercase">Max Legs Rec.</th>
                                        <th className="text-center p-3 text-xs text-slate-400 uppercase">Min Prob Leg</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parlayCalibration.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-slate-500">
                                                No hay datos de calibracion de parlays. Se generaran con el entrenamiento.
                                            </td>
                                        </tr>
                                    ) : (
                                        parlayCalibration.map(pc => (
                                            <tr key={pc.id} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                                                <td className="p-3 text-white font-bold">{pc.legs_count}</td>
                                                <td className="p-3 text-slate-300 capitalize">{pc.risk_level}</td>
                                                <td className="p-3 text-center text-slate-300">{pc.sample_size}</td>
                                                <td className={`p-3 text-center font-bold ${pc.actual_wr >= 40 ? 'text-emerald-400' : pc.actual_wr >= 25 ? 'text-amber-400' : 'text-red-400'}`}>
                                                    {pc.actual_wr.toFixed(1)}%
                                                </td>
                                                <td className="p-3 text-center text-slate-300">{pc.avg_odds?.toFixed(2) || '-'}</td>
                                                <td className={`p-3 text-center font-medium ${(pc.roi || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {pc.roi != null ? `${pc.roi > 0 ? '+' : ''}${pc.roi.toFixed(1)}%` : '-'}
                                                </td>
                                                <td className="p-3 text-center text-cyan-400 font-bold">{pc.recommended_max_legs || '-'}</td>
                                                <td className="p-3 text-center text-cyan-400 font-bold">{pc.recommended_min_leg_prob ? `${pc.recommended_min_leg_prob}%` : '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ═══ HISTORY TAB ═══ */}
                    {activeTab === 'history' && (
                        <div className="space-y-3">
                            {history.length === 0 ? (
                                <div className="glass p-8 rounded-xl border border-white/5 text-center text-slate-500">
                                    No hay historial de entrenamientos.
                                </div>
                            ) : (
                                history.map(run => (
                                    <div key={run.id} className={`glass p-4 rounded-xl border transition-all ${
                                        run.status === 'rolled_back' ? 'border-red-500/20 opacity-60' : 'border-white/10'
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {run.status === 'completed' ? (
                                                    <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                                                ) : (
                                                    <XCircleIcon className="w-5 h-5 text-red-400" />
                                                )}
                                                <div>
                                                    <p className="text-sm font-bold text-white">
                                                        {new Date(run.training_date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {run.picks_processed} picks ({run.picks_won}W / {run.picks_lost}L / {run.picks_void}V)
                                                        {' | '}
                                                        {new Date(run.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {run.status === 'rolled_back' && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-300">Revertido</span>
                                                )}
                                                {run.status === 'completed' && (
                                                    <button
                                                        onClick={() => handleRollback(run.id)}
                                                        disabled={rollbackingId === run.id}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 text-slate-300 hover:bg-red-600/20 hover:text-red-300 transition-all"
                                                    >
                                                        {rollbackingId === run.id ? (
                                                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            'Revertir'
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MLTrainingPanel;
