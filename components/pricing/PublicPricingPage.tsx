'use client';

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, SparklesIcon } from '../icons/Icons';
import { initSubscriptionPayment, usdToCop } from '../../services/wompiService';
import { useAuth } from '../../hooks/useAuth';

interface Plan {
    id: string;
    name: string;
    displayName: string;
    description: string;
    priceCents: number;
    predictionsPercentage: number;
    monthlyParlayLimit: number;
    monthlyAnalysisLimit: number | null;
    canAnalyzeOwnTickets: boolean;
    canAccessMLDashboard: boolean;
    canAccessFullStats: boolean;
    hasPrioritySupport: boolean;
}

const PAID_PLANS: Plan[] = [
    {
        id: '2',
        name: 'starter',
        displayName: 'Starter',
        description: 'Acceso al 35% de pronósticos premium',
        priceCents: 999,
        predictionsPercentage: 35,
        monthlyParlayLimit: 2,
        monthlyAnalysisLimit: 10,
        canAnalyzeOwnTickets: false,
        canAccessMLDashboard: false,
        canAccessFullStats: false,
        hasPrioritySupport: false
    },
    {
        id: '3',
        name: 'pro',
        displayName: 'Pro',
        description: 'Acceso al 70% de pronósticos + 8 parlays',
        priceCents: 2399,
        predictionsPercentage: 70,
        monthlyParlayLimit: 8,
        monthlyAnalysisLimit: null,
        canAnalyzeOwnTickets: false,
        canAccessMLDashboard: true,
        canAccessFullStats: true,
        hasPrioritySupport: false
    },
    {
        id: '4',
        name: 'premium',
        displayName: 'Premium',
        description: 'Acceso completo + soporte prioritario',
        priceCents: 9999,
        predictionsPercentage: 100,
        monthlyParlayLimit: 24,
        monthlyAnalysisLimit: null,
        canAnalyzeOwnTickets: true,
        canAccessMLDashboard: true,
        canAccessFullStats: true,
        hasPrioritySupport: true
    }
];

const FREE_PLAN: Plan = {
    id: '1',
    name: 'free',
    displayName: 'Gratis',
    description: 'Plan gratuito con acceso básico',
    priceCents: 0,
    predictionsPercentage: 0,
    monthlyParlayLimit: 0,
    monthlyAnalysisLimit: 0,
    canAnalyzeOwnTickets: false,
    canAccessMLDashboard: false,
    canAccessFullStats: false,
    hasPrioritySupport: false
};

function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}

interface PricingCardProps {
    plan: Plan;
    isPopular: boolean;
    onSelect: (plan: Plan) => void;
    isProcessing: boolean;
}

const PricingCard: React.FC<PricingCardProps> = ({ plan, isPopular, onSelect, isProcessing }) => {
    const features = [
        {
            label: 'Pronósticos de alta probabilidad',
            value: plan.predictionsPercentage === 0
                ? '1 diario'
                : plan.predictionsPercentage === 100
                    ? '100% (Ilimitados)'
                    : `${plan.predictionsPercentage}%`,
            included: true
        },
        {
            label: 'Parlays mensuales',
            value: plan.monthlyParlayLimit === 0
                ? 'No incluido'
                : plan.monthlyParlayLimit >= 24
                    ? 'Ilimitados (~24)'
                    : `${plan.monthlyParlayLimit}/mes`,
            included: plan.monthlyParlayLimit > 0
        },
        {
            label: 'Análisis de partidos',
            value: plan.monthlyAnalysisLimit === null
                ? 'Ilimitado'
                : plan.monthlyAnalysisLimit === 0
                    ? 'No incluido'
                    : `${plan.monthlyAnalysisLimit}/mes`,
            included: plan.monthlyAnalysisLimit === null || plan.monthlyAnalysisLimit > 0
        },
        {
            label: 'Dashboard ML',
            value: plan.canAccessMLDashboard ? 'Incluido' : 'No incluido',
            included: plan.canAccessMLDashboard
        },
        {
            label: 'Análisis de tickets propios',
            value: plan.canAnalyzeOwnTickets ? 'Incluido' : 'No incluido',
            included: plan.canAnalyzeOwnTickets
        },
        {
            label: 'Soporte prioritario',
            value: plan.hasPrioritySupport ? 'Incluido' : 'No incluido',
            included: plan.hasPrioritySupport
        }
    ];

    return (
        <div className={`
      relative flex flex-col bg-slate-900 rounded-2xl border-2 transition-all duration-300
      ${isPopular ? 'border-brand shadow-xl shadow-brand/20 scale-105 lg:scale-110' : 'border-white/10 hover:border-white/20'}
    `}>
            {/* Popular Badge */}
            {isPopular && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-brand via-emerald-400 to-brand text-slate-900 text-xs font-black px-5 py-2 rounded-full uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-brand/40 animate-pulse">
                        <SparklesIcon className="w-4 h-4" />
                        Más Popular
                        <SparklesIcon className="w-4 h-4" />
                    </div>
                </div>
            )}

            {/* Header */}
            <div className={`p-6 border-b border-white/5 ${isPopular ? 'bg-gradient-to-b from-brand/10 to-transparent' : ''}`}>
                <h3 className="text-lg font-bold text-white">{plan.displayName}</h3>
                <p className="text-sm text-gray-400 mt-1">{plan.description}</p>

                <div className="mt-4 flex items-baseline gap-1">
                    <span className={`text-4xl font-black ${isPopular ? 'text-brand' : 'text-white'}`}>
                        {plan.priceCents === 0 ? 'Gratis' : formatPrice(plan.priceCents)}
                    </span>
                    {plan.priceCents > 0 && (
                        <span className="text-gray-500">/mes</span>
                    )}
                </div>
            </div>

            {/* Features */}
            <div className="flex-grow p-6 space-y-3">
                {features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                        <CheckIcon className={`w-5 h-5 shrink-0 mt-0.5 ${feature.included ? (isPopular ? 'text-brand' : 'text-emerald-500') : 'text-gray-600'}`} />
                        <div>
                            <span className={feature.included ? 'text-white' : 'text-gray-500'}>
                                {feature.label}
                            </span>
                            <span className={`ml-2 text-sm ${feature.included ? (isPopular ? 'text-brand font-bold' : 'text-emerald-500 font-semibold') : 'text-gray-600'}`}>
                                {feature.value}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* CTA */}
            <div className="p-6 border-t border-white/5">
                <button
                    onClick={() => onSelect(plan)}
                    disabled={isProcessing}
                    className={`
            w-full py-3 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
            ${isPopular
                            ? 'bg-gradient-to-r from-brand via-emerald-400 to-brand text-slate-900 hover:shadow-lg hover:shadow-brand/40 hover:scale-[1.02] animate-gradient-x'
                            : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                        }
          `}
                >
                    {isProcessing ? (
                        <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            Procesando...
                        </>
                    ) : (
                        plan.priceCents === 0 ? 'Comenzar Gratis' : 'Seleccionar Plan'
                    )}
                </button>
            </div>
        </div>
    );
};

export const PublicPricingPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSelectPlan = async (plan: Plan) => {
        if (!user) {
            navigate('/login');
            return;
        }

        if (plan.priceCents === 0) {
            navigate('/login');
            return;
        }

        setProcessing(true);
        setMessage(null);

        try {
            const priceCOP = usdToCop(plan.priceCents / 100);

            await initSubscriptionPayment(
                plan.name,
                plan.displayName,
                priceCOP,
                profile?.email || user.email || '',
                profile?.full_name || 'Usuario',
                () => {
                    setMessage({ type: 'success', text: '¡Pago procesado! Tu suscripción se activará en segundos.' });
                    setTimeout(() => navigate('/app'), 3000);
                },
                () => {
                    setMessage({ type: 'error', text: 'El pago no pudo ser procesado. Intenta de nuevo.' });
                }
            );
        } catch (error) {
            console.error('Error selecting plan:', error);
            setMessage({ type: 'error', text: 'Ocurrió un error. Intenta de nuevo.' });
        }

        setProcessing(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 py-12 px-4">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto mb-12">
                <button
                    onClick={() => navigate('/')}
                    className="text-brand hover:text-emerald-400 text-sm font-medium mb-4 inline-block"
                >
                    ← Volver al inicio
                </button>
                <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
                    Elige tu Plan
                </h1>
                <p className="text-xl text-gray-400">
                    Accede a pronósticos de alta probabilidad generados por inteligencia artificial
                    con sistema de aprendizaje automático.
                </p>
            </div>

            {/* Message Banner */}
            {message && (
                <div className={`max-w-2xl mx-auto mb-8 p-4 rounded-xl border ${message.type === 'success'
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                    <p className="text-center font-medium">{message.text}</p>
                </div>
            )}

            {/* Paid Plans Grid */}
            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {PAID_PLANS.map((plan, idx) => (
                    <PricingCard
                        key={plan.id}
                        plan={plan}
                        isPopular={idx === 1} // Plan del medio (Pro)
                        onSelect={handleSelectPlan}
                        isProcessing={processing}
                    />
                ))}
            </div>

            {/* Free Plan - Destacado Abajo */}
            <div className="max-w-2xl mx-auto mb-12">
                <div className="text-center mb-6">
                    <p className="text-gray-400 text-sm uppercase tracking-wide">O empieza gratis</p>
                </div>
                <div className="max-w-md mx-auto">
                    <PricingCard
                        plan={FREE_PLAN}
                        isPopular={false}
                        onSelect={handleSelectPlan}
                        isProcessing={processing}
                    />
                </div>
            </div>

            {/* FAQ or Additional Info */}
            <div className="max-w-3xl mx-auto text-center">
                <p className="text-gray-500 text-sm">
                    Los precios están en USD (convertidos a COP al pagar). Puedes cancelar en cualquier momento.
                    Todos los planes incluyen acceso a nuestra plataforma con inteligencia artificial.
                </p>
            </div>
        </div>
    );
};
