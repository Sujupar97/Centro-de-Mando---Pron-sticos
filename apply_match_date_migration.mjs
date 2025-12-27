// Script para aplicar la migration de match_date usando supabase-js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
ALTER TABLE public.analysis_runs 
ADD COLUMN IF NOT EXISTS match_date DATE;

CREATE INDEX IF NOT EXISTS idx_analysis_runs_match_date ON public.analysis_runs(match_date);

UPDATE public.analysis_runs
SET match_date = DATE(created_at AT TIME ZONE 'UTC')
WHERE match_date IS NULL;
`;

console.log('Aplicando migration: add match_date to analysis_runs...');

// Supabase-js doesn't support raw SQL directly, needs RPC or SQL Editor
// Alternative: Use pg client or ask user to run in Dashboard
console.log('\nSQL a ejecutar en SQL Editor del Dashboard de Supabase:\n');
console.log(sql);
console.log('\nPor favor, copia y pega este SQL en: https://supabase.com/dashboard/project/[tu-project]/sql');
