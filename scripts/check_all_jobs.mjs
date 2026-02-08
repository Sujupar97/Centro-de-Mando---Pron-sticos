/**
 * Check the MOST RECENT job and its etl_context
 */

const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.x1icf0Wbkp1xb6h1500HeTvyNykBAAnlqz1udv2AaX4';

async function main() {
    // Get ALL jobs for this fixture
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/analysis_jobs_v2?fixture_id=eq.19427701&select=id,status,etl_context,created_at&order=created_at.desc`,
        {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        }
    );

    const jobs = await res.json();

    console.log('═'.repeat(60));
    console.log(`Found ${jobs.length} jobs for fixture 19427701`);
    console.log('═'.repeat(60));

    jobs.forEach((job, i) => {
        const hasCtx = job.etl_context && Object.keys(job.etl_context).length > 0;
        console.log(`\n[${i}] Job: ${job.id}`);
        console.log(`    Created: ${job.created_at}`);
        console.log(`    Status: ${job.status}`);
        console.log(`    etl_context: ${hasCtx ? 'YES (' + Object.keys(job.etl_context).join(', ') + ')' : 'NO/EMPTY'}`);

        if (hasCtx && job.etl_context.datasets) {
            const ds = job.etl_context.datasets;
            console.log(`    datasets.home_team_last40: ${ds.home_team_last40?.all?.length || 0} matches`);
            if (ds.home_team_last40?.all?.length > 0) {
                const sample = ds.home_team_last40.all[0];
                console.log(`    Sample: ${sample.date} | ${sample.home_team} vs ${sample.away_team}`);
            }
        }
    });
}

main().catch(console.error);
