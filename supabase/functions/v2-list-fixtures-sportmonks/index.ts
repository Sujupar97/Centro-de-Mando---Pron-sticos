// supabase/functions/v2-list-fixtures-sportmonks/index.ts
// Proxy para listar partidos usando SportMonks (reemplaza football-data-proxy para listados)
// Also syncs fixtures to daily_matches so analysis tables use consistent SportMonks IDs
//
// TIMEZONE FIX: `date` param is a Bogotá date (YYYY-MM-DD).
// SportMonks /fixtures/date/{date} interprets dates as UTC.
// Bogotá = UTC-5, so a Bogotá day spans two UTC days.
// We fetch BOTH UTC days and filter to only include fixtures within the Bogotá day.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getFixturesByDate } from '../_shared/sportmonks-client.ts'
import { normalizeSportMonksToListGame } from '../_shared/sportmonks-normalizer.ts'
import { corsHeaders } from '../_shared/cors.ts'

/** Convert a UTC timestamp to YYYY-MM-DD in Bogotá timezone */
function getBogotaDate(utcTimestamp: string): string {
    const d = new Date(utcTimestamp);
    // Intl.DateTimeFormat with en-CA locale gives YYYY-MM-DD natively
    return new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        timeZone: 'America/Bogota'
    }).format(d);
}

/** Get next day string YYYY-MM-DD */
function getNextDay(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z'); // noon to avoid DST edge cases
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split('T')[0];
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { date } = await req.json();

        if (!date) {
            throw new Error('Date is required (YYYY-MM-DD)');
        }

        console.log(`[v2-list-fixtures-sportmonks] Fetching for Bogotá date: ${date}`);

        // ═══════════════════════════════════════════════════════════════
        // TIMEZONE FIX: Fetch TWO UTC days to cover full Bogotá day
        // Bogotá 00:00 = UTC 05:00 (same day)
        // Bogotá 23:59 = UTC 04:59 (next day)
        // So we need SportMonks data for `date` (UTC) + `date+1` (UTC)
        // ═══════════════════════════════════════════════════════════════
        const nextDayStr = getNextDay(date);

        const [fixturesDay1, fixturesDay2] = await Promise.all([
            getFixturesByDate(date),
            getFixturesByDate(nextDayStr)
        ]);

        console.log(`[v2-list-fixtures-sportmonks] Raw: ${fixturesDay1.length} fixtures (${date} UTC) + ${fixturesDay2.length} fixtures (${nextDayStr} UTC)`);

        // Merge + deduplicate by fixture ID
        const seenIds = new Set<number>();
        const allRaw: any[] = [];
        for (const f of [...fixturesDay1, ...fixturesDay2]) {
            if (f.id && !seenIds.has(f.id)) {
                seenIds.add(f.id);
                allRaw.push(f);
            }
        }

        // Filter: only fixtures whose starting_at falls within the requested Bogotá date
        const filtered = allRaw.filter(f => {
            if (!f.starting_at) return false;
            return getBogotaDate(f.starting_at) === date;
        });

        console.log(`[v2-list-fixtures-sportmonks] After Bogotá filter: ${filtered.length} fixtures (from ${allRaw.length} total)`);

        // 2. Normalize using shared logic
        const normalized = filtered.map(normalizeSportMonksToListGame);

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
                    league_id: null, // NULL to avoid FK violation (SportMonks league IDs ≠ allowed_leagues)
                    league_name: g.league?.name || 'Unknown',
                    home_team: g.teams.home.name,
                    home_team_logo: g.teams.home.logo || '',
                    away_team: g.teams.away.name,
                    away_team_logo: g.teams.away.logo || '',
                    match_time: g.fixture.date,
                    match_status: g.fixture.status?.short || 'NS',
                    home_score: g.goals?.home,
                    away_score: g.goals?.away,
                    match_date: getBogotaDate(g.fixture.date), // Real Bogotá date from UTC timestamp
                    scan_date: new Date().toISOString().split('T')[0]
                }));

            if (dailyMatchRows.length > 0) {
                // CRITICAL: DB constraint is UNIQUE(api_fixture_id, match_date) - must use composite key
                const { error: upsertError } = await supabase
                    .from('daily_matches')
                    .upsert(dailyMatchRows, { onConflict: 'api_fixture_id,match_date' });

                if (upsertError) {
                    console.error(`[v2-list-fixtures-sportmonks] daily_matches upsert error:`, upsertError.message);
                } else {
                    console.log(`[v2-list-fixtures-sportmonks] Synced ${dailyMatchRows.length} matches to daily_matches`);
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // STALE CLEANUP: Remove daily_matches entries for this date
            // that no longer exist in SportMonks (rescheduled/cancelled).
            // This prevents showing stale fixtures on a wrong date.
            // ═══════════════════════════════════════════════════════════════
            const currentFixtureIds = normalized.map((g: any) => g.fixture?.id).filter(Boolean);
            const { data: dbRows } = await supabase
                .from('daily_matches')
                .select('id, api_fixture_id')
                .eq('match_date', date);

            if (dbRows && dbRows.length > 0) {
                const currentIdSet = new Set(currentFixtureIds);
                const staleRows = dbRows.filter((r: any) => !currentIdSet.has(r.api_fixture_id));

                if (staleRows.length > 0) {
                    const staleIds = staleRows.map((r: any) => r.id);
                    const { error: deleteError } = await supabase
                        .from('daily_matches')
                        .delete()
                        .in('id', staleIds);

                    if (deleteError) {
                        console.error(`[v2-list-fixtures-sportmonks] Stale cleanup error:`, deleteError.message);
                    } else {
                        console.log(`[v2-list-fixtures-sportmonks] Cleaned ${staleRows.length} stale fixtures from ${date} (rescheduled/cancelled)`);
                    }
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
