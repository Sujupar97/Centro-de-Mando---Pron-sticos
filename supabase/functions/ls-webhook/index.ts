/**
 * ls-webhook
 * Webhook handler para Lemon Squeezy.
 * Procesa todos los eventos del ciclo de vida de suscripciones.
 *
 * Eventos manejados:
 * - subscription_created/updated/cancelled/expired/paused/unpaused/resumed
 * - subscription_payment_success/failed/recovered
 * - order_refunded
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature',
    'Content-Type': 'application/json'
};

// ==========================================
// HMAC-SHA256 Signature Verification
// ==========================================

async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    const computedHash = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    return computedHash === signature;
}

// ==========================================
// Helper: Resolver plan_id desde variant_id
// ==========================================

async function resolvePlanFromVariant(supabase: any, variantId: string): Promise<string | null> {
    // Buscar en subscription_plans por ls_variant_id_monthly o ls_variant_id_annual
    const { data } = await supabase
        .from('subscription_plans')
        .select('id')
        .or(`ls_variant_id_monthly.eq.${variantId},ls_variant_id_annual.eq.${variantId}`)
        .limit(1)
        .single();

    return data?.id || null;
}

// ==========================================
// Helper: Asignar plan free a un usuario
// ==========================================

async function assignFreePlan(supabase: any, userId: string, orgId: string) {
    const { data: freePlan } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('name', 'free')
        .single();

    if (!freePlan) return;

    await supabase.from('user_subscriptions').upsert({
        user_id: userId,
        organization_id: orgId,
        plan_id: freePlan.id,
        status: 'active',
        current_period_start: new Date().toISOString(),
        billing_period: 'monthly',
        ls_subscription_id: null,
        ls_customer_id: null,
        customer_portal_url: null
    }, { onConflict: 'user_id,organization_id' });
}

// ==========================================
// Helper: Notificar al equipo admin (fire-and-forget)
// ==========================================

function notifyAdmin(sbUrl: string, sbKey: string, type: string, notifData: any) {
    const url = `${sbUrl}/functions/v1/send-admin-notification`;
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sbKey}`
        },
        body: JSON.stringify({ type, data: notifData })
    }).catch(err => {
        console.error('[ls-webhook] Admin notification error (non-blocking):', err);
    });
}

// ==========================================
// Event Handlers
// ==========================================

async function handleSubscriptionCreated(supabase: any, attrs: any, customData: any, subscriptionId: string) {
    const userId = customData?.user_id;
    const orgId = customData?.org_id;
    const billingPeriod = customData?.billing_period || 'monthly';

    if (!userId) {
        console.error('[ls-webhook] subscription_created: Missing user_id in custom_data');
        return;
    }

    const variantId = String(attrs.variant_id);
    const planId = await resolvePlanFromVariant(supabase, variantId);

    if (!planId) {
        console.error(`[ls-webhook] subscription_created: No plan found for variant ${variantId}`);
        return;
    }

    // Buscar organizacion del usuario si no se proporciono
    let resolvedOrgId = orgId;
    if (!resolvedOrgId) {
        const { data: memberData } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', userId)
            .limit(1)
            .single();
        resolvedOrgId = memberData?.organization_id;
    }

    const upsertData: any = {
        user_id: userId,
        organization_id: resolvedOrgId,
        plan_id: planId,
        status: attrs.status === 'active' ? 'active' : 'trialing',
        current_period_start: attrs.created_at,
        current_period_end: attrs.renews_at || null,
        renews_at: attrs.renews_at || null,
        ends_at: attrs.ends_at || null,
        billing_period: billingPeriod,
        ls_subscription_id: String(subscriptionId),
        ls_customer_id: String(attrs.customer_id),
        ls_order_id: String(attrs.order_id),
        ls_variant_id: variantId,
        ls_product_id: String(attrs.product_id),
        card_brand: attrs.card_brand || null,
        card_last_four: attrs.card_last_four || null,
        customer_portal_url: attrs.urls?.customer_portal || null,
        cancel_at_period_end: false
    };

    const { error } = await supabase
        .from('user_subscriptions')
        .upsert(upsertData, { onConflict: 'user_id,organization_id' });

    if (error) {
        console.error('[ls-webhook] Error upserting subscription:', error);
    } else {
        console.log(`[ls-webhook] Subscription created: user=${userId}, plan=${planId}, period=${billingPeriod}`);

        // Notificar al equipo admin (fire-and-forget, no bloquea)
        try {
            const sbUrl = Deno.env.get('SUPABASE_URL')!;
            const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

            // Obtener nombre del plan
            const { data: planData } = await supabase
                .from('subscription_plans')
                .select('display_name, name')
                .eq('id', planId)
                .single();

            // Obtener perfil del usuario
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', userId)
                .single();

            notifyAdmin(sbUrl, sbKey, 'new_subscription', {
                name: profile?.full_name || 'Sin nombre',
                email: profile?.email || attrs.user_email || 'Sin email',
                plan: planData?.display_name || planData?.name || 'Desconocido',
                amount: attrs.subtotal || null,
                billingPeriod,
                processor: 'Lemon Squeezy'
            });
        } catch (notifErr) {
            console.error('[ls-webhook] Notification prep error (non-blocking):', notifErr);
        }
    }
}

async function handleSubscriptionUpdated(supabase: any, attrs: any, subscriptionId: string) {
    const subId = String(subscriptionId);
    const variantId = String(attrs.variant_id);
    const planId = await resolvePlanFromVariant(supabase, variantId);

    const updateData: any = {
        status: attrs.status === 'active' ? 'active' : attrs.status,
        renews_at: attrs.renews_at || null,
        ends_at: attrs.ends_at || null,
        card_brand: attrs.card_brand || null,
        card_last_four: attrs.card_last_four || null,
        customer_portal_url: attrs.urls?.customer_portal || null,
        ls_variant_id: variantId,
    };

    // Si cambio de plan (upgrade/downgrade)
    if (planId) {
        updateData.plan_id = planId;
    }

    if (attrs.status === 'active') {
        updateData.paused_at = null;
    }

    const { error } = await supabase
        .from('user_subscriptions')
        .update(updateData)
        .eq('ls_subscription_id', subId);

    if (error) {
        console.error('[ls-webhook] Error updating subscription:', error);
    } else {
        console.log(`[ls-webhook] Subscription updated: ${subId}`);
    }
}

async function handleSubscriptionCancelled(supabase: any, attrs: any, subscriptionId: string) {
    const subId = String(subscriptionId);

    // Lemon Squeezy: cancelled = sigue activa hasta fin de periodo
    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            cancel_at_period_end: true,
            ends_at: attrs.ends_at || null,
        })
        .eq('ls_subscription_id', subId);

    if (error) {
        console.error('[ls-webhook] Error cancelling subscription:', error);
    } else {
        console.log(`[ls-webhook] Subscription cancelled (active until period end): ${subId}`);
    }
}

async function handleSubscriptionExpired(supabase: any, attrs: any, subscriptionId: string) {
    const subId = String(subscriptionId);

    // Obtener usuario antes de actualizar
    const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('user_id, organization_id')
        .eq('ls_subscription_id', subId)
        .single();

    // Marcar como expirada
    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'expired',
            ends_at: attrs.ends_at || new Date().toISOString()
        })
        .eq('ls_subscription_id', subId);

    if (error) {
        console.error('[ls-webhook] Error expiring subscription:', error);
    }

    // Asignar plan free automaticamente
    if (sub?.user_id && sub?.organization_id) {
        await assignFreePlan(supabase, sub.user_id, sub.organization_id);
        console.log(`[ls-webhook] Subscription expired, assigned free plan: ${subId}`);
    }
}

async function handleSubscriptionPaused(supabase: any, attrs: any, subscriptionId: string) {
    const subId = String(subscriptionId);

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'paused',
            paused_at: new Date().toISOString()
        })
        .eq('ls_subscription_id', subId);

    if (error) {
        console.error('[ls-webhook] Error pausing subscription:', error);
    } else {
        console.log(`[ls-webhook] Subscription paused: ${subId}`);
    }
}

async function handleSubscriptionUnpaused(supabase: any, attrs: any, subscriptionId: string) {
    const subId = String(subscriptionId);

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'active',
            paused_at: null,
            renews_at: attrs.renews_at || null
        })
        .eq('ls_subscription_id', subId);

    if (error) {
        console.error('[ls-webhook] Error unpausing subscription:', error);
    } else {
        console.log(`[ls-webhook] Subscription unpaused: ${subId}`);
    }
}

async function handleSubscriptionResumed(supabase: any, attrs: any, subscriptionId: string) {
    const subId = String(subscriptionId);

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'active',
            cancel_at_period_end: false,
            renews_at: attrs.renews_at || null,
            ends_at: null
        })
        .eq('ls_subscription_id', subId);

    if (error) {
        console.error('[ls-webhook] Error resuming subscription:', error);
    } else {
        console.log(`[ls-webhook] Subscription resumed: ${subId}`);
    }
}

async function handlePaymentSuccess(supabase: any, attrs: any, subscriptionId: string) {
    const subId = String(subscriptionId);

    // Actualizar suscripcion
    await supabase
        .from('user_subscriptions')
        .update({
            status: 'active',
            renews_at: attrs.renews_at || null
        })
        .eq('ls_subscription_id', subId);

    // Log en payment_history
    const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('id, user_id')
        .eq('ls_subscription_id', subId)
        .single();

    if (sub) {
        await supabase.from('payment_history').insert({
            user_id: sub.user_id,
            subscription_id: sub.id,
            amount_cents: attrs.subtotal || 0,
            currency: attrs.currency || 'USD',
            status: 'paid',
            ls_subscription_invoice_id: attrs.subscription_invoice_id ? String(attrs.subscription_invoice_id) : null,
            billing_reason: attrs.billing_reason || 'renewal',
            raw_response: attrs,
            description: `Pago ${attrs.billing_reason === 'initial' ? 'inicial' : 'de renovacion'}`
        });
    }

    console.log(`[ls-webhook] Payment success for subscription: ${subId}`);
}

async function handlePaymentFailed(supabase: any, attrs: any, subscriptionId: string) {
    const subId = String(subscriptionId);

    await supabase
        .from('user_subscriptions')
        .update({ status: 'past_due' })
        .eq('ls_subscription_id', subId);

    // Log en payment_history
    const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('id, user_id')
        .eq('ls_subscription_id', subId)
        .single();

    if (sub) {
        await supabase.from('payment_history').insert({
            user_id: sub.user_id,
            subscription_id: sub.id,
            amount_cents: attrs.subtotal || 0,
            currency: attrs.currency || 'USD',
            status: 'declined',
            billing_reason: attrs.billing_reason || 'renewal',
            error_message: 'Payment failed',
            raw_response: attrs,
            description: 'Pago fallido'
        });
    }

    console.log(`[ls-webhook] Payment failed for subscription: ${subId}`);
}

async function handlePaymentRecovered(supabase: any, attrs: any, subscriptionId: string) {
    const subId = String(subscriptionId);

    await supabase
        .from('user_subscriptions')
        .update({
            status: 'active',
            renews_at: attrs.renews_at || null
        })
        .eq('ls_subscription_id', subId);

    console.log(`[ls-webhook] Payment recovered for subscription: ${subId}`);
}

async function handleOrderRefunded(supabase: any, attrs: any, orderId: string) {
    const orderIdStr = String(orderId);

    // Marcar pagos del order como refunded
    const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('id, user_id')
        .eq('ls_order_id', orderIdStr)
        .single();

    if (sub) {
        await supabase
            .from('payment_history')
            .update({
                refunded: true,
                refunded_at: new Date().toISOString(),
                status: 'refunded'
            })
            .eq('subscription_id', sub.id)
            .eq('status', 'paid');
    }

    console.log(`[ls-webhook] Order refunded: ${orderIdStr}`);
}

// ==========================================
// MAIN HANDLER
// ==========================================

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET');
    const supabase = createClient(sbUrl, sbKey);

    try {
        // 1. Leer body crudo para verificacion
        const rawBody = await req.text();

        // 2. Verificar firma HMAC-SHA256
        const signature = req.headers.get('x-signature');
        if (!signature || !webhookSecret) {
            console.error('[ls-webhook] Missing signature or webhook secret');
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: corsHeaders
            });
        }

        const isValid = await verifySignature(rawBody, signature, webhookSecret);
        if (!isValid) {
            console.error('[ls-webhook] Invalid signature');
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                status: 401,
                headers: corsHeaders
            });
        }

        // 3. Parse payload
        const body = JSON.parse(rawBody);
        const eventName = body.meta?.event_name;
        const customData = body.meta?.custom_data || {};
        const attrs = body.data?.attributes || {};
        const dataId = body.data?.id;

        console.log(`[ls-webhook] Event: ${eventName}, ID: ${dataId}`);

        // 4. Idempotency check
        const eventId = dataId ? `${eventName}_${dataId}` : null;
        if (eventId) {
            const { data: existing } = await supabase
                .from('ls_webhook_events')
                .select('id')
                .eq('ls_event_id', eventId)
                .single();

            if (existing) {
                console.log(`[ls-webhook] Duplicate event, skipping: ${eventId}`);
                return new Response(JSON.stringify({ success: true, duplicate: true }), {
                    headers: corsHeaders
                });
            }
        }

        // 5. Guardar evento
        await supabase.from('ls_webhook_events').insert({
            event_name: eventName,
            ls_event_id: eventId,
            payload: body
        });

        // 6. Procesar segun tipo de evento
        switch (eventName) {
            case 'subscription_created':
                await handleSubscriptionCreated(supabase, attrs, customData, dataId);
                break;
            case 'subscription_updated':
                await handleSubscriptionUpdated(supabase, attrs, dataId);
                break;
            case 'subscription_cancelled':
                await handleSubscriptionCancelled(supabase, attrs, dataId);
                break;
            case 'subscription_expired':
                await handleSubscriptionExpired(supabase, attrs, dataId);
                break;
            case 'subscription_paused':
                await handleSubscriptionPaused(supabase, attrs, dataId);
                break;
            case 'subscription_unpaused':
                await handleSubscriptionUnpaused(supabase, attrs, dataId);
                break;
            case 'subscription_resumed':
                await handleSubscriptionResumed(supabase, attrs, dataId);
                break;
            case 'subscription_payment_success':
                await handlePaymentSuccess(supabase, attrs, dataId);
                break;
            case 'subscription_payment_failed':
                await handlePaymentFailed(supabase, attrs, dataId);
                break;
            case 'subscription_payment_recovered':
                await handlePaymentRecovered(supabase, attrs, dataId);
                break;
            case 'order_refunded':
                await handleOrderRefunded(supabase, attrs, dataId);
                break;
            default:
                console.log(`[ls-webhook] Unhandled event: ${eventName}`);
        }

        // 7. Marcar como procesado
        if (eventId) {
            await supabase.from('ls_webhook_events')
                .update({ processed: true, processed_at: new Date().toISOString() })
                .eq('ls_event_id', eventId);
        }

        // Siempre retornar 200 para evitar retries
        return new Response(JSON.stringify({ success: true }), {
            headers: corsHeaders
        });

    } catch (error) {
        console.error('[ls-webhook] Unhandled error:', error);

        // Retornar 200 incluso en error para evitar retries infinitos de LS
        return new Response(JSON.stringify({ success: true, error: 'Internal error logged' }), {
            status: 200,
            headers: corsHeaders
        });
    }
});
