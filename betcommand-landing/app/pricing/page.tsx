'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircleIcon, XCircleIcon, SparklesIcon, ArrowRightIcon } from '@/components/Icons';

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

const PLANS: Plan[] = [
    {
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
    },
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

function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}

function PricingCard({ plan, isPopular }: { plan: Plan; isPopular: boolean }) {
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
      ${isPopular ? 'border-emerald-500 shadow-xl shadow-emerald-500/20 scale-105' : 'border-white/10 hover:border-white/20'}
    `}>
            {/* Popular Badge */}
            {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-900 text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <SparklesIcon className="w-3 h-3" />
                        Más Popular
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white">{plan.displayName}</h3>
                <p className="text-sm text-gray-400 mt-1">{plan.description}</p>

                <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">
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
                        {feature.included ? (
                            <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                            <XCircleIcon className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                            <span className={feature.included ? 'text-white' : 'text-gray-500'}>
                                {feature.label}
                            </span>
                            <span className={`ml-2 text-sm ${feature.included ? 'text-emerald-500 font-semibold' : 'text-gray-600'}`}>
                                {feature.value}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* CTA */}
            <div className="p-6 border-t border-white/5">
                <Link
                    href="http://localhost:3000"
                    className={`
            w-full py-3 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2
            ${isPopular
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-900 hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.02]'
                            : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                        }
          `}
                >
                    {plan.priceCents === 0 ? 'Comenzar Gratis' : 'Seleccionar Plan'}
                    <ArrowRightIcon className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 py-12 px-4">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto mb-12">
                <Link href="/" className="text-emerald-500 hover:text-emerald-400 text-sm font-medium mb-4 inline-block">
                    ← Volver al inicio
                </Link>
                <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
                    Elige tu Plan
                </h1>
                <p className="text-xl text-gray-400">
                    Accede a pronósticos de alta probabilidad generados por inteligencia artificial
                    con sistema de aprendizaje automático.
                </p>
            </div>

            {/* Plans Grid */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
                {PLANS.map((plan) => (
                    <PricingCard
                        key={plan.id}
                        plan={plan}
                        isPopular={plan.name === 'pro'}
                    />
                ))}
            </div>

            {/* FAQ or Additional Info */}
            <div className="max-w-3xl mx-auto mt-16 text-center">
                <p className="text-gray-500 text-sm">
                    Los precios están en USD (convertidos a COP al pagar). Puedes cancelar en cualquier momento.
                    Todos los planes incluyen acceso a nuestra plataforma con inteligencia artificial.
                </p>
            </div>
        </div>
    );
}
