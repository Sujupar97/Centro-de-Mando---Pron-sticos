/**
 * Wompi Payment Service
 * Integración con la pasarela de pagos Wompi
 */

// Wompi Public Key (safe to expose in frontend)
const WOMPI_PUBLIC_KEY = 'pub_prod_DEHPi3nCM47jY1Fe8EmBU2tEaH8EhG3N';
const WOMPI_WIDGET_URL = 'https://checkout.wompi.co/widget.js';

export interface WompiPaymentData {
    amountInCents: number;
    currency: string;
    reference: string;
    customerEmail: string;
    customerFullName: string;
    redirectUrl?: string;
}

/**
 * Carga el script del widget de Wompi
 */
export const loadWompiWidget = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if ((window as any).WidgetCheckout) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = WOMPI_WIDGET_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Wompi widget'));
        document.head.appendChild(script);
    });
};

/**
 * Genera una referencia única para la transacción
 */
export const generatePaymentReference = (userId: string, planId: string): string => {
    const timestamp = Date.now();
    return `sub_${userId}_${planId}_${timestamp}`;
};

/**
 * Abre el widget de pago de Wompi
 */
export const openWompiCheckout = async (
    paymentData: WompiPaymentData,
    onSuccess?: (result: any) => void,
    onError?: (error: any) => void,
    onClose?: () => void
): Promise<void> => {
    try {
        await loadWompiWidget();

        const WidgetCheckout = (window as any).WidgetCheckout;

        if (!WidgetCheckout) {
            throw new Error('Wompi widget not available');
        }

        const checkout = new WidgetCheckout({
            currency: paymentData.currency,
            amountInCents: paymentData.amountInCents,
            reference: paymentData.reference,
            publicKey: WOMPI_PUBLIC_KEY,
            redirectUrl: paymentData.redirectUrl || window.location.href,
            customerData: {
                email: paymentData.customerEmail,
                fullName: paymentData.customerFullName
            }
        });

        checkout.open((result: any) => {
            const transaction = result.transaction;

            if (transaction.status === 'APPROVED') {
                console.log('[WOMPI] Payment approved:', transaction.id);
                onSuccess?.(result);
            } else if (transaction.status === 'DECLINED' || transaction.status === 'ERROR') {
                console.log('[WOMPI] Payment failed:', transaction.status);
                onError?.(result);
            } else {
                console.log('[WOMPI] Payment pending:', transaction.status);
                onSuccess?.(result); // Treat pending as success, webhook will handle
            }
        });

        // Handle close event
        checkout.onClose = () => {
            onClose?.();
        };

    } catch (error) {
        console.error('[WOMPI] Error opening checkout:', error);
        onError?.(error);
    }
};

/**
 * Inicia el proceso de pago para una suscripción
 */
export const initSubscriptionPayment = async (
    userId: string,
    planId: string,
    priceCents: number,
    userEmail: string,
    userName: string,
    onSuccess?: () => void,
    onError?: (error: any) => void
): Promise<void> => {
    const reference = generatePaymentReference(userId, planId);

    await openWompiCheckout(
        {
            amountInCents: priceCents,
            currency: 'COP', // Colombian Pesos for Wompi
            reference,
            customerEmail: userEmail,
            customerFullName: userName,
            redirectUrl: `${window.location.origin}/app?payment=success`
        },
        (result) => {
            console.log('[WOMPI] Subscription payment successful');
            onSuccess?.();
        },
        (error) => {
            console.error('[WOMPI] Subscription payment failed:', error);
            onError?.(error);
        }
    );
};

/**
 * Convierte precio de USD a COP (tasa aproximada)
 * Nota: En producción, usar una API de tasas de cambio
 */
export const usdToCop = (usdCents: number): number => {
    const USD_TO_COP_RATE = 4000; // Tasa aproximada
    return Math.round(usdCents * USD_TO_COP_RATE / 100) * 100; // Redondear a múltiplos de 100
};

export default {
    loadWompiWidget,
    openWompiCheckout,
    initSubscriptionPayment,
    generatePaymentReference,
    usdToCop
};
