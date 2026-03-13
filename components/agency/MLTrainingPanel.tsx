import React, { useState, useEffect, useCallback } from 'react';
import {
    BrainIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    XCircleIcon,
    LightBulbIcon,
} from '../icons/Icons';
import {
    getPoolCount,
    getInsightPool,
    getStrategicInsights,
    getBatchHistory,
    getStrategicSystemStatus,
    triggerStrategicTraining,
    toggleInsight,
    deactivateBatch,
    emergencyReset,
} from '../../services/mlService';
import type {
    PoolPick,
    StrategicInsight,
    TrainingBatch,
    StrategicTrainingResult,
} from '../../services/mlService';

type ActiveTab = 'pool' | 'insights' | 'train' | 'history' | 'reset';

const MIN_PICKS_FOR_TRAINING = 20;

const MLTrainingPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('pool');
    const [loading, setLoading] = useState(true);

    // System status
    const [status, setStatus] = useState<{
        insightsEnabled: boolean;
        poolCount: number;
        activeInsights: number;
        totalBatches: number;
        totalPicksTrained: number;
        lastBatchDate: string | null;
    } | null>(null);

    // Pool state
    const [poolPicks, setPoolPicks] = useState<PoolPick[]>([]);
    const [poolStats, setPoolStats] = useState({ total: 0, won: 0, lost: 0 });

    // Insights state
    const [insights, setInsights] = useState<StrategicInsight[]>([]);
    const [insightFilter, setInsightFilter] = useState<string>('all');

    // History state
    const [batches, setBatches] = useState<TrainingBatch[]>([]);

    // Training state
    const [isTraining, setIsTraining] = useState(false);
    const [trainingResult, setTrainingResult] = useState<StrategicTrainingResult | null>(null);

    // Reset state
    const [isResetting, setIsResetting] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const statusPromise = getStrategicSystemStatus();

            if (activeTab === 'pool') {
                const [pool, stats, s] = await Promise.all([getInsightPool(), getPoolCount(), statusPromise]);
                setPoolPicks(pool);
                setPoolStats(stats);
                setStatus(s);
            } else if (activeTab === 'insights') {
                const [ins, s] = await Promise.all([getStrategicInsights(), statusPromise]);
                setInsights(ins);
                setStatus(s);
            } else if (activeTab === 'train') {
                const [stats, s] = await Promise.all([getPoolCount(), statusPromise]);
                setPoolStats(stats);
                setStatus(s);
            } else if (activeTab === 'history') {
                const [b, s] = await Promise.all([getBatchHistory(), statusPromise]);
                setBatches(b);
                setStatus(s);
            } else {
                setStatus(await statusPromise);
            }
        } catch (err) {
            console.error('[MLTrainingPanel] Error loading data:', err);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ── Handlers ──────────────────────────────────────────────────────

    const handleTrain = async () => {
        setIsTraining(true);
        setTrainingResult(null);
        const result = await triggerStrategicTraining();
        setTrainingResult(result);
        setIsTraining(false);
        if (result.success) loadData();
    };

    const handleDeactivateBatch = async (batchId: string) => {
        if (!confirm('Esto desactivara todos los insights de este lote. Continuar?')) return;
        const ok = await deactivateBatch(batchId);
        if (ok) loadData();
        else alert('Error al desactivar el lote');
    };

    const handleReset = async () => {
        if (!confirm('RESTABLECER A GEMINI PURO: Se desactivaran TODOS los insights y se apagara el toggle. Continuar?')) return;
        setIsResetting(true);
        const result = await emergencyReset();
        setIsResetting(false);
        if (result.success) {
            alert('Sistema restablecido a Gemini Puro correctamente.');
            loadData();
        } else {
            alert(result.error || 'Error al restablecer');
        }
    };

    // ── Render Helpers ────────────────────────────────────────────────

    const getInsightTypeBadge = (type: string) => {
        const map: Record<string, { bg: string; text: string; label: string }> = {
            winning_pattern: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Patron Ganador' },
            losing_pattern: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Trampa Analitica' },
            market_insight: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Mercado' },
            league_insight: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Liga' },
            methodology_insight: { bg: 'bg-violet-500/20', text: 'text-violet-300', label: 'Metodologia' },
        };
        const style = map[type] || map.methodology_insight;
        return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>{style.label}</span>;
    };

    const progressPercent = Math.min(100, (poolStats.total / MIN_PICKS_FOR_TRAINING) * 100);

    const filteredInsights = insightFilter === 'all'
        ? insights
        : insights.filter(i => i.insight_type === insightFilter);

    const insightTypes = [...new Set(insights.map(i => i.insight_type))];

    const tabs: { id: ActiveTab; label: string }[] = [
        { id: 'pool', label: `Pool (${status?.poolCount ?? '...'})` },
        { id: 'insights', label: `Aprendizajes (${status?.activeInsights ?? '...'})` },
        { id: 'train', label: 'Entrenar' },
        { id: 'history', label: 'Historial' },
        { id: 'reset', label: 'Restablecer' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header + Status */}
            <div className="glass p-6 rounded-xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-800">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-display font-bold text-white flex items-center gap-3">
                        <LightBulbIcon className="w-6 h-6 text-violet-400" />
                        Aprendizajes Estrategicos
                    </h2>
                    <button onClick={loadData} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Refrescar">
                        <ArrowPathIcon className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {status && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Estado</p>
                            <p className={`text-lg font-bold ${status.insightsEnabled ? 'text-violet-400' : 'text-slate-500'}`}>
                                {status.insightsEnabled ? 'Activo' : 'Desactivado'}
                            </p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Pool</p>
                            <p className="text-lg font-bold text-cyan-400">{status.poolCount}/{MIN_PICKS_FOR_TRAINING}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Insights Activos</p>
                            <p className="text-lg font-bold text-emerald-400">{status.activeInsights}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Lotes</p>
                            <p className="text-lg font-bold text-white">{status.totalBatches}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Picks Analizados</p>
                            <p className="text-lg font-bold text-amber-400">{status.totalPicksTrained}</p>
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
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                            activeTab === tab.id
                                ? tab.id === 'reset'
                                    ? 'bg-red-600/20 text-red-300 border border-red-500/30'
                                    : 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
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
                    <ArrowPathIcon className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-3" />
                    <p className="text-slate-400">Cargando datos...</p>
                </div>
            ) : (
                <>
                    {/* ═══ POOL TAB ═══ */}
                    {activeTab === 'pool' && (
                        <div className="space-y-4">
                            {/* Progress bar */}
                            <div className="glass p-4 rounded-xl border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm text-slate-300">
                                        <span className="font-bold text-cyan-400">{poolStats.total}</span> / {MIN_PICKS_FOR_TRAINING} picks listos
                                        <span className="text-slate-500 ml-2">({poolStats.won}W / {poolStats.lost}L)</span>
                                    </p>
                                    {poolStats.total >= MIN_PICKS_FOR_TRAINING ? (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            Listo para entrenar
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-500">
                                            Faltan {MIN_PICKS_FOR_TRAINING - poolStats.total} picks
                                        </span>
                                    )}
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-3">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-500 ${
                                            progressPercent >= 100 ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-gradient-to-r from-violet-500 to-cyan-500'
                                        }`}
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Los picks se agregan automaticamente cuando el verificador de resultados marca un pick como WON o LOST (con probabilidad {'\u2265'} 83%).
                                </p>
                            </div>

                            {/* Pool list */}
                            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 p-3 border-b border-white/5 bg-slate-800/50">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Partido</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase text-center">Mercado</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase text-center">Prob</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase text-center">Resultado</p>
                                </div>
                                {poolPicks.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">
                                        El pool esta vacio. Los picks se agregan automaticamente cuando se verifican.
                                    </div>
                                ) : (
                                    poolPicks.slice(0, 50).map(pick => (
                                        <div key={pick.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center p-3 border-b border-white/5 last:border-0 hover:bg-white/2">
                                            <div>
                                                <p className="text-sm text-white">{pick.home_team || '?'} vs {pick.away_team || '?'}</p>
                                                <p className="text-xs text-slate-500">{pick.league_name || 'Liga desconocida'} {pick.match_date ? `| ${pick.match_date}` : ''}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-slate-300">{pick.market}</p>
                                                <p className="text-xs text-slate-500">{pick.selection}</p>
                                            </div>
                                            <p className="text-sm text-center font-bold text-cyan-400">{(Number(pick.p_model) * 100).toFixed(0)}%</p>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-center ${
                                                pick.result === 'WON' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                                            }`}>
                                                {pick.result}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══ INSIGHTS TAB ═══ */}
                    {activeTab === 'insights' && (
                        <div className="space-y-4">
                            {/* Filter */}
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setInsightFilter('all')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        insightFilter === 'all' ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:bg-white/5 border border-transparent'
                                    }`}
                                >
                                    Todos ({insights.length})
                                </button>
                                {insightTypes.map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setInsightFilter(type)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            insightFilter === type ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:bg-white/5 border border-transparent'
                                        }`}
                                    >
                                        {type.replace('_', ' ')} ({insights.filter(i => i.insight_type === type).length})
                                    </button>
                                ))}
                            </div>

                            {/* Insights list */}
                            {filteredInsights.length === 0 ? (
                                <div className="glass p-8 rounded-xl border border-white/5 text-center text-slate-500">
                                    No hay aprendizajes generados. Entrena con al menos {MIN_PICKS_FOR_TRAINING} picks verificados.
                                </div>
                            ) : (
                                filteredInsights.map(ins => (
                                    <div key={ins.id} className={`glass p-4 rounded-xl border transition-all ${
                                        ins.active ? 'border-white/10' : 'border-white/5 opacity-50'
                                    }`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    {getInsightTypeBadge(ins.insight_type)}
                                                    <span className="text-xs text-slate-500">
                                                        Confianza: {(ins.confidence_score * 100).toFixed(0)}% | Base: {ins.based_on_picks} picks ({ins.based_on_won}W/{ins.based_on_lost}L)
                                                    </span>
                                                </div>
                                                <p className="text-sm text-white font-medium">{ins.insight_text}</p>
                                                {ins.insight_context && (
                                                    <p className="text-xs text-slate-400 mt-1">{ins.insight_context}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => toggleInsight(ins.id, !ins.active).then(() => loadData())}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                                    ins.active
                                                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-red-500/20 hover:text-red-300'
                                                        : 'bg-slate-600/20 text-slate-500 hover:bg-emerald-500/20 hover:text-emerald-300'
                                                }`}
                                            >
                                                {ins.active ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* ═══ TRAIN TAB ═══ */}
                    {activeTab === 'train' && (
                        <div className="space-y-4">
                            <div className="glass p-6 rounded-xl border border-white/5">
                                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    <BrainIcon className="w-5 h-5 text-violet-400" />
                                    Generar Aprendizajes
                                </h3>
                                <p className="text-sm text-slate-400 mb-4">
                                    Analiza los picks verificados en el pool y extrae patrones cualitativos usando Gemini.
                                    Requiere al menos {MIN_PICKS_FOR_TRAINING} picks verificados.
                                </p>

                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                                            poolStats.total >= MIN_PICKS_FOR_TRAINING
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        }`}>
                                            {poolStats.total} / {MIN_PICKS_FOR_TRAINING} picks
                                        </div>
                                        <span className="text-xs text-slate-500">({poolStats.won}W / {poolStats.lost}L)</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleTrain}
                                    disabled={poolStats.total < MIN_PICKS_FOR_TRAINING || isTraining}
                                    className={`w-full px-6 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                                        poolStats.total >= MIN_PICKS_FOR_TRAINING && !isTraining
                                            ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500 shadow-lg shadow-violet-500/20'
                                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    }`}
                                >
                                    {isTraining ? (
                                        <>
                                            <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                            Analizando patrones con Gemini...
                                        </>
                                    ) : (
                                        <>
                                            <LightBulbIcon className="w-5 h-5" />
                                            Generar Aprendizajes Estrategicos
                                        </>
                                    )}
                                </button>

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
                                            <div className="flex-1">
                                                <p className={`font-bold text-sm ${trainingResult.success ? 'text-emerald-300' : 'text-red-300'}`}>
                                                    {trainingResult.success ? `Lote #${trainingResult.batch_number} completado` : 'Error en el entrenamiento'}
                                                </p>
                                                {trainingResult.success ? (
                                                    <div className="text-xs text-slate-400 mt-2 space-y-1">
                                                        <p>{trainingResult.picks_analyzed} picks analizados ({trainingResult.picks_won}W / {trainingResult.picks_lost}L)</p>
                                                        <p className="font-bold text-violet-300">{trainingResult.insights_generated} insights generados</p>
                                                        {trainingResult.summary && (
                                                            <p className="text-slate-300 mt-2 italic">"{trainingResult.summary}"</p>
                                                        )}
                                                        {trainingResult.insights && trainingResult.insights.length > 0 && (
                                                            <div className="mt-3 space-y-1">
                                                                {trainingResult.insights.map((ins, i) => (
                                                                    <div key={i} className="flex items-start gap-2">
                                                                        <span className="text-violet-400 mt-0.5">-</span>
                                                                        <span className="text-slate-300">{ins.text}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <p className="text-slate-500 mt-2">
                                                            Modelo: {trainingResult.model_used} | {trainingResult.elapsed_ms}ms
                                                        </p>
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

                    {/* ═══ HISTORY TAB ═══ */}
                    {activeTab === 'history' && (
                        <div className="space-y-3">
                            {batches.length === 0 ? (
                                <div className="glass p-8 rounded-xl border border-white/5 text-center text-slate-500">
                                    No hay lotes de entrenamiento.
                                </div>
                            ) : (
                                batches.map(batch => (
                                    <div key={batch.id} className={`glass p-4 rounded-xl border transition-all ${
                                        batch.status === 'deactivated' ? 'border-red-500/20 opacity-60' : 'border-white/10'
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {batch.status === 'completed' ? (
                                                    <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                                                ) : (
                                                    <XCircleIcon className="w-5 h-5 text-red-400" />
                                                )}
                                                <div>
                                                    <p className="text-sm font-bold text-white">
                                                        Lote #{batch.batch_number}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {batch.picks_analyzed} picks ({batch.picks_won}W / {batch.picks_lost}L) | {batch.insights_generated} insights
                                                        {' | '}
                                                        {new Date(batch.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {batch.status === 'deactivated' && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-300">Desactivado</span>
                                                )}
                                                {batch.status === 'completed' && (
                                                    <button
                                                        onClick={() => handleDeactivateBatch(batch.id)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 text-slate-300 hover:bg-red-600/20 hover:text-red-300 transition-all"
                                                    >
                                                        Desactivar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* ═══ RESET TAB ═══ */}
                    {activeTab === 'reset' && (
                        <div className="glass p-6 rounded-xl border border-red-500/20 bg-gradient-to-br from-red-950/20 to-slate-900">
                            <div className="flex items-start gap-3 mb-4">
                                <ExclamationTriangleIcon className="w-6 h-6 text-red-400 mt-0.5" />
                                <div>
                                    <h3 className="text-lg font-bold text-red-300">Restablecer a Gemini Puro</h3>
                                    <p className="text-sm text-slate-400 mt-1">
                                        Esta accion desactiva TODOS los insights estrategicos y apaga el toggle.
                                        El sistema volvera a funcionar como si no hubiera ningun entrenamiento.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5 mb-4">
                                <p className="text-sm text-white font-medium mb-2">Esto hara:</p>
                                <ul className="text-xs text-slate-400 space-y-1">
                                    <li>- Desactivar todos los insights estrategicos ({status?.activeInsights || 0} activos actualmente)</li>
                                    <li>- Marcar todos los lotes como "desactivados"</li>
                                    <li>- Apagar el toggle "Aprendizajes Estrategicos" en Operations Center</li>
                                    <li>- El pool de picks NO se borra (se pueden re-entrenar despues)</li>
                                </ul>
                            </div>

                            <button
                                onClick={handleReset}
                                disabled={isResetting}
                                className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                                    !isResetting
                                        ? 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-500/20'
                                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                            >
                                {isResetting ? (
                                    <>
                                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                        Restableciendo...
                                    </>
                                ) : (
                                    <>
                                        <ExclamationTriangleIcon className="w-5 h-5" />
                                        Restablecer a Gemini Puro
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MLTrainingPanel;
