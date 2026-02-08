// supabase/functions/v3-orchestrator/index.ts
// ORQUESTADOR V3: Pipeline Simplificado A → E (ETL → IA Puro)
// Elimina motores B, C, D - Todo el análisis lo hace Gemini

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

const ENGINE_VERSION = '3.0.0';

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const totalStartTime = Date.now();
    const incomingAuth = req.headers.get('Authorization') || '';

    try {
        const { fixture_id } = await req.json();
        if (!fixture_id) throw new Error('fixture_id is required');

        console.log(`[V3-ORCHESTRATOR] Starting simplified pipeline for fixture: ${fixture_id}`);

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKeyFromEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const authHeader = incomingAuth || `Bearer ${sbKeyFromEnv}`;

        const supabase = createClient(sbUrl, sbKeyFromEnv || '');
        const baseUrl = sbUrl.replace('.supabase.co', '.supabase.co/functions/v1');

        const results: Record<string, any> = {
            fixture_id,
            engine_version: ENGINE_VERSION,
            started_at: new Date().toISOString(),
            pipeline: 'V3-SIMPLIFIED',
            motors: {}
        };

        // ═══════════════════════════════════════════════════════════════
        // MOTOR A: ETL (Sin cambios - Extrae todos los datos)
        // ═══════════════════════════════════════════════════════════════
        console.log('[V3-ORCHESTRATOR] Motor A: ETL (SportMonks)...');
        const motorARes = await fetch(`${baseUrl}/v2-create-job-sportmonks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify({ fixture_id })
        });

        if (!motorARes.ok) {
            const errorText = await motorARes.text();
            throw new Error(`Motor A (ETL) failed: ${errorText}`);
        }

        const motorAData = await motorARes.json();
        if (!motorAData.success) throw new Error(`Motor A failed: ${motorAData.error}`);

        results.motors.A = {
            job_id: motorAData.job_id,
            coverage_score: motorAData.coverage_score,
            has_odds: !!motorAData.payload?.odds,
            execution_time_ms: motorAData.execution_time_ms
        };

        const job_id = motorAData.job_id;
        const payload = motorAData.payload;

        console.log(`[V3-ORCHESTRATOR] ETL complete. Coverage: ${motorAData.coverage_score}, Odds: ${!!payload.odds}`);

        // ═══════════════════════════════════════════════════════════════
        // MOTORES B, C, D: ELIMINADOS ❌
        // La IA ahora hace todo el trabajo de análisis, cálculo y decisión
        // ═══════════════════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════════════════
        // MOTOR E*: V3-AI-ANALYZER (IA Puro - Hace TODO el trabajo)
        // ═══════════════════════════════════════════════════════════════
        console.log('[V3-ORCHESTRATOR] Motor E*: V3-AI-ANALYZER (Pure AI)...');
        const motorERes = await fetch(`${baseUrl}/v3-ai-analyzer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify({
                job_id,
                fixture_id,
                payload
            })
        });

        if (!motorERes.ok) {
            const errorText = await motorERes.text();
            throw new Error(`Motor E* (AI) failed: ${errorText}`);
        }

        const motorEData = await motorERes.json();
        if (!motorEData.success) throw new Error(`Motor E* failed: ${motorEData.error}`);

        results.motors.E = {
            tokens_used: motorEData.tokens_used,
            picks_count: motorEData.analysis?.pronosticos?.length || 0,
            veredicto: motorEData.analysis?.resumen_ejecutivo?.veredicto,
            execution_time_ms: motorEData.execution_time_ms
        };

        // ═══════════════════════════════════════════════════════════════
        // RESUMEN FINAL
        // ═══════════════════════════════════════════════════════════════
        const totalTime = Date.now() - totalStartTime;

        results.completed_at = new Date().toISOString();
        results.total_execution_time_ms = totalTime;
        results.job_id = job_id;
        results.summary = {
            picks: motorEData.analysis?.pronosticos?.length || 0,
            veredicto: motorEData.analysis?.resumen_ejecutivo?.veredicto || 'N/A',
            confianza: motorEData.analysis?.resumen_ejecutivo?.confianza_global || 'N/A',
            edge_promedio: motorEData.analysis?.resumen_ejecutivo?.edge_promedio_porcentaje || 0
        };
        results.report = motorEData.analysis;

        console.log(`[V3-ORCHESTRATOR] ✅ Pipeline complete in ${totalTime}ms`);
        console.log(`[V3-ORCHESTRATOR] Picks: ${results.summary.picks}, Veredicto: ${results.summary.veredicto}`);

        return new Response(JSON.stringify({
            success: true,
            ...results
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[V3-ORCHESTRATOR] Pipeline failed:', e);
        return new Response(JSON.stringify({
            success: false,
            error: e.message,
            total_execution_time_ms: Date.now() - totalStartTime
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
