/**
 * Get actual schema of analysis_jobs_v2
 */
const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.x1icf0Wbkp1xb6h1500HeTvyNykBAAnlqz1udv2AaX4';

async function main() {
    // Get one row to see available columns
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/analysis_jobs_v2?limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await res.json();

    if (data && data.length > 0) {
        console.log('Available columns in analysis_jobs_v2:');
        console.log(Object.keys(data[0]).sort().join('\n'));
    }
}

main().catch(console.error);
