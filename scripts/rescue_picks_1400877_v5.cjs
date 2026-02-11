
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function rescuePicks() {
    console.log("Starting Rescue Mission for Report 19451998 -> Fixture 1400877 (RETRY with Valid Enum)");

    // 1. Fetch Report
    const { data: reports, error } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('fixture_id', 19451998)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !reports || reports.length === 0) {
        console.error("Report not found.");
        return;
    }

    const report = reports[0];
    let packet = report.report_packet;
    if (typeof packet === 'string') packet = JSON.parse(packet);

    if (!packet.pronosticos) {
        console.error("No pronosticos found in report to rescue.");
        return;
    }

    // 2. Map Picks with Valid Types and Enums
    const mapConfidence = (str) => {
        if (!str) return 5;
        const s = str.toUpperCase();
        if (s.includes('MUY ALTA')) return 9;
        if (s.includes('ALTA')) return 8;
        if (s.includes('MEDIA')) return 6;
        return 5;
    };

    const picksToInsert = packet.pronosticos.map(p => ({
        job_id: report.job_id,
        fixture_id: 1400877,
        market: p.mercado,
        selection: p.seleccion,
        p_model: p.probabilidad_calculada_porcentaje / 100,
        // CHECK CONSTRAINT FIX: ONLY 'BET' OR 'ABSTENERSE' (likely)
        decision: p.probabilidad_calculada_porcentaje >= 70 ? 'BET' : 'ABSTENERSE',
        confidence: mapConfidence(p.confianza),
        engine_version: "V4-RESCUE",
        odds: p.cuota_actual,
        created_at: new Date().toISOString()
    }));

    console.log(`Found ${picksToInsert.length} picks to insert:`);
    picksToInsert.forEach(p => console.log(`- ${p.market} ${p.selection} (${p.p_model}) Decision: ${p.decision}`));

    // 3. Clear existing picks for this fixture
    await supabase.from('value_picks_v2').delete().eq('fixture_id', 1400877);

    // 4. Insert!
    const { data, error: insertError } = await supabase
        .from('value_picks_v2')
        .insert(picksToInsert)
        .select();

    if (insertError) {
        console.error("Insert Error:", insertError);
    } else {
        console.log(`Successfully inserted ${data.length} picks into value_picks_v2!`);
        console.log("Matches table ID: 1400877 (Linked correctly)");
    }
}

rescuePicks();
