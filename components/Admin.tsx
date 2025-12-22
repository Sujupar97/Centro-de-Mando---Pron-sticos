import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TeamManagement } from './admin/TeamManagement';
import { SuperAdminDashboard } from './superadmin/SuperAdminDashboard';
import { SparklesIcon } from './icons/Icons';

export const AdminPage: React.FC = () => {
    const { profile } = useAuth();
    const [showSuperAdmin, setShowSuperAdmin] = useState(false);

    // Si el usuario activa la consola de superadmin
    if (showSuperAdmin) {
        return <SuperAdminDashboard onBack={() => setShowSuperAdmin(false)} />;
    }

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center border-b border-white/5 pb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-white tracking-tight">Administración de Organización</h2>
                    <p className="text-slate-400 text-sm mt-1">Gestiona tu equipo y accesos.</p>
                </div>

                {profile?.role === 'superadmin' && (
                    <button
                        onClick={() => setShowSuperAdmin(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-purple-500/20 transition-all transform hover:scale-[1.02] active:scale-95"
                    >
                        <SparklesIcon className="w-5 h-5" />
                        Consola Superadmin
                    </button>
                )}
            </div>

            <TeamManagement />
        </div>
    );
};