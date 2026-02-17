
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    // 1. Fetch Today's Matches
    const targetDate = '2026-02-11';
    console.log(`Fetching Daily Matches for ${targetDate}...`);
    const { data: dailyMatches } = await supabase
        .from('daily_matches')
        .select('api_fixture_id, home_team, away_team, league_name, match_time')
        .gte('match_time', `${targetDate}T00:00:00`)
        .lt('match_time', `${targetDate}T23:59:59`);

    if (!dailyMatches || dailyMatches.length === 0) {
        console.log('No daily matches found.');
        return;
    }
    console.log(`Found ${dailyMatches.length} matches.`);
    console.log(`Examples: ${dailyMatches.slice(0, 3).map(m => `${m.home_team} vs ${m.away_team}`).join(', ')}`);

    // 2. Fetch Recent Reports
    console.log('Fetching Recent Reports (last 20)...');
    const { data: reports } = await supabase
        .from('reports_v2')
        .select('job_id, fixture_id, created_at')
        .not('job_id', 'is', null) // Ensure job_id exists
        .order('created_at', { ascending: false })
        .limit(20);

    if (!reports) {
        console.log('No reports found.');
        return;
    }
    console.log(`Found ${reports.length} recent reports.`);

    // 3. Fetch Job Payloads
    const jobIds = reports.map(r => r.job_id);
    const { data: jobs } = await supabase
        .from('analysis_jobs_v2')
        .select('id, etl_context')
        .in('id', jobIds);

    const jobsMap = new Map();
    if (jobs) {
        jobs.forEach(j => jobsMap.set(j.id, j.etl_context));
    }

    console.log(`Found ${jobs.length} valid payloads.`);

    // 4. Try Match Logic
    console.log('--- Matching Check ---');
    let matchedCount = 0;
    for (const r of reports) {
        // ID Match (Cast to Number)
        let match = dailyMatches.find(m => Number(m.api_fixture_id) === Number(r.fixture_id));

        const payload = jobsMap.get(r.job_id);
        let payloadTeams = "N/A";

        if (payload && payload.match && payload.match.teams) {
            const homeName = payload.match.teams.home?.name || '';
            const awayName = payload.match.teams.away?.name || '';
            payloadTeams = `${homeName} vs ${awayName}`;

            // Name Match
            if (!match && homeName && awayName) {
                // Try to find ANY match in dailyMatches
                const potential = dailyMatches.find(m => {
                    const mHome = m.home_team.toLowerCase();
                    const mAway = m.away_team.toLowerCase();
                    const pHome = homeName.toLowerCase();
                    const pAway = awayName.toLowerCase();

                    return (mHome.includes(pHome) || pHome.includes(mHome)) &&
                        (mAway.includes(pAway) || pAway.includes(mAway));
                });
                if (potential) {
                    match = potential;
                    console.log(`[NAME MATCH] Report for "${payloadTeams}" matched Daily Match "${match.home_team} vs ${match.away_team}"`);
                } else {
                    // Log failure for debugging
                    console.log(`[FAIL] Report "${payloadTeams}" (ID: ${r.fixture_id}) NOT found in today's matches.`);
                }
            }
        }

        if (match) matchedCount++;
    }
    console.log(`Total Matches Found: ${matchedCount}`);
}

check();
