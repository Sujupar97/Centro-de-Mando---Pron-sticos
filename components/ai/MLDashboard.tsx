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
    PlayIcon
} from '../icons/Icons';

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
    const [stats, setStats] = useState<MLStats | null>(null);
    const [lessons, setLessons] = useState<LearnedLesson[]>([]);
    const [versions, setVersions] = useState<ModelVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

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
