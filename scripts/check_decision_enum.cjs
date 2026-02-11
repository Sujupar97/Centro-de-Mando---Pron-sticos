
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEnums() {
    console.log("Checking distinct decision values...");

    // We can't do SELECT DISTINCT easily with JS client without RPC sometimes, 
    // but we can fetch a bunch and simple set.
    const { data: picks, error } = await supabase
        .from('value_picks_v2')
        .select('decision')
        .limit(200);

    if (error) { console.error(error); return; }

    const values = new Set(picks.map(p => p.decision));
    console.log("Valid Decisions found in recent rows:", [...values]);
}

checkEnums();
