import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';
import {
    BrainIcon,
    TrendingUpIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ChartBarIcon,
    LightBulbIcon,
    ArrowPathIcon,
    PlayIcon,
    SparklesIcon,
    LockClosedIcon
} from '../icons/Icons';
import { useSubscriptionLimits } from '../../hooks/useSubscriptionLimits';
import { useNavigate } from 'react-router-dom';
import { getV1VsV2Comparison, ModelVersionStats } from '../../services/modelVersionStatsService';

interface LearnedLesson {
    id: string;
    failure_category: string;
    overvalued_factors: string[];
    missing_context: string[];
    ideal_confidence: number;
    lesson_text: string;
    created_at: string;
}

interface MLStats {
    totalPredictions: number;
    verified: number;
    pending: number;
    correctCount: number;
    incorrectCount: number;
    winRate: number;
    avgConfidenceError: number;
    lessonsGenerated: number;
}

interface ModelVersion {
    version_name: string;
    traffic_percentage: number;
    is_active: boolean;
}

export default function MLDashboard() {
    const navigate = useNavigate();
    const { subscription, loading: subLoading, isPro, isPremium, isAdmin } = useSubscriptionLimits();

    const [stats, setStats] = useState<MLStats | null>(null);
    const [lessons, setLessons] = useState<LearnedLesson[]>([]);
    const [versions, setVersions] = useState<ModelVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // NEW: Stats por versión del modelo
    const [statsV1, setStatsV1] = useState<ModelVersionStats | null>(null);
    const [statsV2, setStatsV2] = useState<ModelVersionStats | null>(null);
    const [versionComparison, setVersionComparison] = useState<{
        accuracyDiff: number;
        betterVersion: 'v1-stable' | 'v2-learning' | 'tie';
        isSignificant: boolean;
    } | null>(null);

    // Verificar acceso (incluye Admin)
    const hasAccess = isAdmin || isPro || isPremium;

    useEffect(() => {
        if (hasAccess) {
            loadData();
        }
    }, [hasAccess]);

    // Si no tiene acceso, mostrar página de upgrade
    if (!subLoading && !hasAccess) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center p-8">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-tr from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30">
                        <LockClosedIcon className="w-10 h-10 text-amber-500" />
                    </div>

                    <h2 className="text-3xl font-black text-white mb-4">
                        ML Dashboard Exclusivo
                    </h2>

                    <p className="text-slate-400 mb-6">
                        El Machine Learning Dashboard está disponible exclusivamente para usuarios con planes <span className="text-brand font-bold">Pro</span> y <span className="text-purple-400 font-bold">Premium</span>.
                    </p>

                    <div className="bg-slate-800/50 rounded-xl p-4 mb-6 text-left border border-white/5">
                        <p className="text-sm text-slate-400 mb-3 font-medium">Con el ML Dashboard podrás:</p>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2 text-slate-300">
                                <CheckCircleIcon className="w-4 h-4 text-brand" />
                                Ver estadísticas de predicciones
                            </li>
                            <li className="flex items-center gap-2 text-slate-300">
                                <CheckCircleIcon className="w-4 h-4 text-brand" />
                                Analizar lecciones aprendidas por la IA
                            </li>
                            <li className="flex items-center gap-2 text-slate-300">
                                <CheckCircleIcon className="w-4 h-4 text-brand" />
                                Ejecutar ciclos de aprendizaje automático
                            </li>
                            <li className="flex items-center gap-2 text-slate-300">
                                <CheckCircleIcon className="w-4 h-4 text-brand" />
                                Monitorear versiones del modelo
                            </li>
                        </ul>
                    </div>

                    <button
                        onClick={() => navigate('/pricing')}
                        className="px-8 py-3 bg-gradient-to-r from-brand to-emerald-400 text-slate-900 font-bold rounded-xl hover:shadow-lg hover:shadow-brand/30 transition-all flex items-center gap-2 mx-auto"
                    >
                        <SparklesIcon className="w-5 h-5" />
                        Actualizar Plan
                    </button>

                    <p className="text-xs text-slate-500 mt-4">
                        Tu plan actual: <span className="text-slate-300 font-medium">{subscription?.displayName || 'Gratis'}</span>
                    </p>
                </div>
            </div>
        );
    }

    const loadData = async () => {
        setLoading(true);
        try {
            // Cargar estadísticas
            const { count: total } = await supabase.from('predictions').select('*', { count: 'exact', head: true });
            const { count: verified } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).not('is_won', 'is', null);
            const { count: pending } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).is('is_won', null);

            const { data: results } = await supabase.from('predictions_results').select('was_correct, confidence_delta');
            const correctCount = results?.filter(r => r.was_correct).length || 0;
            const incorrectCount = results?.filter(r => !r.was_correct).length || 0;
            const avgError = results?.reduce((sum, r) => sum + (r.confidence_delta || 0), 0) / (results?.length || 1);

            const { count: lessonsCount } = await supabase.from('learned_lessons').select('*', { count: 'exact', head: true });

            setStats({
                totalPredictions: total || 0,
                verified: verified || 0,
                pending: pending || 0,
                correctCount,
                incorrectCount,
                winRate: results?.length ? (correctCount / results.length) * 100 : 0,
                avgConfidenceError: avgError || 0,
                lessonsGenerated: lessonsCount || 0
            });

            // Cargar lecciones
            const { data: lessonsData } = await supabase
                .from('learned_lessons')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
            setLessons(lessonsData || []);

            // Cargar versiones de modelo
            const { data: versionsData } = await supabase
                .from('model_versions')
                .select('version_name, traffic_percentage, is_active')
                .eq('is_active', true);
            setVersions(versionsData || []);

            // NEW: Cargar comparación v1 vs v2
            const comparison = await getV1VsV2Comparison();
            setStatsV1(comparison.v1);
            setStatsV2(comparison.v2);
            setVersionComparison(comparison.difference);

        } catch (error) {
            console.error('Error loading ML data:', error);
        }
        setLoading(false);
    };

    const runAction = async (action: string) => {
        setActionLoading(action);
        try {
            const response = await fetch(
                `https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/${action}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const result = await response.json();
            console.log(`${action} result:`, result);
            await loadData(); // Recargar datos
        } catch (error) {
            console.error(`Error running ${action}:`, error);
        }
        setActionLoading(null);
    };

    const startABTest = async (testSplit: number) => {
        setActionLoading('ab-test');
        try {
            // Actualizar porcentajes de tráfico
            await supabase.from('model_versions').update({ traffic_percentage: 100 - testSplit }).eq('version_name', 'v1-stable');
            await supabase.from('model_versions').update({ traffic_percentage: testSplit }).eq('version_name', 'v2-learning');
            await loadData();
        } catch (error) {
            console.error('Error starting A/B test:', error);
        }
        setActionLoading(null);
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'STATISTICAL': return 'bg-blue-500/20 text-blue-400';
            case 'TACTICAL': return 'bg-purple-500/20 text-purple-400';
            case 'CONTEXTUAL': return 'bg-yellow-500/20 text-yellow-400';
            case 'OVERCONFIDENCE': return 'bg-red-500/20 text-red-400';
            case 'UNEXPECTED_EVENT': return 'bg-orange-500/20 text-orange-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <ArrowPathIcon className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BrainIcon className="w-8 h-8 text-emerald-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-white">Sistema de Aprendizaje ML</h1>
                        <p className="text-gray-400 text-sm">Análisis de rendimiento y lecciones aprendidas</p>
                    </div>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                >
                    <ArrowPathIcon className="w-4 h-4" />
                    Actualizar
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                        <ChartBarIcon className="w-4 h-4" />
                        Total Predicciones
                    </div>
                    <div className="text-2xl font-bold text-white">{stats?.totalPredictions}</div>
                    <div className="text-sm text-gray-500">
                        {stats?.verified} verificadas · {stats?.pending} pendientes
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                        <TrendingUpIcon className="w-4 h-4 text-emerald-500" />
                        Win Rate
                    </div>
                    <div className={`text-2xl font-bold ${stats?.winRate >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {stats?.winRate.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">
                        {stats?.correctCount} aciertos · {stats?.incorrectCount} fallos
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                        <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />
                        Error de Confianza Prom.
                    </div>
                    <div className="text-2xl font-bold text-yellow-500">
                        {stats?.avgConfidenceError.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">
                        Diferencia entre predicción e ideal
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                        <LightBulbIcon className="w-4 h-4 text-purple-500" />
                        Lecciones Aprendidas
                    </div>
                    <div className="text-2xl font-bold text-purple-500">{stats?.lessonsGenerated}</div>
                    <div className="text-sm text-gray-500">
                        Análisis post-mortem de fallos
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <PlayIcon className="w-5 h-5 text-emerald-500" />
                    Acciones del Sistema
                </h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => runAction('sync-results')}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-white transition-colors"
                    >
                        {actionLoading === 'sync-results' ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                        Verificar Resultados
                    </button>

                    <button
                        onClick={() => runAction('analyze-failures')}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-white transition-colors"
                    >
                        {actionLoading === 'analyze-failures' ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <BrainIcon className="w-4 h-4" />}
                        Analizar Fallos
                    </button>

                    <button
                        onClick={() => runAction('migrate-verified-predictions')}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-white transition-colors"
                    >
                        {actionLoading === 'migrate-verified-predictions' ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <TrendingUpIcon className="w-4 h-4" />}
                        Migrar Histórico
                    </button>
                </div>
            </div>

            {/* NEW: Comparación v1 vs v2 */}
            {(statsV1 || statsV2) && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-purple-500" />
                        Comparación de Versiones del Modelo
                    </h2>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* v1-stable */}
                        {statsV1 && (
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-white/5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                        <h3 className="text-lg font-bold text-white">v1-stable</h3>
                                    </div>
                                    <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-300">
                                        Sin ML
                                    </span>
                                </div>

                                <div className="text-4xl font-black text-white mb-2">
                                    {statsV1.accuracy.toFixed(1)}%
                                </div>

                                <div className="text-sm text-slate-400 mb-4">
                                    {statsV1.won}/{statsV1.verified} predicciones correctas
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="bg-slate-700/50 rounded p-2">
                                        <div className="text-slate-400">Total</div>
                                        <div className="text-white font-semibold">{statsV1.total}</div>
                                    </div>
                                    <div className="bg-green-500/10 rounded p-2">
                                        <div className="text-green-400">Ganadas</div>
                                        <div className="text-white font-semibold">{statsV1.won}</div>
                                    </div>
                                    <div className="bg-red-500/10 rounded p-2">
                                        <div className="text-red-400">Perdidas</div>
                                        <div className="text-white font-semibold">{statsV1.lost}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* v2-learning */}
                        {statsV2 && (
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-white/5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                        <h3 className="text-lg font-bold text-white">v2-learning</h3>
                                    </div>
                                    <span className="text-xs px-2 py-1 bg-purple-500/20 rounded text-purple-300">
                                        Con ML
                                    </span>
                                </div>

                                <div className="text-4xl font-black text-white mb-2">
                                    {statsV2.accuracy.toFixed(1)}%
                                </div>

                                <div className="text-sm text-slate-400 mb-4">
                                    {statsV2.won}/{statsV2.verified} predicciones correctas
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="bg-slate-700/50 rounded p-2">
                                        <div className="text-slate-400">Total</div>
                                        <div className="text-white font-semibold">{statsV2.total}</div>
                                    </div>
                                    <div className="bg-green-500/10 rounded p-2">
                                        <div className="text-green-400">Ganadas</div>
                                        <div className="text-white font-semibold">{statsV2.won}</div>
                                    </div>
                                    <div className="bg-red-500/10 rounded p-2">
                                        <div className="text-red-400">Perdidas</div>
                                        <div className="text-white font-semibold">{statsV2.lost}</div>
                                    </div>
                                </div>

                                {/* Diferencia vs v1 */}
                                {versionComparison && (
                                    <div className={`mt-4 p-3 rounded-lg text-center ${versionComparison.betterVersion === 'v2-learning'
                                            ? 'bg-green-500/10 border border-green-500/30'
                                            : versionComparison.betterVersion === 'v1-stable'
                                                ? 'bg-red-500/10 border border-red-500/30'
                                                : 'bg-slate-700/50'
                                        }`}>
                                        <div className={`text-2xl font-bold ${versionComparison.betterVersion === 'v2-learning'
                                                ? 'text-green-400'
                                                : versionComparison.betterVersion === 'v1-stable'
                                                    ? 'text-red-400'
                                                    : 'text-slate-400'
                                            }`}>
                                            {versionComparison.accuracyDiff > 0 ? '+' : ''}
                                            {versionComparison.accuracyDiff.toFixed(1)}%
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            {versionComparison.betterVersion === 'v2-learning'
                                                ? '🎉 ML funciona mejor'
                                                : versionComparison.betterVersion === 'v1-stable'
                                                    ? '⚠️ ML necesita más datos'
                                                    : 'Sin diferencia significativa'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Mensaje si no hay suficientes datos */}
                    {(!statsV2 || statsV2.verified < 50) && (
                        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <div className="flex items-center gap-2 text-yellow-400 text-sm">
                                <ExclamationTriangleIcon className="w-4 h-4" />
                                <span>
                                    Se necesitan al menos 50 predicciones verificadas por versión para comparación confiable.
                                    {statsV2 && ` v2-learning tiene ${statsV2.verified} verificadas.`}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* A/B Testing */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <ChartBarIcon className="w-5 h-5 text-blue-500" />
                    A/B Testing de Modelos
                </h2>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {versions.map(v => (
                        <div key={v.version_name} className="bg-gray-700/50 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                                <span className="font-medium text-white">{v.version_name}</span>
                                <span className={`px-2 py-1 rounded text-sm ${v.traffic_percentage > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-600 text-gray-400'}`}>
                                    {v.traffic_percentage}% tráfico
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => startABTest(10)}
                        disabled={actionLoading !== null}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
                    >
                        90/10 Split
                    </button>
                    <button
                        onClick={() => startABTest(30)}
                        disabled={actionLoading !== null}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
                    >
                        70/30 Split
                    </button>
                    <button
                        onClick={() => startABTest(50)}
                        disabled={actionLoading !== null}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
                    >
                        50/50 Split
                    </button>
                </div>
            </div>

            {/* Lessons List */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <LightBulbIcon className="w-5 h-5 text-yellow-500" />
                    Lecciones Aprendidas Recientes
                </h2>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {lessons.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">No hay lecciones aún. Ejecuta "Analizar Fallos" para generar.</p>
                    ) : (
                        lessons.map(lesson => (
                            <div key={lesson.id} className="bg-gray-700/50 rounded-lg p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(lesson.failure_category)}`}>
                                        {lesson.failure_category}
                                    </span>
                                    {lesson.ideal_confidence && (
                                        <span className="text-sm text-gray-400">
                                            Confianza ideal: <span className="text-emerald-400">{lesson.ideal_confidence}%</span>
                                        </span>
                                    )}
                                </div>

                                <p className="text-gray-300 text-sm mb-2">{lesson.lesson_text}</p>

                                {lesson.overvalued_factors?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        <span className="text-xs text-red-400">Sobrevalorado:</span>
                                        {lesson.overvalued_factors.map((f, i) => (
                                            <span key={i} className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">{f}</span>
                                        ))}
                                    </div>
                                )}

                                {lesson.missing_context?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        <span className="text-xs text-yellow-400">Faltante:</span>
                                        {lesson.missing_context.map((c, i) => (
                                            <span key={i} className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">{c}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
