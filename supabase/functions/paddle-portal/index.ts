/**
 * paddle-portal
 * Genera URLs temporales del portal self-service de Paddle.
 *
 * A diferencia de Lemon Squeezy (que da URLs estáticas en webhooks),
 * Paddle requiere generar URLs con token temporal via API.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const paddleApiKey = Deno.env.get('PADDLE_API_KEY');
    const paddleEnv = Deno.env.get('PADDLE_ENVIRONMENT') || 'production';
    const supabase = createClient(sbUrl, sbKey);

    try {
        const { userId, orgId } = await req.json();

        if (!userId) {
            return new Response(JSON.stringify({ error: 'userId is required' }), {
                status: 400,
                headers: corsHeaders
            });
        }

        if (!paddleApiKey) {
            console.error('[paddle-portal] PADDLE_API_KEY not configured');
            return new Response(JSON.stringify({ error: 'Paddle not configured' }), {
                status: 500,
                headers: corsHeaders
            });
        }

        // 1. Find user's Paddle subscription
        let query = supabase
            .from('user_subscriptions')
            .select('paddle_subscription_id, paddle_customer_id')
            .eq('user_id', userId)
            .not('paddle_subscription_id', 'is', null)
            .in('status', ['active', 'cancelled', 'paused', 'past_due'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (orgId) {
            query = supabase
                .from('user_subscriptions')
                .select('paddle_subscription_id, paddle_customer_id')
                .eq('user_id', userId)
                .eq('organization_id', orgId)
                .not('paddle_subscription_id', 'is', null)
                .in('status', ['active', 'cancelled', 'paused', 'past_due'])
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
        }

        const { data: sub, error: subError } = await query;

        if (subError || !sub?.paddle_customer_id) {
            console.log('[paddle-portal] No Paddle subscription found for user:', userId);
            return new Response(JSON.stringify({ portalUrl: null }), {
                headers: corsHeaders
            });
        }

        // 2. Create portal session via Paddle API
        const baseUrl = paddleEnv === 'sandbox'
            ? 'https://sandbox-api.paddle.com'
            : 'https://api.paddle.com';

        const portalResponse = await fetch(
            `${baseUrl}/customers/${sub.paddle_customer_id}/portal-sessions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${paddleApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subscription_ids: sub.paddle_subscription_id
                        ? [sub.paddle_subscription_id]
                        : []
                })
            }
        );

        if (!portalResponse.ok) {
            const errorText = await portalResponse.text();
            console.error('[paddle-portal] Paddle API error:', portalResponse.status, errorText);
            return new Response(JSON.stringify({ error: 'Error creating portal session' }), {
                status: 500,
                headers: corsHeaders
            });
        }

        const portalData = await portalResponse.json();
        const portalUrl = portalData?.data?.urls?.general?.overview || null;

        console.log(`[paddle-portal] Portal session created for customer: ${sub.paddle_customer_id}`);

        return new Response(JSON.stringify({ portalUrl }), {
            headers: corsHeaders
        });

    } catch (error) {
        console.error('[paddle-portal] Error:', error);
        return new Response(JSON.stringify({ error: 'Internal error' }), {
            status: 500,
            headers: corsHeaders
        });
    }
});
