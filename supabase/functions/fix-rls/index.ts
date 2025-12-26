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

    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Conectar directamente a Postgres usando el pooler
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');

    if (!dbUrl) {
        return new Response(JSON.stringify({
            error: "SUPABASE_DB_URL not configured",
            hint: "Add SUPABASE_DB_URL to Edge Function secrets"
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        // Importar postgres driver
        const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.4/mod.js");

        const sql = postgres(dbUrl);

        // Ejecutar las correcciones de RLS
        await sql`
      DROP POLICY IF EXISTS "Public predictions are viewable by everyone" ON public.predictions;
    `;

        await sql`
      DROP POLICY IF EXISTS "Auth users can insert predictions" ON public.predictions;
    `;

        await sql`
      DROP POLICY IF EXISTS "Anyone can read predictions" ON public.predictions;
    `;

        await sql`
      DROP POLICY IF EXISTS "Service can manage predictions" ON public.predictions;
    `;

        // Crear nuevas políticas
        await sql`
      CREATE POLICY "Anyone can read predictions" 
        ON public.predictions 
        FOR SELECT 
        USING (true);
    `;

        await sql`
      CREATE POLICY "Service can manage predictions" 
        ON public.predictions 
        FOR ALL
        USING (true)
        WITH CHECK (true);
    `;

        // Verificar
        const count = await sql`SELECT COUNT(*) as total FROM public.predictions`;

        await sql.end();

        return new Response(JSON.stringify({
            success: true,
            message: "RLS policies updated successfully",
            predictionsCount: count[0].total
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        return new Response(JSON.stringify({
            success: false,
            error: err.message,
            stack: err.stack
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
