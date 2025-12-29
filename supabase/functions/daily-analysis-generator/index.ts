// supabase/functions/daily-analysis-generator/index.ts
// Edge Function que llama a create-analysis-job para cada partido pendiente
// Ejecuta: 2:00 AM Colombia (7:00 AM UTC)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Límite de análisis por ejecución (reducido para evitar timeout)
const MAX_ANALYSES_PER_RUN = 2

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        console.log(`[AutoAnalyzer] Iniciando análisis automático`)

        // 1. Obtener partidos pendientes de análisis
        const { data: pendingMatches, error: fetchError } = await supabase
            .from('daily_matches')
            .select('*')
            .eq('is_analyzed', false)
            .order('match_time', { ascending: true })
            .limit(MAX_ANALYSES_PER_RUN)

        if (fetchError) {
            throw new Error(`Error obteniendo partidos: ${fetchError.message}`)
        }

        if (!pendingMatches || pendingMatches.length === 0) {
            console.log('[AutoAnalyzer] No hay partidos pendientes')
            return new Response(
                JSON.stringify({ success: true, analyzed: 0, message: 'No pending matches' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`[AutoAnalyzer] Partidos pendientes: ${pendingMatches.length}`)

        let successCount = 0
        let failedCount = 0
        const results: any[] = []

        // 2. Procesar cada partido llamando a create-analysis-job
        for (const match of pendingMatches) {
            try {
                console.log(`[AutoAnalyzer] Analizando: ${match.home_team} vs ${match.away_team}`)

                // Llamar a la función create-analysis-job existente
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
                    console.error(`[AutoAnalyzer] Error en análisis: ${errorText}`)
                    failedCount++
                    results.push({
                        match: `${match.home_team} vs ${match.away_team}`,
                        status: 'failed',
                        error: errorText.substring(0, 100)
                    })
                } else {
                    const analysisResult = await analysisResponse.json()
                    console.log(`[AutoAnalyzer] Análisis completado para ${match.home_team} vs ${match.away_team}`)

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

                // Esperar entre análisis para no saturar (3 segundos)
                await new Promise(resolve => setTimeout(resolve, 3000))

            } catch (matchError: any) {
                console.error(`[AutoAnalyzer] Error en ${match.home_team} vs ${match.away_team}:`, matchError)
                failedCount++
                results.push({
                    match: `${match.home_team} vs ${match.away_team}`,
                    status: 'failed',
                    error: matchError.message
                })
            }
        }

        console.log(`[AutoAnalyzer] Completado. Éxitos: ${successCount}, Fallos: ${failedCount}`)

        return new Response(
            JSON.stringify({
                success: true,
                total: pendingMatches.length,
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
