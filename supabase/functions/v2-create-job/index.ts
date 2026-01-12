// supabase/functions/v2-create-job/index.ts
// MOTOR A: ETL y Normalización
// Propósito: Recoger datos, normalizar, calcular coverage - SIN predictions externas

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const ENGINE_VERSION = '2.0.0';

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const startTime = Date.now();
    let supabase: any;
    let jobId: string | null = null;

    try {
        const { fixture_id } = await req.json();
        if (!fixture_id) throw new Error('fixture_id is required');

        console.log(`[V2-ETL] Starting job for fixture: ${fixture_id}`);

        // Setup
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const footballKeys = Deno.env.get('API_FOOTBALL_KEYS') || '';

        supabase = createClient(sbUrl, sbKey);
        const apiKeys = footballKeys.split(',').map(k => k.trim()).filter(k => k);

        // Create job
        const { data: job, error: jobError } = await supabase
            .from('analysis_jobs_v2')
            .insert({
                fixture_id,
                status: 'etl',
                current_motor: 'A',
                engine_version: ENGINE_VERSION
            })
            .select()
            .single();

        if (jobError) throw jobError;
        jobId = job.id;

        // Helper: Fetch from API-Football
        const fetchFootball = async (path: string) => {
            for (const key of apiKeys) {
                try {
                    const res = await fetch(`${API_FOOTBALL_BASE}/${path}`, {
                        headers: { 'x-apisports-key': key }
                    });
                    if (res.ok) {
                        const json = await res.json();
                        if (!json.errors || Object.keys(json.errors).length === 0) {
                            return json.response;
                        }
                    }
                } catch (e) { console.error(`[V2-ETL] Fetch error: ${path}`, e); }
            }
            return [];
        };

        // ═══════════════════════════════════════════════════════════════
        // STAGE 1: CORE DATA FETCH
        // ═══════════════════════════════════════════════════════════════
        const fixtureData = await fetchFootball(`fixtures?id=${fixture_id}`);
        if (!fixtureData || fixtureData.length === 0) throw new Error("Fixture not found");

        const game = fixtureData[0];
        const { home: homeTeam, away: awayTeam } = game.teams;
        const leagueId = game.league.id;
        const season = game.league.season;

        console.log(`[V2-ETL] ${homeTeam.name} vs ${awayTeam.name} (${game.league.name})`);

        // ═══════════════════════════════════════════════════════════════
        // STAGE 2: PARALLEL FETCHING (SIN predictions de API)
        // ═══════════════════════════════════════════════════════════════
        const [
            last40_H, last40_A,
            h2h,
            standingsData,
            injuriesData,
            // ❌ PROHIBIDO: predictionsData - NO se incluye
            statsHome,
            statsAway,
            oddsData,
            currentMatchLineups,
            refereeFixtures
        ] = await Promise.all([
            fetchFootball(`fixtures?team=${homeTeam.id}&last=40&status=FT`),
            fetchFootball(`fixtures?team=${awayTeam.id}&last=40&status=FT`),
            fetchFootball(`fixtures/headtohead?h2h=${homeTeam.id}-${awayTeam.id}&last=20`),
            fetchFootball(`standings?league=${leagueId}&season=${season}`),
            fetchFootball(`injuries?fixture=${fixture_id}`),
            // ❌ NO: fetchFootball(`predictions?fixture=${fixture_id}`),
            fetchFootball(`teams/statistics?league=${leagueId}&season=${season}&team=${homeTeam.id}`),
            fetchFootball(`teams/statistics?league=${leagueId}&season=${season}&team=${awayTeam.id}`),
            fetchFootball(`odds?fixture=${fixture_id}`),
            fetchFootball(`fixtures/lineups?fixture=${fixture_id}`),
            game.fixture.referee ? fetchFootball(`fixtures?referee=${encodeURIComponent(game.fixture.referee)}&last=20&status=FT`) : Promise.resolve([])
        ]);

        // ═══════════════════════════════════════════════════════════════
        // STAGE 3: ENRICH COMPARABLES (10 home-as-home + 10 away-as-away)
        // ═══════════════════════════════════════════════════════════════
        const homeAsHome10 = (last40_H || []).filter((f: any) => f.teams.home.id === homeTeam.id).slice(0, 10);
        const awayAsAway10 = (last40_A || []).filter((f: any) => f.teams.away.id === awayTeam.id).slice(0, 10);

        const comparableIds = [...new Set([...homeAsHome10, ...awayAsAway10].map((f: any) => f.fixture.id))];

        console.log(`[V2-ETL] Enriching ${comparableIds.length} comparables with stats...`);

        const statsMap = new Map();
        const lineupsMap = new Map();

        await Promise.all(comparableIds.map(async (fid) => {
            const [s, l] = await Promise.all([
                fetchFootball(`fixtures/statistics?fixture=${fid}`),
                fetchFootball(`fixtures/lineups?fixture=${fid}`)
            ]);
            if (s && s.length > 0) statsMap.set(fid, s);
            if (l && l.length > 0) lineupsMap.set(fid, l);
        }));

        // ═══════════════════════════════════════════════════════════════
        // STAGE 4: BUILD NORMALIZED PAYLOAD (SIN predictions)
        // ═══════════════════════════════════════════════════════════════
        const createMatchObject = (f: any, stats: any = null) => ({
            fixture_id: f.fixture.id,
            date: f.fixture.date.split('T')[0],
            home_team: f.teams.home.name,
            away_team: f.teams.away.name,
            home_id: f.teams.home.id,
            away_id: f.teams.away.id,
            score_home: f.goals.home,
            score_away: f.goals.away,
            stats: stats ? {
                home: stats.find((t: any) => t.team.id === f.teams.home.id)?.statistics?.reduce((acc: any, s: any) => ({ ...acc, [s.type]: s.value }), {}) || {},
                away: stats.find((t: any) => t.team.id === f.teams.away.id)?.statistics?.reduce((acc: any, s: any) => ({ ...acc, [s.type]: s.value }), {}) || {}
            } : null
        });

        const enrich = (list: any[]) => list.map(f => createMatchObject(f, statsMap.get(f.fixture.id)));

        const allStandings = standingsData?.[0]?.league?.standings?.[0] || [];
        const getTeamContext = (tid: number) => {
            const s = allStandings.find((x: any) => x.team.id === tid);
            return s ? { position: s.rank, points: s.points, form: s.form, gd: s.goalsDiff } : null;
        };

        // Payload normalizado V2 (SIN api_prediction)
        const normalizedPayload = {
            match: {
                fixture_id,
                date_time_utc: game.fixture.date,
                referee: game.fixture.referee,
                venue: { stadium: game.fixture.venue?.name, city: game.fixture.venue?.city },
                competition: {
                    id: leagueId,
                    name: game.league.name,
                    country: game.league.country,
                    type: game.league.type,
                    round: game.league.round,
                    season
                },
                teams: {
                    home: { id: homeTeam.id, name: homeTeam.name, logo: homeTeam.logo },
                    away: { id: awayTeam.id, name: awayTeam.name, logo: awayTeam.logo }
                }
            },
            datasets: {
                home_team_last40: {
                    all: (last40_H || []).slice(0, 40).map((f: any) => createMatchObject(f)),
                    as_home: (last40_H || []).filter((f: any) => f.teams.home.id === homeTeam.id).slice(0, 20).map((f: any) => createMatchObject(f)),
                    as_away: (last40_H || []).filter((f: any) => f.teams.away.id === homeTeam.id).slice(0, 20).map((f: any) => createMatchObject(f))
                },
                away_team_last40: {
                    all: (last40_A || []).slice(0, 40).map((f: any) => createMatchObject(f)),
                    as_home: (last40_A || []).filter((f: any) => f.teams.home.id === awayTeam.id).slice(0, 20).map((f: any) => createMatchObject(f)),
                    as_away: (last40_A || []).filter((f: any) => f.teams.away.id === awayTeam.id).slice(0, 20).map((f: any) => createMatchObject(f))
                },
                comparables: {
                    home_as_home: enrich(homeAsHome10),
                    away_as_away: enrich(awayAsAway10)
                },
                h2h: (h2h || []).map((f: any) => createMatchObject(f)),
                standings: {
                    table: allStandings.slice(0, 10),
                    home_context: getTeamContext(homeTeam.id),
                    away_context: getTeamContext(awayTeam.id)
                },
                injuries: {
                    home: (injuriesData || []).filter((i: any) => i.team.id === homeTeam.id),
                    away: (injuriesData || []).filter((i: any) => i.team.id === awayTeam.id)
                },
                season_stats: {
                    home: statsHome,
                    away: statsAway
                },
                // ❌ PROHIBIDO: api_prediction NO SE INCLUYE
                odds: {
                    bookmaker: oddsData?.[0]?.bookmakers?.[0]?.name || null,
                    markets: oddsData?.[0]?.bookmakers?.[0]?.bets || []
                },
                lineups: {
                    home: currentMatchLineups?.[0] || null,
                    away: currentMatchLineups?.[1] || null
                },
                referee: {
                    name: game.fixture.referee,
                    recent_matches: (refereeFixtures || []).slice(0, 10).map((f: any) => ({
                        fixture_id: f.fixture.id,
                        date: f.fixture.date.split('T')[0],
                        home_team: f.teams.home.name,
                        away_team: f.teams.away.name
                    }))
                }
            }
        };

        // ═══════════════════════════════════════════════════════════════
        // STAGE 5: CALCULATE DATA COVERAGE SCORE
        // ═══════════════════════════════════════════════════════════════
        let coverageScore = 0;
        const coverageDetails: Record<string, boolean> = {};

        // Check each data source
        coverageDetails.fixture = !!game;
        coverageDetails.last40_home = (last40_H?.length || 0) >= 10;
        coverageDetails.last40_away = (last40_A?.length || 0) >= 10;
        coverageDetails.h2h = (h2h?.length || 0) >= 3;
        coverageDetails.standings = allStandings.length > 0;
        coverageDetails.injuries = true; // Always available (may be empty)
        coverageDetails.season_stats_home = !!statsHome;
        coverageDetails.season_stats_away = !!statsAway;
        coverageDetails.odds = (oddsData?.[0]?.bookmakers?.[0]?.bets?.length || 0) > 0;
        coverageDetails.comparables_enriched = statsMap.size >= 10;
        coverageDetails.lineups = !!(currentMatchLineups?.[0] || currentMatchLineups?.[1]);
        coverageDetails.referee = !!game.fixture.referee;

        const totalChecks = Object.keys(coverageDetails).length;
        const passedChecks = Object.values(coverageDetails).filter(v => v).length;
        coverageScore = Math.round((passedChecks / totalChecks) * 100);

        console.log(`[V2-ETL] Data coverage: ${coverageScore}% (${passedChecks}/${totalChecks})`);

        // ═══════════════════════════════════════════════════════════════
        // STAGE 6: SAVE & UPDATE JOB
        // ═══════════════════════════════════════════════════════════════
        const payloadHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(normalizedPayload)))
            .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16));

        await supabase
            .from('analysis_jobs_v2')
            .update({
                status: 'features', // Ready for Motor B
                current_motor: 'A',
                input_payload_hash: payloadHash,
                data_coverage_score: coverageScore,
                execution_time_ms: Date.now() - startTime
            })
            .eq('id', jobId);

        const executionTime = Date.now() - startTime;
        console.log(`[V2-ETL] ✅ Completed in ${executionTime}ms`);

        return new Response(JSON.stringify({
            success: true,
            job_id: jobId,
            fixture_id,
            coverage_score: coverageScore,
            coverage_details: coverageDetails,
            payload_hash: payloadHash,
            execution_time_ms: executionTime,
            // Include payload for next motor (or store in separate table)
            payload: normalizedPayload
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[V2-ETL] Error:', e);

        if (jobId && supabase) {
            await supabase
                .from('analysis_jobs_v2')
                .update({ status: 'failed', error_message: e.message })
                .eq('id', jobId);
        }

        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
