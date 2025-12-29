// supabase/functions/daily-analysis-generator/index.ts
// Edge Function para generar análisis automáticos de partidos pendientes
// Ejecuta: 2:00 AM Colombia (7:00 AM UTC) → Analiza partidos escaneados

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Límite de análisis por ejecución (para controlar costos)
const MAX_ANALYSES_PER_RUN = 20

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!
        const apiFootballKey = Deno.env.get('API_FOOTBALL_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const genAI = new GoogleGenerativeAI(geminiApiKey)

        // Fecha de hoy para el log
        const today = new Date().toISOString().split('T')[0]

        console.log(`[Analyzer] Iniciando generación de análisis`)

        // 1. Iniciar log
        const { data: jobId } = await supabase.rpc('start_automation_job', {
            p_job_type: 'analyzer',
            p_execution_date: today
        })

        // 2. Obtener partidos pendientes de análisis
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
            console.log('[Analyzer] No hay partidos pendientes')

            await supabase.rpc('complete_automation_job', {
                p_job_id: jobId,
                p_status: 'success',
                p_processed: 0,
                p_success: 0,
                p_failed: 0,
                p_details: { message: 'No pending matches' }
            })

            return new Response(
                JSON.stringify({ success: true, analyzed: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`[Analyzer] Partidos pendientes: ${pendingMatches.length}`)

        let successCount = 0
        let failedCount = 0
        const results: any[] = []

        // 3. Procesar cada partido
        for (const match of pendingMatches) {
            try {
                console.log(`[Analyzer] Procesando: ${match.home_team} vs ${match.away_team}`)

                // 3.1 Obtener datos adicionales de API-Football
                const matchData = await fetchMatchData(match.api_fixture_id, apiFootballKey)

                // 3.2 Generar análisis con Gemini
                const analysis = await generateAnalysis(genAI, match, matchData)

                // 3.3 Guardar en analysis_runs
                const { data: runData, error: runError } = await supabase
                    .from('analysis_runs')
                    .insert({
                        api_fixture_id: match.api_fixture_id,
                        status: 'done',
                        league_id: match.league_id,
                        league_name: match.league_name,
                        home_team: match.home_team,
                        away_team: match.away_team,
                        match_date: match.match_date,
                        analysis_report: analysis.report,
                        completed_at: new Date().toISOString()
                    })
                    .select('id')
                    .single()

                if (runError) {
                    console.error(`[Analyzer] Error guardando run:`, runError)
                    failedCount++
                    continue
                }

                // 3.4 Guardar prediction
                if (analysis.prediction) {
                    await supabase.from('predictions').insert({
                        analysis_run_id: runData.id,
                        fixture_id: match.api_fixture_id,
                        match_date: match.match_date,
                        home_team: match.home_team,
                        away_team: match.away_team,
                        league_name: match.league_name,
                        prediction_type: analysis.prediction.type,
                        predicted_outcome: analysis.prediction.outcome,
                        confidence: analysis.prediction.confidence,
                        reasoning: analysis.prediction.reasoning,
                        // Clasificar por tier según confianza
                        prediction_tier: getPredictionTier(analysis.prediction.confidence)
                    })
                }

                // 3.5 Marcar como analizado
                await supabase
                    .from('daily_matches')
                    .update({
                        is_analyzed: true,
                        analysis_run_id: runData.id
                    })
                    .eq('id', match.id)

                successCount++
                results.push({
                    match: `${match.home_team} vs ${match.away_team}`,
                    status: 'success',
                    confidence: analysis.prediction?.confidence
                })

                // Rate limiting entre análisis
                await new Promise(resolve => setTimeout(resolve, 2000))

            } catch (matchError: any) {
                console.error(`[Analyzer] Error en partido ${match.id}:`, matchError)
                failedCount++
                results.push({
                    match: `${match.home_team} vs ${match.away_team}`,
                    status: 'failed',
                    error: matchError.message
                })
            }
        }

        // 4. Completar log
        await supabase.rpc('complete_automation_job', {
            p_job_id: jobId,
            p_status: failedCount > 0 ? 'partial' : 'success',
            p_processed: pendingMatches.length,
            p_success: successCount,
            p_failed: failedCount,
            p_details: { results }
        })

        console.log(`[Analyzer] Completado. Éxitos: ${successCount}, Fallos: ${failedCount}`)

        return new Response(
            JSON.stringify({
                success: true,
                total: pendingMatches.length,
                analyzed: successCount,
                failed: failedCount
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('[Analyzer] Error fatal:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})

// Función helper: Obtener datos del partido
async function fetchMatchData(fixtureId: number, apiKey: string) {
    try {
        // Obtener estadísticas del equipo y H2H
        const [statsRes, h2hRes] = await Promise.all([
            fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
                headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' }
            }),
            fetch(`https://v3.football.api-sports.io/fixtures/headtohead?h2h=${fixtureId}`, {
                headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' }
            }).catch(() => null)
        ])

        const statsData = await statsRes.json()
        const h2hData = h2hRes ? await h2hRes.json() : null

        return {
            fixture: statsData.response?.[0] || null,
            h2h: h2hData?.response || []
        }
    } catch (error) {
        console.error('Error fetching match data:', error)
        return { fixture: null, h2h: [] }
    }
}

// Función helper: Generar análisis con Gemini
async function generateAnalysis(genAI: GoogleGenerativeAI, match: any, matchData: any) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `
Eres un analista experto en apuestas deportivas. Analiza el siguiente partido y genera un pronóstico.

PARTIDO:
- ${match.home_team} vs ${match.away_team}
- Liga: ${match.league_name}
- Fecha: ${match.match_date}
- Hora: ${match.match_time}

DATOS ADICIONALES:
${JSON.stringify(matchData, null, 2).substring(0, 3000)}

Responde en formato JSON:
{
  "report": {
    "summary": "Resumen del análisis en 2-3 oraciones",
    "strengths_home": ["punto1", "punto2"],
    "strengths_away": ["punto1", "punto2"],
    "key_factors": ["factor1", "factor2", "factor3"]
  },
  "prediction": {
    "type": "result|over_under|btts",
    "outcome": "descripción del pronóstico",
    "confidence": 65,
    "reasoning": "razón principal"
  }
}

IMPORTANTE: Solo responde con JSON válido, sin markdown ni texto adicional.
`

    try {
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        // Limpiar respuesta
        const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        return JSON.parse(cleanJson)
    } catch (error) {
        console.error('Error parsing Gemini response:', error)
        return {
            report: { summary: 'Error generando análisis', strengths_home: [], strengths_away: [], key_factors: [] },
            prediction: { type: 'result', outcome: 'Sin pronóstico', confidence: 0, reasoning: 'Error' }
        }
    }
}

// Función helper: Clasificar tier según confianza
function getPredictionTier(confidence: number): string {
    if (confidence >= 75) return 'premium_100'
    if (confidence >= 65) return 'premium_70'
    if (confidence >= 55) return 'premium_35'
    return 'free'
}
