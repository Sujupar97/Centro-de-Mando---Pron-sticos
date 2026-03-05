/**
 * whop-create-checkout
 * Crea una sesión de checkout en Whop y retorna la purchase_url.
 * El frontend redirige al usuario a esta URL para completar el pago.
 *
 * Metadata se propaga automáticamente de checkout → memberships → webhooks,
 * permitiendo vincular la compra al usuario de Derbix.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const whopApiKey = Deno.env.get('WHOP_API_KEY');
    if (!whopApiKey) {
        console.error('[whop-create-checkout] Missing WHOP_API_KEY');
        return new Response(JSON.stringify({ error: 'Whop no está configurado' }), {
            status: 500,
            headers: corsHeaders
        });
    }

    try {
        const { whopPlanId, planId, userId, orgId, billingPeriod, email } = await req.json();

        if (!whopPlanId || !userId) {
            return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos' }), {
                status: 400,
                headers: corsHeaders
            });
        }

        console.log(`[whop-create-checkout] Creating checkout: plan=${whopPlanId}, user=${userId}, period=${billingPeriod}`);

        const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://derbix.co';

        // Crear checkout configuration en Whop
        const response = await fetch('https://api.whop.com/api/v1/checkout_configurations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${whopApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                plan_id: whopPlanId,
                redirect_url: `${frontendUrl}/app?payment=success`,
                source_url: `${frontendUrl}/pricing`,
                metadata: {
                    userId,
                    orgId: orgId || '',
                    planId: planId || '',
                    billingPeriod: billingPeriod || 'monthly',
                },
                ...(email ? { prefill_email: email } : {}),
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[whop-create-checkout] Whop API error ${response.status}: ${errorText}`);
            return new Response(JSON.stringify({
                error: 'Error al crear sesión de pago. Intenta de nuevo.'
            }), {
                status: 502,
                headers: corsHeaders
            });
        }

        const checkoutData = await response.json();
        const purchaseUrl = checkoutData.purchase_url;

        if (!purchaseUrl) {
            console.error('[whop-create-checkout] No purchase_url in response:', JSON.stringify(checkoutData));
            return new Response(JSON.stringify({
                error: 'No se pudo generar el enlace de pago'
            }), {
                status: 500,
                headers: corsHeaders
            });
        }

        console.log(`[whop-create-checkout] Checkout created: ${purchaseUrl}`);

        return new Response(JSON.stringify({
            success: true,
            purchase_url: purchaseUrl
        }), {
            headers: corsHeaders
        });

    } catch (error) {
        console.error('[whop-create-checkout] Error:', error);
        return new Response(JSON.stringify({
            error: 'Error interno. Intenta de nuevo.'
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
});
