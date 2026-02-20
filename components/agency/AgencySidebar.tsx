
import React from 'react';
import {
    Squares2X2Icon,
    UsersIcon,
    TrophyIcon,
    ChartBarIcon,
    SignalIcon,
    ListBulletIcon
} from '../icons/Icons';
import { useLanguage } from '../../contexts/LanguageContext';

interface AgencySidebarProps {
    activeView: string;
    onViewChange: (view: string) => void;
}

export const AgencySidebar: React.FC<AgencySidebarProps> = ({ activeView, onViewChange }) => {
    const { t } = useLanguage();

    const menuItems = [
        { id: 'dashboard', label: t('nav.dashboard'), icon: <Squares2X2Icon className="w-5 h-5" /> },
        { id: 'revenue', label: 'Revenue', icon: <ChartBarIcon className="w-5 h-5" /> },
        { id: 'subaccounts', label: t('nav.clients'), icon: <UsersIcon className="w-5 h-5" /> },
        { id: 'activity', label: 'Actividad', icon: <SignalIcon className="w-5 h-5" /> },
        { id: 'advanced-analytics', label: 'Analítica', icon: <TrophyIcon className="w-5 h-5" /> },
        { id: 'audit-log', label: 'Audit Log', icon: <ListBulletIcon className="w-5 h-5" /> },
    ];

    return (
        <div className="w-64 bg-slate-900 border-r border-white/5 flex-shrink-0 flex flex-col h-full min-h-screen">
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand to-emerald-400 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">D</span>
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-sm tracking-wide">{t('nav.main')}</h1>
                        <p className="text-xs text-slate-500">{t('nav.suite')}</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onViewChange(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                            ${activeView === item.id
                                ? 'bg-brand/10 text-brand border border-brand/20 shadow-lg shadow-brand/5'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                            }`}
                    >
                        {item.icon}
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
