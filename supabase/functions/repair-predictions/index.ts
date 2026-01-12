import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
    const logs: string[] = [];

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const today = '2026-01-07';

        logs.push(`Fetching runs desde ${today}...`);

        const { data: runs, error } = await supabase
            .from('analysis_runs')
            .select('id, report_pre_jsonb, created_at, job_id, match_date, analysis_jobs(api_fixture_id)')
            .gte('created_at', today + 'T00:00:00')
            .limit(50);

        if (error) {
            logs.push(`ERROR fetching runs: ${error.message}`);
            throw error;
        }

        logs.push(`Found ${runs?.length || 0} runs`);

        let restored = 0;

        for (const run of runs || []) {
            const { count } = await supabase
                .from('predictions')
                .select('id', { count: 'exact', head: true })
                .eq('analysis_run_id', run.id);

            if (count && count > 0) {
                continue; // Already has predictions
            }

            if (!run.report_pre_jsonb) {
                continue;
            }

            const report = typeof run.report_pre_jsonb === 'string'
                ? JSON.parse(run.report_pre_jsonb)
                : run.report_pre_jsonb;

            const tips = report?.predicciones_finales?.detalle || [];

            if (!Array.isArray(tips) || tips.length === 0) {
                continue;
            }

            const fixtureId = run.analysis_jobs?.api_fixture_id;

            if (!fixtureId) {
                logs.push(`Skip ${run.id}: no fixture_id`);
                continue;
            }

            // Extract team names from report
            const homeTeam = report?.header_partido?.titulo?.split(' vs ')?.[0]?.trim() || 'Home';
            const awayTeam = report?.header_partido?.titulo?.split(' vs ')?.[1]?.split(':')?.[0]?.trim() || 'Away';

            const predsToInsert = tips.map((t: any) => {
                let prob = parseFloat(t.probabilidad_estimado_porcentaje) || 50;
                // Probability is stored as percentage (0-100), not decimal
                if (prob < 1) prob = prob * 100; // Convert if it was decimal

                return {
                    analysis_run_id: run.id,
                    fixture_id: Number(fixtureId),
                    market: String(t.mercado || 'Unknown'),
                    selection: String(t.seleccion || ''),
                    probability: prob
                };
            });

            const { error: insErr } = await supabase.from('predictions').insert(predsToInsert);

            if (insErr) {
                logs.push(`ERROR ${run.id}: ${insErr.message}`);
            } else {
                restored += predsToInsert.length;
                logs.push(`✅ ${predsToInsert.length} preds`);
            }
        }

        logs.push(`TOTAL RESTORED: ${restored}`);

        return new Response(JSON.stringify({ success: true, restored, logs }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (e: any) {
        logs.push(`FATAL: ${e.message}`);
        return new Response(JSON.stringify({ error: e.message, logs }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
})
