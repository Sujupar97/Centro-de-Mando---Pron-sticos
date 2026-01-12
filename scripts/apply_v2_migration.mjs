// Aplicar migración V2
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
    'https://nokejmhlpsaoerhddcyc.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.QxIvR1KJThkZZMVG87m2fHWPPzXGBt3x1IbhJQh2lp8'
);

const sql = readFileSync('./supabase/migrations/20260112_engine_v2_schema.sql', 'utf-8');

// Split by statements (basic)
const statements = sql
    .split(/;\s*$/m)
    .filter(s => s.trim().length > 0 && !s.trim().startsWith('--'));

console.log(`Executing ${statements.length} statements...`);

let success = 0;
let failed = 0;

for (const stmt of statements) {
    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });
        if (error) throw error;
        success++;
        process.stdout.write('.');
    } catch (e) {
        // Try direct query
        try {
            await supabase.from('_exec').select('*'); // This will fail but test connection
        } catch { }
        failed++;
        // console.error('\nFailed:', stmt.substring(0, 50), e.message);
    }
}

console.log(`\n\nDone: ${success} success, ${failed} need manual apply`);
console.log('\nIf failed > 0, run the SQL directly in Supabase Dashboard > SQL Editor');
