/**
 * Lemon Squeezy Service
 * Maneja la integracion con Lemon Squeezy para pagos y suscripciones.
 * Reemplaza completamente a wompiService.ts
 */

import { supabase } from './supabaseService';

const LS_SCRIPT_URL = 'https://app.lemonsqueezy.com/js/lemon.js';

// ==========================================
// TYPES
// ==========================================

export interface CheckoutOptions {
    variantId: string;
    userId: string;
    userEmail: string;
    userName: string;
    orgId: string;
    billingPeriod: 'monthly' | 'annual';
    redirectUrl?: string;
}

export interface CheckoutResult {
    checkoutUrl: string;
}

export interface PlanPriceDisplay {
    display: string;
    monthly: string;
    savings?: string;
}

// ==========================================
// LEMON.JS OVERLAY
// ==========================================

/**
 * Carga el script Lemon.js para overlay checkout
 */
export const loadLemonSqueezy = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if ((window as any).LemonSqueezy) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = LS_SCRIPT_URL;
        script.async = true;
        script.onload = () => {
            (window as any).LemonSqueezy?.Setup?.({
                eventHandler: (event: any) => {
                    if (event?.event === 'Checkout.Success') {
                        console.log('[LemonSqueezy] Checkout exitoso');
                    }
                }
            });
            resolve();
        };
        script.onerror = () => reject(new Error('Error al cargar Lemon Squeezy'));
        document.head.appendChild(script);
    });
};

// ==========================================
// CHECKOUT
// ==========================================

/**
 * Crea un checkout via la Edge Function (server-side, usa API key)
 */
export const createCheckout = async (options: CheckoutOptions): Promise<CheckoutResult> => {
    const { data, error } = await supabase.functions.invoke('ls-create-checkout', {
        body: options
    });

    if (error) throw new Error(error.message || 'Error al crear checkout');
    if (!data?.checkoutUrl) throw new Error('No se obtuvo URL de checkout');

    return { checkoutUrl: data.checkoutUrl };
};

/**
 * Abre el checkout como overlay (mejor UX que redirect)
 */
export const openCheckoutOverlay = async (options: CheckoutOptions): Promise<void> => {
    await loadLemonSqueezy();
    const { checkoutUrl } = await createCheckout(options);

    // Lemon.js abre el checkout como overlay modal
    if ((window as any).LemonSqueezy?.Url?.Open) {
        (window as any).LemonSqueezy.Url.Open(checkoutUrl);
    } else {
        // Fallback: abrir en nueva ventana
        window.open(checkoutUrl, '_blank');
    }
};

/**
 * Abre el checkout redirigiendo (para cuando el overlay no funciona)
 */
export const openCheckoutRedirect = async (options: CheckoutOptions): Promise<void> => {
    const { checkoutUrl } = await createCheckout(options);
    window.location.href = checkoutUrl;
};

// ==========================================
// CUSTOMER PORTAL
// ==========================================

/**
 * Obtiene la URL del portal self-service de Lemon Squeezy.
 * El portal permite al usuario cancelar, pausar, cambiar plan, actualizar pago.
 */
export const getCustomerPortalUrl = async (
    userId: string,
    orgId: string
): Promise<string | null> => {
    const { data, error } = await supabase
        .from('user_subscriptions')
        .select('customer_portal_url')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
        .in('status', ['active', 'cancelled', 'paused', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) return null;
    return data.customer_portal_url;
};

// ==========================================
// PRICING HELPERS
// ==========================================

/**
 * Calcula y formatea precios segun periodo de facturacion
 */
export const getPlanPrice = (
    priceCents: number,
    annualPriceCents: number,
    billingPeriod: 'monthly' | 'annual'
): PlanPriceDisplay => {
    if (priceCents === 0) {
        return { display: 'Gratis', monthly: '$0' };
    }

    if (billingPeriod === 'annual' && annualPriceCents > 0) {
        const monthlyEquiv = annualPriceCents / 12 / 100;
        const monthlyCost = priceCents / 100;
        const savings = Math.round(((monthlyCost - monthlyEquiv) / monthlyCost) * 100);
        return {
            display: `$${(annualPriceCents / 100).toFixed(2)}/ano`,
            monthly: `$${monthlyEquiv.toFixed(2)}/mes`,
            savings: `Ahorras ${savings}%`
        };
    }

    return {
        display: `$${(priceCents / 100).toFixed(2)}/mes`,
        monthly: `$${(priceCents / 100).toFixed(2)}/mes`
    };
};

/**
 * Obtiene el variant ID correcto segun el plan y periodo
 */
export const getVariantId = (
    plan: { ls_variant_id_monthly?: string; ls_variant_id_annual?: string },
    billingPeriod: 'monthly' | 'annual'
): string | null => {
    if (billingPeriod === 'annual') {
        return plan.ls_variant_id_annual || plan.ls_variant_id_monthly || null;
    }
    return plan.ls_variant_id_monthly || null;
};
