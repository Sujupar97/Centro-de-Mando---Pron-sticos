/**
 * paddle-webhook
 * Webhook handler para Paddle Billing.
 * Procesa todos los eventos del ciclo de vida de suscripciones.
 *
 * Eventos manejados:
 * - subscription.created/updated/canceled/paused/resumed/activated/past_due
 * - transaction.completed/past_due
 * - adjustment.created (refunds)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, paddle-signature',
    'Content-Type': 'application/json'
};

// ==========================================
// Paddle Signature Verification (HMAC-SHA256)
// ==========================================

async function verifyPaddleSignature(
    rawBody: string,
    paddleSignature: string,
    secret: string
): Promise<boolean> {
    // Header format: "ts=1671552777;h1=abc123..."
    const parts: Record<string, string> = {};
    paddleSignature.split(';').forEach(part => {
        const idx = part.indexOf('=');
        if (idx > 0) {
            parts[part.substring(0, idx)] = part.substring(idx + 1);
        }
    });

    const ts = parts['ts'];
    const h1 = parts['h1'];
    if (!ts || !h1) return false;

    // Construct signed payload: "ts:rawBody"
    const signedPayload = `${ts}:${rawBody}`;

    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const sig = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(signedPayload)
    );

    const computedHash = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return computedHash === h1;
}

// ==========================================
// Helper: Resolver plan_id desde Paddle price_id
// ==========================================

async function resolvePlanFromPaddlePrice(
    supabase: any,
    priceId: string
): Promise<string | null> {
    const { data } = await supabase
        .from('subscription_plans')
        .select('id')
        .or(`paddle_price_id_monthly.eq.${priceId},paddle_price_id_annual.eq.${priceId}`)
        .limit(1)
        .single();

    return data?.id || null;
}

// ==========================================
// Helper: Detectar billing period desde price_id
// ==========================================

async function detectBillingPeriod(
    supabase: any,
    priceId: string
): Promise<'monthly' | 'annual'> {
    const { data } = await supabase
        .from('subscription_plans')
        .select('paddle_price_id_annual')
        .eq('paddle_price_id_annual', priceId)
        .limit(1)
        .single();

    return data ? 'annual' : 'monthly';
}

// ==========================================
// Helper: Extraer price_id del payload de suscripción
// ==========================================

function extractPriceId(data: any): string | null {
    // items[0].price.id
    const items = data?.items;
    if (Array.isArray(items) && items.length > 0) {
        return items[0]?.price?.id || null;
    }
    return null;
}

// ==========================================
// Helper: Asignar plan free
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
        paddle_subscription_id: null,
        paddle_customer_id: null,
        ls_subscription_id: null,
        ls_customer_id: null,
        customer_portal_url: null
    }, { onConflict: 'user_id,organization_id' });
}

// ==========================================
// Event Handlers
// ==========================================

async function handleSubscriptionCreated(supabase: any, data: any) {
    const customData = data.custom_data || {};
    const userId = customData.user_id;
    const billingPeriod = customData.billing_period || 'monthly';

    if (!userId) {
        console.error('[paddle-webhook] subscription.created: Missing user_id in custom_data');
        return;
    }

    const priceId = extractPriceId(data);
    const planId = priceId ? await resolvePlanFromPaddlePrice(supabase, priceId) : null;

    if (!planId) {
        console.error(`[paddle-webhook] subscription.created: No plan found for price ${priceId}`);
        return;
    }

    // Resolver org si no viene en custom_data
    let orgId = customData.org_id;
    if (!orgId) {
        const { data: memberData } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', userId)
            .limit(1)
            .single();
        orgId = memberData?.organization_id;
    }

    const billingPeriodStart = data.current_billing_period?.starts_at || data.started_at;
    const billingPeriodEnd = data.current_billing_period?.ends_at || null;

    const upsertData: any = {
        user_id: userId,
        organization_id: orgId,
        plan_id: planId,
        status: data.status === 'active' ? 'active' : 'trialing',
        current_period_start: billingPeriodStart,
        current_period_end: billingPeriodEnd,
        renews_at: billingPeriodEnd,
        ends_at: null,
        billing_period: billingPeriod,
        paddle_subscription_id: data.id,
        paddle_customer_id: data.customer_id,
        paddle_transaction_id: data.transaction_id || null,
        card_brand: data.payment_information?.card_brand || null,
        card_last_four: data.payment_information?.last_four || null,
        cancel_at_period_end: false
    };

    const { error } = await supabase
        .from('user_subscriptions')
        .upsert(upsertData, { onConflict: 'user_id,organization_id' });

    if (error) {
        console.error('[paddle-webhook] Error upserting subscription:', error);
    } else {
        console.log(`[paddle-webhook] Subscription created: user=${userId}, plan=${planId}, period=${billingPeriod}`);
    }
}

async function handleSubscriptionUpdated(supabase: any, data: any) {
    const subscriptionId = data.id;
    const priceId = extractPriceId(data);
    const planId = priceId ? await resolvePlanFromPaddlePrice(supabase, priceId) : null;

    const billingPeriodEnd = data.current_billing_period?.ends_at || null;

    const updateData: any = {
        status: data.status,
        renews_at: billingPeriodEnd,
        card_brand: data.payment_information?.card_brand || null,
        card_last_four: data.payment_information?.last_four || null,
    };

    // Upgrade/downgrade: actualizar plan
    if (planId) {
        updateData.plan_id = planId;
    }

    // Scheduled change (cancelación programada)
    if (data.scheduled_change?.action === 'cancel') {
        updateData.cancel_at_period_end = true;
        updateData.ends_at = data.scheduled_change.effective_at || billingPeriodEnd;
    }

    if (data.status === 'active') {
        updateData.paused_at = null;
    }

    const { error } = await supabase
        .from('user_subscriptions')
        .update(updateData)
        .eq('paddle_subscription_id', subscriptionId);

    if (error) {
        console.error('[paddle-webhook] Error updating subscription:', error);
    } else {
        console.log(`[paddle-webhook] Subscription updated: ${subscriptionId}, status=${data.status}`);
    }
}

async function handleSubscriptionCanceled(supabase: any, data: any) {
    const subscriptionId = data.id;

    // En Paddle, "canceled" puede ser inmediato o al final del periodo
    const isImmediate = data.status === 'canceled';

    if (isImmediate) {
        // Cancelación inmediata: marcar como expired y asignar free
        const { data: sub } = await supabase
            .from('user_subscriptions')
            .select('user_id, organization_id')
            .eq('paddle_subscription_id', subscriptionId)
            .single();

        await supabase
            .from('user_subscriptions')
            .update({
                status: 'expired',
                ends_at: data.canceled_at || new Date().toISOString(),
                cancel_at_period_end: false
            })
            .eq('paddle_subscription_id', subscriptionId);

        if (sub?.user_id && sub?.organization_id) {
            await assignFreePlan(supabase, sub.user_id, sub.organization_id);
        }
    } else {
        // Cancelación al final del periodo
        await supabase
            .from('user_subscriptions')
            .update({
                cancel_at_period_end: true,
                ends_at: data.current_billing_period?.ends_at || null
            })
            .eq('paddle_subscription_id', subscriptionId);
    }

    console.log(`[paddle-webhook] Subscription canceled: ${subscriptionId}, immediate=${isImmediate}`);
}

async function handleSubscriptionPaused(supabase: any, data: any) {
    const subscriptionId = data.id;

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'paused',
            paused_at: new Date().toISOString()
        })
        .eq('paddle_subscription_id', subscriptionId);

    if (error) {
        console.error('[paddle-webhook] Error pausing subscription:', error);
    } else {
        console.log(`[paddle-webhook] Subscription paused: ${subscriptionId}`);
    }
}

async function handleSubscriptionResumed(supabase: any, data: any) {
    const subscriptionId = data.id;

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'active',
            paused_at: null,
            cancel_at_period_end: false,
            renews_at: data.current_billing_period?.ends_at || null,
            ends_at: null
        })
        .eq('paddle_subscription_id', subscriptionId);

    if (error) {
        console.error('[paddle-webhook] Error resuming subscription:', error);
    } else {
        console.log(`[paddle-webhook] Subscription resumed: ${subscriptionId}`);
    }
}

async function handleSubscriptionActivated(supabase: any, data: any) {
    // Fired when subscription becomes active (e.g., after trial, payment recovery)
    const subscriptionId = data.id;

    await supabase
        .from('user_subscriptions')
        .update({
            status: 'active',
            renews_at: data.current_billing_period?.ends_at || null
        })
        .eq('paddle_subscription_id', subscriptionId);

    console.log(`[paddle-webhook] Subscription activated: ${subscriptionId}`);
}

async function handleSubscriptionPastDue(supabase: any, data: any) {
    const subscriptionId = data.id;

    await supabase
        .from('user_subscriptions')
        .update({ status: 'past_due' })
        .eq('paddle_subscription_id', subscriptionId);

    console.log(`[paddle-webhook] Subscription past_due: ${subscriptionId}`);
}

async function handleTransactionCompleted(supabase: any, data: any) {
    // Payment successful — log in payment_history
    const subscriptionId = data.subscription_id;
    if (!subscriptionId) return;

    // Update subscription status
    await supabase
        .from('user_subscriptions')
        .update({
            status: 'active',
            paddle_transaction_id: data.id
        })
        .eq('paddle_subscription_id', subscriptionId);

    // Get user info
    const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('id, user_id')
        .eq('paddle_subscription_id', subscriptionId)
        .single();

    if (sub) {
        // Extract amount from details
        const totalAmount = data.details?.totals?.total
            ? parseInt(data.details.totals.total, 10)
            : 0;
        const currency = data.currency_code || 'USD';

        const isInitial = data.origin === 'subscription_charge' && !data.details?.totals?.proration;

        await supabase.from('payment_history').insert({
            user_id: sub.user_id,
            subscription_id: sub.id,
            amount_cents: totalAmount,
            currency: currency,
            status: 'paid',
            paddle_transaction_id: data.id,
            billing_reason: isInitial ? 'initial' : 'renewal',
            raw_response: data,
            description: `Pago ${isInitial ? 'inicial' : 'de renovación'}`
        });
    }

    console.log(`[paddle-webhook] Transaction completed: ${data.id} for subscription ${subscriptionId}`);
}

async function handleTransactionPastDue(supabase: any, data: any) {
    const subscriptionId = data.subscription_id;
    if (!subscriptionId) return;

    await supabase
        .from('user_subscriptions')
        .update({ status: 'past_due' })
        .eq('paddle_subscription_id', subscriptionId);

    // Log failed payment
    const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('id, user_id')
        .eq('paddle_subscription_id', subscriptionId)
        .single();

    if (sub) {
        const totalAmount = data.details?.totals?.total
            ? parseInt(data.details.totals.total, 10)
            : 0;

        await supabase.from('payment_history').insert({
            user_id: sub.user_id,
            subscription_id: sub.id,
            amount_cents: totalAmount,
            currency: data.currency_code || 'USD',
            status: 'declined',
            paddle_transaction_id: data.id,
            billing_reason: 'renewal',
            error_message: 'Payment failed',
            raw_response: data,
            description: 'Pago fallido'
        });
    }

    console.log(`[paddle-webhook] Transaction past_due: ${data.id}`);
}

async function handleAdjustmentCreated(supabase: any, data: any) {
    // Refund
    const transactionId = data.transaction_id;
    if (!transactionId) return;

    // Find subscription by transaction
    const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('paddle_transaction_id', transactionId)
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
            .eq('paddle_transaction_id', transactionId)
            .eq('status', 'paid');
    }

    console.log(`[paddle-webhook] Adjustment (refund) for transaction: ${transactionId}`);
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
    const webhookSecret = Deno.env.get('PADDLE_WEBHOOK_SECRET');
    const supabase = createClient(sbUrl, sbKey);

    try {
        // 1. Read raw body for HMAC verification
        const rawBody = await req.text();

        // 2. Verify Paddle signature
        const signature = req.headers.get('paddle-signature');
        if (!signature || !webhookSecret) {
            console.error('[paddle-webhook] Missing signature or webhook secret');
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: corsHeaders
            });
        }

        const isValid = await verifyPaddleSignature(rawBody, signature, webhookSecret);
        if (!isValid) {
            console.error('[paddle-webhook] Invalid signature');
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                status: 401,
                headers: corsHeaders
            });
        }

        // 3. Parse payload
        const body = JSON.parse(rawBody);
        const eventType = body.event_type;
        const eventId = body.event_id;
        const notificationId = body.notification_id;
        const data = body.data || {};

        console.log(`[paddle-webhook] Event: ${eventType}, ID: ${eventId}`);

        // 4. Idempotency check
        if (eventId) {
            const { data: existing } = await supabase
                .from('paddle_webhook_events')
                .select('id')
                .eq('paddle_event_id', eventId)
                .single();

            if (existing) {
                console.log(`[paddle-webhook] Duplicate event, skipping: ${eventId}`);
                return new Response(JSON.stringify({ success: true, duplicate: true }), {
                    headers: corsHeaders
                });
            }
        }

        // 5. Store event
        await supabase.from('paddle_webhook_events').insert({
            event_type: eventType,
            paddle_event_id: eventId,
            paddle_notification_id: notificationId,
            payload: body
        });

        // 6. Process by event type
        switch (eventType) {
            case 'subscription.created':
                await handleSubscriptionCreated(supabase, data);
                break;
            case 'subscription.updated':
                await handleSubscriptionUpdated(supabase, data);
                break;
            case 'subscription.canceled':
                await handleSubscriptionCanceled(supabase, data);
                break;
            case 'subscription.paused':
                await handleSubscriptionPaused(supabase, data);
                break;
            case 'subscription.resumed':
                await handleSubscriptionResumed(supabase, data);
                break;
            case 'subscription.activated':
                await handleSubscriptionActivated(supabase, data);
                break;
            case 'subscription.past_due':
                await handleSubscriptionPastDue(supabase, data);
                break;
            case 'transaction.completed':
                await handleTransactionCompleted(supabase, data);
                break;
            case 'transaction.past_due':
                await handleTransactionPastDue(supabase, data);
                break;
            case 'adjustment.created':
                await handleAdjustmentCreated(supabase, data);
                break;
            default:
                console.log(`[paddle-webhook] Unhandled event: ${eventType}`);
        }

        // 7. Mark as processed
        if (eventId) {
            await supabase.from('paddle_webhook_events')
                .update({ processed: true, processed_at: new Date().toISOString() })
                .eq('paddle_event_id', eventId);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: corsHeaders
        });

    } catch (error) {
        console.error('[paddle-webhook] Unhandled error:', error);

        // Return 200 to prevent infinite retries from Paddle
        return new Response(JSON.stringify({ success: true, error: 'Internal error logged' }), {
            status: 200,
            headers: corsHeaders
        });
    }
});
