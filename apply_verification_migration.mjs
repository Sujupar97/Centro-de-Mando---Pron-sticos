
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Credentials missing.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const sql = `
-- Modify analysis_runs to store post-mortem
ALTER TABLE IF EXISTS public.analysis_runs 
ADD COLUMN IF NOT EXISTS post_match_analysis TEXT,
ADD COLUMN IF NOT EXISTS actual_outcome JSONB;

-- Modify predictions to store verification status
ALTER TABLE IF EXISTS public.predictions
ADD COLUMN IF NOT EXISTS is_won BOOLEAN,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS result_verified_at TIMESTAMP WITH TIME ZONE;

-- Ensure RLS allows update if needed (though usually service role bypasses)
`;

console.log('Executing Verification Migration...');

// Try rpc exec_sql
const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

if (error) {
    console.error('Error executing SQL via RPC:', error);
    console.log('Attempting direct fallback if possible (usually not via JS client without Service Key on table access)');
    // If table mod fails via RPC, we might be stuck unless we have the service key.
} else {
    console.log('✅ Verification columns added successfully!');
}
