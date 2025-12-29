// supabase/functions/daily-analysis-generator/index.ts
// Edge Function que llama a create-analysis-job para cada partido pendiente
// Ejecuta: 2:00 AM Colombia (7:00 AM UTC)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Procesar 3 partidos por ejecución, de 1 en 1 con pausa de 3 min
const BATCH_SIZE = 3
const DELAY_BETWEEN_MATCHES_MS = 3 * 60 * 1000 // 3 minutos

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        console.log(`[AutoAnalyzer] Iniciando análisis (máximo ${BATCH_SIZE} partidos)`)

        // 1. Obtener partidos pendientes (solo 2)
        const { data: pendingMatches, error: fetchError } = await supabase
            .from('daily_matches')
            .select('*')
            .eq('is_analyzed', false)
            .order('match_time', { ascending: true })
            .limit(BATCH_SIZE)

        if (fetchError) {
            throw new Error(`Error obteniendo partidos: ${fetchError.message}`)
        }

        // Si no hay partidos pendientes, terminar
        if (!pendingMatches || pendingMatches.length === 0) {
            console.log('[AutoAnalyzer] ✅ No hay partidos pendientes')
            return new Response(
                JSON.stringify({
                    success: true,
                    analyzed: 0,
                    message: 'No pending matches'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`[AutoAnalyzer] 📦 Procesando ${pendingMatches.length} partidos`)

        let successCount = 0
        let failedCount = 0
        const results: any[] = []

        // 2. Procesar cada partido
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
                    failedCount++
                    results.push({
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

                    successCount++
                    results.push({
                        match: `${match.home_team} vs ${match.away_team}`,
                        status: 'success',
                        jobId: analysisResult.job_id
                    })
                }

                // Pausa de 3 minutos entre partidos
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MATCHES_MS))

            } catch (matchError: any) {
                console.error(`[AutoAnalyzer] ❌ Error fatal:`, matchError)
                failedCount++
                results.push({
                    match: `${match.home_team} vs ${match.away_team}`,
                    status: 'failed',
                    error: matchError.message
                })
            }
        }

        console.log(`[AutoAnalyzer] 🎉 Completado: ${successCount} éxitos, ${failedCount} fallos`)

        return new Response(
            JSON.stringify({
                success: true,
                analyzed: successCount,
                failed: failedCount,
                results
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
