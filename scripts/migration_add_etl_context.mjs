/**
 * MIGRATION: Add etl_context column to analysis_jobs_v2
 * This is the ROOT CAUSE of all data loss issues
 */

const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.x1icf0Wbkp1xb6h1500HeTvyNykBAAnlqz1udv2AaX4';

async function runSQL(sql) {
    const url = `${SUPABASE_URL}/rest/v1/rpc/exec_raw_sql`;

    // Supabase doesn't have a direct SQL endpoint via REST, so we'll use the postgres connection string
    // For now, output instructions to run manually
    console.log('❌ Direct SQL execution not available via REST API');
    console.log('');
    console.log('Please run this SQL in your Supabase SQL Editor:');
    console.log('');
    console.log('═'.repeat(60));
    console.log(sql);
    console.log('═'.repeat(60));
}

async function main() {
    console.log('🔧 MIGRATION: Adding etl_context column to analysis_jobs_v2\n');

    const migration = `
-- Add etl_context column to analysis_jobs_v2
-- This stores all the raw data fetched from SportMonks for debugging and re-runs
ALTER TABLE analysis_jobs_v2 
ADD COLUMN IF NOT EXISTS etl_context JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN analysis_jobs_v2.etl_context IS 'Stores normalized payload from SportMonks API including deep history, H2H, standings, and odds';

-- Grant permissions (if needed)
GRANT SELECT, UPDATE ON analysis_jobs_v2 TO service_role;
`;

    await runSQL(migration);
}

main().catch(console.error);
