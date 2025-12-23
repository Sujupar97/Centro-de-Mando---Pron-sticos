
import React, { useState } from 'react';
import { AgencySidebar } from './AgencySidebar';
import { SubAccountsPage } from './SubAccountsPage';
import { CreateSubAccountModal } from './CreateSubAccountModal';
import { ManageSubAccountPage } from './ManageSubAccountPage';
import { OperationsCenter } from '../superadmin/OperationsCenter';
import { PerformanceReports } from '../admin/PerformanceReports';

interface AgencyLayoutProps {
    onBack?: () => void;
}

import { useLanguage } from '../../contexts/LanguageContext';
// ... imports

export const AgencyLayout: React.FC<AgencyLayoutProps> = ({ onBack }) => {
    const [activeView, setActiveView] = useState('subaccounts');
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const { t, language, setLanguage } = useLanguage();

    // Reset selected org when changing main views
    const handleViewChange = (view: string) => {
        setActiveView(view);
        setSelectedOrgId(null);
    };

    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden font-sans">
            <AgencySidebar activeView={activeView} onViewChange={handleViewChange} />

            <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 relative">
                {/* Header Actions (Search, Notifications, Add New) */}
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-30">
                    <div className="text-slate-400 text-sm">
                        {t('header.admin')} <span className="mx-2">/</span>
                        <span className="text-white capitalize">
                            {selectedOrgId ? t('detail.title') : t(`nav.${activeView === 'subaccounts' ? 'clients' : activeView}`)}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Language Toggle */}
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

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-8 relative">
                    <div className="max-w-7xl mx-auto animate-fade-in">
                        {activeView === 'launchpad' && (
                            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                                <div className="w-20 h-20 bg-brand/10 rounded-full flex items-center justify-center mb-6">
                                    <span className="text-4xl">🚀</span>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Bienvenido al Launchpad</h2>
                                <p className="text-slate-400 max-w-md">Aquí verás un resumen rápido de onboarding y tareas pendientes para configurar tu agencia al 100%.</p>
                            </div>
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

                        {activeView === 'dashboard' && (
                            <OperationsCenter />
                        )}

                        {activeView === 'analytics' && (
                            <div className="glass p-6 rounded-xl border border-white/5">
                                <PerformanceReports />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <CreateSubAccountModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                    // Trigger refresh of subaccounts if needed (usually context or SWR handles this)
                }}
            />
        </div>
    );
};
