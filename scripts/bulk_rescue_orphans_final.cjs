
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to normalize team names for loose matching
const normalize = (name) => {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/fc|cf|sc|sporting|club|athletic|atletico|real|inter|ac|as/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
};

async function bulkRescue() {
    console.log("Starting BULK Rescue with TEXT SCAN (Enum Fix)...");

    // 1. Fetch Orphans
    const { data: reports, error } = await supabase
        .from('reports_v2')
        .select('*')
        .gte('created_at', '2026-02-07T00:00:00Z')
        .lte('created_at', '2026-02-10T23:59:59Z');

    if (error || !reports) { console.error("Error fetching reports", error); return; }

    // 2. Fetch Matches
    const { data: matches } = await supabase
        .from('daily_matches')
        .select('id, api_fixture_id, home_team, away_team, match_date')
        .gte('match_date', '2026-02-07')
        .lte('match_date', '2026-02-10');

    if (!matches) { console.error("Error fetching matches"); return; }

    console.log(`Loaded ${reports.length} reports and ${matches.length} matches.`);

    let rescuedCount = 0;
    let picksPayload = [];

    for (const r of reports) {
        let packetStr = "";
        let packet = {};

        if (typeof r.report_packet === 'string') {
            packetStr = r.report_packet.toLowerCase();
            try { packet = JSON.parse(r.report_packet); } catch (e) { }
        } else {
            packetStr = JSON.stringify(r.report_packet).toLowerCase();
            packet = r.report_packet;
        }

        let rawPicks = packet.pronosticos || [];
        if (rawPicks.length === 0 && packet.predicciones_finales?.detalle) {
            rawPicks = packet.predicciones_finales.detalle;
        }

        if (rawPicks.length === 0) continue;

        // Try to match with a daily match
        let bestMatch = null;

        for (const m of matches) {
            const h = normalize(m.home_team);
            const a = normalize(m.away_team);
            if (h.length < 3 || a.length < 3) continue;

            let score = 0;
            if (packetStr.includes(h)) score += 1;
            if (packetStr.includes(a)) score += 1;

            if (score >= 2) {
                bestMatch = m;
                break;
            }
        }

        if (!bestMatch) continue;

        // Map Enums Strict (BET / AVOID)
        const mapConfidence = (str) => {
            if (typeof str === 'number') return str;
            if (!str) return 5;
            const s = str.toUpperCase();
            if (s.includes('MUY ALTA')) return 9;
            if (s.includes('ALTA')) return 8;
            if (s.includes('MEDIA')) return 6;
            return 5;
        };

        rawPicks.forEach(p => {
            let prob = p.probabilidad_calculada_porcentaje || p.p_model || p.probabilidad || 50;
            if (prob > 1) prob = prob / 100;

            // V3 strict enum: BET or AVOID
            // We map everything to AVOID unless it's a clear BET
            let decision = 'AVOID';
            const d = (p.decision || '').toUpperCase();
            if (d === 'BET' || d === 'APOSTAR' || prob >= 0.70) {
                decision = 'BET';
            }

            picksPayload.push({
                job_id: r.job_id,
                fixture_id: bestMatch.api_fixture_id,
                market: p.mercado || "Mercado General",
                selection: p.seleccion || "Selección",
                p_model: prob,
                decision: decision,
                confidence: mapConfidence(p.confianza),
                engine_version: "V4-RESCUE-BULK",
                odds: p.cuota_actual || p.odds || null,
                created_at: new Date().toISOString()
            });
        });

        rescuedCount++;
    }

    console.log(`Matched ${rescuedCount} orphans. Generated ${picksPayload.length} picks.`);

    if (picksPayload.length > 0) {
        const uniqueFixtureIds = [...new Set(picksPayload.map(p => p.fixture_id))];
        console.log(`Updating ${uniqueFixtureIds.length} fixtures...`);

        // 1. Delete existing
        await supabase.from('value_picks_v2').delete().in('fixture_id', uniqueFixtureIds);

        // 2. Insert
        const { error: insError } = await supabase.from('value_picks_v2').insert(picksPayload);

        if (insError) console.error("Error inserting picks:", insError);
        else console.log("SUCCESS! Bulk rescue completed.");
    }
}

bulkRescue();
