
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchReportText() {
    console.log("Searching reports_v2 for 'Panserraikos'...");

    // Search text in JSONB column
    const { data: reports, error } = await supabase
        .from('reports_v2')
        .select('id, job_id, fixture_id, created_at, report_packet')
        .textSearch('report_packet', "'Panserraikos'", { config: 'english' })
        .limit(5);

    if (error) {
        // Fallback to ilike if textSearch fails or isn't indexed
        console.error("TextSearch Error (trying ilike):", error.message);

        // Note: casting directly in JS logic if needed, but let's try strict ILIKE on cast
        // report_packet is usually jsonb, so we need to cast to text
        const { data: reports2, error: e2 } = await supabase
            .from('reports_v2')
            .select('id, job_id, fixture_id, created_at')
            // .ilike('report_packet::text', '%Panserraikos%') // Supabase JS doesn't support casting easily in filter helpers
            // We can use a different approach: fetch recent reports and filter in JS? (Expensive but safer)
            .order('created_at', { ascending: false })
            .limit(100);

        if (e2) {
            console.error("Fallback Fetch Error:", e2);
            return;
        }

        console.log(` fetched ${reports2.length} recent reports. Filtering locally...`);
        const found = [];
        // Need to fetch content for filtering?
        // We selected only metadata. 
        // Let's try raw SQL query via RPC? No, security.

        // Let's just fetch recent reports WITH content (limit 20)
        const { data: recent, error: e3 } = await supabase
            .from('reports_v2')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (recent) {
            recent.forEach(r => {
                const str = JSON.stringify(r.report_packet);
                if (str.toLowerCase().includes('panserraikos') || str.toLowerCase().includes('aek')) {
                    console.log(`FOUND Report ${r.id}!`);
                    console.log(`- Job: ${r.job_id}`);
                    console.log(`- Fixture: ${r.fixture_id}`);
                    console.log(`- Created: ${r.created_at}`);
                }
            });
        }
        return;
    }

    // Standard textsearch path
    if (!reports || reports.length === 0) {
        console.log("No reports found with text search.");
        return;
    }

    console.log(`Found ${reports.length} reports.`);
    reports.forEach(r => {
        console.log(`Report ${r.id}: Fixture ${r.fixture_id}, Created ${r.created_at}`);
    });
}

searchReportText();
