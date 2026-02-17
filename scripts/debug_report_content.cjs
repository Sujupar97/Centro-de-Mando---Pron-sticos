
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://sujupar97.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Fetching last report content...');

    const { data: reports } = await supabase
        .from('reports_v2')
        .select('fixture_id, input_payload, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

    if (reports && reports.length > 0) {
        const r = reports[0];
        const payload = typeof r.input_payload === 'string'
            ? JSON.parse(r.input_payload)
            : r.input_payload;

        const match = payload?.match || {};

        console.log('--- Report ID: ' + r.fixture_id + ' ---');
        console.log('Match Title:', `${match.teams?.home?.name} vs ${match.teams?.away?.name}`);
        console.log('Match Date:', match.date_time);
        console.log('League:', match.competition?.name);
    } else {
        console.log("No reports found.");
    }
}

check();
