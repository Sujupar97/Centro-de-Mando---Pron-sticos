
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
    console.log("Inspecting Report for Fixture 19451998...");

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

    // Check Date in packet if available
    console.log("Packet Date info:", packet.fecha || "N/A");

    // Check Picks
    if (packet.picks_recomendados) {
        console.log("Picks found in packet:");
        packet.picks_recomendados.forEach(p => {
            console.log(`- ${p.mercado} ${p.seleccion} (Prob ${p.probabilidad_numerica}%)`);
            console.log(`  Odds: ${p.cuota_europea}`);
        });
    } else {
        console.log("No picks_recomendados found in packet.");
    }
}

inspectReport();
