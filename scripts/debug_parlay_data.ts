
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/std@0.145.0/dotenv/load.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log("Checking value_picks_v2 for recent entries...");
    const { data: picks, error } = await supabase
        .from('value_picks_v2')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching picks:", error);
        return;
    }

    if (!picks || picks.length === 0) {
        console.log("No picks found in value_picks_v2");
        return;
    }

    console.log(`Found ${picks.length} picks. Inspecting first one:`);
    const pick = picks[0];
    console.log(`ID: ${pick.id}, FixtureID: ${pick.fixture_id}, Odds: ${pick.odds}, Implied: ${pick.p_implied}`);

    if (pick.fixture_id) {
        console.log(`Fetching fixture ${pick.fixture_id}...`);
        const { data: fixture, error: fixError } = await supabase
            .from('fixtures')
            .select('*')
            .eq('id', pick.fixture_id)
            .single();

        if (fixError) {
            console.error("Error fetching fixture:", fixError);
        } else {
            console.log("Fixture Data Home:", fixture.home_team);
            console.log("Fixture Data Away:", fixture.away_team);
            console.log("Fixture Data League:", fixture.league_name);
            console.log("Type of home_team:", typeof fixture.home_team);
        }
    }
}

checkData();
