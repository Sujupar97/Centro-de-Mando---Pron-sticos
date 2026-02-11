
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectReport() {
    console.log("Inspecting Report for Fixture 19451998 (Correct Keys)...");

    const { data: reports, error } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('fixture_id', 19451998)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!reports || reports.length === 0) {
        console.log("No reports found.");
        return;
    }

    const report = reports[0];
    console.log(`Report ID: ${report.id}, Created: ${report.created_at}`);

    let packet = report.report_packet;
    if (typeof packet === 'string') packet = JSON.parse(packet);

    // Check Predicciones
    if (packet.predicciones_finales && packet.predicciones_finales.detalle) {
        console.log("Found 'predicciones_finales.detalle':");
        packet.predicciones_finales.detalle.forEach(p => {
            console.log(`- Market: ${p.mercado}`);
            console.log(`  Selection: ${p.seleccion}`);
            console.log(`  Prob: ${p.probabilidad_estimado_porcentaje}%`);
            console.log(`  Decision: ${p.decision}`);
            console.log(`  Odds: ${p.cuota_europea || 'N/A'}`);
        });
    } else {
        console.log("No predicciones_finales.detalle found.");
        console.log("Keys available:", Object.keys(packet));
        if (packet.predicciones_finales) console.log("Subkeys:", Object.keys(packet.predicciones_finales));
    }
}

inspectReport();
