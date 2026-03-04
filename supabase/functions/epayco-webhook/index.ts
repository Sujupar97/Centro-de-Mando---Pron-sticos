/**
 * epayco-webhook
 * Webhook handler para ePayco.
 * Recibe confirmaciones de pago y activa/actualiza suscripciones.
 *
 * ePayco envía un POST con x_ref_payco que debemos validar
 * contra su API antes de activar la suscripción.
 *
 * Validación: GET https://secure.epayco.co/validation/v1/reference/{ref_payco}
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
};

const EPAYCO_VALIDATION_URL = 'https://secure.epayco.co/validation/v1/reference';

// ==========================================
// Helper: Validar transacción contra ePayco API
// ==========================================

async function validateTransaction(refPayco: string): Promise<any> {
    const response = await fetch(`${EPAYCO_VALIDATION_URL}/${refPayco}`);
    if (!response.ok) {
        throw new Error(`ePayco validation failed: ${response.status}`);
    }
    return await response.json();
}

// ==========================================
// Helper: Resolver plan_id desde epayco_plan_id
// ==========================================

async function resolvePlanFromEpayco(supabase: any, epaycoPlanId: string, billingPeriod: string): Promise<string | null> {
    // Buscar en subscription_plans por epayco_plan_id o epayco_plan_id_annual
    const { data } = await supabase
        .from('subscription_plans')
        .select('id')
        .or(`epayco_plan_id.eq.${epaycoPlanId},epayco_plan_id_annual.eq.${epaycoPlanId}`)
        .limit(1)
        .single();

    if (data?.id) return data.id;

    // Fallback: buscar por nombre del plan en extra3 (formato: "planId|billingPeriod")
    // Si epaycoPlanId contiene el UUID directo del plan
    const { data: directPlan } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('id', epaycoPlanId)
        .single();

    return directPlan?.id || null;
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
        epayco_subscription_id: null,
        epayco_customer_id: null,
    }, { onConflict: 'user_id,organization_id' });
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
    const supabase = createClient(sbUrl, sbKey);

    try {
        // 1. Leer body (ePayco envía form-urlencoded o JSON)
        let payload: Record<string, any> = {};

        const contentType = req.headers.get('content-type') || '';

        if (contentType.includes('application/x-www-form-urlencoded')) {
            const text = await req.text();
            const params = new URLSearchParams(text);
            for (const [key, value] of params) {
                payload[key] = value;
            }
        } else if (contentType.includes('application/json')) {
            payload = await req.json();
        } else {
            // Try to parse as form data
            const text = await req.text();
            try {
                payload = JSON.parse(text);
            } catch {
                const params = new URLSearchParams(text);
                for (const [key, value] of params) {
                    payload[key] = value;
                }
            }
        }

        // ePayco fields: x_ref_payco, x_id_invoice, x_amount, x_currency_code,
        // x_response, x_approval_code, x_transaction_id, x_extra1, x_extra2, x_extra3
        const refPayco = payload.x_ref_payco;
        const transactionId = payload.x_transaction_id;
        const responseCode = payload.x_cod_response || payload.x_response;
        const userId = payload.x_extra1;
        const orgId = payload.x_extra2;
        const planInfo = payload.x_extra3 || ''; // formato: "planId|billingPeriod"

        console.log(`[epayco-webhook] Ref: ${refPayco}, Response: ${responseCode}, User: ${userId}`);

        if (!refPayco) {
            console.error('[epayco-webhook] Missing x_ref_payco');
            return new Response(JSON.stringify({ success: false, error: 'Missing ref' }), {
                headers: corsHeaders
            });
        }

        // 2. Idempotency check
        const { data: existing } = await supabase
            .from('epayco_webhook_events')
            .select('id')
            .eq('ref_payco', String(refPayco))
            .single();

        if (existing) {
            console.log(`[epayco-webhook] Duplicate ref_payco, skipping: ${refPayco}`);
            return new Response(JSON.stringify({ success: true, duplicate: true }), {
                headers: corsHeaders
            });
        }

        // 3. Guardar evento (antes de validar, para auditoría)
        await supabase.from('epayco_webhook_events').insert({
            event_type: 'payment_confirmation',
            epayco_ref: transactionId ? String(transactionId) : null,
            ref_payco: String(refPayco),
            payload
        });

        // 4. Validar transacción contra API de ePayco
        let validatedData: any = null;
        try {
            const validation = await validateTransaction(String(refPayco));
            validatedData = validation?.data;
            console.log(`[epayco-webhook] Validation: status=${validatedData?.x_cod_response}, amount=${validatedData?.x_amount}`);
        } catch (err) {
            console.error(`[epayco-webhook] Validation error:`, err);
            // Log error but don't fail — we still have the webhook data
            await supabase.from('epayco_webhook_events')
                .update({ error: `Validation failed: ${err}` })
                .eq('ref_payco', String(refPayco));
        }

        // Usar datos validados si disponibles, si no los del webhook
        const finalData = validatedData || payload;
        const finalResponseCode = String(finalData.x_cod_response || finalData.x_response || responseCode);
        const amount = finalData.x_amount;
        const currency = finalData.x_currency_code || 'COP';

        // 5. Procesar según código de respuesta
        // ePayco response codes: 1=Aceptada, 2=Rechazada, 3=Pendiente, 4=Fallida
        const isApproved = finalResponseCode === '1';
        const isPending = finalResponseCode === '3';
        const isRejected = finalResponseCode === '2' || finalResponseCode === '4';

        if (isApproved && userId) {
            // Parse plan info
            const [planId, billingPeriod] = planInfo.split('|');
            const resolvedBillingPeriod = billingPeriod || 'monthly';

            // Resolver plan
            let resolvedPlanId = planId;
            if (planId) {
                const fromEpayco = await resolvePlanFromEpayco(supabase, planId, resolvedBillingPeriod);
                if (fromEpayco) resolvedPlanId = fromEpayco;
            }

            if (!resolvedPlanId) {
                console.error(`[epayco-webhook] No plan found for: ${planInfo}`);
                await supabase.from('epayco_webhook_events')
                    .update({ error: `No plan found: ${planInfo}` })
                    .eq('ref_payco', String(refPayco));
                return new Response(JSON.stringify({ success: false }), { headers: corsHeaders });
            }

            // Buscar organización si no se proporcionó
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

            // Calcular período (30 días para mensual, 365 para anual)
            const periodStart = new Date();
            const periodEnd = new Date();
            if (resolvedBillingPeriod === 'annual') {
                periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            } else {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
            }

            // Upsert suscripción
            const { error: subError } = await supabase
                .from('user_subscriptions')
                .upsert({
                    user_id: userId,
                    organization_id: resolvedOrgId,
                    plan_id: resolvedPlanId,
                    status: 'active',
                    current_period_start: periodStart.toISOString(),
                    current_period_end: periodEnd.toISOString(),
                    renews_at: periodEnd.toISOString(),
                    billing_period: resolvedBillingPeriod,
                    cancel_at_period_end: false,
                    epayco_subscription_id: String(refPayco),
                    epayco_customer_id: finalData.x_customer_id ? String(finalData.x_customer_id) : null,
                }, { onConflict: 'user_id,organization_id' });

            if (subError) {
                console.error('[epayco-webhook] Error upserting subscription:', subError);
            } else {
                console.log(`[epayco-webhook] Subscription activated: user=${userId}, plan=${resolvedPlanId}, period=${resolvedBillingPeriod}`);
            }

            // Log en payment_history
            const { data: sub } = await supabase
                .from('user_subscriptions')
                .select('id')
                .eq('user_id', userId)
                .eq('organization_id', resolvedOrgId)
                .single();

            if (sub) {
                await supabase.from('payment_history').insert({
                    user_id: userId,
                    subscription_id: sub.id,
                    amount_cents: Math.round(parseFloat(amount || '0') * 100),
                    currency: currency.toUpperCase(),
                    status: 'paid',
                    epayco_ref: String(refPayco),
                    epayco_transaction_id: transactionId ? String(transactionId) : null,
                    billing_reason: 'initial',
                    raw_response: finalData,
                    description: `Pago ePayco - ${resolvedBillingPeriod === 'annual' ? 'Anual' : 'Mensual'}`
                });
            }
        } else if (isPending && userId) {
            console.log(`[epayco-webhook] Payment pending: ref=${refPayco}, user=${userId}`);
        } else if (isRejected) {
            console.log(`[epayco-webhook] Payment rejected: ref=${refPayco}, code=${finalResponseCode}`);

            // Log payment failure
            if (userId) {
                const [planId] = (planInfo || '').split('|');
                const resolvedOrgId = orgId || null;

                if (resolvedOrgId) {
                    const { data: sub } = await supabase
                        .from('user_subscriptions')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('organization_id', resolvedOrgId)
                        .single();

                    if (sub) {
                        await supabase.from('payment_history').insert({
                            user_id: userId,
                            subscription_id: sub.id,
                            amount_cents: Math.round(parseFloat(amount || '0') * 100),
                            currency: (currency || 'COP').toUpperCase(),
                            status: 'declined',
                            epayco_ref: String(refPayco),
                            billing_reason: 'initial',
                            error_message: `Payment rejected: code ${finalResponseCode}`,
                            raw_response: finalData,
                            description: 'Pago rechazado'
                        });
                    }
                }
            }
        }

        // 6. Marcar como procesado
        await supabase.from('epayco_webhook_events')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq('ref_payco', String(refPayco));

        // Siempre retornar 200
        return new Response(JSON.stringify({ success: true }), {
            headers: corsHeaders
        });

    } catch (error) {
        console.error('[epayco-webhook] Unhandled error:', error);
        return new Response(JSON.stringify({ success: true, error: 'Internal error logged' }), {
            status: 200,
            headers: corsHeaders
        });
    }
});
