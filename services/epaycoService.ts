/**
 * ePayco Service
 * Maneja la integración con ePayco para pagos y suscripciones.
 * Usa el Checkout Standard de ePayco (overlay similar a Lemon Squeezy).
 */

const EPAYCO_CHECKOUT_URL = 'https://checkout.epayco.co/checkout.js';

// ==========================================
// TYPES
// ==========================================

export interface EpaycoCheckoutOptions {
    planId: string;
    planName: string;
    planDescription: string;
    amount: string;
    currency: 'cop' | 'usd';
    userId: string;
    userEmail: string;
    userName: string;
    orgId: string;
    billingPeriod: 'monthly' | 'annual';
}

// ==========================================
// LOAD CHECKOUT.JS
// ==========================================

/**
 * Carga el script de ePayco Checkout (overlay)
 */
export const loadEpaycoCheckout = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if ((window as any).ePayco) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = EPAYCO_CHECKOUT_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Error al cargar ePayco Checkout'));
        document.head.appendChild(script);
    });
};

// ==========================================
// CHECKOUT
// ==========================================

/**
 * Abre el checkout de ePayco como overlay.
 * ePayco maneja toda la UI de pago (tarjeta, PSE, Nequi, PayPal).
 * Envía confirmación vía POST a nuestro webhook.
 */
export const openEpaycoCheckout = async (options: EpaycoCheckoutOptions): Promise<void> => {
    await loadEpaycoCheckout();

    const publicKey = import.meta.env.VITE_EPAYCO_PUBLIC_KEY;
    if (!publicKey) {
        throw new Error('ePayco no está configurado. Contacta soporte.');
    }

    const isTest = import.meta.env.VITE_EPAYCO_TEST === 'true';
    const frontendUrl = import.meta.env.VITE_FRONTEND_URL || 'https://derbix.netlify.app';
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const confirmationUrl = `${supabaseUrl}/functions/v1/epayco-webhook`;

    const handler = (window as any).ePayco.checkout.configure({
        key: publicKey,
        test: isTest,
    });

    handler.open({
        // Datos del producto
        name: options.planName,
        description: options.planDescription,
        amount: options.amount,
        currency: options.currency,
        country: 'co',
        lang: 'es',

        // Datos custom (se envían en el webhook)
        extra1: options.userId,
        extra2: options.orgId,
        extra3: `${options.planId}|${options.billingPeriod}`,

        // Email del comprador
        email_billing: options.userEmail,
        name_billing: options.userName,

        // URLs
        response: `${frontendUrl}/app?payment=success`,
        confirmation: confirmationUrl,
        method_confirmation: 'POST',

        // Comportamiento
        external: 'false',     // overlay (no redirect)
        autoclick: 'false',
    });
};

// ==========================================
// PLAN HELPERS
// ==========================================

/**
 * Obtiene el epayco_plan_id correcto según el plan y periodo
 */
export const getEpaycoPlanId = (
    plan: { epayco_plan_id?: string; epayco_plan_id_annual?: string },
    billingPeriod: 'monthly' | 'annual'
): string | null => {
    if (billingPeriod === 'annual') {
        return plan.epayco_plan_id_annual || plan.epayco_plan_id || null;
    }
    return plan.epayco_plan_id || null;
};
