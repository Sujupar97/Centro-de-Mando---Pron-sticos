
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing ENV vars");
    Deno.exit(1);
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
        // Look for evidence in the text
        const jsonStr = JSON.stringify(res, null, 2);
        console.log("\n=== RESULT JSON MATCHES FOR 'MERCADO' / 'CUOTA' ===");

        // Scan for keywords
        const keywords = ['cuota', 'odd', 'mercado', 'paga', '1.8', '1.9', '2.0', '2.1', 'Pinnacle'];
        keywords.forEach(k => {
            const count = (jsonStr.match(new RegExp(k, 'gi')) || []).length;
            console.log(`Keyword '${k}': found ${count} times`);
        });

        console.log("\n=== SUMMARY TEXT ===");
        if (res.resumen_ejecutivo) console.log(res.resumen_ejecutivo);

        console.log("\n=== MARKET ANALYSIS ===");
        if (res.analisis_mercados_completo) console.log(JSON.stringify(res.analisis_mercados_completo, null, 2));

        console.log("\n=== FULL JSON (First 2000 chars) ===");
        console.log(jsonStr.substring(0, 2000));
    } else {
        console.log("No result_jsonb found. Job might be failed or running.");
        console.log("Progress:", data.progress_jsonb);
    }
}

main();
