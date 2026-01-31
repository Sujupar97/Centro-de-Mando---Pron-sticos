
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function inspectPicks() {
    const jobId = 'd7307cf5-909a-4547-8499-c192ca393484';
    console.log(`Inspecting picks for Job ${jobId}...`);

    const { data: picks, error } = await supabase
        .from('value_picks_v2')
        .select('*')
        .eq('job_id', jobId);

    if (error) {
        console.error("Error fetching picks:", error);
        return;
    }

    console.log(`Found ${picks.length} picks.`);

    // Filter showing those with odds
    const withOdds = picks.filter(p => p.odds !== null);
    console.log(`Picks with Odds: ${withOdds.length}`);
    withOdds.forEach(p => console.log(`[ODDS FOUND] ${p.market} (${p.selection}): ${p.odds}`));

    // Show a sample of those WITHOUT odds to see what market they are
    const withoutOdds = picks.filter(p => p.odds === null);
    console.log(`Picks per 'type' without odds:`);
    withoutOdds.slice(0, 5).forEach(p => console.log(`[NO ODDS] ${p.market} (${p.selection})`));
}

inspectPicks();
