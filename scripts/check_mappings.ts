
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkMappings() {
    console.log("Checking mappings for Girona and Getafe...");
    const { data, error } = await supabase
        .from('team_mappings')
        .select('*')
        .or('team_name_api_football.ilike.%Platense%,team_name_api_football.ilike.%Instituto%');

    if (error) console.error(error);
    else console.table(data);
}

checkMappings();
