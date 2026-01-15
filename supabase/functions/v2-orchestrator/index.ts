// supabase/functions/v2-orchestrator/index.ts
// ORQUESTADOR V2: Ejecuta el pipeline completo A→B→C→D→E
// Propósito: Coordinar todos los motores en secuencia

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

const ENGINE_VERSION = '2.0.0';

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const totalStartTime = Date.now();

    try {
        const { fixture_id } = await req.json();
        if (!fixture_id) throw new Error('fixture_id is required');

        console.log(`[V2-ORCHESTRATOR] Starting full pipeline for fixture: ${fixture_id}`);

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        // ═══════════════════════════════════════════════════════════════
        // LIMPIEZA: Eliminar análisis anteriores para este fixture
        // ═══════════════════════════════════════════════════════════════
        console.log(`[V2-ORCHESTRATOR] 🧹 Cleaning previous analysis for fixture: ${fixture_id}`);

        // 1. Obtener jobs anteriores para este fixture
        const { data: previousJobs } = await supabase
            .from('analysis_jobs_v2')
            .select('id')
            .eq('fixture_id', fixture_id);

        if (previousJobs && previousJobs.length > 0) {
            const previousJobIds = previousJobs.map((j: any) => j.id);
            console.log(`[V2-ORCHESTRATOR] Found ${previousJobIds.length} previous jobs to clean`);

            // 2. Eliminar picks anteriores
            await supabase
                .from('value_picks_v2')
                .delete()
                .in('job_id', previousJobIds);

            // 3. Eliminar probabilidades anteriores
            await supabase
                .from('market_probs_v2')
                .delete()
                .in('job_id', previousJobIds);

            // 4. Eliminar reportes anteriores
            await supabase
                .from('analysis_reports_v2')
                .delete()
                .in('job_id', previousJobIds);

            // 5. Eliminar jobs anteriores
            await supabase
                .from('analysis_jobs_v2')
                .delete()
                .eq('fixture_id', fixture_id);

            console.log(`[V2-ORCHESTRATOR] ✅ Cleaned ${previousJobIds.length} previous analyses`);
        }

        const baseUrl = sbUrl.replace('.supabase.co', '.supabase.co/functions/v1');
        const authHeader = `Bearer ${sbKey}`;

        const results: Record<string, any> = {
            fixture_id,
            engine_version: ENGINE_VERSION,
            started_at: new Date().toISOString(),
            motors: {}
        };

        // ═══════════════════════════════════════════════════════════════
        // MOTOR A: ETL
        // ═══════════════════════════════════════════════════════════════
        console.log('[V2-ORCHESTRATOR] Motor A: ETL...');
        const motorARes = await fetch(`${baseUrl}/v2-create-job`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify({ fixture_id })
        });

        if (!motorARes.ok) {
            const errorText = await motorARes.text();
            throw new Error(`Motor A failed: ${errorText}`);
        }

        const motorAData = await motorARes.json();
        if (!motorAData.success) throw new Error(`Motor A failed: ${motorAData.error}`);

        results.motors.A = {
            job_id: motorAData.job_id,
            coverage_score: motorAData.coverage_score,
            execution_time_ms: motorAData.execution_time_ms
        };

        const job_id = motorAData.job_id;
        const payload = motorAData.payload;

        // ═══════════════════════════════════════════════════════════════
        // MOTOR B: Features/Metrics
        // ═══════════════════════════════════════════════════════════════
        console.log('[V2-ORCHESTRATOR] Motor B: Metrics...');
        const motorBRes = await fetch(`${baseUrl}/v2-compute-metrics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify({ job_id, payload })
        });

        if (!motorBRes.ok) {
            const errorText = await motorBRes.text();
            throw new Error(`Motor B failed: ${errorText}`);
        }

        const motorBData = await motorBRes.json();
        if (!motorBData.success) throw new Error(`Motor B failed: ${motorBData.error}`);

        results.motors.B = {
            quality_flags: motorBData.quality_flags,
            execution_time_ms: motorBData.execution_time_ms
        };

        const metrics = motorBData.metrics;
        const quality_flags = motorBData.quality_flags;

        // ═══════════════════════════════════════════════════════════════
        // MOTOR C: Market Models
        // ═══════════════════════════════════════════════════════════════
        console.log('[V2-ORCHESTRATOR] Motor C: Models...');
        const motorCRes = await fetch(`${baseUrl}/v2-market-models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify({ job_id, fixture_id, metrics, quality_flags })
        });

        if (!motorCRes.ok) {
            const errorText = await motorCRes.text();
            throw new Error(`Motor C failed: ${errorText}`);
        }

        const motorCData = await motorCRes.json();
        if (!motorCData.success) throw new Error(`Motor C failed: ${motorCData.error}`);

        results.motors.C = {
            markets_calculated: motorCData.market_probs?.length || 0,
            execution_time_ms: motorCData.execution_time_ms
        };

        const market_probs = motorCData.market_probs;

        // ═══════════════════════════════════════════════════════════════
        // MOTOR D: Value Engine
        // ═══════════════════════════════════════════════════════════════
        console.log('[V2-ORCHESTRATOR] Motor D: Value...');
        const motorDRes = await fetch(`${baseUrl}/v2-value-engine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify({
                job_id,
                fixture_id,
                market_probs,
                quality_flags,
                odds_data: payload.datasets?.odds
            })
        });

        if (!motorDRes.ok) {
            const errorText = await motorDRes.text();
            throw new Error(`Motor D failed: ${errorText}`);
        }

        const motorDData = await motorDRes.json();
        if (!motorDData.success) throw new Error(`Motor D failed: ${motorDData.error}`);

        results.motors.D = {
            summary: motorDData.summary,
            execution_time_ms: motorDData.execution_time_ms
        };

        const picks = motorDData.picks;

        // ═══════════════════════════════════════════════════════════════
        // MOTOR E: Interpretation & Report
        // ═══════════════════════════════════════════════════════════════
        console.log('[V2-ORCHESTRATOR] Motor E: Report...');
        const motorERes = await fetch(`${baseUrl}/v2-interpret-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify({ job_id, fixture_id, payload, metrics, picks })
        });

        if (!motorERes.ok) {
            const errorText = await motorERes.text();
            throw new Error(`Motor E failed: ${errorText}`);
        }

        const motorEData = await motorERes.json();
        if (!motorEData.success) throw new Error(`Motor E failed: ${motorEData.error}`);

        results.motors.E = {
            tokens_used: motorEData.tokens_used,
            execution_time_ms: motorEData.execution_time_ms
        };

        // ═══════════════════════════════════════════════════════════════
        // FINAL SUMMARY
        // ═══════════════════════════════════════════════════════════════
        const totalTime = Date.now() - totalStartTime;

        results.completed_at = new Date().toISOString();
        results.total_execution_time_ms = totalTime;
        results.job_id = job_id;
        results.summary = motorDData.summary;
        results.report = motorEData.report;

        console.log(`[V2-ORCHESTRATOR] ✅ Pipeline complete in ${totalTime}ms`);
        console.log(`[V2-ORCHESTRATOR] Picks: ${results.summary?.bet_picks || 0} BET, ${results.summary?.watch_picks || 0} WATCH`);

        return new Response(JSON.stringify({
            success: true,
            ...results
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[V2-ORCHESTRATOR] Pipeline failed:', e);
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
