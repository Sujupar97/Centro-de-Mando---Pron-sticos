
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFixture() {
    console.log("Inspecting 'fixtures' table...");

    // 1. Get one row to see structure
    const { data: sample } = await supabase.from('fixtures').select('*').limit(1);
    if (sample && sample.length > 0) {
        console.log("Sample Row Keys:", Object.keys(sample[0]));
        console.log("Sample ID Type:", typeof sample[0].id);
        console.log("Sample ID Value:", sample[0].id);
    } else {
        console.log("Table 'fixtures' seems empty/inaccessible.");
    }

    // 2. Try searching by 'api_id' if 'id' failed
    console.log("Trying search by 'api_id' = 1378083...");
    const { data: byApiId, error } = await supabase.from('fixtures').select('*').eq('api_id', 1378083);

    if (byApiId && byApiId.length > 0) {
        console.log("✅ Found by api_id!");
        console.log(byApiId[0]);
    } else {
        console.log("❌ Not found by api_id. Error:", error?.message);

        // 3. Try searching by 'fixture_id' aka standard API-Football name?
        // Note: API-Footbal usually uses 'id' in its JSON, but DB mappings vary.
    }
}

checkFixture();
