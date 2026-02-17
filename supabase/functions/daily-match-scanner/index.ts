// supabase/functions/daily-match-scanner/index.ts
// DEPRECATED: This function used API-Football IDs which conflicted with SportMonks IDs.
// Replaced by v2-list-fixtures-sportmonks which populates daily_matches with SportMonks IDs
// on every user request. Kept as no-op so the cron job doesn't fail.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    console.log('[Scanner] DEPRECATED: daily-match-scanner is disabled. daily_matches is now populated by v2-list-fixtures-sportmonks.');

    return new Response(
        JSON.stringify({
            success: true,
            deprecated: true,
            message: 'daily-match-scanner is disabled. daily_matches is populated by v2-list-fixtures-sportmonks on user request.',
            matchesSaved: 0
        }),
        {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        }
    )
})
