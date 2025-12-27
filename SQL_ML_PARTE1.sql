-- =====================================================
-- ML FASES 2 + 4: SCRIPT CORREGIDO (PARTE 1)
-- =====================================================
-- Ejecutar PRIMERO este script
-- =====================================================

-- 1. HABILITAR EXTENSIÓN PGVECTOR
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABLA: prediction_embeddings
CREATE TABLE IF NOT EXISTS public.prediction_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID,
  prediction_result_id UUID,
  context_vector vector(768),
  context_text TEXT,
  league_name TEXT,
  market_type TEXT,
  was_correct BOOLEAN,
  confidence_error FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_prediction_embeddings_market ON public.prediction_embeddings(market_type);
CREATE INDEX IF NOT EXISTS idx_prediction_embeddings_correct ON public.prediction_embeddings(was_correct);

-- 4. RLS
ALTER TABLE public.prediction_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_prediction_embeddings" ON public.prediction_embeddings;
CREATE POLICY "allow_all_prediction_embeddings" ON public.prediction_embeddings FOR ALL USING (true) WITH CHECK (true);
