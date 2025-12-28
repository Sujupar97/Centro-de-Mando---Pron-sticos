import React, { useState, useEffect } from 'react';
import { getActivePlans, formatPrice, SubscriptionPlan, assignPlanToUser } from '../../services/subscriptionService';
import { initSubscriptionPayment, usdToCop } from '../../services/wompiService';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../hooks/useAuth';
import { useOrganization } from '../../contexts/OrganizationContext';
import { CheckCircleIcon, XCircleIcon, SparklesIcon, ArrowRightIcon } from '../icons/Icons';

interface PricingCardProps {
    plan: SubscriptionPlan;
    isCurrentPlan: boolean;
    isPopular: boolean;
    isProcessing: boolean;
    onSelect: (plan: SubscriptionPlan) => void;
}

const PricingCard: React.FC<PricingCardProps> = ({ plan, isCurrentPlan, isPopular, isProcessing, onSelect }) => {
    const features = [
        {
            label: 'Pronósticos de alta probabilidad',
            value: plan.predictions_percentage === 0
                ? '1 diario'
                : plan.predictions_percentage === 100
                    ? '100% (Ilimitados)'
                    : `${plan.predictions_percentage}%`,
            included: true
        },
        {
            label: 'Parlays mensuales',
            value: plan.monthly_parlay_limit === 0
                ? 'No incluido'
                : plan.monthly_parlay_limit >= 24
                    ? 'Ilimitados (~24)'
                    : `${plan.monthly_parlay_limit}/mes`,
            included: plan.monthly_parlay_limit > 0
        },
        {
            label: 'Análisis de partidos',
            value: plan.monthly_analysis_limit === null
                ? 'Ilimitado'
                : plan.monthly_analysis_limit === 0
                    ? 'No incluido'
                    : `${plan.monthly_analysis_limit}/mes`,
            included: plan.monthly_analysis_limit === null || plan.monthly_analysis_limit > 0
        },
        {
            label: 'Dashboard ML',
            value: plan.can_access_ml_dashboard ? 'Incluido' : 'No incluido',
            included: plan.can_access_ml_dashboard
        },
        {
            label: 'Análisis de tickets propios',
            value: plan.can_analyze_own_tickets ? 'Incluido' : 'No incluido',
            included: plan.can_analyze_own_tickets
        },
        {
            label: 'Soporte prioritario',
            value: plan.has_priority_support ? 'Incluido' : 'No incluido',
            included: plan.has_priority_support
        }
    ];

    return (
        <div className={`
      relative flex flex-col bg-slate-900 rounded-2xl border-2 transition-all duration-300
      ${isPopular ? 'border-brand shadow-xl shadow-brand/20 scale-105' : 'border-white/10 hover:border-white/20'}
      ${isCurrentPlan ? 'ring-2 ring-brand ring-offset-2 ring-offset-slate-950' : ''}
    `}>
            {/* Popular Badge */}
            {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-r from-brand to-emerald-400 text-slate-900 text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <SparklesIcon className="w-3 h-3" />
                        Más Popular
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white">{plan.display_name}</h3>
                <p className="text-sm text-gray-400 mt-1">{plan.description}</p>

                <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">
                        {plan.price_cents === 0 ? 'Gratis' : formatPrice(plan.price_cents)}
                    </span>
                    {plan.price_cents > 0 && (
                        <span className="text-gray-500">/mes</span>
                    )}
                </div>
            </div>

            {/* Features */}
            <div className="flex-grow p-6 space-y-3">
                {features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                        {feature.included ? (
                            <CheckCircleIcon className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                        ) : (
                            <XCircleIcon className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                            <span className={feature.included ? 'text-white' : 'text-gray-500'}>
                                {feature.label}
                            </span>
                            <span className={`ml-2 text-sm ${feature.included ? 'text-brand font-semibold' : 'text-gray-600'}`}>
                                {feature.value}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* CTA */}
            <div className="p-6 border-t border-white/5">
                {isCurrentPlan ? (
                    <button
                        disabled
                        className="w-full py-3 px-6 rounded-xl font-bold text-gray-400 bg-gray-800 cursor-not-allowed"
                    >
                        Plan Actual
                    </button>
                ) : (
                    <button
                        onClick={() => onSelect(plan)}
                        disabled={isProcessing}
                        className={`
              w-full py-3 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2
              ${isPopular
                                ? 'bg-gradient-to-r from-brand to-emerald-400 text-slate-900 hover:shadow-lg hover:shadow-brand/30 hover:scale-[1.02]'
                                : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                            }
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
            `}
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                {plan.price_cents === 0 ? 'Comenzar Gratis' : 'Seleccionar Plan'}
                                <ArrowRightIcon className="w-4 h-4" />
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export const PricingPage: React.FC = () => {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const { plan: currentPlan, refreshSubscription } = useSubscription();
    const { user, profile } = useAuth();
    const { currentOrg } = useOrganization();

    useEffect(() => {
        const loadPlans = async () => {
            const data = await getActivePlans();
            setPlans(data);
            setLoading(false);
        };
        loadPlans();
    }, []);

    const handleSelectPlan = async (plan: SubscriptionPlan) => {
        if (!user || !currentOrg) {
            setMessage({ type: 'error', text: 'Debes iniciar sesión para seleccionar un plan.' });
            return;
        }

        setProcessing(plan.id);
        setMessage(null);

        try {
            if (plan.price_cents === 0) {
                // Plan gratuito - asignar directamente
                const result = await assignPlanToUser(user.id, currentOrg.id, plan.id);
                if (result.success) {
                    setMessage({ type: 'success', text: '¡Plan gratuito activado!' });
                    await refreshSubscription();
                } else {
                    setMessage({ type: 'error', text: result.error || 'Error al asignar plan' });
                }
            } else {
                // Plan de pago - abrir Wompi checkout
                const priceCOP = usdToCop(plan.price_cents);

                await initSubscriptionPayment(
                    user.id,
                    plan.id,
                    priceCOP,
                    profile?.email || user.email || '',
                    profile?.full_name || 'Usuario',
                    async () => {
                        setMessage({ type: 'success', text: '¡Pago procesado! Tu suscripción se activará en segundos.' });
                        // El webhook activará la suscripción, pero refrescamos por si acaso
                        setTimeout(() => refreshSubscription(), 3000);
                    },
                    (error) => {
                        setMessage({ type: 'error', text: 'El pago no pudo ser procesado. Intenta de nuevo.' });
                    }
                );
            }
        } catch (error) {
            console.error('Error selecting plan:', error);
            setMessage({ type: 'error', text: 'Ocurrió un error. Intenta de nuevo.' });
        }

        setProcessing(null);
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-full bg-gradient-to-b from-slate-950 to-slate-900 py-12 px-4">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto mb-12">
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

            {/* Plans Grid */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
                {plans.map((plan) => (
                    <PricingCard
                        key={plan.id}
                        plan={plan}
                        isCurrentPlan={currentPlan?.plan_name === plan.name}
                        isPopular={plan.name === 'pro'}
                        isProcessing={processing === plan.id}
                        onSelect={handleSelectPlan}
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
};

export default PricingPage;
