/**
 * Subscription Management - SuperAdmin Panel
 * Panel para gestionar suscripciones de usuarios
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';
import { getActivePlans, assignPlanToUser, SubscriptionPlan, formatPrice } from '../../services/subscriptionService';
import { UserIcon, SparklesIcon, CheckCircleIcon, MagnifyingGlassIcon } from '../icons/Icons';

interface UserWithSubscription {
    id: string;
    email: string;
    full_name: string;
    organization_id: string;
    organization_name: string;
    plan_name: string | null;
    plan_display_name: string | null;
    subscription_status: string | null;
    subscription_end: string | null;
}

export const SubscriptionManagement: React.FC = () => {
    const [users, setUsers] = useState<UserWithSubscription[]>([]);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserWithSubscription | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<string>('');
    const [assignNotes, setAssignNotes] = useState('');
    const [assigning, setAssigning] = useState(false);

    // Cargar usuarios y planes
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);

            try {
                // Cargar planes
                const plansData = await getActivePlans();
                setPlans(plansData);

                // 1. Cargar todos los profiles
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, email, full_name')
                    .order('full_name', { ascending: true });

                if (profilesError) {
                    console.error('Error loading profiles:', profilesError);
                    setLoading(false);
                    return;
                }

                // 2. Cargar organization_members para todos los usuarios
                const userIds = profilesData?.map(p => p.id) || [];
                const { data: membersData } = await supabase
                    .from('organization_members')
                    .select('user_id, organization_id')
                    .in('user_id', userIds);

                // 3. Cargar organizations
                const orgIds = [...new Set(membersData?.map(m => m.organization_id) || [])];
                const { data: orgsData } = await supabase
                    .from('organizations')
                    .select('id, name')
                    .in('id', orgIds);

                // 4. Cargar suscripciones activas
                const { data: subs } = await supabase
                    .from('user_subscriptions')
                    .select('user_id, organization_id, plan_id, status, current_period_end')
                    .in('status', ['active', 'trialing']);

                // Crear maps para acceso rápido
                const orgsMap = new Map(orgsData?.map(o => [o.id, o]) || []);
                const subsMap = new Map(subs?.map(s => [`${s.user_id}_${s.organization_id}`, s]) || []);
                const plansMap = new Map(plansData.map(p => [p.id, p]));

                // Mapear usuarios
                const mappedUsers: UserWithSubscription[] = [];

                for (const profile of profilesData || []) {
                    const userMembers = membersData?.filter(m => m.user_id === profile.id) || [];

                    for (const member of userMembers) {
                        const org = orgsMap.get(member.organization_id);
                        const sub = subsMap.get(`${profile.id}_${member.organization_id}`);
                        const plan = sub ? plansMap.get(sub.plan_id) : null;

                        mappedUsers.push({
                            id: profile.id,
                            email: profile.email,
                            full_name: profile.full_name || profile.email,
                            organization_id: member.organization_id,
                            organization_name: org?.name || 'Sin organización',
                            plan_name: plan?.name || null,
                            plan_display_name: plan?.display_name || 'Sin Plan',
                            subscription_status: sub?.status || null,
                            subscription_end: sub?.current_period_end || null
                        });
                    }
                }

                setUsers(mappedUsers);
            } catch (err) {
                console.error('Error loading subscription data:', err);
            }

            setLoading(false);
        };

        loadData();
    }, []);

    // Filtrar usuarios
    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.organization_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Asignar plan
    const handleAssignPlan = async () => {
        if (!selectedUser || !selectedPlan) return;

        setAssigning(true);

        const { data: userData } = await supabase.auth.getUser();
        const result = await assignPlanToUser(
            selectedUser.id,
            selectedUser.organization_id,
            selectedPlan,
            userData.user?.id,
            assignNotes
        );

        if (result.success) {
            // Actualizar lista
            setUsers(prev => prev.map(u => {
                if (u.id === selectedUser.id && u.organization_id === selectedUser.organization_id) {
                    const plan = plans.find(p => p.id === selectedPlan);
                    return {
                        ...u,
                        plan_name: plan?.name || null,
                        plan_display_name: plan?.display_name || 'Sin Plan',
                        subscription_status: 'active'
                    };
                }
                return u;
            }));

            setSelectedUser(null);
            setSelectedPlan('');
            setAssignNotes('');
            alert('Plan asignado correctamente');
        } else {
            alert('Error al asignar plan: ' + result.error);
        }

        setAssigning(false);
    };

    const getPlanBadgeColor = (planName: string | null) => {
        switch (planName) {
            case 'premium': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'pro': return 'bg-brand/20 text-brand border-brand/30';
            case 'starter': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <SparklesIcon className="w-7 h-7 text-brand" />
                        Gestión de Suscripciones
                    </h1>
                    <p className="text-gray-400 mt-1">Administra los planes de usuarios</p>
                </div>

                {/* Search */}
                <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Buscar usuario..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand w-64"
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                {plans.map((plan) => {
                    const count = users.filter(u => u.plan_name === plan.name).length;
                    return (
                        <div key={plan.id} className="bg-slate-800 rounded-xl p-4 border border-white/5">
                            <p className="text-sm text-gray-400">{plan.display_name}</p>
                            <p className="text-2xl font-bold text-white mt-1">{count}</p>
                            <p className="text-xs text-gray-500">{formatPrice(plan.price_cents)}/mes</p>
                        </div>
                    );
                })}
            </div>

            {/* Users Table */}
            <div className="flex-grow bg-slate-900 rounded-xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-800 border-b border-white/5">
                            <tr>
                                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider px-6 py-4">Usuario</th>
                                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider px-6 py-4">Organización</th>
                                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider px-6 py-4">Plan</th>
                                <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider px-6 py-4">Estado</th>
                                <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-wider px-6 py-4">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.map((user, idx) => (
                                <tr key={`${user.id}_${user.organization_id}_${idx}`} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                                                <UserIcon className="w-5 h-5 text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{user.full_name}</p>
                                                <p className="text-sm text-gray-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-300">{user.organization_name}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getPlanBadgeColor(user.plan_name)}`}>
                                            {user.plan_display_name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.subscription_status === 'active' ? (
                                            <span className="flex items-center gap-1 text-green-400 text-sm">
                                                <CheckCircleIcon className="w-4 h-4" />
                                                Activo
                                            </span>
                                        ) : (
                                            <span className="text-gray-500 text-sm">Sin suscripción</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setSelectedUser(user)}
                                            className="text-brand hover:text-white text-sm font-medium transition-colors"
                                        >
                                            Cambiar Plan
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Assign Plan Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setSelectedUser(null)} />
                    <div className="relative bg-slate-900 rounded-2xl border border-white/10 max-w-md w-full mx-4 p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Asignar Plan</h3>

                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-400 mb-1">Usuario</p>
                                <p className="text-white font-medium">{selectedUser.full_name}</p>
                                <p className="text-sm text-gray-500">{selectedUser.email}</p>
                            </div>

                            <div>
                                <label className="text-sm text-gray-400 mb-2 block">Seleccionar Plan</label>
                                <select
                                    value={selectedPlan}
                                    onChange={(e) => setSelectedPlan(e.target.value)}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand"
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {plans.map((plan) => (
                                        <option key={plan.id} value={plan.id}>
                                            {plan.display_name} - {formatPrice(plan.price_cents)}/mes
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm text-gray-400 mb-2 block">Notas (opcional)</label>
                                <textarea
                                    value={assignNotes}
                                    onChange={(e) => setAssignNotes(e.target.value)}
                                    placeholder="Ej: Upgrade por promoción especial"
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand resize-none h-20"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="flex-1 py-3 rounded-xl font-medium text-gray-400 bg-slate-800 hover:bg-slate-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAssignPlan}
                                disabled={!selectedPlan || assigning}
                                className="flex-1 py-3 rounded-xl font-bold bg-brand text-slate-900 hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {assigning ? 'Asignando...' : 'Asignar Plan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscriptionManagement;
