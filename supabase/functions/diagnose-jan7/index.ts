
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const sbUrl = Deno.env.get('SUPABASE_URL')
const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(sbUrl, sbKey)

console.log("--- DIAGNÓSTICO PROFUNDO 7 ENE ---")

// 1. Check System Settings (Cron activation)
const { data: settings } = await supabase.from('system_settings').select('*');
console.log("System Settings:", settings);

// 2. Check Analysis Jobs created TODAY (Jan 7)
const today = '2026-01-07'; // User local date
const { data: jobs } = await supabase
    .from('analysis_jobs')
    .select('id, api_fixture_id, status, created_at')
    .gte('created_at', today + 'T00:00:00')
    .limit(50);

console.log(`Manual Jobs Today (${jobs?.length || 0}):`);
// console.log(jobs);

// 3. Check Daily Matches for TODAY
const { data: dailyMatches } = await supabase
    .from('daily_matches')
    .select('*')
    .gte('match_time', today + 'T00:00:00') // or scan_date
    .limit(50);

console.log(`Daily Matches Today (${dailyMatches?.length || 0}):`);
// Check overlap
const jobFixtureIds = jobs?.map(j => j.api_fixture_id) || [];
const matchFixtureIds = dailyMatches?.map(m => m.api_fixture_id) || [];
const missing = jobFixtureIds.filter(id => !matchFixtureIds.includes(id));

console.log(`Jobs (Fixture IDs) missing in Daily Matches: ${missing.length}`, missing);

// 4. Check Top Picks Logic Simulation (fetchTopPicks uses daily_matches)
// If dailyMatches is empty, it means frontend falls back to API.
// If dailyMatches has rows, frontend uses ONLY these rows.
// If the rows in dailyMatches are NOT the ones user analyzed (e.g. from a partial cron run), 
// AND the user's manual ones failed to insert... then they are invisible.

