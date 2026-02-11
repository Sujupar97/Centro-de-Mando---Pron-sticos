
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyImplied(date) {
    console.log(`Checking picks for ${date}...`);

    // get high prob picks, WITHOUT odds_implied
    const { data: picks, error } = await supabase
        .from('value_picks_v2')
        .select('id, fixture_id, market, selection, odds, p_model, decision')
        .eq('decision', 'BET')
        .gte('p_model', 0.80)
        .limit(20);

    if (error) {
        console.error("Error fetching picks:", error);
        return;
    }

    console.log(`Found ${picks.length} potential high-prob picks (sample 20).`);

    picks.forEach(p => {
        const rawOdds = p.odds;
        let final = rawOdds;
        let status = "MARKET";

        if (!final || final <= 1.01) {
            // calculation logic
            if (p.p_model > 0) {
                final = parseFloat((1 / p.p_model).toFixed(2));
                status = "CALCULATED";
            } else {
                final = 0;
                status = "INVALID";
            }
        }

        console.log(`Pick ${p.id.slice(0, 8)}: Market=${rawOdds}, P_Model=${p.p_model} -> Final=${final} (${status})`);
    });
}

const targetDate = process.argv[2] || '2026-02-08';
verifyImplied(targetDate);
