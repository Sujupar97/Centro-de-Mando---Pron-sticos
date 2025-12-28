import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TeamManagement } from './admin/TeamManagement';
import { AgencyLayout } from './agency/AgencyLayout';
import { SubscriptionManagement } from './superadmin/SubscriptionManagement';
import { SparklesIcon, CreditCardIcon } from './icons/Icons';

export const AdminPage: React.FC = () => {
    const { profile } = useAuth();
    const [showAgencySuite, setShowAgencySuite] = useState(false);
    const [showSubscriptions, setShowSubscriptions] = useState(false);

    // Si el usuario activa la suite de agencia
    if (showAgencySuite) {
        return <AgencyLayout onBack={() => setShowAgencySuite(false)} />;
    }

    // Si el usuario activa gestión de suscripciones
    if (showSubscriptions) {
        return (
            <div className="h-full">
                <button
                    onClick={() => setShowSubscriptions(false)}
                    className="mb-4 px-4 py-2 text-gray-400 hover:text-white flex items-center gap-2"
                >
                    ← Volver a Admin
                </button>
                <SubscriptionManagement />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center border-b border-white/5 pb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-white tracking-tight">Administración de Organización</h2>
                    <p className="text-slate-400 text-sm mt-1">Gestiona tu equipo y accesos.</p>
                </div>

                <div className="flex gap-3">
                    {profile?.role === 'superadmin' && (
                        <>
                            <button
                                onClick={() => setShowSubscriptions(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand to-emerald-600 text-slate-900 font-bold rounded-xl hover:shadow-lg hover:shadow-brand/20 transition-all transform hover:scale-[1.02] active:scale-95"
                            >
                                <CreditCardIcon className="w-5 h-5" />
                                Suscripciones
                            </button>
                            <button
                                onClick={() => setShowAgencySuite(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-purple-500/20 transition-all transform hover:scale-[1.02] active:scale-95"
                            >
                                <SparklesIcon className="w-5 h-5" />
                                Agency Suite
                            </button>
                        </>
                    )}
                </div>
            </div>

            <TeamManagement />
        </div>
    );
};