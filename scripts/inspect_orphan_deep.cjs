
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectOrphanDeep() {
    console.log("Inspecting Orphan Deep: a8ca6e6b-af12-4484-aa47-3da208138558");

    const { data: report, error } = await supabase
        .from('reports_v2')
        .select('report_packet')
        .eq('id', 'a8ca6e6b-af12-4484-aa47-3da208138558') // Use the ID from previous step
        .single();

    if (error) { console.error("Error:", error); return; }

    let packet = report.report_packet;
    if (typeof packet === 'string') packet = JSON.parse(packet);

    console.log("Resumen Ejecutivo:", JSON.stringify(packet.resumen_ejecutivo, null, 2));
    console.log("Analisis Profundo:", JSON.stringify(packet.analisis_profundo, null, 2));
}

inspectOrphanDeep();
