
import React, { useState } from 'react';
import { AgencySidebar } from './AgencySidebar';
import { SubAccountsPage } from './SubAccountsPage';
import { CreateSubAccountModal } from './CreateSubAccountModal';
import { ManageSubAccountPage } from './ManageSubAccountPage';
import { OperationsCenter } from '../superadmin/OperationsCenter';
import AnaliticaAvanzada from '../admin/AnaliticaAvanzada';
import RevenueDashboard from './RevenueDashboard';
import UserActivityMonitor from './UserActivityMonitor';
import AuditLog from './AuditLog';

interface AgencyLayoutProps {
    onBack?: () => void;
}

import { useLanguage } from '../../contexts/LanguageContext';

export const AgencyLayout: React.FC<AgencyLayoutProps> = ({ onBack }) => {
    const [activeView, setActiveView] = useState('dashboard');
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const { t, language, setLanguage } = useLanguage();

    const handleViewChange = (view: string) => {
        setActiveView(view);
        setSelectedOrgId(null);
    };

    const viewLabels: Record<string, string> = {
        dashboard: t('nav.dashboard'),
        revenue: 'Revenue',
        subaccounts: t('nav.clients'),
        activity: 'Actividad',
        'advanced-analytics': 'Analítica',
        'audit-log': 'Audit Log',
    };

    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden font-sans">
            <AgencySidebar activeView={activeView} onViewChange={handleViewChange} />

            <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 relative">
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-30">
                    <div className="text-slate-400 text-sm">
                        {t('header.admin')} <span className="mx-2">/</span>
                        <span className="text-white capitalize">
                            {selectedOrgId ? t('detail.title') : viewLabels[activeView] || activeView}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-white/5">
                            <button
                                onClick={() => setLanguage('es')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${language === 'es' ? 'bg-brand text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                ES
                            </button>
                            <button
                                onClick={() => setLanguage('en')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${language === 'en' ? 'bg-brand text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                EN
                            </button>
                        </div>

                        {activeView === 'subaccounts' && !selectedOrgId && (
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="bg-brand hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-brand/20 transition-all flex items-center gap-2"
                            >
                                {t('btn.new_client')}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 relative">
                    <div className="max-w-7xl mx-auto animate-fade-in">
                        {activeView === 'dashboard' && (
                            <OperationsCenter />
                        )}

                        {activeView === 'revenue' && (
                            <RevenueDashboard />
                        )}

                        {activeView === 'subaccounts' && (
                            selectedOrgId ? (
                                <ManageSubAccountPage
                                    orgId={selectedOrgId}
                                    onBack={() => setSelectedOrgId(null)}
                                />
                            ) : (
                                <SubAccountsPage
                                    onCreateClick={() => setIsCreateModalOpen(true)}
                                    onManageClick={(orgId) => setSelectedOrgId(orgId)}
                                />
                            )
                        )}

                        {activeView === 'activity' && (
                            <UserActivityMonitor />
                        )}

                        {activeView === 'advanced-analytics' && (
                            <div className="glass p-6 rounded-xl border border-white/5">
                                <AnaliticaAvanzada />
                            </div>
                        )}

                        {activeView === 'audit-log' && (
                            <AuditLog />
                        )}
                    </div>
                </div>
            </div>

            <CreateSubAccountModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                }}
            />
        </div>
    );
};
