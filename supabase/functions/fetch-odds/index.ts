// supabase/functions/fetch-odds/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { LEAGUE_MAPPING } from '../_shared/league-mapping.ts'

const ODDS_API_KEY = "527a97a0d2316436a0bacf71c7b93eb5";
const BASE_URL = "https://api.the-odds-api.com/v4/sports";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        let body;
        try {
            body = await req.json();
        } catch {
            body = {};
        }

        const { league_id, region, markets } = body; // Using league_id from API-Football

        // 1. Resolve Sport Key
        let sportKey = 'soccer_epl'; // Default
        if (league_id) {
            sportKey = LEAGUE_MAPPING[league_id];
            if (!sportKey) {
                console.log(`[FETCH-ODDS] League ID ${league_id} not mapped. returning empty.`);
                return new Response(JSON.stringify({
                    data: [],
                    meta: { message: `League ${league_id} not supported by Odds API mapping yet.` }
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }

        const targetRegion = region || 'eu';
        const targetMarkets = markets || 'h2h,totals'; // Winner & Over/Under

        // 2. Fetch from API
        const url = `${BASE_URL}/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=${targetRegion}&markets=${targetMarkets}&oddsFormat=decimal`;

        console.log(`[FETCH-ODDS] Fetching for league: ${league_id} -> ${sportKey}`);

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error("[FETCH-ODDS] API Error:", data);
            return new Response(JSON.stringify({ data: [], error: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 3. Return Data
        const remaining = response.headers.get('x-requests-remaining');
        console.log(`[FETCH-ODDS] Success. Events: ${Array.isArray(data) ? data.length : 0}. API Quota: ${remaining}`);

        return new Response(JSON.stringify({
            data: data,
            meta: { remaining }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("[FETCH-ODDS] Exception:", error.message);
        return new Response(JSON.stringify({ data: [], error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
})
