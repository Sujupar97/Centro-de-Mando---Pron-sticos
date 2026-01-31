
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMarkets() {
    const { data, error } = await supabase
        .from('value_picks_v2')
        .select('market, selection, p_model')
        .limit(500)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    const markets = new Set();
    const samples = {};

    data.forEach(p => {
        markets.add(p.market);
        if (!samples[p.market]) samples[p.market] = [];
        if (samples[p.market].length < 3) samples[p.market].push(`${p.selection} (${p.p_model})`);
    });

    console.log("Unique Markets found:", Array.from(markets));
    console.log("Samples:", JSON.stringify(samples, null, 2));
}

checkMarkets();
