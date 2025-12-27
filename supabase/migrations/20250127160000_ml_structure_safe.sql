-- ML Estructura Completa (Idempotente)
-- Incluye correcciones de CAST ::NUMERIC para vistas

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

-- 5. TABLA: model_versions
CREATE TABLE IF NOT EXISTS public.model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name TEXT NOT NULL UNIQUE,
  version_description TEXT,
  model_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  traffic_percentage INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. COLUMNA: model_version en predictions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'predictions' AND column_name = 'model_version'
  ) THEN
    ALTER TABLE public.predictions ADD COLUMN model_version TEXT DEFAULT 'v1-stable';
  END IF;
END $$;

-- 7. INSERTAR VERSIONES INICIALES (Idempotente)
INSERT INTO public.model_versions (version_name, version_description, is_active, traffic_percentage)
VALUES 
  ('v1-stable', 'Modelo base de producción', true, 100),
  ('v2-learning', 'Modelo con ajustes ML basados en historial', true, 0)
ON CONFLICT (version_name) DO NOTHING;

-- 8. RLS model_versions
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_model_versions" ON public.model_versions;
CREATE POLICY "allow_all_model_versions" ON public.model_versions FOR ALL USING (true) WITH CHECK (true);

-- 9. FUNCIÓN: find_similar_predictions
CREATE OR REPLACE FUNCTION public.find_similar_predictions(
  query_embedding vector(768),
  match_count INT DEFAULT 10,
  market_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  prediction_id UUID,
  similarity DOUBLE PRECISION,
  was_correct BOOLEAN,
  confidence_error DOUBLE PRECISION,
  context_text TEXT,
  market_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pe.prediction_id,
    (1 - (pe.context_vector <=> query_embedding))::DOUBLE PRECISION as similarity,
    pe.was_correct,
    pe.confidence_error::DOUBLE PRECISION,
    pe.context_text,
    pe.market_type
  FROM public.prediction_embeddings pe
  WHERE 
    (market_filter IS NULL OR pe.market_type = market_filter)
    AND pe.was_correct IS NOT NULL
  ORDER BY pe.context_vector <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 10. VISTA: model_performance_comparison (CORREGIDA)
CREATE OR REPLACE VIEW public.model_performance_comparison AS
SELECT 
  p.model_version,
  COUNT(*)::INT as total_predictions,
  SUM(CASE WHEN pr.was_correct THEN 1 ELSE 0 END)::INT as correct_predictions,
  ROUND((100.0 * SUM(CASE WHEN pr.was_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0))::NUMERIC, 2) as win_rate_pct,
  ROUND(AVG(pr.predicted_probability)::NUMERIC, 2) as avg_confidence,
  ROUND(AVG(ABS(pr.confidence_delta))::NUMERIC, 2) as avg_confidence_error
FROM public.predictions p
JOIN public.predictions_results pr ON pr.prediction_id = p.id
GROUP BY p.model_version;
