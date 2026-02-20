/**
 * User Activity Monitor
 * Monitoreo de actividad de usuarios: DAU/MAU, usuarios en riesgo, pagos fallidos
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';

interface ActivityData {
    recentLogins: { user_id: string; full_name: string; email: string; last_login: string }[];
    atRiskUsers: { user_id: string; full_name: string; email: string; plan_name: string; last_login: string; days_inactive: number }[];
    pastDueUsers: { user_id: string; full_name: string; email: string; plan_name: string; status: string }[];
    recentSignups: { user_id: string; full_name: string; email: string; created_at: string }[];
    recentCancellations: { user_id: string; full_name: string; plan_name: string; cancelled_at: string }[];
    totalUsers: number;
    activeToday: number;
    activeThisWeek: number;
    activeThisMonth: number;
}

export const UserActivityMonitor: React.FC = () => {
    const [data, setData] = useState<ActivityData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

            // Profiles con ultimo login
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, email, updated_at, created_at')
                .order('updated_at', { ascending: false })
                .limit(200);

            const allProfiles = profiles || [];
            const totalUsers = allProfiles.length;

            // Aproximar actividad por updated_at del profile
            const activeToday = allProfiles.filter(p => p.updated_at >= todayStart).length;
            const activeThisWeek = allProfiles.filter(p => p.updated_at >= weekAgo).length;
            const activeThisMonth = allProfiles.filter(p => p.updated_at >= monthAgo).length;

            // Logins recientes (top 10)
            const recentLogins = allProfiles.slice(0, 10).map(p => ({
                user_id: p.id,
                full_name: p.full_name || 'Sin nombre',
                email: p.email || '',
                last_login: p.updated_at
            }));

            // Signups recientes (ultimo mes)
            const recentSignups = allProfiles
                .filter(p => p.created_at >= monthAgo)
                .slice(0, 10)
                .map(p => ({
                    user_id: p.id,
                    full_name: p.full_name || 'Sin nombre',
                    email: p.email || '',
                    created_at: p.created_at
                }));

            // Usuarios en riesgo: plan activo + sin actividad en 7+ dias
            const { data: subsWithPlans } = await supabase
                .from('user_subscriptions')
                .select('user_id, status, subscription_plans(name, display_name)')
                .eq('status', 'active');

            const activeSubMap = new Map<string, string>();
            (subsWithPlans || []).forEach(s => {
                const plan = s.subscription_plans as any;
                if (plan && plan.name !== 'free') {
                    activeSubMap.set(s.user_id, plan.display_name);
                }
            });

            const atRiskUsers = allProfiles
                .filter(p => {
                    const isPayingUser = activeSubMap.has(p.id);
                    const daysInactive = Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / (24 * 60 * 60 * 1000));
                    return isPayingUser && daysInactive >= 7;
                })
                .map(p => ({
                    user_id: p.id,
                    full_name: p.full_name || 'Sin nombre',
                    email: p.email || '',
                    plan_name: activeSubMap.get(p.id) || '',
                    last_login: p.updated_at,
                    days_inactive: Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / (24 * 60 * 60 * 1000))
                }))
                .sort((a, b) => b.days_inactive - a.days_inactive)
                .slice(0, 15);

            // Pagos fallidos
            const { data: pastDueSubs } = await supabase
                .from('user_subscriptions')
                .select('user_id, status, subscription_plans(name)')
                .eq('status', 'past_due');

            const pastDueUserIds = (pastDueSubs || []).map(s => s.user_id);
            const pastDueProfiles = allProfiles.filter(p => pastDueUserIds.includes(p.id));
            const pastDueUsers = pastDueProfiles.map(p => {
                const sub = (pastDueSubs || []).find(s => s.user_id === p.id);
                return {
                    user_id: p.id,
                    full_name: p.full_name || 'Sin nombre',
                    email: p.email || '',
                    plan_name: (sub?.subscription_plans as any)?.name || '',
                    status: 'past_due'
                };
            });

            // Cancelaciones recientes
            const { data: cancelledSubs } = await supabase
                .from('user_subscriptions')
                .select('user_id, cancelled_at, subscription_plans(display_name)')
                .eq('status', 'cancelled')
                .not('cancelled_at', 'is', null)
                .gte('cancelled_at', monthAgo)
                .order('cancelled_at', { ascending: false })
                .limit(10);

            const cancelledUserIds = (cancelledSubs || []).map(s => s.user_id);
            const cancelledProfiles = allProfiles.filter(p => cancelledUserIds.includes(p.id));
            const recentCancellations = (cancelledSubs || []).map(s => {
                const prof = cancelledProfiles.find(p => p.id === s.user_id);
                return {
                    user_id: s.user_id,
                    full_name: prof?.full_name || 'Sin nombre',
                    plan_name: (s.subscription_plans as any)?.display_name || '',
                    cancelled_at: s.cancelled_at!
                };
            });

            setData({
                recentLogins,
                atRiskUsers,
                pastDueUsers,
                recentSignups,
                recentCancellations,
                totalUsers,
                activeToday,
                activeThisWeek,
                activeThisMonth,
            });
        } catch (error) {
            console.error('Error loading activity data:', error);
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

    if (!data) {
        return <div className="text-gray-400 text-center py-12">Error al cargar datos de actividad</div>;
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Actividad de Usuarios</h2>

            {/* Activity KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 rounded-xl border border-white/10 p-5">
                    <p className="text-gray-400 text-xs font-medium uppercase">Total Usuarios</p>
                    <p className="text-2xl font-black text-white mt-1">{data.totalUsers}</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl border border-emerald-500/30 p-5">
                    <p className="text-gray-400 text-xs font-medium uppercase">Activos Hoy</p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">{data.activeToday}</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl border border-blue-500/30 p-5">
                    <p className="text-gray-400 text-xs font-medium uppercase">Activos 7d</p>
                    <p className="text-2xl font-black text-blue-400 mt-1">{data.activeThisWeek}</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl border border-purple-500/30 p-5">
                    <p className="text-gray-400 text-xs font-medium uppercase">Activos 30d</p>
                    <p className="text-2xl font-black text-purple-400 mt-1">{data.activeThisMonth}</p>
                </div>
            </div>

            {/* At Risk Users */}
            {data.atRiskUsers.length > 0 && (
                <div className="bg-red-500/5 rounded-xl border border-red-500/20 p-6">
                    <h3 className="text-lg font-bold text-red-400 mb-4">Usuarios en Riesgo de Churn</h3>
                    <p className="text-gray-400 text-sm mb-3">Usuarios con plan de pago sin actividad en 7+ días</p>
                    <div className="space-y-2">
                        {data.atRiskUsers.map(user => (
                            <div key={user.user_id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg text-sm">
                                <div>
                                    <span className="text-white font-medium">{user.full_name}</span>
                                    <span className="text-gray-500 ml-2">{user.email}</span>
                                    <span className="text-gray-600 ml-2">({user.plan_name})</span>
                                </div>
                                <span className="text-red-400 font-bold">{user.days_inactive}d inactivo</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Past Due Users */}
            {data.pastDueUsers.length > 0 && (
                <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-6">
                    <h3 className="text-lg font-bold text-amber-400 mb-4">Pagos Fallidos Pendientes</h3>
                    <div className="space-y-2">
                        {data.pastDueUsers.map(user => (
                            <div key={user.user_id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg text-sm">
                                <div>
                                    <span className="text-white font-medium">{user.full_name}</span>
                                    <span className="text-gray-500 ml-2">{user.email}</span>
                                </div>
                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded">PAST DUE</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Signups */}
                <div className="bg-slate-900/50 rounded-xl border border-white/5 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Registros Recientes</h3>
                    <div className="space-y-2">
                        {data.recentSignups.map(user => (
                            <div key={user.user_id} className="flex items-center justify-between p-2 text-sm">
                                <span className="text-white">{user.full_name}</span>
                                <span className="text-gray-500 text-xs">{new Date(user.created_at).toLocaleDateString('es-CO')}</span>
                            </div>
                        ))}
                        {data.recentSignups.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Sin registros recientes</p>}
                    </div>
                </div>

                {/* Recent Cancellations */}
                <div className="bg-slate-900/50 rounded-xl border border-white/5 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Cancelaciones Recientes</h3>
                    <div className="space-y-2">
                        {data.recentCancellations.map((c, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 text-sm">
                                <div>
                                    <span className="text-white">{c.full_name}</span>
                                    <span className="text-gray-500 ml-2">({c.plan_name})</span>
                                </div>
                                <span className="text-red-400 text-xs">{new Date(c.cancelled_at).toLocaleDateString('es-CO')}</span>
                            </div>
                        ))}
                        {data.recentCancellations.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Sin cancelaciones recientes</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserActivityMonitor;
