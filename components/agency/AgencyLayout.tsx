
import React, { useState } from 'react';
import { AgencySidebar } from './AgencySidebar';
import { SubAccountsPage } from './SubAccountsPage';
import { CreateSubAccountModal } from './CreateSubAccountModal';
import { ManageSubAccountPage } from './ManageSubAccountPage';
import { OperationsCenter } from '../superadmin/OperationsCenter';
import AnaliticaAvanzada from '../admin/AnaliticaAvanzada';
import PlanPerformanceComparison from '../admin/PlanPerformanceComparison';
import RevenueDashboard from './RevenueDashboard';
import UserActivityMonitor from './UserActivityMonitor';
import AuditLog from './AuditLog';
import MLTrainingPanel from './MLTrainingPanel';
import { NotificationAnalytics } from './NotificationAnalytics';
import ResultadosPublic from '../live/ResultadosPublic';

interface AgencyLayoutProps {
    onBack?: () => void;
}

import { useLanguage } from '../../contexts/LanguageContext';

export const AgencyLayout: React.FC<AgencyLayoutProps> = ({ onBack }) => {
    const [activeView, setActiveView] = useState('dashboard');
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { t, language, setLanguage } = useLanguage();

    const handleViewChange = (view: string) => {
        setActiveView(view);
        setSelectedOrgId(null);
    };

    const viewLabels: Record<string, string> = {
        dashboard: t('nav.dashboard'),
        results: 'Resultados',
        revenue: 'Revenue',
        subaccounts: t('nav.clients'),
        activity: 'Actividad',
        'plan-performance': 'Rendimiento por Plan',
        'advanced-analytics': 'Analítica',
        'ml-training': 'ML Training',
        'audit-log': 'Audit Log',
    };

    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden font-sans">
            {/* Desktop sidebar */}
            <div className="hidden md:block">
                <AgencySidebar activeView={activeView} onViewChange={handleViewChange} />
            </div>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
                    <div className="fixed left-0 top-0 h-full w-64 z-50 bg-slate-900 border-r border-white/5 animate-slide-in-left">
                        <AgencySidebar activeView={activeView} onViewChange={(v) => { handleViewChange(v); setSidebarOpen(false); }} />
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 relative">
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-30">
                    <div className="flex items-center gap-3 text-slate-400 text-sm">
                        <button className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors" onClick={() => setSidebarOpen(true)}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                        </button>
                        <span>{t('header.admin')} <span className="mx-2">/</span>
                        <span className="text-white capitalize">
                            {selectedOrgId ? t('detail.title') : viewLabels[activeView] || activeView}
                        </span></span>
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

                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
                    <div className="max-w-7xl mx-auto animate-fade-in">
                        {activeView === 'dashboard' && (
                            <OperationsCenter />
                        )}

                        {activeView === 'results' && (
                            <div className="glass p-6 rounded-xl border border-white/5">
                                <ResultadosPublic />
                            </div>
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

                        {activeView === 'plan-performance' && (
                            <PlanPerformanceComparison />
                        )}

                        {activeView === 'advanced-analytics' && (
                            <div className="glass p-6 rounded-xl border border-white/5">
                                <AnaliticaAvanzada />
                            </div>
                        )}

                        {activeView === 'notifications' && (
                            <NotificationAnalytics />
                        )}

                        {activeView === 'ml-training' && (
                            <MLTrainingPanel />
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
