/**
 * Paddle Service
 * Maneja la integración con Paddle Billing para pagos y suscripciones.
 * Reemplaza a lemonSqueezyService.ts para nuevos usuarios.
 *
 * Diferencia clave con LS: Paddle.js abre checkouts directamente desde
 * el frontend (sin Edge Function intermediaria para crear checkouts).
 */

import { supabase } from './supabaseService';

const PADDLE_SCRIPT_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';

// ==========================================
// TYPES
// ==========================================

export interface PaddleCheckoutOptions {
    priceId: string;
    userId: string;
    userEmail: string;
    userName: string;
    orgId: string;
    billingPeriod: 'monthly' | 'annual';
}

export interface PlanPriceDisplay {
    display: string;
    monthly: string;
    savings?: string;
}

// Paddle.js global types
declare global {
    interface Window {
        Paddle?: {
            Environment: { set: (env: string) => void };
            Initialize: (config: any) => void;
            Checkout: { open: (options: any) => void };
        };
    }
}

// ==========================================
// CONFIG
// ==========================================

const PADDLE_CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN || '';
const PADDLE_ENVIRONMENT = import.meta.env.VITE_PADDLE_ENVIRONMENT || 'sandbox';

// ==========================================
// PADDLE.JS SETUP
// ==========================================

let paddleInitialized = false;
let onCheckoutComplete: (() => void) | null = null;

/**
 * Carga e inicializa Paddle.js
 */
export const initializePaddle = (onComplete?: () => void): Promise<void> => {
    if (onComplete) {
        onCheckoutComplete = onComplete;
    }

    return new Promise((resolve, reject) => {
        // Si ya está inicializado, resolver inmediatamente
        if (paddleInitialized && window.Paddle) {
            resolve();
            return;
        }

        // Si Paddle.js ya está cargado pero no inicializado
        if (window.Paddle) {
            setupPaddle();
            resolve();
            return;
        }

        // Cargar el script
        const script = document.createElement('script');
        script.src = PADDLE_SCRIPT_URL;
        script.async = true;
        script.onload = () => {
            setupPaddle();
            resolve();
        };
        script.onerror = () => reject(new Error('Error al cargar Paddle.js'));
        document.head.appendChild(script);
    });
};

function setupPaddle() {
    if (!window.Paddle || paddleInitialized) return;

    if (PADDLE_ENVIRONMENT === 'sandbox') {
        window.Paddle.Environment.set('sandbox');
    }

    window.Paddle.Initialize({
        token: PADDLE_CLIENT_TOKEN,
        eventCallback: (data: any) => {
            switch (data.name) {
                case 'checkout.completed':
                    console.log('[Paddle] Checkout completado exitosamente');
                    if (onCheckoutComplete) {
                        // Delay para dar tiempo al webhook de procesar
                        setTimeout(() => onCheckoutComplete?.(), 2000);
                    }
                    break;
                case 'checkout.closed':
                    console.log('[Paddle] Checkout cerrado por el usuario');
                    break;
                case 'checkout.loaded':
                    console.log('[Paddle] Checkout cargado');
                    break;
            }
        }
    });

    paddleInitialized = true;
    console.log(`[Paddle] Inicializado en modo ${PADDLE_ENVIRONMENT}`);
}

// ==========================================
// CHECKOUT
// ==========================================

/**
 * Abre el checkout overlay de Paddle.
 * No necesita Edge Function — Paddle.js maneja todo client-side.
 */
export const openCheckout = async (options: PaddleCheckoutOptions): Promise<void> => {
    await initializePaddle();

    if (!window.Paddle) {
        throw new Error('Paddle.js no se cargó correctamente');
    }

    window.Paddle.Checkout.open({
        items: [
            { priceId: options.priceId, quantity: 1 }
        ],
        customer: {
            email: options.userEmail
        },
        customData: {
            user_id: options.userId,
            org_id: options.orgId,
            billing_period: options.billingPeriod
        },
        settings: {
            displayMode: 'overlay',
            theme: 'dark',
            locale: 'es',
            allowLogout: false,
            successUrl: `${window.location.origin}/app?payment=success`
        }
    });
};

// ==========================================
// CUSTOMER PORTAL
// ==========================================

/**
 * Obtiene la URL del portal self-service de Paddle.
 * Paddle genera URLs temporales (a diferencia de LS que son estáticas).
 * Requiere Edge Function paddle-portal porque necesita API key server-side.
 */
export const getCustomerPortalUrl = async (
    userId: string,
    orgId: string
): Promise<string | null> => {
    try {
        const { data, error } = await supabase.functions.invoke('paddle-portal', {
            body: { userId, orgId }
        });

        if (error) {
            console.error('[Paddle] Error obteniendo portal URL:', error);
            return null;
        }

        return data?.portalUrl || null;
    } catch (e) {
        console.error('[Paddle] Error invocando paddle-portal:', e);
        return null;
    }
};

// ==========================================
// PRICING HELPERS
// ==========================================

/**
 * Calcula y formatea precios según periodo de facturación.
 * Misma lógica que LS — es genérica.
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
            display: `$${(annualPriceCents / 100).toFixed(2)}/año`,
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
 * Obtiene el price ID correcto según el plan y periodo.
 * Equivalente a getVariantId() de LS pero para Paddle.
 */
export const getPriceId = (
    plan: { paddle_price_id_monthly?: string; paddle_price_id_annual?: string },
    billingPeriod: 'monthly' | 'annual'
): string | null => {
    if (billingPeriod === 'annual') {
        return plan.paddle_price_id_annual || plan.paddle_price_id_monthly || null;
    }
    return plan.paddle_price_id_monthly || null;
};
