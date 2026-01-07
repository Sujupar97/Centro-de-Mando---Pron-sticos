import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

        // 0. VERIFICAR SYSTEM SETTINGS
        const { data: settings } = await supabase
            .from('system_settings')
            .select('key, value')
            .in('key', ['auto_analysis_enabled', 'auto_parlay_enabled']);

        const analysisEnabled = settings?.find(s => s.key === 'auto_analysis_enabled')?.value ?? true; // Default true (safety)
        const parlayEnabled = settings?.find(s => s.key === 'auto_parlay_enabled')?.value ?? true;

        if (analysisEnabled === false) {
            console.log('[AutoAnalyzer] ⏹️ Analysis disabled by system_settings');
            return new Response(JSON.stringify({ success: true, message: 'Analysis disabled' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[AutoAnalyzer] Iniciando análisis (máximo ${BATCH_SIZE} partidos)`)

        // 1. Obtener partidos pendientes (prioridad: los de HOY/MAÑANA más cercanos)
        const { data: pendingMatches, error: fetchError } = await supabase
            .from('daily_matches')
            .select('*')
            .eq('is_analyzed', false)
            .order('match_time', { ascending: true })
            .limit(BATCH_SIZE)

        if (fetchError) {
            throw new Error(`Error obteniendo partidos: ${fetchError.message}`)
        }

        // Si no hay partidos pendientes, verificar si debemos disparar PARLAY GENERATOR
        if (!pendingMatches || pendingMatches.length === 0) {
            console.log('[AutoAnalyzer] ✅ No hay partidos pendientes para analizar.')

            // CHECK PARA TRIGGER PARLAY
            // Solo si está habilitado y es "temprano" o queremos forzarlo. 
            // Como este script corre cada X tiempo, si disparamos parlay cada vez que no hay partidos, 
            // podríamos generar muuchos parlays. 
            // Idealmente, daily-parlay-generator maneja su propia unicidad (borra anterior del día).

            if (parlayEnabled === true) {
                console.log('[AutoAnalyzer] 🚀 Triggering Daily Parlay Generator...');
                // Invoking in background (fire and forget pattern not fully supported in pure fetch without wait, 
                // but we can await it as it shouldn't take too long)

                try {
                    const parlayResponse = await fetch(
                        `${supabaseUrl}/functions/v1/daily-parlay-generator`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${supabaseServiceKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({}) // No args needed, it calculates for "tomorrow" by default
                        }
                    );
                    console.log(`[AutoAnalyzer] Parlay trigger status: ${parlayResponse.status}`);
                } catch (e) {
                    console.error('[AutoAnalyzer] Error triggering parlay:', e);
                }
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    analyzed: 0,
                    message: 'No pending matches. Checked Parlay.'
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

                if (pendingMatches.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MATCHES_MS))
                }

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
