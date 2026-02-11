
// supabase/functions/v2-generate-parlays/index.ts
// OPPORTUNITIES ENGINE V5: HIGH PROBABILITY SINGLES ONLY
// Trigger: Manual (botón) o Automático
// Description: Retorna proyecciones individuales con probabilidad > 70%.
// NOTE: "Smart Parlays" logic has been DEPRECATED and REMOVED as per user request.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        const { date } = await req.json();
        if (!date) throw new Error('date is required (YYYY-MM-DD)');

        log(`[OPPORTUNITIES-V5] Fetching high probability picks (>70%) for date: ${date}`);

        // 1. Obtener Matches VALIDOS y EN FECHA (daily_matches)
        const { data: validMatches, error: matchesError } = await supabase
            .from('daily_matches')
            .select('api_fixture_id, home_team, away_team, league_name, match_time, home_team_logo, away_team_logo')
            .gte('match_time', `${date}T00:00:00`)
            .lt('match_time', `${date}T23:59:59`);

        if (matchesError) throw matchesError;

        if (!validMatches || validMatches.length === 0) {
            log(`[OPPORTUNITIES-V5] No matches found for date ${date}`);
            return new Response(JSON.stringify({ success: true, message: 'No hay partidos programados.', parlays: [], singles: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const validFixtureIds = validMatches.map(m => m.api_fixture_id);

        // 2. Obtener Picks Candidatos (>70% Prob)
        // STRICT USER REQUIREMENT: > 70% Only.
        const { data: picks, error: picksError } = await supabase
            .from('value_picks_v2')
            .select('*')
            .in('fixture_id', validFixtureIds)
            .gte('p_model', 0.70) // STRICT FILTER >= 70%
            .order('p_model', { ascending: false });

        if (picksError) throw picksError;

        if (!picks || picks.length === 0) {
            const msg = 'No hay picks >70% para esta fecha.';
            log(`[OPPORTUNITIES-V5] ${msg}`);
            return new Response(JSON.stringify({
                success: true,
                message: msg,
                parlays: [],
                singles: [], // Empty
                debug_logs: logs
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        log(`[OPPORTUNITIES-V5] Found ${picks.length} picks > 70%.`);

        // 3. Hydrate with Report Data (Tesis, etc.)
        const jobIds = [...new Set(picks.map(p => p.job_id))];
        const { data: reports } = await supabase
            .from('reports_v2')
            .select('job_id, report_packet')
            .in('job_id', jobIds);

        const singles = picks.map(p => {
            const report = reports?.find(r => r.job_id === p.job_id);
            const fixture = validMatches.find(m => String(m.api_fixture_id) === String(p.fixture_id));

            if (!fixture) return null;

            // Extract Thesis/Reasoning
            let thesis = "Análisis estadístico estándar.";
            let matchup = "No especificado.";

            if (report && report.report_packet) {
                const analysis = typeof report.report_packet === 'string'
                    ? JSON.parse(report.report_packet)
                    : report.report_packet;

                thesis = analysis?.razonamiento_central?.tesis_principal
                    || analysis?.analisis_profundo?.factor_psicologico
                    || thesis;

                matchup = analysis?.analisis_profundo?.matchup_clave || matchup;
            }

            const home = typeof fixture.home_team === 'object' ? fixture.home_team?.name || 'Local' : fixture.home_team;
            const away = typeof fixture.away_team === 'object' ? fixture.away_team?.name || 'Away' : fixture.away_team;
            const leagueRaw = fixture.league_name;
            const league = typeof leagueRaw === 'object' ? leagueRaw?.name || 'Liga' : leagueRaw;

            return {
                id: p.id,
                fixture_id: p.fixture_id,
                job_id: p.job_id,
                market: p.market,
                selection: p.selection,
                p_model: p.p_model,
                home_team: home,
                away_team: away,
                league: league,
                odds: p.odds,
                logo_home: fixture.home_team_logo,
                logo_away: fixture.away_team_logo,
                // Extra metadata for UI if needed in future, but keeping clean for now
                tesis: thesis,
                tactica: matchup
            };
        }).filter(Boolean);

        return new Response(JSON.stringify({
            success: true,
            date,
            stats: { generated: 0, singles: singles.length },
            parlays: [], // ALWAYS EMPTY
            singles: singles,
            debug_logs: logs
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[OPPORTUNITIES-V5] Error:', e);
        return new Response(JSON.stringify({
            success: false,
            error: e.message || "Unknown error",
            parlays: [],
            singles: [],
            debug_logs: [e.message, ...logs]
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
