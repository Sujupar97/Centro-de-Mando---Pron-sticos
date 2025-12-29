// supabase/functions/daily-results-verifier/index.ts
// Edge Function para verificar resultados de partidos y actualizar predicciones
// Ejecuta: 11:00 PM Colombia (4:00 AM UTC día siguiente)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const apiFootballKey = Deno.env.get('API_FOOTBALL_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const today = new Date().toISOString().split('T')[0]

        console.log(`[Verifier] Iniciando verificación de resultados para: ${today}`)

        // 1. Iniciar log
        const { data: jobId } = await supabase.rpc('start_automation_job', {
            p_job_type: 'verifier',
            p_execution_date: today
        })

        // 2. Obtener partidos de hoy sin verificar
        const { data: matches, error: matchError } = await supabase
            .from('daily_matches')
            .select('*')
            .eq('match_date', today)
            .eq('match_status', 'NS') // No started o pendientes

        if (matchError) {
            throw new Error(`Error obteniendo partidos: ${matchError.message}`)
        }

        // También obtener predicciones pendientes
        const { data: pendingPredictions, error: predError } = await supabase
            .from('predictions')
            .select('*')
            .eq('match_date', today)
            .is('is_won', null)

        if (predError) {
            throw new Error(`Error obteniendo predicciones: ${predError.message}`)
        }

        console.log(`[Verifier] Partidos a verificar: ${matches?.length || 0}`)
        console.log(`[Verifier] Predicciones pendientes: ${pendingPredictions?.length || 0}`)

        let verified = 0
        let updated = 0
        let failed = 0

        // 3. Verificar cada partido
        if (pendingPredictions && pendingPredictions.length > 0) {
            // Obtener IDs únicos de fixtures
            const fixtureIds = [...new Set(pendingPredictions.map(p => p.fixture_id))]

            for (const fixtureId of fixtureIds) {
                try {
                    // Obtener resultado de API-Football
                    const response = await fetch(
                        `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`,
                        {
                            headers: {
                                'x-rapidapi-key': apiFootballKey,
                                'x-rapidapi-host': 'v3.football.api-sports.io'
                            }
                        }
                    )

                    if (!response.ok) {
                        console.error(`[Verifier] Error API para fixture ${fixtureId}`)
                        failed++
                        continue
                    }

                    const data = await response.json()
                    const fixture = data.response?.[0]

                    if (!fixture) {
                        console.log(`[Verifier] No se encontró fixture ${fixtureId}`)
                        continue
                    }

                    // Verificar si el partido terminó
                    const status = fixture.fixture.status.short
                    if (!['FT', 'AET', 'PEN'].includes(status)) {
                        console.log(`[Verifier] Partido ${fixtureId} no ha terminado: ${status}`)
                        continue
                    }

                    const homeScore = fixture.goals.home
                    const awayScore = fixture.goals.away

                    // Actualizar daily_matches
                    await supabase
                        .from('daily_matches')
                        .update({
                            home_score: homeScore,
                            away_score: awayScore,
                            match_status: status
                        })
                        .eq('api_fixture_id', fixtureId)

                    // Actualizar predicciones relacionadas
                    const relatedPredictions = pendingPredictions.filter(p => p.fixture_id === fixtureId)

                    for (const pred of relatedPredictions) {
                        const isWon = evaluatePrediction(pred, homeScore, awayScore)

                        await supabase
                            .from('predictions')
                            .update({
                                is_won: isWon,
                                actual_result: `${homeScore}-${awayScore}`,
                                verified_at: new Date().toISOString()
                            })
                            .eq('id', pred.id)

                        // Guardar en predictions_results para ML
                        await supabase
                            .from('predictions_results')
                            .insert({
                                prediction_id: pred.id,
                                fixture_id: fixtureId,
                                was_correct: isWon,
                                confidence_delta: isWon ? 0 : pred.confidence // Penalización si falló
                            })
                            .onConflict('prediction_id')

                        updated++
                    }

                    verified++

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 300))

                } catch (fixtureError) {
                    console.error(`[Verifier] Error fixture ${fixtureId}:`, fixtureError)
                    failed++
                }
            }
        }

        // 4. Actualizar parlays automáticos
        const { data: parlays } = await supabase
            .from('daily_auto_parlays')
            .select('*')
            .eq('parlay_date', today)
            .eq('status', 'pending')

        if (parlays && parlays.length > 0) {
            for (const parlay of parlays) {
                const parlayStatus = await evaluateParlay(supabase, parlay)

                await supabase
                    .from('daily_auto_parlays')
                    .update({
                        status: parlayStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', parlay.id)
            }
        }

        // 5. Completar log
        await supabase.rpc('complete_automation_job', {
            p_job_id: jobId,
            p_status: failed > 0 ? 'partial' : 'success',
            p_processed: verified,
            p_success: updated,
            p_failed: failed,
            p_details: {
                fixtures_checked: verified,
                predictions_updated: updated,
                parlays_updated: parlays?.length || 0
            }
        })

        console.log(`[Verifier] Completado. Verificados: ${verified}, Actualizados: ${updated}`)

        return new Response(
            JSON.stringify({
                success: true,
                verified,
                updated,
                failed
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('[Verifier] Error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})

// Evaluar si la predicción fue correcta
function evaluatePrediction(prediction: any, homeScore: number, awayScore: number): boolean {
    const { prediction_type, predicted_outcome } = prediction
    const lowerOutcome = predicted_outcome.toLowerCase()

    switch (prediction_type) {
        case 'result':
        case '1x2':
            if (lowerOutcome.includes('local') || lowerOutcome.includes('home') || lowerOutcome === '1') {
                return homeScore > awayScore
            }
            if (lowerOutcome.includes('visit') || lowerOutcome.includes('away') || lowerOutcome === '2') {
                return awayScore > homeScore
            }
            if (lowerOutcome.includes('empate') || lowerOutcome.includes('draw') || lowerOutcome === 'x') {
                return homeScore === awayScore
            }
            break

        case 'over_under':
            const totalGoals = homeScore + awayScore
            if (lowerOutcome.includes('over 2.5') || lowerOutcome.includes('+2.5')) {
                return totalGoals > 2
            }
            if (lowerOutcome.includes('under 2.5') || lowerOutcome.includes('-2.5')) {
                return totalGoals < 3
            }
            if (lowerOutcome.includes('over 1.5') || lowerOutcome.includes('+1.5')) {
                return totalGoals > 1
            }
            break

        case 'btts':
            const bothScored = homeScore > 0 && awayScore > 0
            if (lowerOutcome.includes('sí') || lowerOutcome.includes('yes')) {
                return bothScored
            }
            if (lowerOutcome.includes('no')) {
                return !bothScored
            }
            break
    }

    // Default: intentar match simple
    return lowerOutcome.includes(homeScore > awayScore ? '1' : awayScore > homeScore ? '2' : 'x')
}

// Evaluar estado del parlay
async function evaluateParlay(supabase: any, parlay: any): Promise<string> {
    const legs = parlay.legs as any[]

    let won = 0
    let lost = 0
    let pending = 0

    for (const leg of legs) {
        // Buscar predicción correspondiente
        const { data: pred } = await supabase
            .from('predictions')
            .select('is_won')
            .eq('match_date', parlay.parlay_date)
            .ilike('home_team', `%${leg.match.split(' vs ')[0]}%`)
            .single()

        if (!pred || pred.is_won === null) {
            pending++
        } else if (pred.is_won) {
            won++
        } else {
            lost++
        }
    }

    if (lost > 0) return 'lost'
    if (pending > 0) return 'pending'
    if (won === legs.length) return 'won'
    return 'partial'
}
