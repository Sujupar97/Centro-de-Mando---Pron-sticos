
import React, { useState, useEffect } from 'react';
import { OrganizationWithDetails } from '../../types';
import { organizationService } from '../../services/organizationService';
import {
    BuildingOfficeIcon,
    ArrowLeftIcon,
    ArrowRightOnRectangleIcon,
    TrashIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XMarkIcon
} from '../icons/Icons';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface ManageSubAccountPageProps {
    orgId: string;
    onBack: () => void;
}

const PLAN_COLORS: Record<string, string> = {
    free: 'bg-slate-500/20 text-slate-400 border-slate-500/20',
    starter: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    pro: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
    premium: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    active: { label: 'Activa', color: 'text-emerald-400 bg-emerald-500/20' },
    trialing: { label: 'Prueba', color: 'text-blue-400 bg-blue-500/20' },
    past_due: { label: 'Pago pendiente', color: 'text-amber-400 bg-amber-500/20' },
    cancelled: { label: 'Cancelada', color: 'text-red-400 bg-red-500/20' },
    expired: { label: 'Expirada', color: 'text-slate-400 bg-slate-500/20' },
};

export const ManageSubAccountPage: React.FC<ManageSubAccountPageProps> = ({ orgId, onBack }) => {
    const { t } = useLanguage();
    const [org, setOrg] = useState<OrganizationWithDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'details' | 'subscription'>('details');
    const [actionLoading, setActionLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmName, setDeleteConfirmName] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const { impersonateOrganization } = useOrganization();

    useEffect(() => {
        loadOrgDetails();
    }, [orgId]);

    const loadOrgDetails = async () => {
        try {
            const data = await organizationService.getOrganizationWithDetails(orgId);
            setOrg(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Cargando detalles...</div>;
    if (!org) return <div className="p-8 text-center text-red-400">Cuenta no encontrada.</div>;

    const handleImpersonate = async () => {
        if (confirm(`¿Acceder como ${org.name}?`)) {
            await impersonateOrganization(org.id);
        }
    };

    const handleSuspend = async () => {
        if (!confirm(`¿Suspender la cuenta "${org.name}"? El usuario perderá acceso a su plan.`)) return;

        setActionLoading(true);
        const result = await organizationService.suspendOrganization(org.id);
        setActionLoading(false);

        if (result.success) {
            setMessage({ type: 'success', text: 'Cuenta suspendida exitosamente.' });
            await loadOrgDetails();
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al suspender.' });
        }
    };

    const handleReactivate = async () => {
        if (!confirm(`¿Reactivar la cuenta "${org.name}"?`)) return;

        setActionLoading(true);
        const result = await organizationService.reactivateOrganization(org.id);
        setActionLoading(false);

        if (result.success) {
            setMessage({ type: 'success', text: 'Cuenta reactivada exitosamente.' });
            await loadOrgDetails();
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al reactivar.' });
        }
    };

    const handleDelete = async () => {
        if (deleteConfirmName !== org.name) {
            setMessage({ type: 'error', text: 'El nombre no coincide. Escribe el nombre exacto.' });
            return;
        }

        setActionLoading(true);
        const result = await organizationService.deleteOrganization(org.id);
        setActionLoading(false);

        if (result.success) {
            onBack();
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al eliminar.' });
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('es-CO', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    };

    const formatPrice = (cents: number | null) => {
        if (!cents) return 'Gratis';
        return `$${(cents / 100).toFixed(2)} USD`;
    };

    const planName = org.activePlanName || 'free';
    const planDisplay = org.activePlanDisplayName || 'Free';
    const planColors = PLAN_COLORS[planName] || PLAN_COLORS.free;
    const subStatus = STATUS_LABELS[org.subscriptionStatus || ''] || STATUS_LABELS.expired;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{org.name}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider
                                ${org.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {org.status === 'active' ? 'Activa' : org.status === 'suspended' ? 'Suspendida' : org.status}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${planColors}`}>
                                {planDisplay}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleImpersonate}
                        className="flex items-center gap-2 px-4 py-2 bg-brand/10 hover:bg-brand/20 text-brand rounded-lg text-sm font-bold border border-brand/20 transition-all shadow-lg shadow-brand/5"
                    >
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                        Acceder a la Cuenta
                    </button>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    message.type === 'success'
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                    <p className="font-medium">{message.text}</p>
                    <button onClick={() => setMessage(null)} className="p-1 hover:bg-white/10 rounded">
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-white/5">
                <button
                    onClick={() => setActiveTab('details')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-brand text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    Detalles Generales
                </button>
                <button
                    onClick={() => setActiveTab('subscription')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'subscription' ? 'border-brand text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    Suscripción
                </button>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Column */}
                <div className="lg:col-span-2 space-y-6">
                    {activeTab === 'details' && (
                        <div className="space-y-6">
                            {/* Info Card */}
                            <div className="glass p-6 rounded-xl border border-white/5">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <BuildingOfficeIcon className="w-5 h-5 text-blue-400" />
                                    Información del Titular
                                </h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">Nombre</label>
                                        <p className="text-slate-300 mt-1">{org.ownerName || 'No registrado'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">Email</label>
                                        <p className="text-slate-300 mt-1">{org.ownerEmail || 'No registrado'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">Cuenta Creada</label>
                                        <p className="text-slate-300 mt-1">{formatDate(org.created_at)}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">ID de Organización</label>
                                        <p className="text-slate-400 mt-1 font-mono text-xs">{org.id}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'subscription' && (
                        <div className="glass p-6 rounded-xl border border-white/5">
                            <h3 className="text-lg font-bold text-white mb-6">Detalles de Suscripción</h3>

                            {org.activePlanName && org.activePlanName !== 'free' ? (
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">Plan Activo</label>
                                        <div className="mt-1.5">
                                            <span className={`px-3 py-1 rounded-lg text-sm font-bold uppercase border ${planColors}`}>
                                                {planDisplay}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">Precio</label>
                                        <p className="text-white mt-1 text-lg font-bold">{formatPrice(org.planPriceCents)}<span className="text-slate-500 text-sm font-normal">/mes</span></p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">Estado</label>
                                        <div className="mt-1.5">
                                            <span className={`px-2.5 py-1 rounded text-xs font-bold ${subStatus.color}`}>
                                                {subStatus.label}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">Periodo</label>
                                        <p className="text-slate-300 mt-1 capitalize">{org.billingPeriod || 'monthly'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">Fecha de Inicio</label>
                                        <p className="text-slate-300 mt-1">{formatDate(org.subscriptionCreatedAt)}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">Renovación</label>
                                        <p className="text-slate-300 mt-1">{formatDate(org.subscriptionRenewsAt)}</p>
                                    </div>
                                    {org.subscriptionEndsAt && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase">Finalización</label>
                                            <p className="text-red-400 mt-1 font-medium">{formatDate(org.subscriptionEndsAt)}</p>
                                        </div>
                                    )}
                                    {org.whopMembershipId && (
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase">Whop Membership ID</label>
                                            <p className="text-slate-400 mt-1 font-mono text-xs">{org.whopMembershipId}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-2xl flex items-center justify-center">
                                        <CheckCircleIcon className="w-8 h-8 text-slate-500" />
                                    </div>
                                    <p className="text-slate-400 font-medium">Plan gratuito por defecto</p>
                                    <p className="text-slate-500 text-sm mt-1">Esta cuenta no tiene una suscripción de pago activa.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar Column */}
                <div className="space-y-6">
                    <div className="glass p-6 rounded-xl border border-white/5">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Acciones</h3>
                        <div className="space-y-2">
                            {org.status === 'active' ? (
                                <button
                                    onClick={handleSuspend}
                                    disabled={actionLoading}
                                    className="w-full text-left px-4 py-2.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                >
                                    <ExclamationTriangleIcon className="w-4 h-4" />
                                    Suspender Cuenta
                                </button>
                            ) : (
                                <button
                                    onClick={handleReactivate}
                                    disabled={actionLoading}
                                    className="w-full text-left px-4 py-2.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                >
                                    <CheckCircleIcon className="w-4 h-4" />
                                    Reactivar Cuenta
                                </button>
                            )}
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={actionLoading}
                                className="w-full text-left px-4 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Eliminar Cuenta
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                                <TrashIcon className="w-5 h-5 text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white">Eliminar Cuenta</h3>
                        </div>
                        <p className="text-slate-400 text-sm mb-4">
                            Esta acción es <span className="text-red-400 font-bold">irreversible</span>. Se eliminarán todos los datos de la cuenta, incluyendo suscripciones, membresías y perfil del usuario.
                        </p>
                        <p className="text-slate-300 text-sm mb-2">
                            Escribe <span className="font-mono font-bold text-white">{org.name}</span> para confirmar:
                        </p>
                        <input
                            type="text"
                            value={deleteConfirmName}
                            onChange={(e) => setDeleteConfirmName(e.target.value)}
                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 mb-4"
                            placeholder={org.name}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmName(''); }}
                                className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleteConfirmName !== org.name || actionLoading}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {actionLoading ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
