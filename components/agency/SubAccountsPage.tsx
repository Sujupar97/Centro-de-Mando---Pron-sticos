import React, { useState, useEffect } from 'react';
import { organizationService } from '../../services/organizationService';
import { getActivePlans, assignPlanToUser, SubscriptionPlan as PlanRecord } from '../../services/subscriptionService';
import { Organization } from '../../types';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import {
    MagnifyingGlassIcon,
    BuildingOfficeIcon,
    PhoneIcon,
    MapPinIcon,
    ArrowRightOnRectangleIcon,
    EllipsisVerticalIcon
} from '../icons/Icons';

interface SubAccountsPageProps {
    onCreateClick: () => void;
    onManageClick: (orgId: string) => void;
}

const PLAN_COLORS: Record<string, string> = {
    free: 'bg-slate-500/20 text-slate-400 border-slate-500/20',
    starter: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    pro: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
    premium: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
    unlimited: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
};

export const SubAccountsPage: React.FC<SubAccountsPageProps> = ({ onCreateClick, onManageClick }) => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [plans, setPlans] = useState<PlanRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [changingPlan, setChangingPlan] = useState<string | null>(null);
    const { impersonateOrganization } = useOrganization();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [orgsData, plansData] = await Promise.all([
                organizationService.getAllOrganizations(),
                getActivePlans(),
            ]);
            setOrgs(orgsData);
            setPlans(plansData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredOrgs = orgs.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleImpersonate = async (orgId: string) => {
        if (confirm(t('confirm.impersonate'))) {
            await impersonateOrganization(orgId);
        }
    };

    const handlePlanChange = async (org: Organization, newPlanName: string) => {
        const plan = plans.find(p => p.name === newPlanName);
        if (!plan || newPlanName === org.subscription_plan) return;

        setChangingPlan(org.id);
        try {
            // Obtener owner del org para asignar el plan
            const members = await organizationService.getOrganizationMembers(org.id);
            const owner = members.find(m => m.role === 'owner') || members[0];
            if (!owner) {
                alert('No se encontró el dueño de esta cuenta.');
                return;
            }

            const result = await assignPlanToUser(
                owner.user_id,
                org.id,
                plan.id,
                user?.id,
                `Plan changed by agency admin`
            );

            if (result.success) {
                // Actualizar el org local también
                setOrgs(prev => prev.map(o =>
                    o.id === org.id ? { ...o, subscription_plan: newPlanName as any } : o
                ));
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (e: any) {
            console.error('Error changing plan:', e);
            alert(`Error: ${e.message}`);
        } finally {
            setChangingPlan(null);
        }
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
                        placeholder={t('page.search_ph')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:ring-2 focus:ring-brand placeholder-slate-500"
                    />
                    <MagnifyingGlassIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>

                <div className="text-sm text-slate-400">
                    {t('page.showing')} <span className="font-bold text-white">{filteredOrgs.length}</span> {t('page.items')}
                </div>
            </div>

            {/* Grid View */}
            <div className="grid grid-cols-1 gap-4">
                {filteredOrgs.map(org => (
                    <div key={org.id} className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-xl p-6 transition-all duration-200 group relative">
                        <div className="flex flex-col md:flex-row items-center gap-6">

                            {/* Avatar / Logo */}
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                                <span className="text-2xl font-bold text-slate-300">{org.name.charAt(0).toUpperCase()}</span>
                            </div>

                            {/* Main Info */}
                            <div className="flex-1 text-center md:text-left min-w-0">
                                <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                                    <h3 className="text-lg font-bold text-white truncate">{org.name}</h3>
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider
                                        ${org.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'}`}>
                                        {org.status}
                                    </span>
                                </div>
                                <div className="flex flex-col md:flex-row items-center md:items-start gap-4 text-sm text-slate-400 mt-2">
                                    {org.metadata?.address && (
                                        <div className="flex items-center gap-1.5">
                                            <MapPinIcon className="w-3.5 h-3.5" />
                                            <span>{org.metadata.address}</span>
                                        </div>
                                    )}
                                    {org.metadata?.phone && (
                                        <div className="flex items-center gap-1.5">
                                            <PhoneIcon className="w-3.5 h-3.5" />
                                            <span>{org.metadata.phone}</span>
                                        </div>
                                    )}
                                    {!org.metadata?.address && !org.metadata?.phone && (
                                        <span className="opacity-50 italic">{t('card.no_contact_data')}</span>
                                    )}
                                </div>
                            </div>

                            {/* Plan selector */}
                            <div className="text-center md:text-right px-4 border-l border-white/5">
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{t('card.plan')}</p>
                                <select
                                    value={org.subscription_plan}
                                    onChange={(e) => handlePlanChange(org, e.target.value)}
                                    disabled={changingPlan === org.id}
                                    className={`bg-slate-800 border rounded-lg px-3 py-1.5 text-sm font-bold capitalize cursor-pointer focus:ring-2 focus:ring-brand transition-all ${
                                        changingPlan === org.id ? 'opacity-50 cursor-wait' : ''
                                    } ${PLAN_COLORS[org.subscription_plan] || PLAN_COLORS.free}`}
                                >
                                    {plans.map(p => (
                                        <option key={p.id} value={p.name} className="bg-slate-800 text-white">
                                            {p.display_name}
                                        </option>
                                    ))}
                                    {/* Fallback si el plan actual no esta en la lista */}
                                    {!plans.find(p => p.name === org.subscription_plan) && (
                                        <option value={org.subscription_plan} className="bg-slate-800 text-white">
                                            {org.subscription_plan}
                                        </option>
                                    )}
                                </select>
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
                        <button onClick={onCreateClick} className="mt-6 text-brand hover:underline font-bold text-sm">{t('btn.new_client')}</button>
                    </div>
                )}
            </div>
        </div>
    );
};
