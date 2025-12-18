import React from 'react';
import { HomeIcon, ChartBarIcon, PlusCircleIcon, SparklesIcon, CogIcon, CalendarDaysIcon, UsersIcon, ArrowLeftOnRectangleIcon, TicketIcon } from './icons/Icons';
import { useAuth } from '../hooks/useAuth';
import { Page } from '../App';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  setCurrentPage: (page: Page) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, setCurrentPage }) => {
  const { profile, signOut } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <HomeIcon className="w-6 h-6 mx-auto mb-1" />, roles: ['superadmin', 'admin', 'usuario'] },
    { id: 'live', label: 'Jornadas', icon: <CalendarDaysIcon className="w-6 h-6 mx-auto mb-1" />, roles: ['superadmin', 'admin', 'usuario'] },
    { id: 'scan', label: 'Escanear', icon: <TicketIcon className="w-6 h-6 mx-auto mb-1" />, roles: ['superadmin', 'admin', 'usuario'] },
    { id: 'bets', label: 'Apuestas', icon: <ChartBarIcon className="w-6 h-6 mx-auto mb-1" />, roles: ['superadmin', 'admin', 'usuario'] },
    { id: 'add', label: 'Añadir', icon: <PlusCircleIcon className="w-6 h-6 mx-auto mb-1" />, roles: ['superadmin'] },
    { id: 'ai', label: 'Análisis IA', icon: <SparklesIcon className="w-6 h-6 mx-auto mb-1" />, roles: ['superadmin', 'admin', 'usuario'] },
    { id: 'admin', label: 'Admin', icon: <UsersIcon className="w-6 h-6 mx-auto mb-1" />, roles: ['superadmin', 'admin'] },
    { id: 'settings', label: 'Ajustes', icon: <CogIcon className="w-6 h-6 mx-auto mb-1" />, roles: ['superadmin', 'admin', 'usuario'] },
  ];

  const availableNavItems = navItems.filter(item => profile && item.roles.includes(profile.role));

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200">
      <header className="bg-gray-800 shadow-md z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-xl md:text-2xl font-bold text-white">
              <span className="text-green-accent">Bet</span>Command
            </h1>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400 hidden sm:block">
                Hola, {profile?.full_name || 'Usuario'}
              </span>
              <button onClick={signOut} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Cerrar sesión">
                <ArrowLeftOnRectangleIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
          <nav className="flex -mb-px overflow-x-auto">
            {availableNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id as Page)}
                className={`flex flex-col items-center justify-center w-24 py-3 px-2 text-xs font-medium transition-colors duration-200 flex-shrink-0 ${currentPage === item.id
                    ? 'text-green-accent border-b-2 border-green-accent'
                    : 'text-gray-400 hover:text-white border-b-2 border-transparent'
                  }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
