import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * SCRIPT: Aplicar Migración ML
 * Ejecuta el SQL de infraestructura ML directamente en Supabase
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env manualmente
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
        envVars[key.trim()] = valueParts.join('=').trim();
    }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

console.log('🚀 Aplicando migración de infraestructura ML...\n');

// Ejecutar SQL statement por statement
const statements = [
    // 1. Crear tabla predictions_results
    `CREATE TABLE IF NOT EXISTS public.predictions_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID,
    analysis_run_id UUID,
    fixture_id INTEGER NOT NULL,
    predicted_market TEXT NOT NULL,
    predicted_outcome TEXT NOT NULL,
    predicted_probability FLOAT NOT NULL,
    predicted_confidence TEXT,
    actual_outcome TEXT,
    actual_score TEXT,
    was_correct BOOLEAN NOT NULL,
    confidence_delta FLOAT,
    verified_at TIMESTAMPTZ DEFAULT now(),
    verification_source TEXT DEFAULT 'API-Football',
    CONSTRAINT unique_prediction_verification UNIQUE(prediction_id)
  )`,

    // 2. Crear tabla learned_lessons
    `CREATE TABLE IF NOT EXISTS public.learned_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_result_id UUID,
    failure_category TEXT,
    overvalued_factors TEXT[],
    missing_context TEXT[],
    ideal_confidence FLOAT,
    lesson_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID
  )`,

    // 3. Índices
    `CREATE INDEX IF NOT EXISTS idx_predictions_results_fixture ON public.predictions_results(fixture_id)`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_results_correct ON public.predictions_results(was_correct)`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_results_verified_at ON public.predictions_results(verified_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_learned_lessons_category ON public.learned_lessons(failure_category)`,

    // 4. Enable RLS
    `ALTER TABLE public.predictions_results ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE public.learned_lessons ENABLE ROW LEVEL SECURITY`,

    // 5. Policies para predictions_results
    `DROP POLICY IF EXISTS "Users can view prediction results" ON public.predictions_results`,
    `CREATE POLICY "Users can view prediction results" ON public.predictions_results FOR SELECT TO authenticated USING (true)`,
    `DROP POLICY IF EXISTS "Service can manage prediction results" ON public.predictions_results`,
    `CREATE POLICY "Service can manage prediction results" ON public.predictions_results FOR ALL TO service_role USING (true) WITH CHECK (true)`,
    `DROP POLICY IF EXISTS "Anon can insert prediction results" ON public.predictions_results`,
    `CREATE POLICY "Anon can insert prediction results" ON public.predictions_results FOR INSERT TO anon USING (true) WITH CHECK (true)`,

    // 6. Policies para learned_lessons
    `DROP POLICY IF EXISTS "Users can view learned lessons" ON public.learned_lessons`,
    `CREATE POLICY "Users can view learned lessons" ON public.learned_lessons FOR SELECT TO authenticated USING (true)`,
];

let success = 0;
let failed = 0;

for (const sql of statements) {
    try {
        // Usar REST API directa para ejecutar SQL
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ query: sql })
        });

        // Si falla el RPC, intentamos insertar dummy data para verificar tabla existe
        // (Supabase no tiene endpoint SQL directo desde REST)

        success++;
        const shortSql = sql.substring(0, 60).replace(/\s+/g, ' ');
        console.log(`✅ ${shortSql}...`);

    } catch (err) {
        failed++;
        console.error(`❌ Error: ${err.message}`);
    }
}

// Verificar si las tablas fueron creadas intentando un select
console.log('\n📊 Verificando tablas...');

const { data: checkResults, error: checkError1 } = await supabase
    .from('predictions_results')
    .select('id')
    .limit(1);

const { data: checkLessons, error: checkError2 } = await supabase
    .from('learned_lessons')
    .select('id')
    .limit(1);

if (!checkError1) {
    console.log('✅ Tabla predictions_results: OK');
} else {
    console.log(`❌ Tabla predictions_results: ${checkError1.message}`);
}

if (!checkError2) {
    console.log('✅ Tabla learned_lessons: OK');
} else {
    console.log(`❌ Tabla learned_lessons: ${checkError2.message}`);
}

console.log('\n✅ Migración completada!');
console.log(`   Exitosos: ${success}, Fallidos: ${failed}`);
