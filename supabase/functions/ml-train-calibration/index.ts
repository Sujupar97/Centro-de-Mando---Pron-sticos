// supabase/functions/ml-train-calibration/index.ts
// ML Auto-Learning Engine: processes verified picks and generates calibration factors
// CRITICAL: Only processes days that are FULLY verified (0 PENDING picks) and not yet trained
// Uses weighted averaging to prevent single-day outliers from destroying calibration

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

const MIN_SAMPLE_SIZE = 5; // Minimum picks to generate a calibration factor
const MAX_CALIBRATION_REDUCTION = 25; // Max percentage points a factor can reduce probability

interface PickRow {
    id: string;
    fixture_id: number;
    market: string;
    selection: string;
    p_model: number;
    odds: number;
    result: string;
    confidence: number;
    engine_version: string;
}

interface MatchRow {
    api_fixture_id: number;
    league_name: string;
    match_date: string;
}

interface CalibrationFactor {
    dimension: string;
    dimension_key: string;
    sample_size: number;
    wins: number;
    losses: number;
    actual_wr: number;
    predicted_avg: number;
    calibration_factor: number;
    confidence_adjustment: number;
    roi: number;
    status: string;
}

// ── Helpers (reused from performance-analyzer) ──────────────────────

function getOddsRange(odds: number): string {
    if (odds < 1.40) return '<1.40';
    if (odds < 1.70) return '1.40-1.69';
    if (odds < 2.00) return '1.70-1.99';
    if (odds < 2.50) return '2.00-2.49';
    return '2.50+';
}

function getProbBand(pModel: number): string {
    const pct = pModel > 1 ? pModel : pModel * 100;
    if (pct < 80) return '<80%';
    if (pct < 83) return '80-82%';
    if (pct < 86) return '83-85%';
    if (pct < 90) return '86-89%';
    return '90%+';
}

function calculateROI(won: number, lost: number, avgOdds: number): number {
    if (won + lost === 0) return 0;
    const stakePerPick = 4;
    const totalStaked = (won + lost) * stakePerPick;
    const totalProfit = (won * stakePerPick * (avgOdds - 1)) - (lost * stakePerPick);
    return totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
}

// ── Weighted Average Calculator ─────────────────────────────────────

function weightedAverage(
    oldValue: number, oldSample: number,
    newValue: number, newSample: number
): number {
    if (oldSample + newSample === 0) return 0;
    return (oldValue * oldSample + newValue * newSample) / (oldSample + newSample);
}

// ── Pattern Generator ───────────────────────────────────────────────

interface GeneratedPattern {
    pattern_type: string;
    scope: string;
    scope_key: string;
    rule_text: string;
    severity: string;
    based_on_sample: number;
    based_on_wr: number;
}

function generatePatterns(
    dimension: string,
    key: string,
    wr: number,
    sample: number,
    predictedAvg: number
): GeneratedPattern[] {
    const patterns: GeneratedPattern[] = [];
    if (sample < MIN_SAMPLE_SIZE) return patterns;

    const scope = dimension === 'market_league' ? 'market_league' : dimension;
    const gap = predictedAvg - wr;

    // Blacklist: WR < 30%
    if (wr < 30) {
        patterns.push({
            pattern_type: 'blacklist',
            scope,
            scope_key: key,
            rule_text: `EVITAR ${key}: solo ${wr.toFixed(1)}% WR en ${sample} picks. Rendimiento inaceptable.`,
            severity: 'critical',
            based_on_sample: sample,
            based_on_wr: wr,
        });
    }
    // Boost: WR > 85%
    else if (wr > 85) {
        patterns.push({
            pattern_type: 'boost',
            scope,
            scope_key: key,
            rule_text: `PRIORIZAR ${key}: ${wr.toFixed(1)}% WR en ${sample} picks. Excelente rendimiento.`,
            severity: 'info',
            based_on_sample: sample,
            based_on_wr: wr,
        });
    }
    // Warning: overconfidence gap > 20 points
    if (gap > 20) {
        patterns.push({
            pattern_type: 'warning',
            scope,
            scope_key: key,
            rule_text: `SOBRECONFIANZA en ${key}: predicho ${predictedAvg.toFixed(1)}% pero real ${wr.toFixed(1)}% (gap ${gap.toFixed(1)}pts). Reducir confianza.`,
            severity: 'warning',
            based_on_sample: sample,
            based_on_wr: wr,
        });
    }

    return patterns;
}

// ── Main Handler ────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { dates } = await req.json();

        if (!Array.isArray(dates) || dates.length === 0) {
            throw new Error('dates is required: array of YYYY-MM-DD strings');
        }

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        console.log(`[ml-train-calibration] Processing ${dates.length} date(s): ${dates.join(', ')}`);

        // ═══ STEP 1: Filter out already-trained dates ═══
        const { data: existingRuns } = await supabase
            .from('ml_training_runs')
            .select('training_date')
            .in('training_date', dates)
            .eq('status', 'completed');

        const trainedDates = new Set((existingRuns || []).map(r => r.training_date));
        const newDates = dates.filter(d => !trainedDates.has(d));

        console.log(`[ml-train-calibration] ${trainedDates.size} already trained, ${newDates.length} to process`);

        if (newDates.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                daysProcessed: 0,
                daysSkipped: dates.length,
                totalPicksProcessed: 0,
                factorsUpdated: 0,
                patternsGenerated: 0,
                summary: 'Todos los dias seleccionados ya fueron entrenados previamente.',
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ═══ STEP 2: Get fixtures for these dates ═══
        const { data: matches } = await supabase
            .from('daily_matches')
            .select('api_fixture_id, league_name, match_date')
            .in('match_date', newDates);

        const matchMap = new Map<number, MatchRow>();
        const dateFixtures = new Map<string, number[]>();
        for (const m of (matches || [])) {
            matchMap.set(m.api_fixture_id, m);
            if (!dateFixtures.has(m.match_date)) dateFixtures.set(m.match_date, []);
            dateFixtures.get(m.match_date)!.push(m.api_fixture_id);
        }

        const allFixtureIds = Array.from(matchMap.keys());
        if (allFixtureIds.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                daysProcessed: 0,
                daysSkipped: dates.length,
                totalPicksProcessed: 0,
                factorsUpdated: 0,
                patternsGenerated: 0,
                summary: 'No se encontraron partidos en las fechas seleccionadas.',
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ═══ STEP 3: Get ALL picks for these fixtures ═══
        const { data: picks } = await supabase
            .from('value_picks_v2')
            .select('id, fixture_id, market, selection, p_model, odds, result, confidence, engine_version')
            .in('fixture_id', allFixtureIds);

        // ═══ STEP 4: Validate — every date must have 0 PENDING picks ═══
        const validDates: string[] = [];
        const skippedDates: string[] = [];

        for (const date of newDates) {
            const fixtureIdsForDate = dateFixtures.get(date) || [];
            if (fixtureIdsForDate.length === 0) {
                skippedDates.push(date);
                continue;
            }

            const picksForDate = (picks || []).filter(p => fixtureIdsForDate.includes(p.fixture_id));
            const pendingCount = picksForDate.filter(p => p.result === 'PENDING' && p.p_model != null && p.p_model >= 0.80).length;

            if (pendingCount > 0) {
                console.log(`[ml-train-calibration] SKIPPING ${date}: ${pendingCount} PENDING picks`);
                skippedDates.push(date);
                continue;
            }

            if (picksForDate.length === 0) {
                skippedDates.push(date);
                continue;
            }

            validDates.push(date);
        }

        console.log(`[ml-train-calibration] Valid dates: ${validDates.length}, Skipped: ${skippedDates.length}`);

        if (validDates.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                daysProcessed: 0,
                daysSkipped: dates.length,
                totalPicksProcessed: 0,
                factorsUpdated: 0,
                patternsGenerated: 0,
                summary: 'Ninguna fecha tiene todos los picks verificados. Verifica todos los picks pendientes antes de entrenar.',
                error: 'Hay picks PENDING sin verificar en las fechas seleccionadas.',
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ═══ STEP 5: Collect valid picks (WON or LOST only) ═══
        const validFixtureIds = new Set<number>();
        for (const date of validDates) {
            for (const fid of (dateFixtures.get(date) || [])) {
                validFixtureIds.add(fid);
            }
        }

        const trainingPicks = (picks || []).filter(p =>
            validFixtureIds.has(p.fixture_id) &&
            (p.result === 'WON' || p.result === 'LOST') &&
            p.p_model != null && p.odds != null
        ) as PickRow[];

        console.log(`[ml-train-calibration] Training with ${trainingPicks.length} verified picks`);

        // ═══ STEP 6: Snapshot existing calibration factors ═══
        const { data: existingFactors } = await supabase
            .from('ml_calibration_factors')
            .select('*');

        const existingMap = new Map<string, CalibrationFactor>();
        for (const f of (existingFactors || [])) {
            existingMap.set(`${f.dimension}|${f.dimension_key}`, f);
        }

        const calibrationSnapshot = existingFactors || [];

        // ═══ STEP 7: Aggregate by dimensions ═══
        interface DimStats {
            wins: number;
            losses: number;
            totalPredicted: number;
            totalOdds: number;
        }

        const dimensionAggs = new Map<string, DimStats>();

        function addToDim(dimKey: string, pick: PickRow) {
            if (!dimensionAggs.has(dimKey)) {
                dimensionAggs.set(dimKey, { wins: 0, losses: 0, totalPredicted: 0, totalOdds: 0 });
            }
            const d = dimensionAggs.get(dimKey)!;
            if (pick.result === 'WON') d.wins++;
            else d.losses++;
            d.totalPredicted += (pick.p_model > 1 ? pick.p_model : pick.p_model * 100);
            d.totalOdds += pick.odds;
        }

        for (const p of trainingPicks) {
            const match = matchMap.get(p.fixture_id);
            const league = match?.league_name || 'Desconocida';
            const market = p.market || 'unknown';
            const oddsRange = getOddsRange(p.odds);
            const probBand = getProbBand(p.p_model);

            addToDim(`market|${market}`, p);
            addToDim(`league|${league}`, p);
            addToDim(`odds_range|${oddsRange}`, p);
            addToDim(`prob_band|${probBand}`, p);
            addToDim(`market_league|${market}|${league}`, p);
        }

        // ═══ STEP 8: Compute calibration factors with weighted averaging ═══
        const newFactors: CalibrationFactor[] = [];
        const allPatterns: GeneratedPattern[] = [];

        for (const [dimKey, stats] of dimensionAggs.entries()) {
            const [dimension, ...keyParts] = dimKey.split('|');
            const dimensionKey = keyParts.join('|');
            const total = stats.wins + stats.losses;

            if (total < MIN_SAMPLE_SIZE) continue; // Skip small samples

            const newWR = (stats.wins / total) * 100;
            const newPredAvg = stats.totalPredicted / total;
            const newAvgOdds = stats.totalOdds / total;
            const newROI = calculateROI(stats.wins, stats.losses, newAvgOdds);

            // Check existing factor for weighted averaging
            const existingKey = `${dimension}|${dimensionKey}`;
            const existing = existingMap.get(existingKey);

            let finalWR: number;
            let finalPredAvg: number;
            let finalSample: number;
            let finalWins: number;
            let finalLosses: number;

            if (existing && existing.sample_size > 0) {
                // Weighted average with existing data
                finalSample = existing.sample_size + total;
                finalWins = existing.wins + stats.wins;
                finalLosses = existing.losses + stats.losses;
                finalWR = (finalWins / (finalWins + finalLosses)) * 100;
                finalPredAvg = weightedAverage(existing.predicted_avg, existing.sample_size, newPredAvg, total);
            } else {
                finalSample = total;
                finalWins = stats.wins;
                finalLosses = stats.losses;
                finalWR = newWR;
                finalPredAvg = newPredAvg;
            }

            // Calculate calibration factor (capped to prevent extreme adjustments)
            let calibFactor = finalPredAvg > 0 ? finalWR / finalPredAvg : 1.0;

            // Cap: never reduce more than MAX_CALIBRATION_REDUCTION percentage points
            const minFactor = Math.max(0.5, 1 - (MAX_CALIBRATION_REDUCTION / 100));
            calibFactor = Math.max(minFactor, Math.min(1.5, calibFactor));

            // Confidence adjustment (how many points to add/subtract)
            const gap = finalPredAvg - finalWR;
            let confAdj = 0;
            if (gap > 20) confAdj = -Math.min(15, Math.round(gap * 0.6));
            else if (gap > 10) confAdj = -Math.min(8, Math.round(gap * 0.4));
            else if (gap > 5) confAdj = -Math.round(gap * 0.3);
            else if (gap < -5) confAdj = Math.min(5, Math.round(Math.abs(gap) * 0.2));

            const finalROI = calculateROI(finalWins, finalLosses, newAvgOdds);

            const factor: CalibrationFactor = {
                dimension,
                dimension_key: dimensionKey,
                sample_size: finalSample,
                wins: finalWins,
                losses: finalLosses,
                actual_wr: Math.round(finalWR * 100) / 100,
                predicted_avg: Math.round(finalPredAvg * 100) / 100,
                calibration_factor: Math.round(calibFactor * 10000) / 10000,
                confidence_adjustment: confAdj,
                roi: Math.round(finalROI * 100) / 100,
                status: 'active',
            };

            newFactors.push(factor);

            // Generate patterns
            const patterns = generatePatterns(dimension, dimensionKey, finalWR, finalSample, finalPredAvg);
            allPatterns.push(...patterns);
        }

        // ═══ STEP 9: Upsert calibration factors ═══
        let factorsUpdated = 0;
        for (const f of newFactors) {
            const { error } = await supabase
                .from('ml_calibration_factors')
                .upsert({
                    dimension: f.dimension,
                    dimension_key: f.dimension_key,
                    sample_size: f.sample_size,
                    wins: f.wins,
                    losses: f.losses,
                    actual_wr: f.actual_wr,
                    predicted_avg: f.predicted_avg,
                    calibration_factor: f.calibration_factor,
                    confidence_adjustment: f.confidence_adjustment,
                    roi: f.roi,
                    status: f.status,
                    last_updated: new Date().toISOString(),
                }, { onConflict: 'dimension,dimension_key' });

            if (!error) factorsUpdated++;
            else console.error(`[ml-train-calibration] Error upserting factor ${f.dimension}|${f.dimension_key}:`, error);
        }

        // ═══ STEP 10: Process parlays ═══
        let parlayFactorsUpdated = 0;
        try {
            // Get parlay results for valid dates
            const { data: parlays } = await supabase
                .from('parlay_combos_v2')
                .select('id, picks, risk_level, combined_odds, status, match_date')
                .in('match_date', validDates)
                .in('status', ['WON', 'LOST']);

            if (parlays && parlays.length > 0) {
                const parlayAggs = new Map<string, { wins: number; losses: number; totalOdds: number }>();

                for (const p of parlays) {
                    const legsCount = Array.isArray(p.picks) ? p.picks.length : 0;
                    const risk = p.risk_level || 'moderate';
                    const key = `${legsCount}|${risk}`;

                    if (!parlayAggs.has(key)) parlayAggs.set(key, { wins: 0, losses: 0, totalOdds: 0 });
                    const agg = parlayAggs.get(key)!;
                    if (p.status === 'WON') agg.wins++;
                    else agg.losses++;
                    agg.totalOdds += p.combined_odds || 0;
                }

                for (const [key, stats] of parlayAggs.entries()) {
                    const [legsStr, risk] = key.split('|');
                    const legsCount = parseInt(legsStr);
                    const total = stats.wins + stats.losses;
                    if (total < 3) continue; // Lower threshold for parlays (fewer samples)

                    const wr = (stats.wins / total) * 100;
                    const avgOdds = stats.totalOdds / total;
                    const roi = calculateROI(stats.wins, stats.losses, avgOdds);

                    // Recommendations based on data
                    const recMaxLegs = wr < 20 ? Math.max(2, legsCount - 1) : legsCount;
                    const recMinProb = wr < 30 ? 85 : wr < 50 ? 83 : 80;

                    const { error } = await supabase
                        .from('ml_parlay_calibration')
                        .upsert({
                            legs_count: legsCount,
                            risk_level: risk,
                            sample_size: total,
                            wins: stats.wins,
                            actual_wr: Math.round(wr * 100) / 100,
                            avg_odds: Math.round(avgOdds * 100) / 100,
                            roi: Math.round(roi * 100) / 100,
                            recommended_max_legs: recMaxLegs,
                            recommended_min_leg_prob: recMinProb,
                            status: 'active',
                            last_updated: new Date().toISOString(),
                        }, { onConflict: 'legs_count,risk_level' });

                    if (!error) parlayFactorsUpdated++;
                }
            }
        } catch (parlayErr) {
            console.error('[ml-train-calibration] Parlay calibration error (non-blocking):', parlayErr);
        }

        // ═══ STEP 11: Save training runs (one per date) ═══
        const totalWon = trainingPicks.filter(p => p.result === 'WON').length;
        const totalLost = trainingPicks.filter(p => p.result === 'LOST').length;

        // Count VOID picks for stats
        const voidPicks = (picks || []).filter(p =>
            validFixtureIds.has(p.fixture_id) &&
            (p.result === 'VOID' || p.result === 'PUSH')
        ).length;

        for (const date of validDates) {
            const fixtureIdsForDate = new Set(dateFixtures.get(date) || []);
            const dayPicks = trainingPicks.filter(p => fixtureIdsForDate.has(p.fixture_id));
            const dayVoid = (picks || []).filter(p =>
                fixtureIdsForDate.has(p.fixture_id) && (p.result === 'VOID' || p.result === 'PUSH')
            ).length;

            await supabase
                .from('ml_training_runs')
                .insert({
                    training_date: date,
                    picks_processed: dayPicks.length,
                    picks_won: dayPicks.filter(p => p.result === 'WON').length,
                    picks_lost: dayPicks.filter(p => p.result === 'LOST').length,
                    picks_void: dayVoid,
                    calibration_snapshot: calibrationSnapshot,
                    new_calibration: newFactors,
                });
        }

        // ═══ STEP 12: Save learned patterns ═══
        let patternsGenerated = 0;
        // Get the first training run ID for pattern association
        const { data: latestRun } = await supabase
            .from('ml_training_runs')
            .select('id')
            .in('training_date', validDates)
            .order('created_at', { ascending: false })
            .limit(1);

        const trainingRunId = latestRun?.[0]?.id || null;

        for (const pattern of allPatterns) {
            // Check if a similar pattern already exists
            const { data: existing } = await supabase
                .from('ml_learned_patterns')
                .select('id')
                .eq('scope', pattern.scope)
                .eq('scope_key', pattern.scope_key)
                .eq('pattern_type', pattern.pattern_type)
                .limit(1);

            if (existing && existing.length > 0) {
                // Update existing pattern
                await supabase
                    .from('ml_learned_patterns')
                    .update({
                        rule_text: pattern.rule_text,
                        severity: pattern.severity,
                        based_on_sample: pattern.based_on_sample,
                        based_on_wr: pattern.based_on_wr,
                        training_run_id: trainingRunId,
                    })
                    .eq('id', existing[0].id);
            } else {
                // Insert new pattern
                await supabase
                    .from('ml_learned_patterns')
                    .insert({
                        ...pattern,
                        auto_generated: true,
                        active: true,
                        training_run_id: trainingRunId,
                    });
            }
            patternsGenerated++;
        }

        const summary = [
            `Entrenamiento completado: ${validDates.length} dia(s) procesado(s).`,
            `${trainingPicks.length} picks analizados (${totalWon}W / ${totalLost}L / ${voidPicks}V).`,
            `${factorsUpdated} factores de calibracion actualizados.`,
            `${parlayFactorsUpdated} factores de parlay actualizados.`,
            `${patternsGenerated} patrones generados/actualizados.`,
            skippedDates.length > 0 ? `${skippedDates.length} dia(s) omitido(s) (ya entrenados o con picks pendientes).` : '',
        ].filter(Boolean).join(' ');

        console.log(`[ml-train-calibration] ${summary}`);

        return new Response(JSON.stringify({
            success: true,
            daysProcessed: validDates.length,
            daysSkipped: skippedDates.length,
            totalPicksProcessed: trainingPicks.length,
            factorsUpdated: factorsUpdated + parlayFactorsUpdated,
            patternsGenerated,
            summary,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error('[ml-train-calibration] Error:', error);
        return new Response(JSON.stringify({
            success: false,
            daysProcessed: 0,
            daysSkipped: 0,
            totalPicksProcessed: 0,
            factorsUpdated: 0,
            patternsGenerated: 0,
            summary: '',
            error: error.message,
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
