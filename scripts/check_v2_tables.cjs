// scripts/check_v2_tables.cjs
// Script to check which V2 tables exist in the remote database

const https = require('https');

const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Tables to check
const V2_TABLES = [
    'system_config_v2',
    'analysis_jobs_v2',
    'derived_metrics_v2',
    'market_probs_v2',
    'value_picks_v2',
    'interpretation_v2',
    'reports_v2',
    'pick_results_v2'
];

async function checkTable(tableName) {
    return new Promise((resolve) => {
        const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*&limit=1`;

        const req = https.get(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        }, (res) => {
            if (res.statusCode === 200) {
                resolve({ table: tableName, exists: true, status: res.statusCode });
            } else {
                resolve({ table: tableName, exists: false, status: res.statusCode });
            }
        });

        req.on('error', (e) => {
            resolve({ table: tableName, exists: false, error: e.message });
        });
    });
}

async function main() {
    if (!SUPABASE_KEY) {
        console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
        console.log('Run with: SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/check_v2_tables.cjs');
        process.exit(1);
    }

    console.log('=== V2 Table Status Check ===\n');

    for (const table of V2_TABLES) {
        const result = await checkTable(table);
        const status = result.exists ? '✅ EXISTS' : '❌ MISSING';
        console.log(`${status}: ${table} (HTTP ${result.status || result.error})`);
    }

    console.log('\n=== Done ===');
}

main();
