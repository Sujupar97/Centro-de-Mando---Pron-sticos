
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
    console.log("Starting BULK Rescue with TEXT SCAN (Feb 7-10)...");

    // 1. Fetch Orphans
    const { data: reports, error } = await supabase
        .from('reports_v2')
        .select('*')
        .gte('created_at', '2026-02-07T00:00:00Z')
        .lte('created_at', '2026-02-10T23:59:59Z');

    if (error || !reports) { console.error("Error fetching reports", error); return; }

    // 2. Fetch Daily Matches for the same window (to map teams -> ID)
    const { data: matches, error: matchError } = await supabase
        .from('daily_matches')
        .select('id, api_fixture_id, home_team, away_team, match_date')
        .gte('match_date', '2026-02-07')
        .lte('match_date', '2026-02-10');

    if (matchError || !matches) { console.error("Error fetching matches", matchError); return; }

    console.log(`Loaded ${reports.length} reports and ${matches.length} matches.`);

    // 3. Get existing picks to avoid duplication logic
    const { data: existingPicks } = await supabase
        .from('value_picks_v2')
        .select('fixture_id')
        .gte('created_at', '2026-02-07T00:00:00Z');

    // We actually want to rescue even if some picks exist, but maybe not if ALL exist.
    // For now, let's just log what we match.

    let rescuedCount = 0;
    let picksPayload = [];
    let orphansFound = 0;

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

        // Check if it has picks
        let rawPicks = packet.pronosticos || [];
        if (rawPicks.length === 0 && packet.predicciones_finales?.detalle) {
            rawPicks = packet.predicciones_finales.detalle;
        }

        if (rawPicks.length === 0) continue;
        orphansFound++;

        // Try to match with a daily match
        let bestMatch = null;
        let maxScore = 0;

        for (const m of matches) {
            const h = normalize(m.home_team);
            const a = normalize(m.away_team);

            if (h.length < 3 || a.length < 3) continue; // too short to match safely

            // Simple occurrence check
            // We give points if home is found and away is found
            let score = 0;
            if (packetStr.includes(h)) score += 1;
            if (packetStr.includes(a)) score += 1;

            if (score >= 2) {
                // Strong match
                bestMatch = m;
                maxScore = score;
                break; // Found it!
            }
        }

        if (!bestMatch) {
            // console.log(`[FAIL] No text match for report ${r.id}`);
            continue;
        }

        // console.log(`[MATCH] Report ${r.id} -> ${bestMatch.home_team} vs ${bestMatch.away_team}`);

        // Prepare Picks
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
            // Validate pick integrity
            if (!p.probabilidad_calculada_porcentaje && !p.p_model && !p.probabilidad) return;

            let prob = p.probabilidad_calculada_porcentaje || p.p_model || p.probabilidad || 50;
            if (prob > 1) prob = prob / 100; // Normalize to 0-1 if not already

            picksPayload.push({
                job_id: r.job_id,
                fixture_id: bestMatch.api_fixture_id, // THE CORRECT ID
                market: p.mercado || "Mercado General",
                selection: p.seleccion || "Selección",
                p_model: prob,
                decision: (['APOSTAR', 'BET'].includes(p.decision) || prob >= 0.70) ? 'BET' : 'ABSTENERSE',
                confidence: mapConfidence(p.confianza),
                engine_version: "V4-RESCUE-TEXT",
                odds: p.cuota_actual || p.odds || null,
                created_at: new Date().toISOString()
            });
        });

        rescuedCount++;
    }

    console.log(`Matched ${rescuedCount} / ${orphansFound} orphans. Generated ${picksPayload.length} picks.`);

    if (picksPayload.length > 0) {
        // Dedup by fixture_id locally to avoid double inserting if multiple reports map to same match
        // (Unlikely but possible)

        console.log("Inserting picks...");

        const uniqueFixtureIds = [...new Set(picksPayload.map(p => p.fixture_id))];

        // 1. Delete existing for these fixtures
        const { error: delError } = await supabase
            .from('value_picks_v2')
            .delete()
            .in('fixture_id', uniqueFixtureIds);

        if (delError) console.error("Error clearing old picks:", delError);

        // 2. Bulk Insert
        const { error: insError } = await supabase
            .from('value_picks_v2')
            .insert(picksPayload);

        if (insError) console.error("Error inserting picks:", insError);
        else console.log("SUCCESS! Bulk rescue completed.");
    }
}

bulkRescue();
