/**
 * ls-create-checkout
 * Crea un checkout de Lemon Squeezy para suscripciones.
 * El API key se usa server-side, nunca expuesto al frontend.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

const LS_API_URL = 'https://api.lemonsqueezy.com/v1';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const LS_API_KEY = Deno.env.get('LEMON_SQUEEZY_API_KEY');
        const LS_STORE_ID = Deno.env.get('LEMON_SQUEEZY_STORE_ID');
        const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://derbix.co';

        if (!LS_API_KEY || !LS_STORE_ID) {
            console.error('[ls-create-checkout] Missing env vars');
            return new Response(JSON.stringify({
                error: 'Configuracion de pagos no disponible'
            }), { status: 500, headers: corsHeaders });
        }

        const {
            variantId,
            userId,
            userEmail,
            userName,
            orgId,
            billingPeriod,
            redirectUrl
        } = await req.json();

        // Validacion basica
        if (!variantId || !userId || !userEmail) {
            return new Response(JSON.stringify({
                error: 'Faltan campos requeridos: variantId, userId, userEmail'
            }), { status: 400, headers: corsHeaders });
        }

        // Rate limiting simple: verificar checkouts recientes del usuario
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count } = await supabase
            .from('ls_webhook_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_name', 'checkout_created')
            .gte('created_at', oneHourAgo)
            .contains('payload', { user_id: userId });

        if (count && count >= 10) {
            return new Response(JSON.stringify({
                error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'
            }), { status: 429, headers: corsHeaders });
        }

        console.log(`[ls-create-checkout] Creating checkout for user=${userId}, variant=${variantId}, period=${billingPeriod}`);

        // Crear checkout via Lemon Squeezy API
        const checkoutBody = {
            data: {
                type: 'checkouts',
                attributes: {
                    checkout_data: {
                        email: userEmail,
                        name: userName || undefined,
                        custom: {
                            user_id: userId,
                            org_id: orgId || '',
                            billing_period: billingPeriod || 'monthly'
                        }
                    },
                    product_options: {
                        redirect_url: redirectUrl || `${FRONTEND_URL}/app?payment=success`,
                        receipt_button_text: 'Volver a Derbix',
                        receipt_thank_you_note: 'Gracias por suscribirte a Derbix. Tu plan se activa inmediatamente.'
                    }
                },
                relationships: {
                    store: {
                        data: { type: 'stores', id: LS_STORE_ID }
                    },
                    variant: {
                        data: { type: 'variants', id: variantId }
                    }
                }
            }
        };

        const response = await fetch(`${LS_API_URL}/checkouts`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.api+json',
                'Content-Type': 'application/vnd.api+json',
                'Authorization': `Bearer ${LS_API_KEY}`
            },
            body: JSON.stringify(checkoutBody)
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('[ls-create-checkout] LS API Error:', JSON.stringify(result));
            return new Response(JSON.stringify({
                error: result.errors?.[0]?.detail || 'Error al crear el checkout'
            }), { status: response.status, headers: corsHeaders });
        }

        const checkoutUrl = result.data?.attributes?.url;

        if (!checkoutUrl) {
            console.error('[ls-create-checkout] No checkout URL in response');
            return new Response(JSON.stringify({
                error: 'No se obtuvo URL de checkout'
            }), { status: 500, headers: corsHeaders });
        }

        // Log del intento de checkout
        await supabase.from('ls_webhook_events').insert({
            event_name: 'checkout_created',
            ls_event_id: `checkout_${userId}_${Date.now()}`,
            payload: { user_id: userId, variant_id: variantId, billing_period: billingPeriod },
            processed: true,
            processed_at: new Date().toISOString()
        });

        console.log(`[ls-create-checkout] Success: ${checkoutUrl}`);

        return new Response(JSON.stringify({ checkoutUrl }), {
            headers: corsHeaders
        });

    } catch (error) {
        console.error('[ls-create-checkout] Error:', error);
        return new Response(JSON.stringify({
            error: error.message || 'Error interno del servidor'
        }), { status: 500, headers: corsHeaders });
    }
});
