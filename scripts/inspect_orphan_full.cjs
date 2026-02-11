
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectOrphan() {
    console.log("Inspecting Orphan: a8ca6e6b-af12-4484-aa47-3da208138558");

    const { data: report, error } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('id', 'a8ca6e6b-af12-4484-aa47-3da208138558')
        .single();

    if (error) { console.error("Error:", error); return; }

    console.log("Report Fixture ID:", report.fixture_id);
    let packet = report.report_packet;
    if (typeof packet === 'string') packet = JSON.parse(packet);

    console.log("Packet Keys:", Object.keys(packet));
    if (packet.header_partido) console.log("Header:", packet.header_partido);
    if (packet.meta) console.log("Meta:", packet.meta);
    if (packet.pronosticos) console.log("Pronosticos len:", packet.pronosticos.length);
    if (packet.predicciones_finales) console.log("Predicciones:", JSON.stringify(packet.predicciones_finales, null, 2));

    // Check if input_payload exists in the column
    if (report.input_payload) {
        console.log("Input Payload found!");
        console.log(JSON.stringify(report.input_payload, null, 2));
    }
}

inspectOrphan();
