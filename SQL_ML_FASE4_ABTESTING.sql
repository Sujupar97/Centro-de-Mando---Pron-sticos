-- =====================================================
-- ML FASE 4: A/B TESTING Y VERSIONADO DE MODELOS
-- =====================================================
-- INSTRUCCIONES: 
-- 1. Ir a https://supabase.com/dashboard/project/nokejmhlpsaoerhddcyc/sql
-- 2. Pegar TODO este contenido
-- 3. Hacer clic en "Run"
-- =====================================================

-- 1. TABLA: model_versions
-- Registra las versiones del modelo de análisis
CREATE TABLE IF NOT EXISTS public.model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificador de versión
  version_name TEXT NOT NULL UNIQUE, -- 'v1-stable', 'v2-learning', etc.
  version_description TEXT,
  
  -- Configuración del modelo
  model_config JSONB DEFAULT '{}', -- Parámetros de temperatura, prompt, etc.
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  traffic_percentage INT DEFAULT 0, -- % de predicciones que van a esta versión
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. COLUMNA: model_version en predictions
-- Añadir columna para trackear qué versión generó cada predicción
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'predictions' AND column_name = 'model_version'
  ) THEN
    ALTER TABLE public.predictions ADD COLUMN model_version TEXT DEFAULT 'v1-stable';
  END IF;
END $$;

-- 3. VISTA: model_performance_comparison
-- Compara rendimiento entre versiones
CREATE OR REPLACE VIEW public.model_performance_comparison AS
SELECT 
  p.model_version,
  COUNT(*) as total_predictions,
  SUM(CASE WHEN pr.was_correct THEN 1 ELSE 0 END) as correct_predictions,
  ROUND(
    100.0 * SUM(CASE WHEN pr.was_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    2
  ) as win_rate_pct,
  ROUND(AVG(pr.predicted_probability), 2) as avg_confidence,
  ROUND(AVG(ABS(pr.confidence_delta)), 2) as avg_confidence_error,
  MIN(pr.verified_at) as first_verified,
  MAX(pr.verified_at) as last_verified
FROM public.predictions p
JOIN public.predictions_results pr ON pr.prediction_id = p.id
GROUP BY p.model_version
ORDER BY win_rate_pct DESC;

-- 4. FUNCIÓN: get_ab_test_results
-- Obtiene resultados de A/B test entre dos versiones
CREATE OR REPLACE FUNCTION public.get_ab_test_results(
  version_a TEXT DEFAULT 'v1-stable',
  version_b TEXT DEFAULT 'v2-learning',
  min_sample_size INT DEFAULT 30
)
RETURNS TABLE (
  version_name TEXT,
  sample_size BIGINT,
  win_rate NUMERIC,
  avg_confidence NUMERIC,
  avg_error NUMERIC,
  is_significant BOOLEAN,
  recommendation TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_a_winrate NUMERIC;
  v_b_winrate NUMERIC;
  v_a_count BIGINT;
  v_b_count BIGINT;
  v_significant BOOLEAN;
  v_recommendation TEXT;
BEGIN
  -- Obtener stats de versión A
  SELECT 
    COUNT(*),
    ROUND(100.0 * SUM(CASE WHEN pr.was_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2)
  INTO v_a_count, v_a_winrate
  FROM public.predictions p
  JOIN public.predictions_results pr ON pr.prediction_id = p.id
  WHERE p.model_version = version_a;
  
  -- Obtener stats de versión B
  SELECT 
    COUNT(*),
    ROUND(100.0 * SUM(CASE WHEN pr.was_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2)
  INTO v_b_count, v_b_winrate
  FROM public.predictions p
  JOIN public.predictions_results pr ON pr.prediction_id = p.id
  WHERE p.model_version = version_b;
  
  -- Determinar significancia estadística (simplificado)
  v_significant := (v_a_count >= min_sample_size AND v_b_count >= min_sample_size);
  
  -- Generar recomendación
  IF NOT v_significant THEN
    v_recommendation := 'INSUFFICIENT_DATA: Need more samples for conclusive results';
  ELSIF v_b_winrate > v_a_winrate + 5 THEN
    v_recommendation := 'PROMOTE_B: Version B shows significant improvement';
  ELSIF v_a_winrate > v_b_winrate + 5 THEN
    v_recommendation := 'KEEP_A: Version A is still better';
  ELSE
    v_recommendation := 'NO_DIFFERENCE: Versions perform similarly';
  END IF;
  
  -- Retornar resultados
  RETURN QUERY
  SELECT version_a, v_a_count, v_a_winrate, 
    (SELECT ROUND(AVG(pr.predicted_probability), 2) FROM predictions p JOIN predictions_results pr ON pr.prediction_id = p.id WHERE p.model_version = version_a),
    (SELECT ROUND(AVG(ABS(pr.confidence_delta)), 2) FROM predictions p JOIN predictions_results pr ON pr.prediction_id = p.id WHERE p.model_version = version_a),
    v_significant,
    v_recommendation
  UNION ALL
  SELECT version_b, v_b_count, v_b_winrate,
    (SELECT ROUND(AVG(pr.predicted_probability), 2) FROM predictions p JOIN predictions_results pr ON pr.prediction_id = p.id WHERE p.model_version = version_b),
    (SELECT ROUND(AVG(ABS(pr.confidence_delta)), 2) FROM predictions p JOIN predictions_results pr ON pr.prediction_id = p.id WHERE p.model_version = version_b),
    v_significant,
    v_recommendation;
END;
$$;

-- 5. INSERTAR VERSIONES INICIALES
INSERT INTO public.model_versions (version_name, version_description, is_active, traffic_percentage)
VALUES 
  ('v1-stable', 'Modelo base de producción', true, 100),
  ('v2-learning', 'Modelo con ajustes de confianza basados en historial', true, 0)
ON CONFLICT (version_name) DO NOTHING;

-- 6. RLS
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_model_versions" ON public.model_versions;
CREATE POLICY "allow_all_model_versions" ON public.model_versions 
FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- ✅ FASE 4 COMPLETADA: A/B Testing y Versionado
-- =====================================================
