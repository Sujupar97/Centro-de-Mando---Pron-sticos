// supabase/functions/daily-parlay-generator/index.ts
// CRON wrapper: Genera parlays automáticos invocando v3-generate-parlay-combos
// Usa parlay_combos_v2 (sistema actual) — NO el pipeline legacy
// CRON: 4:00 AM Colombia (9:00 AM UTC)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 0. Check system settings
        const { data: settings } = await supabase
            .from('system_settings')
            .select('key, value')
            .eq('key', 'auto_parlay_enabled')
            .single();

        const enabled = settings?.value ?? true;

        if (!enabled) {
            log('[AutoParlayGen] Auto-parlay disabled by system_settings');
            return new Response(JSON.stringify({ success: true, message: 'Disabled', logs }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 1. Determine target date
        let reqBody: any = {};
        try { reqBody = await req.json().catch(() => ({})); } catch { /* ignore */ }
        const targetDate = reqBody?.date || new Date().toISOString().split('T')[0];

        log(`[AutoParlayGen] Generating parlay combos for: ${targetDate}`);

        // 2. Invoke v3-generate-parlay-combos (same Supabase project)
        const comboUrl = `${supabaseUrl}/functions/v1/v3-generate-parlay-combos`;
        const comboResponse = await fetch(comboUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ date: targetDate }),
        });

        const comboResult = await comboResponse.json();

        if (!comboResponse.ok || !comboResult.success) {
            log(`[AutoParlayGen] v3-generate-parlay-combos returned: ${comboResult.message || comboResult.error || 'unknown error'}`);
            // Include combo function logs if available
            if (comboResult.logs) {
                comboResult.logs.forEach((l: string) => log(`  [COMBOS] ${l}`));
            }
            return new Response(JSON.stringify({
                success: false,
                message: comboResult.message || comboResult.error || 'Combo generation failed',
                date: targetDate,
                logs
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        log(`[AutoParlayGen] Successfully generated ${comboResult.stats?.combos_saved || 0} parlay combos`);
        log(`[AutoParlayGen] Source: ${comboResult.source || 'unknown'}`);
        log(`[AutoParlayGen] Stats: ${JSON.stringify(comboResult.stats || {})}`);

        return new Response(JSON.stringify({
            success: true,
            date: targetDate,
            combos_saved: comboResult.stats?.combos_saved || 0,
            source: comboResult.source,
            stats: comboResult.stats,
            logs
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        log(`[AutoParlayGen] Error: ${error.message}`);
        return new Response(
            JSON.stringify({ success: false, error: error.message, logs }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
