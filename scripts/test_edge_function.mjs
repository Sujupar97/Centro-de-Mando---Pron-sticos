/**
 * Direct Edge Function test with full error capture
 */
const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.x1icf0Wbkp1xb6h1500HeTvyNykBAAnlqz1udv2AaX4';

// Test fixture - use the one that worked (Atalanta vs Juventus = 19618104)
const FIXTURE_ID = process.argv[2] || 19618104;

async function main() {
    console.log(`\n🧪 TESTING v2-create-job-sportmonks for fixture ${FIXTURE_ID}\n`);

    const url = `${SUPABASE_URL}/functions/v1/v2-create-job-sportmonks`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({ fixture_id: FIXTURE_ID })
        });

        console.log(`Status: ${res.status} ${res.statusText}`);

        const text = await res.text();

        try {
            const json = JSON.parse(text);
            console.log('\nResponse:');
            console.log(JSON.stringify(json, null, 2));
        } catch {
            console.log('\nRaw Response:');
            console.log(text);
        }
    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

main();
