import React, { useState, useEffect } from 'react';
import { organizationService } from '../../services/organizationService';
import { Organization } from '../../types';
import { useOrganization } from '../../contexts/OrganizationContext';
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

export const SubAccountsPage: React.FC<SubAccountsPageProps> = ({ onCreateClick, onManageClick }) => {
    const { t } = useLanguage();
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { impersonateOrganization } = useOrganization();

    useEffect(() => {
        loadOrgs();
    }, []);

    const loadOrgs = async () => {
        try {
            const data = await organizationService.getAllOrganizations();
            setOrgs(data);
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

                            {/* Metrics / Dates */}
                            <div className="text-center md:text-right px-4 border-l border-white/5">
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{t('card.plan')}</p>
                                <p className="text-sm font-bold text-white capitalize">{org.subscription_plan}</p>
                            </div>

                            <div className="text-center md:text-right px-4 border-l border-white/5 hidden md:block">
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{t('card.created')}</p>
                                <p className="text-sm font-medium text-slate-300">{new Date(org.created_at).toLocaleDateString()}</p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3 pl-4 md:border-l border-white/5">
                                <button
                                    onClick={() => handleImpersonate(org.id)}
                                    className="flex items-center gap-2 px-4 py-2 bg-brand/10 hover:bg-brand/20 text-brand rounded-lg text-sm font-bold transition-all border border-brand/20"
                                >
                                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                                    {t('card.access')}
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
