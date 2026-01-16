// supabase/functions/v2-generate-parlays/index.ts
// SMART PARLAYS ENGINE: Genera combinaciones de picks de diferentes partidos
// Trigger: Manual (botón) o Automático (post-batch de análisis)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

const ENGINE_VERSION = '1.0.0';

// Configuración de parlays - V2.2 OPTIMIZADA
const CONFIG = {
    MIN_PICKS: 2,
    MAX_PICKS: 3,
    MIN_INDIVIDUAL_PROB: 0.80,  // Mínimo 80% probabilidad
    MAX_INDIVIDUAL_PROB: 0.92,  // Máximo 92% (evita cuotas muy bajas)
    MIN_COMBINED_PROB: 0.50,    // Permite más variedad en combinaciones
    MIN_IMPLIED_ODDS: 1.50,     // Cuota mínima interna (NO visible en UI)
    MAX_PARLAYS_PER_SIZE: 5     // Máximo 5 parlays de cada tamaño
};

interface PickData {
    fixture_id: number;
    job_id: string;
    market: string;
    selection: string;
    p_model: number;
    home_team: string;
    away_team: string;
    league: string;
}

interface ParlayCombo {
    picks: PickData[];
    combined_probability: number;
    implied_odds: number;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const startTime = Date.now();

    try {
        const { date } = await req.json();
        if (!date) throw new Error('date is required (YYYY-MM-DD)');

        console.log(`[SMART-PARLAYS] Generating parlays for date: ${date}`);

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        // ═══════════════════════════════════════════════════════════════
        // PASO 1: Obtener todos los picks BET del día con alta probabilidad
        // ═══════════════════════════════════════════════════════════════

        // Primero obtener los jobs del día
        const { data: jobs, error: jobsError } = await supabase
            .from('analysis_jobs_v2')
            .select('id, fixture_id, created_at')
            .gte('created_at', `${date}T00:00:00`)
            .lt('created_at', `${date}T23:59:59`)
            .eq('status', 'done');

        if (jobsError) throw new Error(`Error fetching jobs: ${jobsError.message}`);
        if (!jobs || jobs.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No hay análisis completados para esta fecha',
                parlays_generated: 0
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[SMART-PARLAYS] Found ${jobs.length} completed jobs`);

        // Obtener el job más reciente por fixture (evitar duplicados)
        const latestJobByFixture = new Map<number, any>();
        for (const job of jobs) {
            const existing = latestJobByFixture.get(job.fixture_id);
            if (!existing || new Date(job.created_at) > new Date(existing.created_at)) {
                latestJobByFixture.set(job.fixture_id, job);
            }
        }

        const latestJobIds = Array.from(latestJobByFixture.values()).map(j => j.id);
        console.log(`[SMART-PARLAYS] Using ${latestJobIds.length} latest jobs`);

        // Obtener picks en el rango óptimo de probabilidad (80-92%)
        const { data: picks, error: picksError } = await supabase
            .from('value_picks_v2')
            .select('*')
            .in('job_id', latestJobIds)
            .eq('decision', 'BET')
            .gte('p_model', CONFIG.MIN_INDIVIDUAL_PROB)
            .lte('p_model', CONFIG.MAX_INDIVIDUAL_PROB)
            .order('p_model', { ascending: false });

        if (picksError) throw new Error(`Error fetching picks: ${picksError.message}`);
        if (!picks || picks.length < CONFIG.MIN_PICKS) {
            return new Response(JSON.stringify({
                success: true,
                message: `No hay suficientes picks de alta probabilidad (necesita ≥${CONFIG.MIN_PICKS}, tiene ${picks?.length || 0})`,
                parlays_generated: 0
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[SMART-PARLAYS] Found ${picks.length} high-probability picks`);

        // ═══════════════════════════════════════════════════════════════
        // PASO 2: Enriquecer picks con datos del partido
        // ═══════════════════════════════════════════════════════════════

        // Mapear job_id a fixture_id
        const jobToFixture = new Map<string, number>();
        jobs.forEach(j => jobToFixture.set(j.id, j.fixture_id));

        // Obtener datos de los partidos
        const fixtureIds = [...new Set(picks.map(p => jobToFixture.get(p.job_id)).filter(Boolean))];

        const { data: matches } = await supabase
            .from('daily_matches')
            .select('api_fixture_id, home_team, away_team, league_name')
            .in('api_fixture_id', fixtureIds);

        const matchData = new Map<number, any>();
        (matches || []).forEach(m => matchData.set(m.api_fixture_id, m));

        // Enriquecer picks
        const enrichedPicks: PickData[] = [];
        for (const pick of picks) {
            const fixtureId = jobToFixture.get(pick.job_id);
            if (!fixtureId) continue;

            const match = matchData.get(fixtureId);
            if (!match) continue;

            enrichedPicks.push({
                fixture_id: fixtureId,
                job_id: pick.job_id,
                market: pick.market,
                selection: pick.selection,
                p_model: pick.p_model,
                home_team: match.home_team,
                away_team: match.away_team,
                league: match.league_name
            });
        }

        console.log(`[SMART-PARLAYS] Enriched ${enrichedPicks.length} picks with match data`);

        // ═══════════════════════════════════════════════════════════════
        // PASO 3: Generar combinaciones de picks de DIFERENTES partidos
        // ═══════════════════════════════════════════════════════════════

        const allParlays: ParlayCombo[] = [];

        // Función para generar combinaciones
        const generateCombinations = (arr: PickData[], size: number): PickData[][] => {
            if (size === 1) return arr.map(p => [p]);

            const result: PickData[][] = [];

            for (let i = 0; i <= arr.length - size; i++) {
                const first = arr[i];
                const rest = arr.slice(i + 1);
                const subCombos = generateCombinations(rest, size - 1);

                for (const combo of subCombos) {
                    // REGLA CRÍTICA: Solo combinar picks de DIFERENTES partidos
                    const fixturesInCombo = new Set(combo.map(p => p.fixture_id));
                    if (!fixturesInCombo.has(first.fixture_id)) {
                        result.push([first, ...combo]);
                    }
                }
            }

            return result;
        };

        // Generar parlays de 2 picks
        const combos2 = generateCombinations(enrichedPicks, 2);
        console.log(`[SMART-PARLAYS] Generated ${combos2.length} potential 2-pick parlays`);

        for (const combo of combos2) {
            const combinedProb = combo.reduce((acc, p) => acc * p.p_model, 1);
            const impliedOdds = 1 / combinedProb;
            // Filtrar por probabilidad mínima Y cuota mínima interna
            if (combinedProb >= CONFIG.MIN_COMBINED_PROB && impliedOdds >= CONFIG.MIN_IMPLIED_ODDS) {
                allParlays.push({
                    picks: combo,
                    combined_probability: combinedProb,
                    implied_odds: impliedOdds
                });
            }
        }

        // Generar parlays de 3 picks
        const combos3 = generateCombinations(enrichedPicks, 3);
        console.log(`[SMART-PARLAYS] Generated ${combos3.length} potential 3-pick parlays`);

        for (const combo of combos3) {
            const combinedProb = combo.reduce((acc, p) => acc * p.p_model, 1);
            const impliedOdds = 1 / combinedProb;
            // Filtrar por probabilidad mínima Y cuota mínima interna
            if (combinedProb >= CONFIG.MIN_COMBINED_PROB && impliedOdds >= CONFIG.MIN_IMPLIED_ODDS) {
                allParlays.push({
                    picks: combo,
                    combined_probability: combinedProb,
                    implied_odds: impliedOdds
                });
            }
        }

        console.log(`[SMART-PARLAYS] Total valid parlays: ${allParlays.length}`);

        // ═══════════════════════════════════════════════════════════════
        // PASO 4: Seleccionar los mejores parlays
        // ═══════════════════════════════════════════════════════════════

        // Ordenar por probabilidad combinada (más altas primero)
        allParlays.sort((a, b) => b.combined_probability - a.combined_probability);

        // Tomar los mejores de cada tamaño
        const parlays2 = allParlays.filter(p => p.picks.length === 2).slice(0, CONFIG.MAX_PARLAYS_PER_SIZE);
        const parlays3 = allParlays.filter(p => p.picks.length === 3).slice(0, CONFIG.MAX_PARLAYS_PER_SIZE);

        const selectedParlays = [...parlays2, ...parlays3];

        console.log(`[SMART-PARLAYS] Selected ${parlays2.length} 2-pick and ${parlays3.length} 3-pick parlays`);

        // ═══════════════════════════════════════════════════════════════
        // PASO 5: Limpiar parlays anteriores del día y guardar nuevos
        // ═══════════════════════════════════════════════════════════════

        // Limpiar parlays anteriores del día
        await supabase
            .from('smart_parlays_v2')
            .delete()
            .eq('date', date);

        // Guardar nuevos parlays
        const parlaysToInsert = selectedParlays.map((parlay, index) => {
            const confidenceTier = parlay.combined_probability >= 0.80 ? 'ultra_safe'
                : parlay.combined_probability >= 0.70 ? 'safe'
                    : 'balanced';

            return {
                date,
                name: `Smart Parlay ${parlay.picks.length} Picks #${index + 1}`,
                picks: parlay.picks.map(p => ({
                    fixture_id: p.fixture_id,
                    market: p.market,
                    selection: p.selection,
                    p_model: p.p_model,
                    home_team: p.home_team,
                    away_team: p.away_team,
                    league: p.league
                })),
                combined_probability: Math.round(parlay.combined_probability * 10000) / 10000,
                implied_odds: Math.round(parlay.implied_odds * 100) / 100,
                pick_count: parlay.picks.length,
                confidence_tier: confidenceTier,
                status: 'pending'
            };
        });

        if (parlaysToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('smart_parlays_v2')
                .insert(parlaysToInsert);

            if (insertError) throw new Error(`Error inserting parlays: ${insertError.message}`);
        }

        const executionTime = Date.now() - startTime;

        console.log(`[SMART-PARLAYS] ✅ Generated ${parlaysToInsert.length} parlays in ${executionTime}ms`);

        // Respuesta SIN implied_odds (cuotas ocultas al usuario)
        const parlaysForResponse = parlaysToInsert.map(p => ({
            date: p.date,
            name: p.name,
            picks: p.picks,
            combined_probability: p.combined_probability,
            pick_count: p.pick_count,
            confidence_tier: p.confidence_tier,
            status: p.status
            // implied_odds OMITIDO INTENCIONALMENTE
        }));

        return new Response(JSON.stringify({
            success: true,
            date,
            engine_version: ENGINE_VERSION,
            stats: {
                jobs_found: jobs.length,
                picks_found: picks.length,
                picks_enriched: enrichedPicks.length,
                parlays_2_picks: parlays2.length,
                parlays_3_picks: parlays3.length,
                total_generated: parlaysToInsert.length
            },
            parlays: parlaysForResponse,
            execution_time_ms: executionTime
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[SMART-PARLAYS] Error:', e);
        return new Response(JSON.stringify({
            success: false,
            error: e.message,
            execution_time_ms: Date.now() - startTime
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
