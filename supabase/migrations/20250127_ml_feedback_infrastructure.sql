-- ============================================================================
-- FASE 1 MACHINE LEARNING: INFRAESTRUCTURA DE FEEDBACK
-- ============================================================================
-- Descripción: Tablas para almacenar resultados verificados de predicciones
--              y permitir aprendizaje continuo del sistema
-- ============================================================================

-- 1. TABLA: predictions_results
-- Almacena la verificación de cada predicción contra el resultado real
CREATE TABLE IF NOT EXISTS public.predictions_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referencias
  prediction_id UUID REFERENCES public.predictions(id) ON DELETE CASCADE,
  analysis_run_id UUID REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  fixture_id INTEGER NOT NULL, -- API-Football fixture ID
  
  -- Predicción Original
  predicted_market TEXT NOT NULL, -- 'Total Goals', '1X2', 'BTTS', etc.
  predicted_outcome TEXT NOT NULL, -- 'Over 2.5', 'Manchester City', 'Sí'
  predicted_probability FLOAT NOT NULL, -- 78, 85, etc.
  predicted_confidence TEXT, -- 'Alta', 'Media', 'Baja'
  
  -- Resultado Real
  actual_outcome TEXT, -- Resultado que ocurrió
  actual_score TEXT, -- '2-1', '0-0', etc.
  
  -- Evaluación
  was_correct BOOLEAN NOT NULL,
  confidence_delta FLOAT, -- Diferencia entre confianza predicha y "ideal" post-facto
  
  -- Metadata
  verified_at TIMESTAMPTZ DEFAULT now(),
  verification_source TEXT DEFAULT 'API-Football',
  
  -- Índices para búsquedas rápidas
  CONSTRAINT unique_prediction_verification UNIQUE(prediction_id)
);

CREATE INDEX idx_predictions_results_fixture ON public.predictions_results(fixture_id);
CREATE INDEX idx_predictions_results_correct ON public.predictions_results(was_correct);
CREATE INDEX idx_predictions_results_verified_at ON public.predictions_results(verified_at DESC);
CREATE INDEX idx_predictions_results_market ON public.predictions_results(predicted_market);

-- 2. TABLA: learned_lessons
-- Almacena análisis post-mortem de predicciones fallidas
CREATE TABLE IF NOT EXISTS public.learned_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referencia
  prediction_result_id UUID REFERENCES public.predictions_results(id) ON DELETE CASCADE,
  
  -- Análisis del Error
  failure_category TEXT, -- 'TACTICAL', 'STATISTICAL', 'REFEREE', 'CONTEXTUAL'
  overvalued_factors TEXT[], -- Factores que sobreestimamos
  missing_context TEXT[], -- Contexto que ignoramos
  ideal_confidence FLOAT, -- Qué confianza debimos haber tenido
  
  -- Lección
  lesson_text TEXT NOT NULL, -- Descrición de qué aprendimos
  lesson_embedding vector(768), -- Para búsqueda semántica (futuro)
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_learned_lessons_category ON public.learned_lessons(failure_category);
CREATE INDEX idx_learned_lessons_created ON public.learned_lessons(created_at DESC);

-- 3. VISTA: prediction_performance_summary
-- Vista para análisis rápido de rendimiento
CREATE OR REPLACE VIEW public.prediction_performance_summary AS
SELECT 
  pr.predicted_market,
  pr.predicted_confidence,
  COUNT(*) as total_predictions,
  SUM(CASE WHEN pr.was_correct THEN 1 ELSE 0 END) as correct_predictions,
  ROUND(
    100.0 * SUM(CASE WHEN pr.was_correct THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as win_rate_pct,
  ROUND(AVG(pr.predicted_probability), 2) as avg_predicted_probability,
  ROUND(AVG(ABS(pr.confidence_delta)), 2) as avg_confidence_error,
  MIN(pr.verified_at) as first_verified,
  MAX(pr.verified_at) as last_verified
FROM public.predictions_results pr
GROUP BY pr.predicted_market, pr.predicted_confidence
ORDER BY total_predictions DESC;

-- 4. RLS Policies
ALTER TABLE public.predictions_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learned_lessons ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a usuarios autenticados
CREATE POLICY "Users can view prediction results"
  ON public.predictions_results
  FOR SELECT
  TO authenticated
  USING (true);

-- Permitir escritura solo al service role (Edge Functions)
CREATE POLICY "Service can manage prediction results"
  ON public.predictions_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view learned lessons"
  ON public.learned_lessons
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service can manage learned lessons"
  ON public.learned_lessons
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. FUNCIÓN: get_win_rate_by_market
-- Helper para obtener win rate por mercado
CREATE OR REPLACE FUNCTION public.get_win_rate_by_market(market_filter TEXT DEFAULT NULL)
RETURNS TABLE (
  market TEXT,
  total_count BIGINT,
  wins BIGINT,
  losses BIGINT,
  win_rate NUMERIC
) 
LANGUAGE sql
STABLE
AS $$
  SELECT 
    predicted_market as market,
    COUNT(*) as total_count,
    SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN NOT was_correct THEN 1 ELSE 0 END) as losses,
    ROUND(
      100.0 * SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) / COUNT(*),
      2
    ) as win_rate
  FROM public.predictions_results
  WHERE market_filter IS NULL OR predicted_market = market_filter
  GROUP BY predicted_market
  ORDER BY total_count DESC;
$$;

COMMENT ON TABLE public.predictions_results IS 'Almacena verificación de predicciones contra resultados reales para ML';
COMMENT ON TABLE public.learned_lessons IS 'Análisis post-mortem de predicciones fallidas para aprendizaje continuo';
