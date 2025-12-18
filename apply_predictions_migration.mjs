// Temporary script to add RLS policies to Supabase
// Run with: node apply_rls_policies.js

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual env parsing
const envContent = fs.readFileSync('.env', 'utf-8');
const envConfig = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        envConfig[key] = val;
    }
});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
// Try to get service role key from env, fallback to anon key but printed warning
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY (or ANON KEY) environment variable is required');
    console.error('Please set it in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
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
