import React, { useState } from 'react';
import { CheckIcon, SparklesIcon, ArrowRightIcon } from '../icons/Icons';

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
    popular?: boolean;
}

const PLANS: Plan[] = [
    {
        id: '1',
        name: 'free',
        displayName: 'Gratis',
        description: 'Perfecto para empezar',
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
        description: 'Para apostadores ocasionales',
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
        description: 'Ideal para profesionales',
        priceCents: 2399,
        predictionsPercentage: 70,
        monthlyParlayLimit: 8,
        monthlyAnalysisLimit: null,
        canAnalyzeOwnTickets: false,
        canAccessMLDashboard: true,
        canAccessFullStats: true,
        hasPrioritySupport: false,
        popular: true
    },
    {
        id: '4',
        name: 'premium',
        displayName: 'Premium',
        description: 'Para expertos serios',
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

interface PlanSelectorProps {
    selectedPlan: Plan | null;
    onSelectPlan: (plan: Plan) => void;
}

export const PlanSelector: React.FC<PlanSelectorProps> = ({ selectedPlan, onSelectPlan }) => {
    const features = (plan: Plan) => [
        {
            label: 'Pronósticos premium',
            value: plan.predictionsPercentage === 0 ? '1 diario' : `${plan.predictionsPercentage}%`,
            included: true
        },
        {
            label: 'Parlays mensuales',
            value: plan.monthlyParlayLimit === 0 ? 'No incluido' :
                plan.monthlyParlayLimit >= 24 ? 'Ilimitados' : `${plan.monthlyParlayLimit}/mes`,
            included: plan.monthlyParlayLimit > 0
        },
        {
            label: 'Análisis de partidos',
            value: plan.monthlyAnalysisLimit === null ? 'Ilimitado' :
                plan.monthlyAnalysisLimit === 0 ? 'No incluido' : `${plan.monthlyAnalysisLimit}/mes`,
            included: plan.monthlyAnalysisLimit === null || plan.monthlyAnalysisLimit > 0
        },
        {
            label: 'Dashboard ML',
            included: plan.canAccessMLDashboard
        },
        {
            label: 'Soporte prioritario',
            included: plan.hasPrioritySupport
        }
    ];

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-white mb-2">Elige tu Plan</h2>
                <p className="text-slate-400">Selecciona el plan que mejor se adapte a tus necesidades</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {PLANS.map((plan) => {
                    const isSelected = selectedPlan?.id === plan.id;
                    const isPopular = plan.popular;

                    return (
                        <button
                            key={plan.id}
                            onClick={() => onSelectPlan(plan)}
                            className={`
                relative flex flex-col p-6 rounded-2xl border-2 transition-all text-left
                ${isSelected
                                    ? 'border-brand bg-brand/10 scale-105'
                                    : 'border-white/10 hover:border-white/20 bg-slate-900'
                                }
                ${isPopular && !isSelected ? 'ring-2 ring-brand/50' : ''}
              `}
                        >
                            {/* Popular Badge */}
                            {isPopular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <div className="bg-gradient-to-r from-brand to-emerald-400 text-slate-900 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                                        <SparklesIcon className="w-3 h-3" />
                                        Popular
                                    </div>
                                </div>
                            )}

                            {/* Selected Indicator */}
                            {isSelected && (
                                <div className="absolute top-4 right-4">
                                    <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center">
                                        <CheckIcon className="w-4 h-4 text-white" />
                                    </div>
                                </div>
                            )}

                            {/* Header */}
                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-white mb-1">{plan.displayName}</h3>
                                <p className="text-sm text-slate-400">{plan.description}</p>
                            </div>

                            {/* Price */}
                            <div className="mb-4">
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-3xl font-black ${isSelected ? 'text-brand' : 'text-white'}`}>
                                        {plan.priceCents === 0 ? 'Gratis' : formatPrice(plan.priceCents)}
                                    </span>
                                    {plan.priceCents > 0 && (
                                        <span className="text-slate-500">/mes</span>
                                    )}
                                </div>
                            </div>

                            {/* Features */}
                            <div className="space-y-2 flex-grow">
                                {features(plan).map((feature, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-sm">
                                        <CheckIcon className={`w-4 h-4 shrink-0 mt-0.5 ${feature.included ? 'text-brand' : 'text-slate-600'
                                            }`} />
                                        <span className={feature.included ? 'text-white' : 'text-slate-500'}>
                                            {feature.label}
                                            {feature.value && (
                                                <span className={`ml-1 font-semibold ${feature.included ? 'text-brand' : 'text-slate-600'
                                                    }`}>
                                                    {feature.value}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
