
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectPronosticos() {
    console.log("Inspecting 'pronosticos' for Fixture 19451998...");

    const { data: reports, error } = await supabase
        .from('reports_v2')
        .select('report_packet')
        .eq('fixture_id', 19451998)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !reports || reports.length === 0) {
        console.error("Error or no report found.");
        return;
    }

    let packet = reports[0].report_packet;
    if (typeof packet === 'string') packet = JSON.parse(packet);

    if (packet.pronosticos) {
        console.log("Found 'pronosticos':", JSON.stringify(packet.pronosticos, null, 2));
    } else {
        console.log("'pronosticos' key is missing or empty.");
    }

    if (packet.probabilidades_derbix) {
        console.log("Found 'probabilidades_derbix':", JSON.stringify(packet.probabilidades_derbix, null, 2));
    }
}

inspectPronosticos();
