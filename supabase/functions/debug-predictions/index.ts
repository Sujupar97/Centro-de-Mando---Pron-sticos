import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Usamos la conexión directa de Postgres a través de Supabase Admin
    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(sbUrl, sbKey, {
        db: { schema: 'public' },
        auth: { persistSession: false }
    });

    const results: string[] = [];

    try {
        // Test 1: Verificar datos en predictions
        const { data: count, error: countError } = await supabase
            .from('predictions')
            .select('*', { count: 'exact', head: true });

        results.push(`Predictions count check: ${countError ? countError.message : 'OK'}`);

        // Test 2: Leer predicciones directamente
        const { data: preds, error: predError } = await supabase
            .from('predictions')
            .select('fixture_id, market, selection')
            .limit(5);

        results.push(`Direct read: ${predError ? predError.message : `Found ${preds?.length || 0} predictions`}`);

        // Test 3: Verificar fixture_id específico (Man Utd vs Newcastle)
        const { data: manUtd, error: manUtdError } = await supabase
            .from('predictions')
            .select('*')
            .eq('fixture_id', 1379145);

        results.push(`Man Utd fixture check: ${manUtdError ? manUtdError.message : `Found ${manUtd?.length || 0} predictions for fixture 1379145`}`);

        return new Response(JSON.stringify({
            success: true,
            results,
            predictions: preds || [],
            manUtdPredictions: manUtd || []
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        return new Response(JSON.stringify({
            success: false,
            error: err.message,
            results
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
