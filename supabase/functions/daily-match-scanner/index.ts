// supabase/functions/daily-match-scanner/index.ts
// Edge Function para escanear partidos del día siguiente
// Ejecuta: 1:00 AM Colombia (6:00 AM UTC) → Escanea partidos de MAÑANA

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const apiFootballKey = Deno.env.get('API_FOOTBALL_KEYS')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Leer parámetro opcional de fecha
        let targetDate: string
        try {
            const body = await req.json()
            if (body.targetDate) {
                targetDate = body.targetDate
            } else {
                // Por defecto: mañana en zona horaria Colombia (UTC-5)
                const now = new Date()
                const colombiaOffset = -5 * 60 * 60 * 1000 // UTC-5 en ms
                const colombiaTime = new Date(now.getTime() + colombiaOffset + (now.getTimezoneOffset() * 60 * 1000))
                colombiaTime.setDate(colombiaTime.getDate() + 1)
                targetDate = colombiaTime.toISOString().split('T')[0]
            }
        } catch {
            // Si no hay body, calcular mañana en Colombia
            const now = new Date()
            const colombiaOffset = -5 * 60 * 60 * 1000
            const colombiaTime = new Date(now.getTime() + colombiaOffset + (now.getTimezoneOffset() * 60 * 1000))
            colombiaTime.setDate(colombiaTime.getDate() + 1)
            targetDate = colombiaTime.toISOString().split('T')[0]
        }

        console.log(`[Scanner] Iniciando escaneo para fecha: ${targetDate}`)

        // 1. Iniciar log de ejecución
        const { data: jobLog } = await supabase
            .rpc('start_automation_job', {
                p_job_type: 'scanner',
                p_execution_date: new Date().toISOString().split('T')[0]
            })

        const jobId = jobLog

        // 2. Obtener ligas permitidas
        const { data: allowedLeagues, error: leaguesError } = await supabase
            .rpc('get_active_leagues')

        if (leaguesError) {
            throw new Error(`Error obteniendo ligas: ${leaguesError.message}`)
        }

        console.log(`[Scanner] Ligas activas: ${allowedLeagues.length}`)

        const leagueIds = allowedLeagues.map((l: any) => l.api_league_id)
        const leagueIdSet = new Set(leagueIds)

        // 3. Obtener TODOS los partidos del día (sin filtro de liga)
        // La API requiere 'season' cuando filtras por liga, pero sin ese filtro funciona bien
        let allMatches: any[] = []
        let processed = 0
        let success = 0
        let failed = 0

        try {
            console.log(`[Scanner] Llamando API para fecha: ${targetDate}`)

            const response = await fetch(
                `https://v3.football.api-sports.io/fixtures?date=${targetDate}`,
                {
                    headers: {
                        'x-rapidapi-key': apiFootballKey,
                        'x-rapidapi-host': 'v3.football.api-sports.io'
                    }
                }
            )

            if (!response.ok) {
                console.error(`[Scanner] Error API: ${response.status}`)
                failed++
            } else {
                const data = await response.json()

                if (data.errors && Object.keys(data.errors).length > 0) {
                    console.error(`[Scanner] API Errors:`, data.errors)
                }

                if (data.response && Array.isArray(data.response)) {
                    allMatches = data.response
                    success++
                    console.log(`[Scanner] Total partidos de la API: ${allMatches.length}`)
                }
            }
            processed++

        } catch (apiError) {
            console.error(`[Scanner] Error llamando API:`, apiError)
            failed++
        }

        console.log(`[Scanner] Total partidos obtenidos: ${allMatches.length}`)

        // 4. Filtrar solo ligas permitidas
        const filteredMatches = allMatches.filter((m: any) =>
            leagueIdSet.has(m.league.id)
        )

        console.log(`[Scanner] Partidos después de filtro: ${filteredMatches.length}`)

        // 5. Preparar e insertar partidos
        const matchesToInsert = filteredMatches.map((m: any) => ({
            scan_date: new Date().toISOString().split('T')[0],
            match_date: targetDate,
            api_fixture_id: m.fixture.id,
            league_id: m.league.id,
            league_name: m.league.name,
            home_team: m.teams.home.name,
            away_team: m.teams.away.name,
            home_team_logo: m.teams.home.logo,
            away_team_logo: m.teams.away.logo,
            match_time: new Date(m.fixture.timestamp * 1000).toISOString(),
            match_status: m.fixture.status.short,
            is_analyzed: false
        }))

        // Insertar con upsert (evitar duplicados)
        if (matchesToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('daily_matches')
                .upsert(matchesToInsert, {
                    onConflict: 'api_fixture_id,match_date',
                    ignoreDuplicates: true
                })

            if (insertError) {
                console.error('[Scanner] Error insertando:', insertError)
            }
        }

        // 6. Completar log
        await supabase.rpc('complete_automation_job', {
            p_job_id: jobId,
            p_status: failed > 0 ? 'partial' : 'success',
            p_processed: processed,
            p_success: matchesToInsert.length,
            p_failed: failed,
            p_details: {
                target_date: targetDate,
                leagues_checked: leagueIds.length,
                matches_found: allMatches.length,
                matches_filtered: filteredMatches.length,
                matches_inserted: matchesToInsert.length
            }
        })

        console.log(`[Scanner] Completado. ${matchesToInsert.length} partidos guardados.`)

        return new Response(
            JSON.stringify({
                success: true,
                targetDate,
                matchesScanned: allMatches.length,
                matchesSaved: matchesToInsert.length,
                leaguesChecked: leagueIds.length
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error: any) {
        console.error('[Scanner] Error fatal:', error)

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        )
    }
})
