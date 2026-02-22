import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, SparklesIcon } from '../icons/Icons';
import { getActivePlans, SubscriptionPlan } from '../../services/subscriptionService';
import { getPlanPrice } from '../../services/lemonSqueezyService';
import { useScrollReveal } from './useScrollReveal';

type BillingPeriod = 'monthly' | 'annual';

const getFeatures = (plan: SubscriptionPlan): string[] => {
  const features: string[] = [];

  // Oportunidades
  if (plan.predictions_percentage >= 100) {
    features.push('Todas las oportunidades diarias');
  } else if (plan.predictions_percentage > 0) {
    features.push(`${plan.predictions_percentage}% de oportunidades diarias`);
  } else {
    features.push('1 oportunidad diaria de muestra');
  }

  // Parlays
  if (plan.monthly_parlay_limit === -1) {
    features.push('Parlays ilimitados');
  } else if (plan.monthly_parlay_limit > 0) {
    features.push(`${plan.monthly_parlay_limit} parlays al mes`);
  }

  // Análisis
  if (plan.predictions_percentage >= 100) {
    features.push('Análisis completo de todos los partidos');
  } else if (plan.predictions_percentage >= 50) {
    features.push('Análisis de la mayoría de partidos');
  } else if (plan.predictions_percentage > 0) {
    features.push('Análisis de partidos seleccionados');
  }

  // Stats
  features.push(plan.can_access_full_stats ? 'Estadísticas completas' : 'Estadísticas básicas');

  // History
  features.push('Historial de resultados');

  // Support
  features.push(plan.has_priority_support ? 'Soporte prioritario' : 'Soporte por email');

  return features;
};

// Fallback plans if DB doesn't load
const FALLBACK_PLANS = [
  { name: 'free', display_name: 'Free', price_cents: 0, annual_price_cents: 0, description: 'Para explorar la plataforma' },
  { name: 'pro', display_name: 'Pro', price_cents: 999, annual_price_cents: 9590, description: 'Para apostadores serios' },
  { name: 'premium', display_name: 'Premium', price_cents: 4999, annual_price_cents: 47990, description: 'Acceso completo' },
  { name: 'unlimited', display_name: 'Unlimited', price_cents: 14999, annual_price_cents: 143990, description: 'Acceso total sin límites' },
];

export const LandingPricing: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [loading, setLoading] = useState(true);
  const { ref, isVisible } = useScrollReveal();

  useEffect(() => {
    const load = async () => {
      const data = await getActivePlans();
      setPlans(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleSelect = (planName: string) => {
    navigate(`/signup?plan=${planName}&billing=${billingPeriod}`);
  };

  const paidPlans = plans.filter((p) => p.price_cents > 0);
  const freePlan = plans.find((p) => p.price_cents === 0);
  const displayPlans = paidPlans.length > 0 ? paidPlans : [];

  return (
    <section id="planes" className="py-24 md:py-32 px-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="absolute top-[20%] right-0 w-[500px] h-[500px] bg-brand/3 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto" ref={ref}>
        {/* Header */}
        <div className={`text-center mb-12 transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <p className="text-sm font-bold uppercase tracking-widest text-brand/80 mb-4">Planes</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6">
            Planes transparentes
          </h2>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
            Sin letra chica. Cancela cuando quieras. Sin sorpresas.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className={`flex items-center justify-center gap-4 mb-16 transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '100ms' }}>
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              billingPeriod === 'monthly'
                ? 'bg-white text-slate-950'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
              billingPeriod === 'annual'
                ? 'bg-white text-slate-950'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Anual
            <span className="px-2 py-0.5 rounded-full bg-brand/20 text-brand text-xs font-bold">
              -20%
            </span>
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
          </div>
        )}

        {/* Plan Cards */}
        {!loading && (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${displayPlans.length > 0 ? displayPlans.length : 3} gap-6 max-w-5xl mx-auto transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`} style={{ transitionDelay: '200ms' }}>
            {(displayPlans.length > 0 ? displayPlans : FALLBACK_PLANS.filter(p => p.price_cents > 0)).map((plan, i) => {
              const isPro = plan.name === 'pro';
              const annualCents = (plan as any).annual_price_cents ?? Math.round(plan.price_cents * 12 * 0.8);
              const price = getPlanPrice(plan.price_cents, annualCents, billingPeriod);

              return (
                <div
                  key={plan.name}
                  className={`relative rounded-3xl border transition-all duration-500 ${
                    isPro
                      ? 'bg-slate-900/80 border-brand/30 shadow-[0_0_40px_rgba(16,185,129,0.1)] scale-[1.02] lg:scale-105'
                      : 'bg-slate-900/50 border-white/5 hover:border-white/10'
                  }`}
                >
                  {/* Popular badge */}
                  {isPro && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-brand to-emerald-600 text-white text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
                      <SparklesIcon className="w-3.5 h-3.5" />
                      Más Popular
                    </div>
                  )}

                  <div className="p-8">
                    {/* Plan name */}
                    <h3 className="text-xl font-bold text-white mb-1">{plan.display_name}</h3>
                    <p className="text-sm text-slate-400 mb-6">{plan.description || ''}</p>

                    {/* Price */}
                    <div className="mb-8">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-display font-bold ${isPro ? 'text-brand' : 'text-white'}`}>
                          {billingPeriod === 'annual' && annualCents > 0
                            ? `$${(annualCents / 12 / 100).toFixed(2)}`
                            : `$${(plan.price_cents / 100).toFixed(2)}`}
                        </span>
                        <span className="text-slate-500 text-sm">/mes</span>
                      </div>
                      {billingPeriod === 'annual' && annualCents > 0 && (
                        <p className="text-xs text-brand/80 mt-1">
                          {price.savings} — Facturado anualmente
                        </p>
                      )}
                    </div>

                    {/* Features */}
                    {'predictions_percentage' in plan ? (
                      <ul className="space-y-3 mb-8">
                        {getFeatures(plan as SubscriptionPlan).map((feat, fi) => (
                          <li key={fi} className="flex items-start gap-3">
                            <CheckIcon className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-slate-300">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="h-48" />
                    )}

                    {/* CTA */}
                    <button
                      onClick={() => handleSelect(plan.name)}
                      className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${
                        isPro
                          ? 'bg-brand text-white hover:bg-brand-hover shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]'
                          : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      Seleccionar Plan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Free plan note */}
        {!loading && (
          <div className={`mt-10 text-center transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`} style={{ transitionDelay: '400ms' }}>
            <p className="text-slate-500 text-sm">
              ¿Solo quieres probar? {' '}
              <button
                onClick={() => handleSelect('free')}
                className="text-brand hover:text-brand-hover font-semibold underline underline-offset-2 transition-colors"
              >
                Empieza gratis
              </button>
              {' '} — sin tarjeta de crédito.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
