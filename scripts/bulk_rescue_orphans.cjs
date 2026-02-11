
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
        .replace(/fc|cf|sporting|club|athletic|atletico|real|inter/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
};

async function bulkRescue() {
    console.log("Starting BULK Rescue for Orphans (Feb 7-10)...");

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

    // 3. Get existing picks to avoid duplication logic (although we can just upsert or ignore)
    // Actually, we'll check if the *target* fixture_id already has picks.
    const { data: existingPicks } = await supabase
        .from('value_picks_v2')
        .select('fixture_id')
        .gte('created_at', '2026-02-07T00:00:00Z');

    const existingFixtureIds = new Set(existingPicks.map(p => String(p.fixture_id)));

    let rescuedCount = 0;
    let picksPayload = [];

    for (const r of reports) {
        // Skip if this report ID (the V3 one) is already in picks (unlikely given the bug)
        // But we want to map to V2 ID.

        let packet = r.report_packet;
        if (typeof packet === 'string') {
            try { packet = JSON.parse(packet); } catch (e) { continue; }
        }

        // Get Picks from Packet
        let rawPicks = packet.pronosticos || [];
        if (rawPicks.length === 0 && packet.predicciones_finales?.detalle) {
            rawPicks = packet.predicciones_finales.detalle;
        }

        if (rawPicks.length === 0) continue;

        // Identify Teams
        // Usually deep in 'header_partido' or we have to guess from the packet title
        let homeName = packet.header_partido?.titulo?.split(' vs ')[0] || '';
        let awayName = packet.header_partido?.titulo?.split(' vs ')[1] || '';

        // If not in header, try to extract from 'analisis_profundo.contexto_competitivo' keys?
        // Or if 'home_team' field exists in future versions.
        // Fallback: report doesn't have easy team names?
        // In the AEK report, we saw "Panserraikos vs AEK Athens" in the title?
        // Let's assume title exists.

        if (!homeName || !awayName) {
            // console.log(`[SKIP] Report ${r.id} has no title to parse teams.`);
            continue;
        }

        const normHome = normalize(homeName);
        const normAway = normalize(awayName);

        // Find Match
        const match = matches.find(m => {
            const mHome = normalize(m.home_team);
            const mAway = normalize(m.away_team);
            // Check if BOTH teams match loosely
            return (mHome.includes(normHome) || normHome.includes(mHome)) &&
                (mAway.includes(normAway) || normAway.includes(mAway));
        });

        if (!match) {
            console.log(`[FAIL] Could not match teams: ${homeName} vs ${awayName}`);
            continue;
        }

        // Check if we already have picks for this MATCH ID (Api ID)
        if (existingFixtureIds.has(String(match.api_fixture_id))) {
            // Check if we want to overwrite? Assuming "orphans" logic meant we didn't find them.
            // But verify_feb8 saw we had 2 picks for AEK.
            // We should proceed if we want to valid "ALL" picks. 
            // Maybe we just add them if they are missing?
            // For now, let's assume if it's in existingFixtureIds, we are good?
            // Wait, standard orphans check said "Report fixture_id NOT in value_picks".
            // But now we found the REAL fixture_id.
            // If the real fixture_id IS in existingPicks, then maybe we don't need to rescue?
            // UNLESS the report has *more* picks?
            // Let's skip if fully present to avoid duplicates for now.
            // console.log(`[SKIP] Match ${match.api_fixture_id} already has picks.`);
            // continue;
        }

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
            // Check if this specific pick exists? No, too expensive.
            // Just push to payload. We will use upsert or delete-insert logic?
            // To be safe against duplicates, maybe we delete existing for this fixture_id before insert?
            // But we do it in batch... 

            picksPayload.push({
                job_id: r.job_id,
                fixture_id: match.api_fixture_id, // THE CORRECT ID
                market: p.mercado || "Mercado General",
                selection: p.seleccion || "Selección",
                p_model: (p.probabilidad_calculada_porcentaje || p.probabilidad_estimado_porcentaje || 50) / 100,
                decision: (p.decision === 'APOSTAR' || p.decision === 'BET' || (p.probabilidad_calculada_porcentaje >= 70)) ? 'BET' : 'ABSTENERSE',
                confidence: mapConfidence(p.confianza),
                engine_version: "V4-RESCUE-BULK",
                odds: p.cuota_actual || p.odds,
                created_at: new Date().toISOString()
            });
        });

        rescuedCount++;
        // Clean up previous picks for this match to ensure clean state? 
        // We can do `delete().in('fixture_id',Ids)` later.
    }

    console.log(`Rescued ${rescuedCount} reports. Generated ${picksPayload.length} picks.`);

    if (picksPayload.length > 0) {
        // Dedup by fixture_id
        const uniqueFixtureIds = [...new Set(picksPayload.map(p => p.fixture_id))];
        console.log(`Updating ${uniqueFixtureIds.length} fixtures...`);

        // 1. Delete existing for these fixtures (to clean potentially bad data or partials)
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
        else console.log("SUCCESS! All picks restored.");
    }
}

bulkRescue();
