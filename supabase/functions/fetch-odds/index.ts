
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
        const { sport, region, markets, eventIds } = await req.json();

        // Default params
        const sportKey = sport || 'soccer_epl'; // Default to EPL if generic
        const targetRegion = region || 'eu'; // EU usually has better coverage for soccer
        const targetMarkets = markets || 'h2h,totals'; // standard Winner & Over/Under

        // CACHING STRATEGY (Simple implementation for now)
        // In a real prod env, we would check Supabase DB for recent 'odds_cache' entry.
        // For now, we just pass through to the API.

        // Construct URL
        const url = `${BASE_URL}/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=${targetRegion}&markets=${targetMarkets}&oddsFormat=decimal`;

        console.log(`Fetching odds from: ${url}`);

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error("Odds API Error:", data);
            throw new Error(data.message || "Failed to fetch from Odds API");
        }

        // Return header quotas to monitor usage
        const remaining = response.headers.get('x-requests-remaining');
        const used = response.headers.get('x-requests-used');

        return new Response(JSON.stringify({
            data: data,
            meta: { remaining, used }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
})
