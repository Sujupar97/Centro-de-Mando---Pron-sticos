// supabase/functions/v2-list-fixtures-sportmonks/index.ts
// Proxy para listar partidos usando SportMonks (reemplaza football-data-proxy para listados)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getFixturesByDate } from '../_shared/sportmonks-client.ts'
import { normalizeSportMonksToListGame } from '../_shared/sportmonks-normalizer.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { date } = await req.json();

        if (!date) {
            throw new Error('Date is required (YYYY-MM-DD)');
        }

        console.log(`[v2-list-fixtures-sportmonks] Fetching for date: ${date}`);

        // 1. Fetch data from SportMonks
        const fixtures = await getFixturesByDate(date);
        console.log(`[v2-list-fixtures-sportmonks] Found ${fixtures.length} raw fixtures`);

        // 2. Normalize using shared logic
        const normalized = fixtures.map(normalizeSportMonksToListGame);
        console.log(`[v2-list-fixtures-sportmonks] Normalized ${normalized.length} fixtures`);

        return new Response(JSON.stringify(normalized), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[v2-list-fixtures-sportmonks] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
