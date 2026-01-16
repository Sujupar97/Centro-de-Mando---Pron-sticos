import React, { useState } from 'react';
import { HomeIcon, ChartBarIcon, PlusCircleIcon, SparklesIcon, CogIcon, CalendarDaysIcon, UsersIcon, ArrowLeftOnRectangleIcon, TicketIcon, CreditCardIcon } from './icons/Icons';
import { useAuth } from '../hooks/useAuth';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { Page } from '../App';
import { CreateSubAccountModal } from './agency/CreateSubAccountModal';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  setCurrentPage: (page: Page) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, setCurrentPage }) => {
  const { profile, signOut } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Determinar nivel de acceso basado en el nuevo sistema de roles
  // platform_owner = Owner de la plataforma (Julian) → ACCESO TOTAL
  // agency_admin = Empleado de agencia → ACCESO TOTAL
  // org_owner = Dueño de organización/cliente → Acceso de admin de cuenta
  // org_member = Miembro de organización → Acceso limitado
  // user = Usuario individual → Acceso limitado
  // Backward compatibility: superadmin, admin, usuario

  const isAgencySuperadmin =
    profile?.role === 'platform_owner' ||
    profile?.role === 'agency_admin' ||
    profile?.role === 'superadmin'; // Backward compatibility

  const isAccountAdmin =
    profile?.role === 'org_owner' ||
    profile?.role === 'admin'; // Backward compatibility

  const isUser =
    profile?.role === 'org_member' ||
    profile?.role === 'user' ||
    profile?.role === 'usuario'; // Backward compatibility

  // Opciones del sidebar con niveles de acceso más granulares
  const navItems = [
    // Opciones para TODOS los usuarios
    { id: 'dashboard', label: 'Dashboard', icon: <HomeIcon className="w-5 h-5" />, forAgency: true, forAccount: true, forUser: true },
    { id: 'live', label: 'Jornadas', icon: <CalendarDaysIcon className="w-5 h-5" />, forAgency: true, forAccount: true, forUser: true },
    { id: 'bets', label: 'Apuestas', icon: <ChartBarIcon className="w-5 h-5" />, forAgency: true, forAccount: true, forUser: true },
    { id: 'ai', label: 'Análisis IA', icon: <SparklesIcon className="w-5 h-5" />, forAgency: true, forAccount: true, forUser: true },
    { id: 'settings', label: 'Ajustes', icon: <CogIcon className="w-5 h-5" />, forAgency: true, forAccount: true, forUser: true },

    // Opciones para ADMINS de cuenta y superiores
    { id: 'scan', label: 'Escanear', icon: <TicketIcon className="w-5 h-5" />, forAgency: true, forAccount: true, forUser: false },
    { id: 'pricing', label: 'Planes', icon: <CreditCardIcon className="w-5 h-5" />, forAgency: true, forAccount: true, forUser: false },

    // Opciones SOLO para SUPERADMIN de AGENCIA (platform_owner, agency_admin)
    { id: 'add', label: 'Añadir', icon: <PlusCircleIcon className="w-5 h-5" />, forAgency: true, forAccount: false, forUser: false },
    { id: 'ml', label: 'ML Learning', icon: <SparklesIcon className="w-5 h-5" />, forAgency: true, forAccount: false, forUser: false },
    { id: 'admin', label: 'Admin', icon: <UsersIcon className="w-5 h-5" />, forAgency: true, forAccount: false, forUser: false },
  ];

  // Filtrar según el nivel del usuario
  const availableNavItems = navItems.filter(item => {
    if (isAgencySuperadmin) return item.forAgency;
    if (isAccountAdmin) return item.forAccount;
    if (isUser) return item.forUser;
    return item.forUser; // Por defecto, permisos básicos
  });

  return (
    <div className="flex h-screen overflow-hidden text-slate-200 font-sans selection:bg-brand selection:text-white bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">

      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-64 h-full glass backdrop-blur-xl border-r border-white/5 fixed left-0 top-0 z-30 transition-transform duration-300">
        <div className="p-4 flex items-center justify-center border-b border-white/5 gap-3">
          <img src="/derbix-logo.png" alt="Derbix" className="w-10 h-10 object-contain" />
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">
            Derbix
          </h1>
        </div>

        <div className="px-3 pt-4">
          <OrganizationSwitcher onCreateClick={() => setIsCreateModalOpen(true)} />
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
          {availableNavItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id as Page)}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-300 ease-out group active:scale-[0.98] ${isActive
                  ? 'bg-gradient-to-r from-brand/20 to-transparent text-brand border-l-2 border-brand shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 hover:pl-5 active:bg-white/10'
                  }`}
              >
                <div className={`mr-3 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </div>
                <span className="font-medium tracking-wide text-sm">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand animate-pulse shadow-[0_0_8px_#10b981]"></div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 bg-slate-900/40">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand to-blue-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{profile?.full_name || 'Usuario'}</p>
              <p className="text-xs text-slate-400 truncate capitalize">{profile?.role}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-400 transition-colors text-xs font-medium border border-white/5"
          >
            <ArrowLeftOnRectangleIcon className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col relative h-full overflow-hidden md:ml-64 transition-all duration-300">
        {/* Mobile Header */}
        <header className="md:hidden h-16 glass flex items-center justify-between px-6 sticky top-0 z-30 backdrop-blur-xl border-b border-white/5 shadow-lg">
          <div className="flex items-center gap-2">
            <img src="/derbix-logo.png" alt="Derbix" className="w-8 h-8 object-contain" />
            <h1 className="text-lg font-display font-bold text-white">Derbix</h1>
          </div>
          <button onClick={signOut} className="text-slate-400 hover:text-white">
            <ArrowLeftOnRectangleIcon className="w-6 h-6" />
          </button>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 scroll-smooth relative z-10 overscroll-behavior-contain">
          <div className="max-w-[1800px] mx-auto animate-fade-in pb-24 md:pb-8">
            {children}
          </div>
        </main>

        {/* --- MOBILE BOTTOM TAB BAR --- */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 glass border-t border-white/5 z-40 px-6 pb-safe flex justify-between items-center backdrop-blur-2xl bg-slate-900/95">
          {availableNavItems.slice(0, 5).map((item) => { // Limit to 5 items for mobile spacing
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id as Page)}
                className={`flex flex-col items-center justify-center w-12 h-full transition-all duration-300 ease-out active:scale-95 ${isActive ? 'text-brand -translate-y-2' : 'text-slate-500 active:text-slate-200'}`}
              >
                <div className={`p-2 rounded-full transition-all duration-300 ease-out ${isActive ? 'bg-brand/10 shadow-[0_0_10px_rgba(16,185,129,0.2)] scale-110' : 'active:bg-white/5'}`}>
                  {item.icon}
                </div>
                {isActive && <span className="text-[10px] font-bold mt-1">{item.label}</span>}
              </button>
            );
          })}
          {/* Mobile Menu 'More' button logic could go here if >5 items needed, skipping for now per simplicity */}
        </nav>
      </div>

      <CreateSubAccountModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => setIsCreateModalOpen(false)}
      />

    </div>
  );
};
