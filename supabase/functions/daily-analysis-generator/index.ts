// supabase/functions/daily-analysis-generator/index.ts
// SISTEMA DE ANÁLISIS AUTOMÁTICO DIARIO V2
// Arquitectura: Self-chaining con estado en DB
// Acciones: start | continue | status | heartbeat

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STATE_KEY = 'auto_analysis_state'
const STALE_THRESHOLD_MS = 10 * 60 * 1000 // 10 min sin update = estancado
const SELF_INVOKE_DELAY_MS = 2000 // 2s entre invocaciones (respiro Gemini rate limits)

// ── Helpers ────────────────────────────────────────────────────────

function getTodayBogota(): string {
    const now = new Date()
    // Bogotá = UTC-5
    const bogotaMs = now.getTime() + (-5 * 60 * 60 * 1000)
    const bogotaNow = new Date(bogotaMs)
    // No +1 day — analyze TODAY's matches (CRON fires at 12:30 AM Bogotá)
    return bogotaNow.toISOString().split('T')[0]
}

function isFriendly(leagueName: string): boolean {
    const lower = (leagueName || '').toLowerCase()
    return lower.includes('friendly') || lower.includes('amistoso') || lower.includes('club friendly')
}

function jsonResponse(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
}

async function updateState(supabase: any, state: any) {
    state.updated_at = new Date().toISOString()
    await supabase
        .from('system_settings')
        .upsert({ key: STATE_KEY, value: state, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}

async function selfInvoke(supabaseUrl: string, serviceKey: string, body: any) {
    // Delay para dar respiro a Gemini rate limits
    await new Promise(r => setTimeout(r, SELF_INVOKE_DELAY_MS))

    // Fire-and-forget: enviar request, no esperar respuesta
    fetch(`${supabaseUrl}/functions/v1/daily-analysis-generator`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    }).catch(err => {
        console.error('[AutoAnalyzer] Self-invoke failed:', err.message)
    })

    // Esperar brevemente para asegurar que el request TCP salga antes de que Deno cierre
    await new Promise(r => setTimeout(r, 500))
}

// ── Main Handler ──────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        let reqBody: any = {}
        try {
            reqBody = await req.json()
        } catch {
            // Body vacío es válido (heartbeat CRON puede no enviar body)
        }

        const action = reqBody.action || 'heartbeat'
        console.log(`[AutoAnalyzer] Action: ${action}`)

        // ═══════════════════════════════════════════════════════════
        // ACTION: STATUS — Retorna estado actual para polling del UI
        // ═══════════════════════════════════════════════════════════
        if (action === 'status') {
            const { data: stateRow } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', STATE_KEY)
                .single()

            return jsonResponse({ success: true, state: stateRow?.value || null })
        }

        // ═══════════════════════════════════════════════════════════
        // ACTION: START — Iniciar nuevo batch de análisis
        // ═══════════════════════════════════════════════════════════
        if (action === 'start') {
            const isAuto = reqBody.auto === true

            // Si es CRON automático, verificar toggle
            if (isAuto) {
                const { data: settings } = await supabase
                    .from('system_settings')
                    .select('key, value')
                    .eq('key', 'auto_analysis_enabled')
                    .single()

                if (settings?.value === false) {
                    console.log('[AutoAnalyzer] Analysis disabled by system_settings')
                    return jsonResponse({ success: true, message: 'Analysis disabled', skipped: true })
                }
            }

            // Determinar fecha objetivo
            const targetDate = reqBody.target_date || getTodayBogota()
            console.log(`[AutoAnalyzer] Target date: ${targetDate}`)

            // Verificar que no hay batch activo
            const { data: currentState } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', STATE_KEY)
                .single()

            if (currentState?.value?.active === true) {
                console.log('[AutoAnalyzer] Batch already active, aborting start')
                return jsonResponse({
                    success: false,
                    error: 'Ya hay un batch activo. Cancélalo primero o espera a que termine.',
                    state: currentState.value
                }, 409)
            }

            // Poblar daily_matches para la fecha objetivo via v2-list-fixtures-sportmonks
            console.log(`[AutoAnalyzer] Poblando daily_matches para ${targetDate}...`)
            let fixturesError: string | null = null
            try {
                const fixturesResp = await fetch(
                    `${supabaseUrl}/functions/v1/v2-list-fixtures-sportmonks`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ date: targetDate })
                    }
                )
                const fixturesData = await fixturesResp.json()
                console.log(`[AutoAnalyzer] Fixtures response: ${fixturesResp.status}, count: ${fixturesData?.data?.length || fixturesData?.length || 'N/A'}`)
                if (!fixturesResp.ok) {
                    fixturesError = `SportMonks API error (HTTP ${fixturesResp.status}): ${fixturesData?.error || fixturesData?.message || 'Unknown error'}`
                    console.error(`[AutoAnalyzer] ${fixturesError}`)
                }
            } catch (e: any) {
                fixturesError = `SportMonks API unreachable: ${e.message}`
                console.error(`[AutoAnalyzer] ${fixturesError}`)
            }

            // Consultar daily_matches para la fecha, excluyendo amistosos
            const { data: matches, error: matchErr } = await supabase
                .from('daily_matches')
                .select('api_fixture_id, home_team, away_team, league_name, match_time')
                .eq('match_date', targetDate)
                .order('match_time', { ascending: true })

            if (matchErr) {
                throw new Error(`Error consultando daily_matches: ${matchErr.message}`)
            }

            // Filtrar amistosos
            const filteredMatches = (matches || []).filter(m => !isFriendly(m.league_name))

            if (filteredMatches.length === 0) {
                const msg = fixturesError
                    ? `Error obteniendo partidos de SportMonks: ${fixturesError}`
                    : `No hay partidos para analizar el ${targetDate}`
                console.log(`[AutoAnalyzer] ${msg}`)
                // Guardar error en batch state para que el admin lo vea en el UI
                if (fixturesError) {
                    await updateState(supabase, {
                        active: false,
                        target_date: targetDate,
                        total_matches: 0,
                        error: fixturesError,
                        updated_at: new Date().toISOString()
                    })
                }
                return jsonResponse({
                    success: !fixturesError,
                    message: msg,
                    error: fixturesError || undefined,
                    total_matches: matches?.length || 0,
                    friendly_excluded: (matches?.length || 0) - filteredMatches.length
                })
            }

            console.log(`[AutoAnalyzer] ${filteredMatches.length} partidos a analizar (${(matches?.length || 0) - filteredMatches.length} amistosos excluidos)`)

            // Crear batch state
            const batchState = {
                active: true,
                target_date: targetDate,
                total_matches: filteredMatches.length,
                processed_count: 0,
                current_fixture_id: null as number | null,
                current_phase: 'starting',
                current_match_name: '',
                current_match_index: 0,
                matches: filteredMatches.map(m => ({
                    fixture_id: m.api_fixture_id,
                    home: m.home_team,
                    away: m.away_team,
                    league: m.league_name,
                    standard_done: false,
                    parlay_done: false,
                    standard_error: null as string | null,
                    parlay_error: null as string | null,
                    job_id: null as string | null,
                })),
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                triggered_by: isAuto ? 'cron' : 'manual',
                errors: [] as string[],
            }

            await updateState(supabase, batchState)

            // Self-invoke para empezar a procesar
            await selfInvoke(supabaseUrl, supabaseServiceKey, { action: 'continue' })

            return jsonResponse({
                success: true,
                message: `Batch iniciado: ${filteredMatches.length} partidos para ${targetDate}`,
                total_matches: filteredMatches.length,
                target_date: targetDate
            })
        }

        // ═══════════════════════════════════════════════════════════
        // ACTION: HEARTBEAT — Detectar batches estancados
        // ═══════════════════════════════════════════════════════════
        if (action === 'heartbeat') {
            const { data: stateRow } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', STATE_KEY)
                .single()

            const state = stateRow?.value
            if (!state?.active) {
                // No hay batch activo, nada que hacer
                return jsonResponse({ success: true, message: 'No active batch' })
            }

            // Verificar si está estancado
            const lastUpdate = new Date(state.updated_at).getTime()
            const staleMs = Date.now() - lastUpdate

            if (staleMs > STALE_THRESHOLD_MS) {
                console.log(`[AutoAnalyzer] Heartbeat: batch estancado ${Math.round(staleMs / 60000)} min, reiniciando cadena...`)
                await selfInvoke(supabaseUrl, supabaseServiceKey, { action: 'continue' })
                return jsonResponse({ success: true, message: 'Restarted stale chain', stale_minutes: Math.round(staleMs / 60000) })
            }

            return jsonResponse({ success: true, message: 'Batch active and progressing', last_update_ago_ms: staleMs })
        }

        // ═══════════════════════════════════════════════════════════
        // ACTION: CONTINUE — Procesar UN paso del batch
        // ═══════════════════════════════════════════════════════════
        if (action === 'continue') {
            const { data: stateRow } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', STATE_KEY)
                .single()

            const state = stateRow?.value
            if (!state?.active) {
                console.log('[AutoAnalyzer] Continue: no active batch (cancelled or completed)')
                return jsonResponse({ success: true, message: 'No active batch' })
            }

            // Buscar siguiente partido pendiente
            const nextMatchNeedingStandard = state.matches.find((m: any) => !m.standard_done)
            const nextMatchNeedingParlay = state.matches.find((m: any) => m.standard_done && !m.parlay_done)

            // Prioridad: completar parlay del partido actual antes de pasar al siguiente
            const nextMatch = nextMatchNeedingParlay || nextMatchNeedingStandard

            if (!nextMatch) {
                // ═══ TODOS LOS PARTIDOS PROCESADOS ═══
                console.log('[AutoAnalyzer] Todos los partidos procesados. Generando combos de parlays...')
                state.current_phase = 'generating_combos'
                state.current_match_name = 'Generando Smart Parlays...'
                await updateState(supabase, state)

                try {
                    const parlayResp = await fetch(
                        `${supabaseUrl}/functions/v1/daily-parlay-generator`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${supabaseServiceKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ date: state.target_date })
                        }
                    )
                    console.log(`[AutoAnalyzer] Parlay combos response: ${parlayResp.status}`)
                } catch (e: any) {
                    console.error('[AutoAnalyzer] Error generando combos:', e.message)
                    state.errors.push(`[COMBOS] ${e.message}`)
                }

                state.active = false
                state.current_phase = 'completed'
                state.current_match_name = ''
                await updateState(supabase, state)

                console.log(`[AutoAnalyzer] Batch completado: ${state.processed_count}/${state.total_matches} partidos, ${state.errors.length} errores`)
                return jsonResponse({
                    success: true,
                    message: 'Batch completed',
                    processed: state.processed_count,
                    total: state.total_matches,
                    errors: state.errors.length
                })
            }

            // ═══ PROCESAR STANDARD ANALYSIS ═══
            if (!nextMatch.standard_done) {
                const matchIndex = state.matches.indexOf(nextMatch)
                state.current_phase = 'standard'
                state.current_fixture_id = nextMatch.fixture_id
                state.current_match_name = `${nextMatch.home} vs ${nextMatch.away}`
                state.current_match_index = matchIndex
                await updateState(supabase, state)

                console.log(`[AutoAnalyzer] [${matchIndex + 1}/${state.total_matches}] Standard: ${nextMatch.home} vs ${nextMatch.away} (fixture ${nextMatch.fixture_id})`)

                try {
                    // Paso 1: ETL (await ~10s)
                    console.log(`[AutoAnalyzer] Invocando v2-create-job-sportmonks...`)
                    const etlResp = await fetch(
                        `${supabaseUrl}/functions/v1/v2-create-job-sportmonks`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${supabaseServiceKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ fixture_id: nextMatch.fixture_id })
                        }
                    )

                    const etlData = await etlResp.json()

                    if (!etlData?.success || !etlData?.job_id) {
                        throw new Error(`ETL failed: ${etlData?.error || 'no job_id returned'}`)
                    }

                    console.log(`[AutoAnalyzer] ETL completado: job_id=${etlData.job_id}, coverage=${etlData.coverage_pct}%`)
                    nextMatch.job_id = etlData.job_id

                    // Paso 2: Analyzer (await ~60-120s)
                    console.log(`[AutoAnalyzer] Invocando v3-ai-analyzer...`)
                    const analyzerResp = await fetch(
                        `${supabaseUrl}/functions/v1/v3-ai-analyzer`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${supabaseServiceKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                job_id: etlData.job_id,
                                fixture_id: nextMatch.fixture_id
                            })
                        }
                    )

                    const analyzerData = await analyzerResp.json()

                    if (!analyzerResp.ok || !analyzerData?.success) {
                        throw new Error(`Analyzer failed: ${analyzerData?.error || `HTTP ${analyzerResp.status}`}`)
                    }

                    console.log(`[AutoAnalyzer] Standard analysis completado para ${nextMatch.home} vs ${nextMatch.away}`)

                    // Marcar standard como completado
                    nextMatch.standard_done = true

                    // Marcar is_analyzed en daily_matches
                    await supabase
                        .from('daily_matches')
                        .update({ is_analyzed: true })
                        .eq('api_fixture_id', nextMatch.fixture_id)
                        .eq('match_date', state.target_date)

                } catch (err: any) {
                    console.error(`[AutoAnalyzer] Error en standard analysis:`, err.message)
                    nextMatch.standard_done = true // No reintentar
                    nextMatch.standard_error = err.message
                    state.errors.push(`[STD] ${nextMatch.home} vs ${nextMatch.away}: ${err.message}`)
                }

                await updateState(supabase, state)

                // Self-invoke para procesar parlay (o siguiente partido si falló)
                await selfInvoke(supabaseUrl, supabaseServiceKey, { action: 'continue' })

                return jsonResponse({
                    success: true,
                    action: 'standard_analysis',
                    match: `${nextMatch.home} vs ${nextMatch.away}`,
                    result: nextMatch.standard_error ? 'failed' : 'success'
                })
            }

            // ═══ PROCESAR PARLAY ANALYSIS ═══
            if (!nextMatch.parlay_done) {
                state.current_phase = 'parlay'
                state.current_match_name = `${nextMatch.home} vs ${nextMatch.away} (Parlay)`
                await updateState(supabase, state)

                console.log(`[AutoAnalyzer] Parlay: ${nextMatch.home} vs ${nextMatch.away}`)

                // Si standard falló, saltar parlay
                if (nextMatch.standard_error) {
                    console.log(`[AutoAnalyzer] Saltando parlay (standard falló)`)
                    nextMatch.parlay_done = true
                    nextMatch.parlay_error = 'skipped (standard failed)'
                } else {
                    try {
                        // Buscar job estándar completado para obtener etl_context
                        const { data: stdJob } = await supabase
                            .from('analysis_jobs_v2')
                            .select('id, etl_context')
                            .eq('fixture_id', nextMatch.fixture_id)
                            .or('analysis_type.eq.standard,analysis_type.is.null')
                            .eq('status', 'done')
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single()

                        if (!stdJob?.etl_context) {
                            throw new Error('No etl_context found for standard job')
                        }

                        // Verificar que no existe ya un parlay job para hoy
                        const today = new Date().toISOString().split('T')[0]
                        const { data: existingParlay } = await supabase
                            .from('analysis_jobs_v2')
                            .select('id')
                            .eq('fixture_id', nextMatch.fixture_id)
                            .eq('analysis_type', 'parlay')
                            .gte('created_at', today)
                            .limit(1)

                        if (existingParlay && existingParlay.length > 0) {
                            console.log(`[AutoAnalyzer] Parlay ya existe para fixture ${nextMatch.fixture_id}, saltando`)
                            nextMatch.parlay_done = true
                        } else {
                            // Crear parlay job en analysis_jobs_v2
                            const { data: parlayJob, error: parlayJobErr } = await supabase
                                .from('analysis_jobs_v2')
                                .insert({
                                    fixture_id: nextMatch.fixture_id,
                                    status: 'etl',
                                    current_motor: 'PARLAY-ANALYZER',
                                    engine_version: 'V8.2-STRATEGIC',
                                    analysis_type: 'parlay',
                                    etl_context: stdJob.etl_context
                                })
                                .select()
                                .single()

                            if (parlayJobErr || !parlayJob) {
                                throw new Error(`Failed to create parlay job: ${parlayJobErr?.message}`)
                            }

                            // Invocar v3-parlay-analyzer (await ~40-60s)
                            console.log(`[AutoAnalyzer] Invocando v3-parlay-analyzer (job ${parlayJob.id})...`)
                            const parlayResp = await fetch(
                                `${supabaseUrl}/functions/v1/v3-parlay-analyzer`,
                                {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${supabaseServiceKey}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        job_id: parlayJob.id,
                                        fixture_id: nextMatch.fixture_id
                                    })
                                }
                            )

                            const parlayData = await parlayResp.json()
                            if (!parlayResp.ok) {
                                throw new Error(`Parlay analyzer HTTP ${parlayResp.status}: ${parlayData?.error || 'unknown'}`)
                            }

                            console.log(`[AutoAnalyzer] Parlay completado para ${nextMatch.home} vs ${nextMatch.away}`)
                            nextMatch.parlay_done = true
                        }

                    } catch (err: any) {
                        console.error(`[AutoAnalyzer] Error en parlay:`, err.message)
                        nextMatch.parlay_done = true
                        nextMatch.parlay_error = err.message
                        state.errors.push(`[PLY] ${nextMatch.home} vs ${nextMatch.away}: ${err.message}`)
                    }
                }

                // Actualizar processed_count
                state.processed_count = state.matches.filter((m: any) => m.standard_done && m.parlay_done).length
                await updateState(supabase, state)

                // Self-invoke para siguiente partido
                await selfInvoke(supabaseUrl, supabaseServiceKey, { action: 'continue' })

                return jsonResponse({
                    success: true,
                    action: 'parlay_analysis',
                    match: `${nextMatch.home} vs ${nextMatch.away}`,
                    result: nextMatch.parlay_error ? 'failed' : 'success',
                    progress: `${state.processed_count}/${state.total_matches}`
                })
            }
        }

        // Action no reconocido
        return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400)

    } catch (error: any) {
        console.error('[AutoAnalyzer] Error fatal:', error)

        // Intentar marcar batch como failed
        try {
            const { data: stateRow } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', STATE_KEY)
                .single()

            if (stateRow?.value?.active) {
                const state = stateRow.value
                state.errors.push(`[FATAL] ${error.message}`)
                // No marcar como inactive — el heartbeat puede reintentar
                await updateState(supabase, state)
            }
        } catch {
            // Ignorar errores al actualizar estado en caso de fallo
        }

        return jsonResponse({ success: false, error: error.message }, 500)
    }
})
