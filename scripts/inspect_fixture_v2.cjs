// scripts/inspect_fixture_v2.cjs
const https = require('https');

const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIXTURE_ID = 1379192;

async function fetchTable(table, query) {
  return new Promise((resolve) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
    const req = https.get(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Parse error', raw: data });
        }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
  });
}

async function main() {
  console.log(`=== INSPECTING FIXTURE ${FIXTURE_ID} ===\n`);

  // 1. Check Job Status & Payload
  const jobs = await fetchTable('analysis_jobs_v2', `fixture_id=eq.${FIXTURE_ID}&order=created_at.desc&limit=1`);
  if (jobs.length > 0) {
    const job = jobs[0];
    console.log(`JOB ID: ${job.id}`);
    console.log(`STATUS: ${job.status}`);
    console.log(`COVERAGE: ${job.data_coverage_score}%`);
    // We can't see the payload directly if it's hashed, but we can infer from logs or re-running.
    // But we CAN check value_picks
  } else {
    console.log('❌ No job found for this fixture.');
    return;
  }

  // 2. Check Value Picks (Are odds populated?)
  const picks = await fetchTable('value_picks_v2', `fixture_id=eq.${FIXTURE_ID}`);
  console.log(`\n=== VALUE PICKS (${picks.length}) ===`);
  if (picks.length > 0) {
    // Show first 5
    picks.forEach(p => {
      console.log(`[${p.market}] ${p.selection}`);
      console.log(`   Decision: ${p.decision}`);
      console.log(`   Odds: ${p.odds} | Implied: ${p.p_implied} | Model: ${p.p_model}`);
      console.log(`   Edge: ${p.edge}`);
      console.log(`   Reasons: ${JSON.stringify(p.risk_notes?.reasons || [])}`);
      console.log('---');
    });
  } else {
    console.log('❌ No picks found.');
  }
}

main();
