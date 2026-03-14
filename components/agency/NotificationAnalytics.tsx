import React, { useState, useEffect } from 'react';
import { getNotificationAnalytics, getNotificationStats, sendTestNotification } from '../../services/notificationService';
import { PaperAirplaneIcon, CheckCircleIcon, XCircleIcon } from '../icons/Icons';
import type { NotificationAnalytics as AnalyticsType, NotificationLogEntry } from '../../types';

const STATUS_COLORS: Record<string, string> = {
    queued: 'text-slate-400 bg-slate-400/10',
    sent: 'text-blue-400 bg-blue-400/10',
    delivered: 'text-teal-400 bg-teal-400/10',
    read: 'text-emerald-400 bg-emerald-400/10',
    failed: 'text-red-400 bg-red-400/10',
};

const STATUS_LABELS: Record<string, string> = {
    queued: 'En cola',
    sent: 'Enviado',
    delivered: 'Entregado',
    read: 'Leido',
    failed: 'Fallido',
};

export const NotificationAnalytics: React.FC = () => {
    const [analytics, setAnalytics] = useState<AnalyticsType | null>(null);
    const [stats, setStats] = useState<{ totalUsers: number; usersWithPhone: number; sentToday: number; deliveredToday: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);
    const [testPhone, setTestPhone] = useState('');
    const [testSending, setTestSending] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        loadData();
    }, [days]);

    const loadData = async () => {
        setLoading(true);
        const [analyticsData, statsData] = await Promise.all([
            getNotificationAnalytics(days),
            getNotificationStats(),
        ]);
        setAnalytics(analyticsData);
        setStats(statsData);
        setLoading(false);
    };

    const handleSendTest = async () => {
        if (!testPhone) return;
        setTestSending(true);
        setTestResult(null);
        const result = await sendTestNotification(testPhone);
        setTestResult({
            success: result.success,
            message: result.success ? 'Mensaje enviado correctamente' : (result.error || 'Error al enviar'),
        });
        setTestSending(false);
        setTimeout(() => setTestResult(null), 5000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-teal-500/10">
                        <PaperAirplaneIcon className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Notificaciones WhatsApp</h2>
                        <p className="text-sm text-slate-400">Metricas de envio y engagement</p>
                    </div>
                </div>
                <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                >
                    <option value={7}>Ultimos 7 dias</option>
                    <option value={30}>Ultimos 30 dias</option>
                    <option value={90}>Ultimos 90 dias</option>
                </select>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    label="Usuarios con WhatsApp"
                    value={`${stats?.usersWithPhone || 0}/${stats?.totalUsers || 0}`}
                    subtext={stats && stats.totalUsers > 0 ? `${((stats.usersWithPhone / stats.totalUsers) * 100).toFixed(0)}% cobertura` : ''}
                    color="teal"
                />
                <KPICard
                    label="Enviados"
                    value={String(analytics?.totalSent || 0)}
                    subtext={`Hoy: ${stats?.sentToday || 0}`}
                    color="blue"
                />
                <KPICard
                    label="Tasa de Entrega"
                    value={`${(analytics?.deliveryRate || 0).toFixed(1)}%`}
                    subtext={`${analytics?.delivered || 0} entregados`}
                    color="emerald"
                />
                <KPICard
                    label="Tasa de Lectura"
                    value={`${(analytics?.readRate || 0).toFixed(1)}%`}
                    subtext={`${analytics?.read || 0} leidos`}
                    color="purple"
                />
            </div>

            {/* By Type Breakdown */}
            <div className="glass p-4 rounded-xl border border-white/5">
                <h3 className="font-bold text-white mb-4">Desglose por Tipo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TypeCard
                        label="Pronosticos Listos"
                        data={analytics?.byType.predictions_ready}
                    />
                    <TypeCard
                        label="Resultados del Dia"
                        data={analytics?.byType.daily_results}
                    />
                </div>
            </div>

            {/* Test Notification */}
            <div className="glass p-4 rounded-xl border border-white/5">
                <h3 className="font-bold text-white mb-3">Enviar Notificacion de Prueba</h3>
                <div className="flex gap-2">
                    <input
                        type="tel"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                        className="flex-1 px-4 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                        placeholder="+573001234567"
                    />
                    <button
                        onClick={handleSendTest}
                        disabled={testSending || !testPhone}
                        className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
                    >
                        {testSending ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <PaperAirplaneIcon className="w-4 h-4" />
                        )}
                        Enviar
                    </button>
                </div>
                {testResult && (
                    <div className={`mt-3 p-2 rounded-lg text-sm flex items-center gap-2 ${
                        testResult.success
                            ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                            : 'bg-red-500/10 text-red-300 border border-red-500/30'
                    }`}>
                        {testResult.success ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
                        {testResult.message}
                    </div>
                )}
            </div>

            {/* Recent Logs Table */}
            <div className="glass p-4 rounded-xl border border-white/5">
                <h3 className="font-bold text-white mb-4">Ultimas Notificaciones</h3>
                {analytics?.recentLogs && analytics.recentLogs.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Fecha</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Tipo</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Telefono</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Template</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Estado</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Plan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.recentLogs.map((log: NotificationLogEntry) => (
                                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="py-2 px-3 text-slate-300 text-xs">
                                            {new Date(log.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="py-2 px-3 text-slate-300 text-xs">
                                            {log.notification_type === 'predictions_ready' ? 'Pronosticos' : 'Resultados'}
                                        </td>
                                        <td className="py-2 px-3 text-slate-400 text-xs font-mono">
                                            {log.phone_number ? `...${log.phone_number.slice(-4)}` : '-'}
                                        </td>
                                        <td className="py-2 px-3 text-slate-400 text-xs">
                                            {log.template_name || '-'}
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[log.status] || STATUS_COLORS.queued}`}>
                                                {STATUS_LABELS[log.status] || log.status}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-slate-400 text-xs">
                                            {(log.metadata as any)?.plan || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-slate-500 text-sm text-center py-8">No hay notificaciones registradas en este periodo</p>
                )}
            </div>
        </div>
    );
};

// --- Sub-components ---

function KPICard({ label, value, subtext, color }: { label: string; value: string; subtext: string; color: string }) {
    const colorMap: Record<string, string> = {
        teal: 'from-teal-500/10 to-transparent border-teal-500/20 text-teal-400',
        blue: 'from-blue-500/10 to-transparent border-blue-500/20 text-blue-400',
        emerald: 'from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-400',
        purple: 'from-purple-500/10 to-transparent border-purple-500/20 text-purple-400',
    };

    return (
        <div className={`p-4 rounded-xl bg-gradient-to-br border ${colorMap[color] || colorMap.teal}`}>
            <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
    );
}

function TypeCard({ label, data }: { label: string; data?: { sent: number; delivered: number; clicked: number } }) {
    if (!data) return null;
    const deliveryRate = data.sent > 0 ? ((data.delivered / data.sent) * 100).toFixed(0) : '0';
    const clickRate = data.sent > 0 ? ((data.clicked / data.sent) * 100).toFixed(0) : '0';

    return (
        <div className="p-4 rounded-lg bg-slate-800/50 border border-white/5">
            <h4 className="font-medium text-white text-sm mb-3">{label}</h4>
            <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                    <p className="text-lg font-bold text-white">{data.sent}</p>
                    <p className="text-xs text-slate-400">Enviados</p>
                </div>
                <div>
                    <p className="text-lg font-bold text-teal-400">{deliveryRate}%</p>
                    <p className="text-xs text-slate-400">Entrega</p>
                </div>
                <div>
                    <p className="text-lg font-bold text-emerald-400">{clickRate}%</p>
                    <p className="text-xs text-slate-400">Clicks</p>
                </div>
            </div>
        </div>
    );
}
