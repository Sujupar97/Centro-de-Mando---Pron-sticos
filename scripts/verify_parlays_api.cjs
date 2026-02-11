
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyParlays() {
    console.log("Calling v2-generate-parlays for 2026-02-08...");

    const { data, error } = await supabase.functions.invoke('v2-generate-parlays', {
        body: { date: '2026-02-08', force_regenerate: true } // Force regenerate to bypass cache
    });

    if (error) {
        console.error("Error calling function:", error);
        return;
    }

    console.log("Success:", data.success);
    console.log("Message:", data.message);
    console.log("Parlays count:", data.parlays?.length || 0);
    console.log("Singles count:", data.singles?.length || 0);

    // Validation for new rules:
    if (data.parlays && data.parlays.length > 0) {
        console.error("FAIL: Parlays found! Should be 0.");
    } else {
        console.log("PASS: Parlays count is 0 (Correct).");
    }

    if (!data.singles || data.singles.length === 0) {
        console.error("FAIL: No singles found!");
    } else {
        const invalidProbs = data.singles.filter(s => s.p_model < 0.70);
        if (invalidProbs.length > 0) {
            console.error(`FAIL: Found ${invalidProbs.length} picks with prob < 0.70!`, invalidProbs.map(p => p.p_model));
        } else {
            console.log("PASS: All picks have prob >= 0.70");
        }
    }

    const aekPick = data.singles?.find(p =>
        (p.home_team && p.home_team.includes('AEK')) ||
        (p.away_team && p.away_team.includes('AEK')) ||
        (p.home_team && p.home_team.includes('Panserraikos')) ||
        (p.away_team && p.away_team.includes('Panserraikos'))
    );
    if (aekPick) {
        console.log("PASS: AEK Pick FOUND:", aekPick.home_team, "vs", aekPick.away_team, "| Pick:", aekPick.pick, "| Prob:", aekPick.p_model);
    } else {
        console.error("FAIL: AEK Pick NOT FOUND.");
    }
}

verifyParlays();
