import React, { useState, useEffect } from 'react';
import { organizationService } from '../../services/organizationService';
import { OrganizationWithDetails } from '../../types';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import {
    MagnifyingGlassIcon,
    BuildingOfficeIcon,
    ArrowRightOnRectangleIcon,
    EllipsisVerticalIcon
} from '../icons/Icons';

interface SubAccountsPageProps {
    onCreateClick: () => void;
    onManageClick: (orgId: string) => void;
}

type PlanFilter = 'all' | 'with_plan' | 'free_only';

const PLAN_COLORS: Record<string, string> = {
    free: 'bg-slate-500/20 text-slate-400 border-slate-500/20',
    starter: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    pro: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
    premium: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
};

export const SubAccountsPage: React.FC<SubAccountsPageProps> = ({ onCreateClick, onManageClick }) => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [orgs, setOrgs] = useState<OrganizationWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
    const { impersonateOrganization } = useOrganization();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const orgsData = await organizationService.getOrganizationsWithDetails();
            setOrgs(orgsData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Filtrar: excluir org agencia, aplicar búsqueda y filtro de plan
    const filteredOrgs = orgs
        .filter(org => !org.is_agency)
        .filter(org => {
            const term = searchTerm.toLowerCase();
            if (!term) return true;
            return (
                org.name.toLowerCase().includes(term) ||
                (org.ownerEmail || '').toLowerCase().includes(term) ||
                (org.ownerName || '').toLowerCase().includes(term) ||
                org.id.toLowerCase().includes(term)
            );
        })
        .filter(org => {
            if (planFilter === 'with_plan') return org.activePlanName && org.activePlanName !== 'free';
            if (planFilter === 'free_only') return !org.activePlanName || org.activePlanName === 'free';
            return true;
        });

    const handleImpersonate = async (orgId: string) => {
        if (confirm(t('confirm.impersonate'))) {
            await impersonateOrganization(orgId);
        }
    };

    const getPlanBadge = (org: OrganizationWithDetails) => {
        const planName = org.activePlanName || 'free';
        const displayName = org.activePlanDisplayName || 'Free';
        const colors = PLAN_COLORS[planName] || PLAN_COLORS.free;

        return (
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${colors}`}>
                {displayName}
            </span>
        );
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-400">{t('loading_subaccounts')}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
                <div className="relative w-full sm:w-96">
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email o ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:ring-2 focus:ring-brand placeholder-slate-500"
                    />
                    <MagnifyingGlassIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>

                <div className="flex items-center gap-3">
                    {/* Filtro de plan */}
                    <div className="flex bg-slate-800 rounded-lg p-0.5">
                        {([
                            { key: 'all', label: 'Todos' },
                            { key: 'with_plan', label: 'Con Plan' },
                            { key: 'free_only', label: 'Free' },
                        ] as { key: PlanFilter; label: string }[]).map(f => (
                            <button
                                key={f.key}
                                onClick={() => setPlanFilter(f.key)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                    planFilter === f.key
                                        ? 'bg-brand text-slate-900'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="text-sm text-slate-400">
                        <span className="font-bold text-white">{filteredOrgs.length}</span> cuentas
                    </div>
                </div>
            </div>

            {/* Grid View */}
            <div className="grid grid-cols-1 gap-4">
                {filteredOrgs.map(org => (
                    <div key={org.id} className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-xl p-6 transition-all duration-200 group relative">
                        <div className="flex flex-col md:flex-row items-center gap-6">

                            {/* Avatar */}
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                                <span className="text-2xl font-bold text-slate-300">{org.name.charAt(0).toUpperCase()}</span>
                            </div>

                            {/* Main Info */}
                            <div className="flex-1 text-center md:text-left min-w-0">
                                <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                                    <h3 className="text-lg font-bold text-white truncate">{org.name}</h3>
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider
                                        ${org.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'}`}>
                                        {org.status === 'active' ? 'Activa' : org.status === 'suspended' ? 'Suspendida' : org.status}
                                    </span>
                                </div>
                                <div className="flex flex-col md:flex-row items-center md:items-start gap-3 text-sm text-slate-400 mt-1">
                                    {org.ownerEmail && (
                                        <span className="text-slate-300">{org.ownerEmail}</span>
                                    )}
                                    {org.ownerName && (
                                        <span className="text-slate-500">{org.ownerName}</span>
                                    )}
                                    {!org.ownerEmail && !org.ownerName && (
                                        <span className="opacity-50 italic">Sin datos de contacto</span>
                                    )}
                                </div>
                            </div>

                            {/* Plan badge */}
                            <div className="text-center md:text-right px-4 border-l border-white/5">
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">{t('card.plan')}</p>
                                {getPlanBadge(org)}
                            </div>

                            <div className="text-center md:text-right px-4 border-l border-white/5 hidden md:block">
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{t('card.created')}</p>
                                <p className="text-sm font-medium text-slate-300">{new Date(org.created_at).toLocaleDateString()}</p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3 pl-4 md:border-l border-white/5">
                                <button
                                    onClick={() => handleImpersonate(org.id)}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-sm font-bold transition-all border border-amber-500/20"
                                >
                                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                                    Ingresar como
                                </button>
                                <button
                                    onClick={() => onManageClick(org.id)}
                                    className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <EllipsisVerticalIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredOrgs.length === 0 && (
                    <div className="text-center py-20 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
                        <BuildingOfficeIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-400">{t('page.no_results')}</h3>
                        <p className="text-slate-500 mt-2">{t('page.no_results_sub')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
