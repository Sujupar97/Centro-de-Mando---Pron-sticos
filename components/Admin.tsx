import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TeamManagement } from './admin/TeamManagement';
import { AgencyLayout } from './agency/AgencyLayout';
import { SubscriptionManagement } from './superadmin/SubscriptionManagement';
import { SparklesIcon, CreditCardIcon, ChartBarIcon } from './icons/Icons';
import { isAgencyRole } from '../utils/roles';
import { SupportDashboard } from './admin/SupportDashboard';
import { SeoDashboard } from './admin/SeoDashboard';
import { AffiliateManager } from './admin/AffiliateManager';

export const AdminPage: React.FC = () => {
    const { profile } = useAuth();
    const [showAgencySuite, setShowAgencySuite] = useState(false);
    const [showSubscriptions, setShowSubscriptions] = useState(false);
    const [showSupport, setShowSupport] = useState(false);
    const [showSeo, setShowSeo] = useState(false);
    const [showAffiliates, setShowAffiliates] = useState(false);

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

    // Si el usuario activa soporte
    if (showSupport) {
        return <SupportDashboard onBack={() => setShowSupport(false)} />;
    }

    // Si el usuario activa SEO dashboard
    if (showSeo) {
        return <SeoDashboard onBack={() => setShowSeo(false)} />;
    }

    // Si el usuario activa gestión de afiliados
    if (showAffiliates) {
        return <AffiliateManager onBack={() => setShowAffiliates(false)} />;
    }

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center border-b border-white/5 pb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-white tracking-tight">Administración de Organización</h2>
                    <p className="text-slate-400 text-sm mt-1">Gestiona tu equipo y accesos.</p>
                </div>

                <div className="flex gap-3">
                    {isAgencyRole(profile?.role) && (
                        <>
                            <button
                                onClick={() => setShowSubscriptions(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand to-emerald-600 text-slate-900 font-bold rounded-xl hover:shadow-lg hover:shadow-brand/20 transition-all transform hover:scale-[1.02] active:scale-95"
                            >
                                <CreditCardIcon className="w-5 h-5" />
                                Suscripciones
                            </button>
                            <button
                                onClick={() => setShowSupport(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all transform hover:scale-[1.02] active:scale-95"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                                </svg>
                                Soporte
                            </button>
                            <button
                                onClick={() => setShowSeo(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all transform hover:scale-[1.02] active:scale-95"
                            >
                                <ChartBarIcon className="w-5 h-5" />
                                SEO
                            </button>
                            <button
                                onClick={() => setShowAffiliates(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all transform hover:scale-[1.02] active:scale-95"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
                                Afiliados
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