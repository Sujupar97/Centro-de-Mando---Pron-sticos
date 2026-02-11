
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchByKey() {
    console.log("Searching reports for 'analisis_mercados_calculados'...");

    // We can't query JSON keys easily with Supabase JS filter unless we use RPC or raw SQL.
    // So we fetch recent reports and filter in JS. Not ideal but works for ~100 rows.

    const { data: reports, error } = await supabase
        .from('reports_v2')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300); // Fetch enough history

    if (error) {
        console.error("Error fetching reports:", error);
        return;
    }

    console.log(`Fetched ${reports.length} reports.`);

    const candidates = [];

    for (const r of reports) {
        let packet = r.report_packet;
        if (typeof packet === 'string') {
            try {
                packet = JSON.parse(packet);
            } catch (e) {
                continue;
            }
        }

        // precise key check from screenshot component code
        if (packet.analisis_mercados_calculados) {
            // Check if it's the AEK match
            const str = JSON.stringify(packet).toLowerCase();
            if (str.includes('aek') || str.includes('panserraikos')) {
                candidates.push(r);
            }
        }
    }

    console.log(`Found ${candidates.length} matching reports.`);
    candidates.forEach(c => {
        console.log(`Report ${c.id}: Fixture ${c.fixture_id}, Created ${c.created_at}`);
        // Log detailed keys
        let p = typeof c.report_packet === 'string' ? JSON.parse(c.report_packet) : c.report_packet;
        console.log(`  Keys: ${Object.keys(p).join(', ')}`);
        if (p.header_partido) console.log(`  Title: ${p.header_partido.titulo}`);
    });
}

searchByKey();
