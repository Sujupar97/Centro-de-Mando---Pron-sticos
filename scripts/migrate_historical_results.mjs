import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

/**
 * SCRIPT DE MIGRACIÓN HISTÓRICA
 * 
 * Propósito: Backfill de resultados para predicciones antiguas
 *            cuyos partidos ya finalizaron pero no se verificaron.
 * 
 * Uso: node migrate_historical_results.mjs
 * 
 * IMPORTANTE: Ejecutar UNA SOLA VEZ después de crear tabla predictions_results
 */

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const footballKeys = process.env.API_FOOTBALL_KEYS;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

if (!footballKeys) {
    console.error('❌ Missing API_FOOTBALL_KEYS in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const apiKeys = footballKeys.split(',').map(k => k.trim());

// Helper: Fetch from API-Football
async function fetchFootball(path) {
    for (const key of apiKeys) {
        try {
            const res = await fetch(`https://v3.football.api-sports.io/${path}`, {
                headers: { 'x-apisports-key': key }
            });

            if (res.ok) {
                const json = await res.json();
                if (!json.errors || Object.keys(json.errors).length === 0) {
                    return json.response;
                }
            }
        } catch (e) {
            console.error('API error:', e.message);
        }
    }
    return null;
}

// Evaluation logic (same as Edge Function)
function evaluatePrediction(prediction, fixture) {
    const market = prediction.market_code || prediction.market || '';
    const selection = (prediction.selection || '').toLowerCase();

    const homeGoals = fixture.goals.home || 0;
    const awayGoals = fixture.goals.away || 0;
    const totalGoals = homeGoals + awayGoals;

    if (market.includes('1X2') || market.includes('Ganador') || market.includes('Winner')) {
        const homeTeam = fixture.teams.home.name.toLowerCase();
        const awayTeam = fixture.teams.away.name.toLowerCase();

        if (homeGoals > awayGoals) {
            return selection.includes(homeTeam) || selection.includes('local') || selection.includes('home');
        } else if (awayGoals > homeGoals) {
            return selection.includes(awayTeam) || selection.includes('visit') || selection.includes('away');
        } else {
            return selection.includes('empate') || selection.includes('draw');
        }
    }

    if (market.includes('Total') || market.includes('Over') || market.includes('Under')) {
        const matchLine = selection.match(/(\d+\.?\d*)/);
        const line = matchLine ? parseFloat(matchLine[1]) : 2.5;

        if (selection.includes('over') || selection.includes('más') || selection.includes('mayor')) {
            return totalGoals > line;
        } else if (selection.includes('under') || selection.includes('menos') || selection.includes('menor')) {
            return totalGoals < line;
        }
    }

    if (market.includes('BTTS') || market.includes('Ambos')) {
        const bothScored = homeGoals > 0 && awayGoals > 0;
        const wantsYes = selection.includes('sí') || selection.includes('si') || selection.includes('yes');
        return wantsYes ? bothScored : !bothScored;
    }

    return false;
}

function calculateConfidenceDelta(prediction, fixture, wasCorrect) {
    const predictedProb = prediction.probability || 50;
    const idealProb = wasCorrect ? 100 : 0;
    return Math.abs(predictedProb - idealProb);
}

function getActualOutcome(fixture, marketCode) {
    const homeGoals = fixture.goals.home || 0;
    const awayGoals = fixture.goals.away || 0;

    if (marketCode?.includes('1X2')) {
        if (homeGoals > awayGoals) return fixture.teams.home.name;
        if (awayGoals > homeGoals) return fixture.teams.away.name;
        return 'Draw';
    }

    if (marketCode?.includes('Total')) {
        return `${homeGoals + awayGoals} goals`;
    }

    if (marketCode?.includes('BTTS')) {
        return (homeGoals > 0 && awayGoals > 0) ? 'Yes' : 'No';
    }

    return `${homeGoals}-${awayGoals}`;
}

async function main() {
    console.log('🚀 Starting historical predictions migration...\n');

    // 1. Fetch old predictions without verification
    console.log('📊 Fetching unverified historical predictions...');

    const { data: oldPredictions, error: fetchError } = await supabase
        .from('predictions')
        .select(`
      *,
      analysis_runs!inner (
        id,
        fixture_id,
        job_id,
        analysis_jobs (
          api_fixture_id
        )
      )
    `)
        .is('is_won', null) // Not verified
        .lt('match_date', new Date().toISOString()); // Past matches

    if (fetchError) {
        console.error('❌ Error fetching predictions:', fetchError);
        return;
    }

    console.log(`✅ Found ${oldPredictions?.length || 0} historical predictions to process\n`);

    let processed = 0;
    let verified = 0;
    let notFinished = 0;
    let errors = 0;

    for (const prediction of oldPredictions || []) {
        processed++;

        try {
            // Get fixture ID
            const fixtureId = prediction.analysis_runs?.analysis_jobs?.api_fixture_id || prediction.fixture_id;

            if (!fixtureId) {
                console.warn(`⚠️  [${processed}/${oldPredictions.length}] No fixture_id for prediction ${prediction.id}`);
                errors++;
                continue;
            }

            // Fetch real result
            console.log(`🔍 [${processed}/${oldPredictions.length}] Checking fixture ${fixtureId}...`);

            const fixtureData = await fetchFootball(`fixtures?id=${fixtureId}`);

            if (!fixtureData || fixtureData.length === 0) {
                console.warn(`   ❌ No data for fixture ${fixtureId}`);
                errors++;
                continue;
            }

            const fixture = fixtureData[0];

            // Check if match is finished
            if (fixture.fixture.status.short !== 'FT') {
                console.log(`   ⏳ Match not finished yet (${fixture.fixture.status.short})`);
                notFinished++;
                continue;
            }

            // Evaluate prediction
            const isCorrect = evaluatePrediction(prediction, fixture);
            const confidenceDelta = calculateConfidenceDelta(prediction, fixture, isCorrect);

            // Save result
            const { error: insertError } = await supabase
                .from('predictions_results')
                .upsert({
                    prediction_id: prediction.id,
                    analysis_run_id: prediction.analysis_run_id,
                    fixture_id: fixtureId,

                    predicted_market: prediction.market || prediction.market_code || 'Unknown',
                    predicted_outcome: prediction.selection,
                    predicted_probability: prediction.probability || 50,
                    predicted_confidence: prediction.confidence,

                    actual_outcome: getActualOutcome(fixture, prediction.market_code),
                    actual_score: `${fixture.goals.home}-${fixture.goals.away}`,

                    was_correct: isCorrect,
                    confidence_delta: confidenceDelta,

                    verified_at: new Date().toISOString(),
                    verification_source: 'Historical Migration Script'
                }, {
                    onConflict: 'prediction_id'
                });

            if (insertError) {
                console.error(`   ❌ Error inserting: ${insertError.message}`);
                errors++;
                continue;
            }

            // Update original prediction
            await supabase
                .from('predictions')
                .update({ is_won: isCorrect })
                .eq('id', prediction.id);

            verified++;
            console.log(`   ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'} - ${fixture.teams.home.name} vs ${fixture.teams.away.name} (${fixture.goals.home}-${fixture.goals.away})`);

            // Rate limiting: wait 500ms between requests
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (err) {
            console.error(`   ❌ Error processing prediction ${prediction.id}:`, err.message);
            errors++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total processed:     ${processed}`);
    console.log(`✅ Verified:         ${verified}`);
    console.log(`⏳ Not finished yet: ${notFinished}`);
    console.log(`❌ Errors:           ${errors}`);
    console.log('='.repeat(60));

    if (verified > 0) {
        // Show stats
        const { data: stats } = await supabase
            .from('predictions_results')
            .select('was_correct');

        const total = stats?.length || 0;
        const wins = stats?.filter(s => s.was_correct).length || 0;
        const winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : 0;

        console.log(`\n🎯 Overall Win Rate: ${winRate}% (${wins}/${total})`);
    }

    console.log('\n✅ Migration completed successfully!');
}

// Run
main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
