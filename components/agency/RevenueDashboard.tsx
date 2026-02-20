/**
 * Revenue Dashboard
 * Metricas financieras para el Agency Suite: MRR, ARR, churn, suscripciones por plan
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';

interface RevenueMetrics {
    mrr: number;
    arr: number;
    totalSubscribers: number;
    activeSubscribers: number;
    churnRate: number;
    arpu: number;
    planBreakdown: { plan_name: string; display_name: string; count: number; revenue: number }[];
    recentPayments: { id: string; amount: number; status: string; created_at: string; plan_name: string }[];
    newThisMonth: number;
    cancelledThisMonth: number;
}

const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const RevenueDashboard: React.FC = () => {
    const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMetrics();
    }, []);

    const loadMetrics = async () => {
        setLoading(true);
        try {
            // Obtener suscripciones activas con plan
            const { data: subs } = await supabase
                .from('user_subscriptions')
                .select('id, user_id, status, plan_id, created_at, cancelled_at, subscription_plans(name, display_name, price_cents)')
                .order('created_at', { ascending: false });

            // Obtener pagos recientes
            const { data: payments } = await supabase
                .from('payment_history')
                .select('id, amount_cents, status, created_at, subscription_plans(name)')
                .order('created_at', { ascending: false })
                .limit(20);

            const allSubs = subs || [];
            const activeSubs = allSubs.filter(s => s.status === 'active');

            // Calcular MRR: suma de precios mensuales de suscripciones activas
            let mrr = 0;
            const planCounts: Record<string, { display_name: string; count: number; revenue: number }> = {};

            for (const sub of activeSubs) {
                const plan = sub.subscription_plans as any;
                if (!plan) continue;
                const price = plan.price_cents || 0;
                mrr += price;

                if (!planCounts[plan.name]) {
                    planCounts[plan.name] = { display_name: plan.display_name, count: 0, revenue: 0 };
                }
                planCounts[plan.name].count++;
                planCounts[plan.name].revenue += price;
            }

            // Nuevos y cancelados este mes
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const newThisMonth = allSubs.filter(s => s.created_at >= monthStart).length;
            const cancelledThisMonth = allSubs.filter(s => s.cancelled_at && s.cancelled_at >= monthStart).length;

            // Churn rate: cancelados / total activos al inicio
            const totalAtStart = activeSubs.length + cancelledThisMonth;
            const churnRate = totalAtStart > 0 ? (cancelledThisMonth / totalAtStart) * 100 : 0;

            // ARPU
            const arpu = activeSubs.length > 0 ? mrr / activeSubs.length : 0;

            const planBreakdown = Object.entries(planCounts).map(([plan_name, data]) => ({
                plan_name,
                ...data
            }));

            const recentPayments = (payments || []).map(p => ({
                id: p.id,
                amount: p.amount_cents,
                status: p.status,
                created_at: p.created_at,
                plan_name: (p.subscription_plans as any)?.name || 'unknown'
            }));

            setMetrics({
                mrr,
                arr: mrr * 12,
                totalSubscribers: allSubs.length,
                activeSubscribers: activeSubs.length,
                churnRate: Math.round(churnRate * 10) / 10,
                arpu,
                planBreakdown,
                recentPayments,
                newThisMonth,
                cancelledThisMonth,
            });
        } catch (error) {
            console.error('Error loading revenue metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!metrics) {
        return <div className="text-gray-400 text-center py-12">Error al cargar métricas</div>;
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Revenue Dashboard</h2>

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="MRR" value={formatCurrency(metrics.mrr)} color="emerald" />
                <MetricCard label="ARR" value={formatCurrency(metrics.arr)} color="blue" />
                <MetricCard label="Suscriptores Activos" value={String(metrics.activeSubscribers)} color="purple" />
                <MetricCard label="ARPU" value={formatCurrency(metrics.arpu)} color="amber" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Churn Rate" value={`${metrics.churnRate}%`} color={metrics.churnRate > 5 ? 'red' : 'emerald'} />
                <MetricCard label="Total Registrados" value={String(metrics.totalSubscribers)} color="slate" />
                <MetricCard label="Nuevos este mes" value={`+${metrics.newThisMonth}`} color="emerald" />
                <MetricCard label="Cancelados este mes" value={String(metrics.cancelledThisMonth)} color="red" />
            </div>

            {/* Plan Breakdown */}
            <div className="bg-slate-900/50 rounded-xl border border-white/5 p-6">
                <h3 className="text-lg font-bold text-white mb-4">Desglose por Plan</h3>
                <div className="space-y-3">
                    {metrics.planBreakdown.map(plan => (
                        <div key={plan.plan_name} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <div>
                                <span className="text-white font-medium">{plan.display_name}</span>
                                <span className="text-gray-400 text-sm ml-2">({plan.count} usuarios)</span>
                            </div>
                            <span className="text-emerald-400 font-bold">{formatCurrency(plan.revenue)}/mes</span>
                        </div>
                    ))}
                    {metrics.planBreakdown.length === 0 && (
                        <p className="text-gray-500 text-sm text-center py-4">Sin suscripciones de pago activas</p>
                    )}
                </div>
            </div>

            {/* Recent Payments */}
            <div className="bg-slate-900/50 rounded-xl border border-white/5 p-6">
                <h3 className="text-lg font-bold text-white mb-4">Pagos Recientes</h3>
                <div className="space-y-2">
                    {metrics.recentPayments.map(payment => (
                        <div key={payment.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg text-sm">
                            <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    payment.status === 'paid' || payment.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                    payment.status === 'refunded' ? 'bg-red-500/20 text-red-400' :
                                    'bg-amber-500/20 text-amber-400'
                                }`}>
                                    {payment.status}
                                </span>
                                <span className="text-gray-400">{payment.plan_name}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-white font-medium">{formatCurrency(payment.amount)}</span>
                                <span className="text-gray-500 text-xs">
                                    {new Date(payment.created_at).toLocaleDateString('es-CO')}
                                </span>
                            </div>
                        </div>
                    ))}
                    {metrics.recentPayments.length === 0 && (
                        <p className="text-gray-500 text-sm text-center py-4">Sin pagos registrados</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const MetricCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => {
    const colorClasses: Record<string, string> = {
        emerald: 'border-emerald-500/30 text-emerald-400',
        blue: 'border-blue-500/30 text-blue-400',
        purple: 'border-purple-500/30 text-purple-400',
        amber: 'border-amber-500/30 text-amber-400',
        red: 'border-red-500/30 text-red-400',
        slate: 'border-white/10 text-gray-300',
    };
    const cls = colorClasses[color] || colorClasses.slate;

    return (
        <div className={`bg-slate-900/50 rounded-xl border p-5 ${cls.split(' ')[0]}`}>
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-black mt-1 ${cls.split(' ')[1]}`}>{value}</p>
        </div>
    );
};

export default RevenueDashboard;
