// supabase/functions/daily-analysis-generator/index.ts
// Edge Function que llama a create-analysis-job para cada partido pendiente
// Ejecuta: 2:00 AM Colombia (7:00 AM UTC)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Procesar partidos en batches de 2, con límite de tiempo total (50 minutos)
const BATCH_SIZE = 2
const MAX_EXECUTION_TIME_MS = 50 * 60 * 1000 // 50 minutos
const DELAY_BETWEEN_BATCHES_MS = 10000 // 10 segundos entre batches

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const startTime = Date.now()

        console.log(`[AutoAnalyzer] Iniciando análisis automático en batches de ${BATCH_SIZE}`)

        let totalSuccessCount = 0
        let totalFailedCount = 0
        const allResults: any[] = []
        let batchNumber = 0

        // LOOP: Procesar TODOS los partidos pendientes en batches
        while (true) {
            // Verificar timeout (50 minutos)
            if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
                console.log('[AutoAnalyzer] Timeout alcanzado (50 min), deteniendo')
                break
            }

            batchNumber++

            // 1. Obtener siguiente batch de partidos pendientes
            const { data: pendingMatches, error: fetchError } = await supabase
                .from('daily_matches')
                .select('*')
                .eq('is_analyzed', false)
                .order('match_time', { ascending: true })
                .limit(BATCH_SIZE)

            if (fetchError) {
                throw new Error(`Error obteniendo partidos: ${fetchError.message}`)
            }

            // Si no hay más partidos, terminar
            if (!pendingMatches || pendingMatches.length === 0) {
                console.log('[AutoAnalyzer] ✅ Todos los partidos procesados')
                break
            }

            console.log(`[AutoAnalyzer] 📦 Batch ${batchNumber}: ${pendingMatches.length} partidos`)

            // 2. Procesar cada partido del batch
            for (const match of pendingMatches) {
                try {
                    console.log(`[AutoAnalyzer] Analizando: ${match.home_team} vs ${match.away_team}`)

                    // Llamar a create-analysis-job
                    const analysisResponse = await fetch(
                        `${supabaseUrl}/functions/v1/create-analysis-job`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${supabaseServiceKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                api_fixture_id: match.api_fixture_id
                            })
                        }
                    )

                    if (!analysisResponse.ok) {
                        const errorText = await analysisResponse.text()
                        console.error(`[AutoAnalyzer] ❌ Error: ${errorText}`)
                        totalFailedCount++
                        allResults.push({
                            match: `${match.home_team} vs ${match.away_team}`,
                            status: 'failed',
                            error: errorText.substring(0, 100)
                        })
                    } else {
                        const analysisResult = await analysisResponse.json()
                        console.log(`[AutoAnalyzer] ✅ Completado`)

                        // Marcar como analizado
                        await supabase
                            .from('daily_matches')
                            .update({ is_analyzed: true })
                            .eq('id', match.id)

                        totalSuccessCount++
                        allResults.push({
                            match: `${match.home_team} vs ${match.away_team}`,
                            status: 'success',
                            jobId: analysisResult.job_id
                        })
                    }

                    // Pausa corta entre partidos (3 segundos)
                    await new Promise(resolve => setTimeout(resolve, 3000))

                } catch (matchError: any) {
                    console.error(`[AutoAnalyzer] ❌ Error fatal:`, matchError)
                    totalFailedCount++
                    allResults.push({
                        match: `${match.home_team} vs ${match.away_team}`,
                        status: 'failed',
                        error: matchError.message
                    })
                }
            }

            // 3. Pausa entre batches (10 segundos) para evitar sobrecarga
            console.log(`[AutoAnalyzer] ⏸️  Pausa de ${DELAY_BETWEEN_BATCHES_MS / 1000}s antes del siguiente batch...`)
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS))
        }

        const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
        console.log(`[AutoAnalyzer] 🎉 Finalizado en ${totalTime} minutos`)
        console.log(`[AutoAnalyzer] ✅ Éxitos: ${totalSuccessCount}, ❌ Fallos: ${totalFailedCount}`)

        return new Response(
            JSON.stringify({
                success: true,
                totalAnalyzed: totalSuccessCount,
                totalFailed: totalFailedCount,
                batches: batchNumber,
                executionTimeMinutes: parseFloat(totalTime),
                results: allResults
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('[AutoAnalyzer] Error fatal:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
