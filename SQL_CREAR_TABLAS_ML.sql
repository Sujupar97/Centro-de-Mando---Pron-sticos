-- =====================================================
-- SISTEMA ML FASE 1: TABLAS DE FEEDBACK
-- =====================================================
-- INSTRUCCIONES: 
-- 1. Ir a https://supabase.com/dashboard/project/nokejmhlpsaoerhddcyc/sql
-- 2. Pegar TODO este contenido
-- 3. Hacer clic en "Run"
-- =====================================================

-- 1. TABLA: predictions_results
CREATE TABLE IF NOT EXISTS public.predictions_results (
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
  verification_source TEXT DEFAULT 'API-Football'
);

-- 2. TABLA: learned_lessons
CREATE TABLE IF NOT EXISTS public.learned_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_result_id UUID,
  failure_category TEXT,
  overvalued_factors TEXT[],
  missing_context TEXT[],
  ideal_confidence FLOAT,
  lesson_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- 3. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_predictions_results_fixture ON public.predictions_results(fixture_id);
CREATE INDEX IF NOT EXISTS idx_predictions_results_correct ON public.predictions_results(was_correct);
CREATE INDEX IF NOT EXISTS idx_predictions_results_verified_at ON public.predictions_results(verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_learned_lessons_category ON public.learned_lessons(failure_category);

-- 4. HABILITAR RLS
ALTER TABLE public.predictions_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learned_lessons ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE ACCESO
DROP POLICY IF EXISTS "allow_all_predictions_results" ON public.predictions_results;
CREATE POLICY "allow_all_predictions_results" ON public.predictions_results FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_learned_lessons" ON public.learned_lessons;
CREATE POLICY "allow_all_learned_lessons" ON public.learned_lessons FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- ✅ LISTO! Las tablas ML están configuradas.
-- =====================================================
