
import React, { useState, useEffect } from 'react';
import { Organization } from '../../types';
import { organizationService } from '../../services/organizationService';
import {
    BuildingOfficeIcon,
    UserIcon,
    Cog6ToothIcon,
    ArrowLeftIcon,
    ArrowRightOnRectangleIcon,
    CheckCircleIcon
} from '../icons/Icons';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface ManageSubAccountPageProps {
    orgId: string;
    onBack: () => void;
}

export const ManageSubAccountPage: React.FC<ManageSubAccountPageProps> = ({ orgId, onBack }) => {
    const { t } = useLanguage();
    const [org, setOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'details' | 'settings'>('details');
    const { impersonateOrganization } = useOrganization();

    useEffect(() => {
        loadOrgDetails();
    }, [orgId]);

    const loadOrgDetails = async () => {
        try {
            const data = await organizationService.getOrganizationById(orgId);
            setOrg(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Cargando detalles...</div>;
    if (!org) return <div className="p-8 text-center text-red-400">Organización no encontrada.</div>;

    const handleImpersonate = async () => {
        if (confirm(`¿Acceder como ${org.name}?`)) {
            await impersonateOrganization(org.id);
        }
    };

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
                                {org.status}
                            </span>
                            <span className="text-sm text-slate-500 font-mono">ID: {org.id}</span>
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

            {/* Tabs */}
            <div className="flex border-b border-white/5">
                <button
                    onClick={() => setActiveTab('details')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-brand text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    {t('detail.general')}
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-brand text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    {t('detail.limits')}
                </button>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Column */}
                <div className="lg:col-span-2 space-y-6">
                    {activeTab === 'details' && (
                        <div className="space-y-6">
                            {/* Business Info Card */}
                            <div className="glass p-6 rounded-xl border border-white/5">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <BuildingOfficeIcon className="w-5 h-5 text-blue-400" />
                                    {t('detail.info')}
                                </h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">{t('modal.label.name')}</label>
                                        <p className="text-slate-300 mt-1">{org.name}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">{t('card.plan')}</label>
                                        <p className="text-slate-300 mt-1 capitalize">{org.subscription_plan}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">{t('modal.label.email')}</label>
                                        <p className="text-slate-300 mt-1">{org.metadata?.email || 'No registrado'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase">{t('modal.label.phone')}</label>
                                        <p className="text-slate-300 mt-1">{org.metadata?.phone || 'No registrado'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase">{t('modal.label.address')}</label>
                                        <p className="text-slate-300 mt-1">
                                            {org.metadata?.address ? `${org.metadata.address}, ${org.metadata.city || ''}, ${org.metadata.country || ''}` : 'No registrada'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Preview (Placeholder) */}
                            <div className="glass p-6 rounded-xl border border-white/5">
                                <h3 className="text-lg font-bold text-white mb-4">{t('detail.stats')}</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                                        <p className="text-2xl font-bold text-white">0</p>
                                        <p className="text-xs text-slate-500 uppercase">Usuarios</p>
                                    </div>
                                    <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                                        <p className="text-2xl font-bold text-white">0</p>
                                        <p className="text-xs text-slate-500 uppercase">Análisis</p>
                                    </div>
                                    <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                                        <p className="text-2xl font-bold text-white">0</p>
                                        <p className="text-xs text-slate-500 uppercase">Apuestas</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="glass p-6 rounded-xl border border-white/5">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Cog6ToothIcon className="w-5 h-5 text-slate-400" />
                                {t('detail.limits')}
                            </h3>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-lg border border-white/5">
                                    <div>
                                        <p className="font-bold text-white">Estado de la Suscripción</p>
                                        <p className="text-xs text-slate-500">Controla el acceso general de la cuenta.</p>
                                    </div>
                                    <select
                                        value={org.status}
                                        disabled
                                        className="bg-slate-800 text-white text-sm rounded-lg px-3 py-1.5 border border-white/10"
                                    >
                                        <option value="active">Activa</option>
                                        <option value="suspended">Suspendida</option>
                                        <option value="cancelled">Cancelada</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-lg border border-white/5">
                                    <div>
                                        <p className="font-bold text-white">Límite de Análisis Diarios</p>
                                        <p className="text-xs text-slate-500">Máximo número de análisis de IA permitidos.</p>
                                    </div>
                                    <input
                                        type="number"
                                        value={100}
                                        disabled
                                        className="w-20 bg-slate-800 text-white text-sm rounded-lg px-3 py-1.5 border border-white/10 text-center"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Column */}
                <div className="space-y-6">
                    <div className="glass p-6 rounded-xl border border-white/5">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">{t('detail.actions')}</h3>
                        <div className="space-y-2">
                            <button className="w-full text-left px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-sm font-medium flex items-center gap-2">
                                <UserIcon className="w-4 h-4" /> {t('detail.reset_pass')}
                            </button>
                            <button className="w-full text-left px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium flex items-center gap-2">
                                <CheckCircleIcon className="w-4 h-4" /> {t('detail.suspend')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
