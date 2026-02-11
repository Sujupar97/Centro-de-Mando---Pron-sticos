
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditOrphans() {
    console.log("Auditing Orphaned Reports for Feb 8, 2026...");

    // 1. Get all reports for the target window
    const { data: reports, error } = await supabase
        .from('reports_v2')
        .select('id, fixture_id, created_at, report_packet')
        .gte('created_at', '2026-02-07T00:00:00Z') // Broad window
        .lte('created_at', '2026-02-10T23:59:59Z');

    if (error || !reports) {
        console.error("Error fetching reports:", error);
        return;
    }

    console.log(`Found ${reports.length} reports in the window.`);

    // 2. Get all existing picks fixture_ids
    const { data: picks } = await supabase
        .from('value_picks_v2')
        .select('fixture_id')
        .gte('created_at', '2026-02-07T00:00:00Z');

    const existingFixtureIds = new Set(picks.map(p => String(p.fixture_id)));

    let orphans = 0;

    for (const r of reports) {
        // Check if report has picks
        let packet = r.report_packet;
        if (typeof packet === 'string') {
            try { packet = JSON.parse(packet); } catch (e) { }
        }

        const hasPicks = (packet.pronosticos && packet.pronosticos.length > 0) ||
            (packet.predicciones_finales && packet.predicciones_finales.detalle && packet.predicciones_finales.detalle.length > 0);

        if (hasPicks) {
            // Check if this fixture_id exists in value_picks_v2
            // NOTE: The report fixture_id might be the "wrong" one (19451998)
            // We want to see if picks exist for THIS ID, or if this ID is "unknown" to the matches table

            const isSynced = existingFixtureIds.has(String(r.fixture_id));

            if (!isSynced) {
                // If not directly synced, is it because of ID mismatch?
                // Let's try to find the match in daily_matches by API ID from the report ID?
                // Or maybe we treat it as orphan for now.
                console.log(`[ORPHAN] Report ${r.id} | Fixture: ${r.fixture_id} | Title: ${packet.header_partido?.titulo}`);
                orphans++;
            }
        }
    }

    console.log(`Total Orphaned Reports (Picks exist in JSON but not in DB under that ID): ${orphans}`);
}

auditOrphans();
