import React, { useState, useEffect } from 'react';
import { getActivePlans, formatPrice, SubscriptionPlan, assignPlanToUser } from '../../services/subscriptionService';
import { openCheckoutOverlay, getVariantId, getPlanPrice } from '../../services/lemonSqueezyService';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../hooks/useAuth';
import { useOrganization } from '../../contexts/OrganizationContext';
import { CheckCircleIcon, XCircleIcon, SparklesIcon, ArrowRightIcon } from '../icons/Icons';

interface PricingCardProps {
    plan: SubscriptionPlan;
    isCurrentPlan: boolean;
    isPopular: boolean;
    isProcessing: boolean;
    billingPeriod: 'monthly' | 'annual';
    onSelect: (plan: SubscriptionPlan) => void;
}

const PricingCard: React.FC<PricingCardProps> = ({ plan, isCurrentPlan, isPopular, isProcessing, billingPeriod, onSelect }) => {
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
                    ? 'Todos los partidos'
                    : `${plan.analysis_percentage}% de partidos`,
            included: plan.analysis_percentage > 0
        },
        {
            label: 'Estadísticas completas',
            value: plan.can_access_full_stats ? 'Incluido' : 'No incluido',
            included: plan.can_access_full_stats
        },
        {
            label: 'Historial completo',
            value: 'Incluido',
            included: true
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
      ${isPopular ? 'border-brand shadow-xl shadow-brand/20 lg:scale-105' : 'border-white/10 hover:border-white/20'}
      ${isCurrentPlan ? 'ring-2 ring-brand ring-offset-2 ring-offset-slate-950' : ''}
    `}>
            {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-r from-brand to-emerald-400 text-slate-900 text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <SparklesIcon className="w-3 h-3" />
                        Más Popular
                    </div>
                </div>
            )}

            <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white">{plan.display_name}</h3>
                <p className="text-sm text-gray-400 mt-1">{plan.description}</p>

                <div className="mt-4">
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black text-white">
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
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

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
                const result = await assignPlanToUser(user.id, currentOrg.id, plan.id);
                if (result.success) {
                    setMessage({ type: 'success', text: 'Plan gratuito activado.' });
                    await refreshSubscription();
                } else {
                    setMessage({ type: 'error', text: result.error || 'Error al asignar plan' });
                }
            } else {
                const variantId = getVariantId(plan, billingPeriod);
                if (variantId) {
                    await openCheckoutOverlay({
                        variantId,
                        userId: user.id,
                        userEmail: profile?.email || user.email || '',
                        userName: profile?.full_name || 'Usuario',
                        orgId: currentOrg.id,
                        billingPeriod,
                    });
                    setMessage({ type: 'success', text: 'Checkout abierto. Completa el pago para activar tu plan.' });
                } else {
                    setMessage({ type: 'error', text: 'Plan no disponible para este período. Contacta soporte.' });
                }
            }
        } catch (error: any) {
            console.error('Error selecting plan:', error);
            setMessage({ type: 'error', text: error.message || 'Ocurrió un error. Intenta de nuevo.' });
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
            <div className="text-center max-w-3xl mx-auto mb-8">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4">
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

            {message && (
                <div className={`max-w-2xl mx-auto mb-8 p-4 rounded-xl border ${message.type === 'success'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                    <p className="text-center font-medium">{message.text}</p>
                </div>
            )}

            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
                {plans.map((plan) => (
                    <PricingCard
                        key={plan.id}
                        plan={plan}
                        isCurrentPlan={currentPlan?.plan_name === plan.name}
                        isPopular={plan.name === 'pro'}
                        isProcessing={processing === plan.id}
                        billingPeriod={billingPeriod}
                        onSelect={handleSelectPlan}
                    />
                ))}
            </div>

            {/* Gestionar suscripcion */}
            <ManageSubscriptionSection currentPlan={currentPlan} />

            <div className="max-w-3xl mx-auto mt-16 text-center">
                <p className="text-gray-500 text-sm">
                    Precios en USD. Puedes cancelar en cualquier momento desde el portal de tu suscripción.
                    Todos los planes incluyen acceso al historial completo de resultados anteriores.
                </p>
            </div>
        </div>
    );
};

/**
 * Sección de gestión de suscripción (Lemon Squeezy portal).
 */
const ManageSubscriptionSection: React.FC<{
    currentPlan: any;
}> = ({ currentPlan }) => {
    const hasLSSub = !!currentPlan?.ls_subscription_id && !!currentPlan?.customer_portal_url;

    if (!hasLSSub) return null;

    return (
        <div className="max-w-md mx-auto mt-10 text-center">
            <a
                href={currentPlan.customer_portal_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors border border-white/10"
            >
                Gestionar Suscripción
                <ArrowRightIcon className="w-4 h-4" />
            </a>
            <p className="text-xs text-gray-500 mt-2">
                Cancelar, pausar o cambiar método de pago
            </p>
        </div>
    );
};

export default PricingPage;
