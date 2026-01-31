
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; // Or SERVICE_ROLE if available but anon usually works for reads if policies allow

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditFixture(fixtureId: number) {
    console.log(`\n=== AUDITING FIXTURE ${fixtureId} ===\n`);

    // 1. Check Fixture
    const { data: fixture, error: fixtureError } = await supabase
        .from('fixtures')
        .select('*')
        .eq('id', fixtureId)
        .single();

    if (fixtureError) {
        console.error("Error fetching fixture:", fixtureError);
    } else {
        console.log("✅ Fixture found:");
        console.log(`- ID: ${fixture.id}`);
        console.log(`- Teams: ${fixture.home_team} vs ${fixture.away_team}`);
        console.log(`- Date: ${fixture.date}`);
        console.log(`- Status: ${fixture.status}`);
    }

    // 2. Check Odds
    const { data: odds, error: oddsError } = await supabase
        .from('odds')
        .select('*')
        .eq('fixture_id', fixtureId);

    if (oddsError) {
        console.error("Error fetching odds:", oddsError);
    } else {
        console.log(`\n📊 Odds Found: ${odds.length}`);
        if (odds.length > 0) {
            console.table(odds.map(o => ({
                bookmaker: o.bookmaker_id,
                market: o.market_key,
                values: JSON.stringify(o.values).substring(0, 50) + "..."
            })));
        } else {
            console.warn("⚠️ NO ODDS FOUND for this fixture.");
        }
    }

    // 3. Check recent Analysis Jobs
    const { data: jobs, error: jobsError } = await supabase
        .from('analysis_jobs')
        .select('*')
        .eq('fixture_id', fixtureId)
        .order('created_at', { ascending: false })
        .limit(3);

    if (jobsError) {
        console.error("Error fetching analysis jobs:", jobsError);
    } else {
        console.log(`\n⚙️ Recent Analysis Jobs: ${jobs.length}`);
        jobs.forEach(job => {
            console.log(`- Job ID: ${job.id}`);
            console.log(`  Status: ${job.status}`);
            console.log(`  Created: ${job.created_at}`);
            console.log(`  Steps:`, JSON.stringify(job.steps, null, 2));
            console.log(`  Logs:`, JSON.stringify(job.logs?.slice(-3) || [], null, 2));
        });
    }
}

auditFixture(1379194);
