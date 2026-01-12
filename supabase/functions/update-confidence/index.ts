import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        // Fetch predictions without confidence
        const { data: preds } = await supabase
            .from('predictions')
            .select('id, probability')
            .is('confidence', null)
            .gte('created_at', '2026-01-07T00:00:00');

        let updated = 0;

        for (const pred of preds || []) {
            const confidence = pred.probability >= 70 ? 'Alta' : (pred.probability >= 50 ? 'Media' : 'Baja');

            const { error } = await supabase
                .from('predictions')
                .update({ confidence })
                .eq('id', pred.id);

            if (!error) updated++;
        }

        return new Response(JSON.stringify({ success: true, updated }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
})
