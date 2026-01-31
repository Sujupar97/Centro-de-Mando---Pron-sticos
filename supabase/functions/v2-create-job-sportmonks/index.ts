// supabase/functions/v2-create-job-sportmonks/index.ts
// Motor ETL con SportMonks API - Reemplazo de API-Football
// Versión: 3.0.0-SPORTMONKS

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'
import {
    fetchSportMonks,
    getFixtureComplete,
    getTeamFixtures,
    getH2H,
    getStandings,
    getPredictions,
    getValueBets
} from '../_shared/sportmonks-client.ts'
import { buildNormalizedPayload } from '../_shared/sportmonks-normalizer.ts'

const ENGINE_VERSION = '3.0.0-SPORTMONKS';

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const startTime = Date.now();
    let supabase: any;
    let jobId: string | null = null;

    try {
        const { fixture_id } = await req.json();

        if (!fixture_id) {
            throw new Error('fixture_id is required');
        }

        console.log(`[v2-create-job-sportmonks] Starting ETL for SportMonks fixture: ${fixture_id}`);

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        supabase = createClient(sbUrl, sbKey);

        // Create job record
        const { data: job, error: jobError } = await supabase
            .from('analysis_jobs_v2')
            .insert({
                fixture_id,
                status: 'etl',
                current_motor: 'SPORTMONKS-ETL',
                engine_version: ENGINE_VERSION
            })
            .select()
            .single();

        if (jobError) throw jobError;
        jobId = job.id;

        console.log(`[v2-create-job-sportmonks] Job created: ${jobId}`);

        // ═══════════════════════════════════════════════════════════════
        // STAGE 1: FETCH COMPLETE FIXTURE DATA (single call with includes)
        // ═══════════════════════════════════════════════════════════════
        console.log('[v2-create-job-sportmonks] Stage 1: Fetching complete fixture data...');

        const fixtureData = await getFixtureComplete(fixture_id);

        if (!fixtureData) {
            throw new Error(`Fixture ${fixture_id} not found in SportMonks`);
        }

        // Extract team IDs
        const homeTeam = fixtureData.participants?.find((p: any) => p.meta?.location === 'home');
        const awayTeam = fixtureData.participants?.find((p: any) => p.meta?.location === 'away');

        if (!homeTeam || !awayTeam) {
            throw new Error('Could not identify home/away teams');
        }

        const homeTeamId = homeTeam.id;
        const awayTeamId = awayTeam.id;
        const seasonId = fixtureData.season_id;

        console.log(`[v2-create-job-sportmonks] Teams: ${homeTeam.name} vs ${awayTeam.name}`);

        // ═══════════════════════════════════════════════════════════════
        // STAGE 2: FETCH ADDITIONAL DATA (parallel)
        // ═══════════════════════════════════════════════════════════════
        console.log('[v2-create-job-sportmonks] Stage 2: Fetching additional data (Deep Dive V4)...');

        // V4 REQUIREMENT: 20 matches with FULL stats (lineups, statistics, events)
        const deepIncludes = ['participants', 'scores', 'venue', 'league', 'statistics', 'lineups', 'events', 'formations'];

        const [
            homeHistory,
            awayHistory,
            h2h,
            standings,
            predictions,
            valueBets
        ] = await Promise.all([
            getTeamFixtures(homeTeamId, 20, deepIncludes), // 20 matches Deep Dive
            getTeamFixtures(awayTeamId, 20, deepIncludes), // 20 matches Deep Dive
            getH2H(homeTeamId, awayTeamId),
            seasonId ? getStandings(seasonId) : Promise.resolve([]),
            getPredictions(fixture_id),
            getValueBets(fixture_id)
        ]);

        console.log(`[v2-create-job-sportmonks] Data fetched:`);
        console.log(`  - Home deep history: ${homeHistory.length} matches`);
        console.log(`  - Away deep history: ${awayHistory.length} matches`);
        console.log(`  - H2H: ${h2h.length} matches`);
        console.log(`  - Standings: ${standings.length} teams`);
        console.log(`  - Predictions: ${predictions ? 'YES' : 'NO'}`);
        console.log(`  - Value Bets: ${valueBets.length} bets`);

        // ═══════════════════════════════════════════════════════════════
        // STAGE 3: BUILD NORMALIZED PAYLOAD
        // ═══════════════════════════════════════════════════════════════
        console.log('[v2-create-job-sportmonks] Stage 3: Building normalized payload...');

        // Note: buildNormalizedPayload will need to be updated to accept and process 
        // the deep stats, OR we pre-process them here. 
        // Ideally, we pass the raw data and let the normalizer handle it, 
        // BUT buildNormalizedPayload signature expects simple arrays.
        // We will update sportmonks-normalizer.ts to export a new 'buildDeepPayload' 
        // or just monkey-patch the payload construction here for V4.

        // Import the new normalizer function
        const { normalizeDetailedMatchHistory } = await import('../_shared/sportmonks-normalizer.ts');

        const homeDeep = normalizeDetailedMatchHistory(homeHistory, homeTeamId);
        const awayDeep = normalizeDetailedMatchHistory(awayHistory, awayTeamId);

        const normalizedPayload = {
            match: {
                fixture_id: fixtureData.id,
                stats: fixtureData.statistics,
                venue: fixtureData.venue,
                league_id: fixtureData.league_id,
                season_id: fixtureData.season_id,
                date_time_utc: fixtureData.starting_at,
                teams: {
                    home: { id: homeTeamId, name: homeTeam.name, image: homeTeam.image_path },
                    away: { id: awayTeamId, name: awayTeam.name, image: awayTeam.image_path }
                },
                competition: {
                    id: fixtureData.league?.id,
                    name: fixtureData.league?.name,
                    country: fixtureData.league?.country?.name,
                    round: fixtureData.round?.name
                }
            },
            datasets: {
                home_team_last40: { all: homeDeep }, // Using Deep history in place of simple
                away_team_last40: { all: awayDeep }, // Using Deep history in place of simple
                h2h: h2h, // Helper function to normalize H2H can be reused or raw if fine
                standings: {
                    home_context: standings.find((s: any) => s.participant_id === homeTeamId),
                    away_context: standings.find((s: any) => s.participant_id === awayTeamId),
                    table: standings
                },
                injuries: {
                    home: fixtureData.sidelined?.filter((s: any) => s.team_id === homeTeamId) || [],
                    away: fixtureData.sidelined?.filter((s: any) => s.team_id === awayTeamId) || []
                }
            },
            predictions,
            value_bets: valueBets,
            odds: fixtureData.odds
        };

        // Calculate coverage score
        const coverage = {
            fixture: !!fixtureData,
            lineups: (fixtureData.lineups?.length || 0) > 0,
            statistics: (fixtureData.statistics?.length || 0) > 0,
            odds: (fixtureData.odds?.length || 0) > 0,
            predictions: !!predictions,
            h2h: h2h.length > 0,
            standings: standings.length > 0,
            injuries: (fixtureData.sidelined?.length || 0) > 0,
            xg: !!fixtureData.xGFixture,
            value_bets: valueBets.length > 0,
            deep_history: homeDeep.length > 0 && homeDeep[0].details // Check if deep stats exist
        };

        const coverageScore = Object.values(coverage).filter(Boolean).length / Object.keys(coverage).length;
        console.log(`[v2-create-job-sportmonks] Coverage: ${Math.round(coverageScore * 100)}%`);

        // ═══════════════════════════════════════════════════════════════
        // STAGE 4: UPDATE JOB AND CALL V3-AI-ANALYZER
        // ═══════════════════════════════════════════════════════════════
        console.log('[v2-create-job-sportmonks] Stage 4: Updating job and calling analyzer...');

        await supabase
            .from('analysis_jobs_v2')
            .update({
                status: 'analyzing',
                data_coverage: coverage,
                coverage_pct: Math.round(coverageScore * 100)
            })
            .eq('id', jobId);

        // Call v3-ai-analyzer using SERVICE ROLE KEY via FETCH
        // DEBUG: Hardcoding key because Deno.env.get seems to be failing or returning invalid key
        const envKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const knownGoodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.x1icf0Wbkp1xb6h1500HeTvyNykBAAnlqz1udv2AaX4';

        const serviceRoleKey = knownGoodKey;

        console.log(`[v2] Using Hardcoded Key (Start: ${serviceRoleKey.substring(0, 5)}...)`);
        if (envKey !== knownGoodKey) {
            console.warn(`[v2] WARNING: Deno.env.get Key (${envKey ? envKey.substring(0, 5) : 'null'}) DOES NOT MATCH Known Good Key!`);
        }

        // DEBUG: Inspect normalized odds before sending
        if (normalizedPayload.odds && normalizedPayload.odds.bookmakers && normalizedPayload.odds.bookmakers.length > 0) {
            const bestBookie = normalizedPayload.odds.bookmakers[0];
            console.log(`[v2] Best Bookmaker Selected: ${bestBookie.title} (ID: ${bestBookie.id})`);
            console.log(`[v2] Markets Available: ${bestBookie.markets.map((m: any) => m.key).join(', ')}`);
        } else {
            console.log('[v2] No Odds/Bookmakers found in normalized payload');
        }

        const analyzerUrl = `${sbUrl}/functions/v1/v3-ai-analyzer`;
        console.log(`[v2] Calling analyzer at ${analyzerUrl} with payload size: ${JSON.stringify(normalizedPayload).length} chars`);

        const analyzerRes = await fetch(analyzerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`
            },
            body: JSON.stringify({
                job_id: jobId,
                fixture_id,
                payload: normalizedPayload
            })
        });

        if (!analyzerRes.ok) {
            const errorStatus = analyzerRes.status;
            const errorText = await analyzerRes.text();
            console.error(`[v2] Analyzer call failed with ${errorStatus}: ${errorText}`);
            throw new Error(`Analyzer V3 Failed (${errorStatus}): ${errorText.substring(0, 500)}`);
        }

        const analyzerResult = await analyzerRes.json();

        const duration = Date.now() - startTime;
        console.log(`[v2-create-job-sportmonks] Completed in ${duration}ms`);

        return new Response(JSON.stringify({
            success: true,
            job_id: jobId,
            fixture_id,
            engine: ENGINE_VERSION,
            coverage: coverage,
            coverage_pct: Math.round(coverageScore * 100),
            duration_ms: duration,
            data_source: 'SportMonks',
            predictions_available: !!predictions,
            value_bets_count: valueBets.length
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[v2-create-job-sportmonks] Error:', error);

        if (jobId && supabase) {
            await supabase
                .from('analysis_jobs_v2')
                .update({
                    status: 'error',
                    error_log: error.message
                })
                .eq('id', jobId);
        }

        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            job_id: jobId
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
