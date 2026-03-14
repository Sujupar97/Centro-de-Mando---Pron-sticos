/**
 * whatsapp-status-webhook
 * Receives WhatsApp Cloud API webhook callbacks for message status updates.
 *
 * Status flow: sent → delivered → read
 * Also handles webhook verification (GET request with hub.verify_token).
 *
 * Env vars:
 * - WHATSAPP_WEBHOOK_VERIFY_TOKEN — token for webhook verification
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

const PREFIX = '[WhatsAppWebhook]';

serve(async (req) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // GET: Webhook verification (Meta sends this when registering the webhook)
    if (req.method === 'GET') {
        const url = new URL(req.url);
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        const verifyToken = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

        if (mode === 'subscribe' && token === verifyToken) {
            console.log(`${PREFIX} Webhook verified successfully`);
            return new Response(challenge, { status: 200 });
        }

        console.log(`${PREFIX} Webhook verification failed`);
        return new Response('Forbidden', { status: 403 });
    }

    // POST: Incoming webhook events
    try {
        const body = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // WhatsApp Cloud API webhook payload structure:
        // { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { statuses: [...] } }] }] }

        if (body.object !== 'whatsapp_business_account') {
            return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        let statusesProcessed = 0;

        for (const entry of (body.entry || [])) {
            for (const change of (entry.changes || [])) {
                const statuses = change.value?.statuses || [];

                for (const status of statuses) {
                    // status: { id: 'wamid.xxx', status: 'sent'|'delivered'|'read', timestamp: '1234567890', recipient_id: '573001234567' }
                    const waMessageId = status.id;
                    const newStatus = status.status; // sent, delivered, read, failed
                    const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000).toISOString() : new Date().toISOString();

                    if (!waMessageId || !newStatus) continue;

                    // Update notification_log
                    const updateData: Record<string, any> = {
                        status: newStatus,
                    };

                    if (newStatus === 'sent') {
                        updateData.sent_at = timestamp;
                    } else if (newStatus === 'delivered') {
                        updateData.delivered_at = timestamp;
                    } else if (newStatus === 'read') {
                        updateData.read_at = timestamp;
                    } else if (newStatus === 'failed') {
                        updateData.error_message = status.errors?.[0]?.message || 'Message failed';
                    }

                    const { error } = await supabase
                        .from('notification_log')
                        .update(updateData)
                        .eq('whatsapp_message_id', waMessageId);

                    if (error) {
                        console.error(`${PREFIX} Error updating ${waMessageId}: ${error.message}`);
                    } else {
                        statusesProcessed++;
                    }
                }
            }
        }

        console.log(`${PREFIX} Processed ${statusesProcessed} status updates`);

        return new Response(JSON.stringify({ ok: true, processed: statusesProcessed }), {
            headers: corsHeaders
        });

    } catch (error: any) {
        console.error(`${PREFIX} Error: ${error.message}`);
        // Always return 200 to prevent Meta from retrying
        return new Response(JSON.stringify({ ok: true, error: error.message }), {
            headers: corsHeaders
        });
    }
});
