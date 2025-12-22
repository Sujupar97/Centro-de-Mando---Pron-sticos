import React, { useState } from 'react';
import { OrganizationsList } from './OrganizationsList';
import { UsersList } from './UsersList';
import { OperationsCenter } from './OperationsCenter';
import { PerformanceReports } from '../admin/PerformanceReports'; // Reuse existing component for Global Analytics
import { ChartBarIcon, BuildingOfficeIcon, UserGroupIcon, Cog6ToothIcon, ArrowLeftIcon } from '../icons/Icons';

interface SuperAdminDashboardProps {
    onBack: () => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'orgs' | 'operations' | 'analytics' | 'users'>('orgs');

    return (
        <div className="space-y-6">
            {/* Header / Nav */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                        Superadmin SaaS Suite
                    </h1>
                    <p className="text-slate-400 text-sm">Control centralizado de la plataforma</p>
                </div>
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-white/10"
                >
                    <ArrowLeftIcon className="w-4 h-4" /> Volver a Admin Normal
                </button>
            </div>

            {/* Main Layout: Sidebar/Tabs + Content */}
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="w-full lg:w-64 flex-shrink-0 space-y-2">
                    <NavButton
                        active={activeTab === 'orgs'}
                        onClick={() => setActiveTab('orgs')}
                        icon={<BuildingOfficeIcon className="w-5 h-5" />}
                        label="Organizaciones"
                    />
                    <NavButton
                        active={activeTab === 'operations'}
                        onClick={() => setActiveTab('operations')}
                        icon={<Cog6ToothIcon className="w-5 h-5" />}
                        label="Centro de Operaciones"
                    />
                    <NavButton
                        active={activeTab === 'analytics'}
                        onClick={() => setActiveTab('analytics')}
                        icon={<ChartBarIcon className="w-5 h-5" />}
                        label="Analítica Global"
                    />
                    <NavButton
                        active={activeTab === 'users'}
                        onClick={() => setActiveTab('users')}
                        icon={<UserGroupIcon className="w-5 h-5" />}
                        label="Usuarios Globales"
                    />
                </div>

                {/* Content Area */}
                <div className="flex-grow min-h-[500px]">
                    {activeTab === 'orgs' && <OrganizationsList />}
                    {activeTab === 'operations' && <OperationsCenter />}
                    {activeTab === 'analytics' && (
                        <div className="glass p-6 rounded-xl border border-white/5 shadow-2xl animate-fade-in">
                            <h2 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-3">
                                <ChartBarIcon className="w-6 h-6 text-emerald-400" />
                                Rendimiento Global de la IA
                            </h2>
                            <p className="text-slate-400 mb-6 text-sm">
                                Visualizando datos de TODAS las organizaciones (Vista Superadmin).
                            </p>
                            <PerformanceReports />
                        </div>
                    )}
                    {activeTab === 'users' && <UsersList />}
                </div>
            </div>
        </div>
    );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm
            ${active
                ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white border border-purple-500/30'
                : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
    >
        {icon}
        {label}
    </button>
);
