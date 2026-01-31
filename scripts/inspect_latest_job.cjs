
// scripts/inspect_latest_job.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing ENV vars in .env.local");
    console.log("URL:", SUPABASE_URL);
    console.log("KEY present:", !!SUPABASE_KEY);
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    const { data, error } = await supabase
        .from('analysis_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("=== LATEST JOB ===");
    console.log("ID:", data.id);
    console.log("Fixture:", data.api_fixture_id);
    console.log("Status:", data.status);
    console.log("Created:", data.created_at);

    // Check Result
    const res = data.result_jsonb;
    if (res) {
        const jsonStr = JSON.stringify(res, null, 2);
        console.log("\n=== CONTEXTO DE MERCADO SEARCH ===");
        // NOTE: The prompt injection doesn't save to DB unless we saved it in a debug field. 
        // We can only see if the AI OUTPUT referenced the odds.

        const keywords = ['cuota', 'odd', 'mercado', 'paga', '1.8', '1.9', '2.0', '2.1', 'Pinnacle', 'Bet365', 'Hausse', 'Baisse'];
        keywords.forEach(k => {
            const count = (jsonStr.match(new RegExp(k, 'gi')) || []).length;
            console.log(`Keyword '${k}': found ${count} times`);
        });

        // Check explicit fields in Detailed Analysis causing potential "evidence"
        // Since we didn't add a dedicated "odds" field to the JSON schema output, we rely on the narrative.

        console.log("\n=== ANALISIS MERCADOS COMPLETO ===");
        if (res.analisis_mercados_completo) console.log(JSON.stringify(res.analisis_mercados_completo, null, 2));

        console.log("\n=== MODEL PREDICTIONS (Check reasoning) ===");
        if (res.predicciones_finales && res.predicciones_finales.detalle) {
            res.predicciones_finales.detalle.forEach(p => {
                console.log(`[${p.mercado}]: ${JSON.stringify(p.justificacion_detallada)}`);
            });
        }

    } else {
        console.log("No result_jsonb found.");
    }
}

main();
