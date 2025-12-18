// Temporary script to add RLS policies to Supabase
// Run with: node apply_rls_policies.js

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    console.error('Please set it with: export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const sql = `
-- Policy for analysis_runs (reading analysis results)
DROP POLICY IF EXISTS "Auth users view analysis runs" ON public.analysis_runs;
CREATE POLICY "Auth users view analysis runs" 
    ON public.analysis_runs 
    FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Policy for analisis (reading cached analysis)
DROP POLICY IF EXISTS "Auth users view analysis cache" ON public.analisis;
CREATE POLICY "Auth users view analysis cache" 
    ON public.analisis 
    FOR SELECT 
    USING (auth.role() = 'authenticated');
`;

console.log('Executing RLS policies...');

const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

if (error) {
    console.error('Error executing SQL:', error);
    process.exit(1);
}

console.log('✅ RLS policies added successfully!');
console.log('Analysis tables are now accessible to authenticated users.');
