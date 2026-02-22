'use client';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, SparklesIcon } from '../icons/Icons';
import { getActivePlans, SubscriptionPlan } from '../../services/subscriptionService';
import { getPlanPrice } from '../../services/lemonSqueezyService';
import { useAuth } from '../../hooks/useAuth';

interface PricingCardProps {
    plan: SubscriptionPlan;
    isPopular: boolean;
    billingPeriod: 'monthly' | 'annual';
    onSelect: (plan: SubscriptionPlan) => void;
    isProcessing: boolean;
}

const PricingCard: React.FC<PricingCardProps> = ({ plan, isPopular, billingPeriod, onSelect, isProcessing }) => {
    const priceDisplay = getPlanPrice(plan.price_cents, plan.annual_price_cents, billingPeriod);
    const parlayPct = plan.parlay_percentage ?? 0;

    const features = [
        {
            label: 'Oportunidades diarias',
            value: plan.predictions_percentage <= 1
                ? '1 diario'
                : plan.predictions_percentage >= 100
                    ? '100% (Todos)'
                    : `${plan.predictions_percentage}%`,
            included: true
        },
        {
            label: 'Parlays diarios',
            value: parlayPct === 0
                ? 'No incluido'
                : parlayPct >= 100
                    ? '100% (Todos)'
                    : `${parlayPct}%`,
            included: parlayPct > 0
        },
        {
            label: 'Análisis de partidos',
            value: plan.analysis_percentage === 0
                ? 'No incluido'
                : plan.analysis_percentage >= 100
                    ? 'Todos'
                    : `${plan.analysis_percentage}%`,
            included: plan.analysis_percentage > 0
        },
        {
            label: 'Estadísticas completas',
            included: plan.can_access_full_stats
        },
        {
            label: 'Historial de resultados',
            included: true
        },
        {
            label: 'Soporte prioritario',
            included: plan.has_priority_support
        }
    ];

    return (
        <div className={`
      relative flex flex-col bg-slate-900 rounded-2xl border-2 transition-all duration-300
      ${isPopular ? 'border-brand shadow-xl shadow-brand/20 scale-105 lg:scale-110' : 'border-white/10 hover:border-white/20'}
    `}>
            {isPopular && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-brand via-emerald-400 to-brand text-slate-900 text-xs font-black px-5 py-2 rounded-full uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-brand/40 animate-pulse">
                        <SparklesIcon className="w-4 h-4" />
                        Más Popular
                        <SparklesIcon className="w-4 h-4" />
                    </div>
                </div>
            )}

            <div className={`p-6 border-b border-white/5 ${isPopular ? 'bg-gradient-to-b from-brand/10 to-transparent' : ''}`}>
                <h3 className="text-lg font-bold text-white">{plan.display_name}</h3>
                <p className="text-sm text-gray-400 mt-1">{plan.description}</p>

                <div className="mt-4">
                    <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-black ${isPopular ? 'text-brand' : 'text-white'}`}>
                            {plan.price_cents === 0 ? 'Gratis' : priceDisplay.monthly.replace('/mes', '')}
                        </span>
                        {plan.price_cents > 0 && (
                            <span className="text-gray-500">/mes</span>
                        )}
                    </div>
                    {priceDisplay.savings && (
                        <div className="mt-1 inline-flex items-center px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-xs font-medium">
                            {priceDisplay.savings}
                        </div>
                    )}
                    {billingPeriod === 'annual' && plan.annual_price_cents > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                            Facturado {priceDisplay.display}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex-grow p-6 space-y-3">
                {features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                        <CheckIcon className={`w-5 h-5 shrink-0 mt-0.5 ${feature.included ? (isPopular ? 'text-brand' : 'text-emerald-500') : 'text-gray-600'}`} />
                        <div>
                            <span className={feature.included ? 'text-white' : 'text-gray-500'}>
                                {feature.label}
                            </span>
                            {feature.value && (
                                <span className={`ml-2 text-sm ${feature.included ? (isPopular ? 'text-brand font-bold' : 'text-emerald-500 font-semibold') : 'text-gray-600'}`}>
                                    {feature.value}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

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
                    {plan.price_cents === 0 ? 'Comenzar Gratis' : 'Seleccionar Plan'}
                </button>
            </div>
        </div>
    );
};

export const PublicPricingPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadPlans = async () => {
            const data = await getActivePlans();
            setPlans(data);
            setLoading(false);
        };
        loadPlans();
    }, []);

    const handleSelectPlan = (plan: SubscriptionPlan) => {
        if (!user) {
            navigate(`/signup?plan=${plan.name}&billing=${billingPeriod}`);
            return;
        }
        navigate('/app?page=pricing');
    };

    const paidPlans = plans.filter(p => p.price_cents > 0);
    const freePlan = plans.find(p => p.price_cents === 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 py-12 px-4">
            <div className="text-center max-w-3xl mx-auto mb-8">
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
                    Accede a oportunidades de alto valor generadas por inteligencia artificial.
                </p>
            </div>

            {/* Toggle mensual/anual */}
            <div className="flex items-center justify-center gap-3 mb-10">
                <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-white' : 'text-gray-500'}`}>
                    Mensual
                </span>
                <button
                    onClick={() => setBillingPeriod(bp => bp === 'monthly' ? 'annual' : 'monthly')}
                    className={`relative w-14 h-7 rounded-full transition-colors ${billingPeriod === 'annual' ? 'bg-brand' : 'bg-slate-700'}`}
                >
                    <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${billingPeriod === 'annual' ? 'translate-x-7' : 'translate-x-0.5'}`} />
                </button>
                <span className={`text-sm font-medium ${billingPeriod === 'annual' ? 'text-white' : 'text-gray-500'}`}>
                    Anual
                </span>
                {billingPeriod === 'annual' && (
                    <span className="ml-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-xs font-bold">
                        -20%
                    </span>
                )}
            </div>

            {/* Paid Plans Grid */}
            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {paidPlans.map((plan) => (
                    <PricingCard
                        key={plan.id}
                        plan={plan}
                        isPopular={plan.name === 'pro'}
                        billingPeriod={billingPeriod}
                        onSelect={handleSelectPlan}
                        isProcessing={false}
                    />
                ))}
            </div>

            {/* Free Plan */}
            {freePlan && (
                <div className="max-w-2xl mx-auto mb-12">
                    <div className="text-center mb-6">
                        <p className="text-gray-400 text-sm uppercase tracking-wide">O empieza gratis</p>
                    </div>
                    <div className="max-w-md mx-auto">
                        <PricingCard
                            plan={freePlan}
                            isPopular={false}
                            billingPeriod={billingPeriod}
                            onSelect={handleSelectPlan}
                            isProcessing={false}
                        />
                    </div>
                </div>
            )}

            <div className="max-w-3xl mx-auto text-center">
                <p className="text-gray-500 text-sm">
                    Precios en USD. Puedes cancelar en cualquier momento.
                    Todos los planes incluyen acceso al historial completo de resultados anteriores.
                </p>
            </div>
        </div>
    );
};
