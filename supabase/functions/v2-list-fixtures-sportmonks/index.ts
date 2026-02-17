// supabase/functions/v2-list-fixtures-sportmonks/index.ts
// Proxy para listar partidos usando SportMonks (reemplaza football-data-proxy para listados)
// Also syncs fixtures to daily_matches so analysis tables use consistent SportMonks IDs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
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

        // 3. Sync to daily_matches (non-blocking, best-effort)
        // This ensures v3-ai-analyzer can resolve fixture IDs correctly using SportMonks IDs
        try {
            const sbUrl = Deno.env.get('SUPABASE_URL')!;
            const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabase = createClient(sbUrl, sbKey);

            const dailyMatchRows = normalized
                .filter((g: any) => g.fixture?.id && g.teams?.home?.name && g.teams?.away?.name)
                .map((g: any) => ({
                    api_fixture_id: g.fixture.id, // SportMonks ID
                    league_id: g.league?.id || 0,
                    league_name: g.league?.name || 'Unknown',
                    home_team: g.teams.home.name,
                    home_team_logo: g.teams.home.logo || '',
                    away_team: g.teams.away.name,
                    away_team_logo: g.teams.away.logo || '',
                    match_time: g.fixture.date,
                    match_status: g.fixture.status?.short || 'NS',
                    home_score: g.goals?.home,
                    away_score: g.goals?.away,
                    match_date: date,
                    scan_date: new Date().toISOString().split('T')[0]
                }));

            if (dailyMatchRows.length > 0) {
                const { error: upsertError } = await supabase
                    .from('daily_matches')
                    .upsert(dailyMatchRows, { onConflict: 'api_fixture_id' });

                if (upsertError) {
                    console.error(`[v2-list-fixtures-sportmonks] daily_matches upsert error:`, upsertError.message);
                } else {
                    console.log(`[v2-list-fixtures-sportmonks] Synced ${dailyMatchRows.length} matches to daily_matches`);
                }
            }
        } catch (syncErr: any) {
            // Non-blocking: don't fail the main response if sync fails
            console.error(`[v2-list-fixtures-sportmonks] daily_matches sync error (non-blocking):`, syncErr.message);
        }

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
