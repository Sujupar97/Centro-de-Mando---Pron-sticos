const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.x1icf0Wbkp1xb6h1500HeTvyNykBAAnlqz1udv2AaX4';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function inspect(fixtureId) {
    console.log(`Inspecting report for fixture ${fixtureId}...`);
    const { data: reports } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('fixture_id', fixtureId)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!reports || reports.length === 0) {
        console.log("No report found.");
        return;
    }

    const report = reports[0];
    fs.writeFileSync('debug_report_dump.json', JSON.stringify(report.report_packet, null, 2));
    console.log("Dumped to debug_report_dump.json");
}

const id = process.argv[2];
inspect(id);
