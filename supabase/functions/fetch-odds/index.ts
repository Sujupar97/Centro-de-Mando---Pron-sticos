
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

const ODDS_API_KEY = "6a59ebbe452f64f664d6dcba144b546e"; // User provided
const BASE_URL = "https://api.the-odds-api.com/v4/sports";

serve(async (req) => {
    // 1. Handle CORS Preflight
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

        const { sport, region, markets, eventIds } = body;

        // Default params
        const sportKey = sport || 'soccer_epl'; // Default to EPL if generic
        const targetRegion = region || 'eu'; // EU usually has better coverage for soccer
        const targetMarkets = markets || 'h2h,totals'; // standard Winner & Over/Under

        // Construct URL
        const url = `${BASE_URL}/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=${targetRegion}&markets=${targetMarkets}&oddsFormat=decimal`;

        console.log(`[FETCH-ODDS] Fetching odds for sport: ${sportKey}`);

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error("[FETCH-ODDS] Odds API Error:", data);
            // Return empty array instead of error for unsupported sports
            return new Response(JSON.stringify({
                data: [],
                meta: { remaining: 'unknown', used: 'unknown', error: data.message || 'API Error' }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200, // Return 200 with empty data instead of 500
            });
        }

        // Return header quotas to monitor usage
        const remaining = response.headers.get('x-requests-remaining');
        const used = response.headers.get('x-requests-used');

        console.log(`[FETCH-ODDS] Success. Got ${Array.isArray(data) ? data.length : 0} events. Remaining: ${remaining}`);

        return new Response(JSON.stringify({
            data: data,
            meta: { remaining, used }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("[FETCH-ODDS] Exception:", error.message);
        // Return empty data on error instead of 500
        return new Response(JSON.stringify({
            data: [],
            meta: { error: error.message }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, // Return 200 with empty data to prevent frontend crashes
        });
    }
})

