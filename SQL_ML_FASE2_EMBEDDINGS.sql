-- =====================================================
-- ML FASE 2: EMBEDDINGS Y MEMORIA VECTORIAL
-- =====================================================
-- INSTRUCCIONES: 
-- 1. Ir a https://supabase.com/dashboard/project/nokejmhlpsaoerhddcyc/sql
-- 2. Pegar TODO este contenido
-- 3. Hacer clic en "Run"
-- =====================================================

-- 1. HABILITAR EXTENSIÓN PGVECTOR
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABLA: prediction_embeddings
-- Almacena vectores de contexto de cada predicción para búsqueda de similares
CREATE TABLE IF NOT EXISTS public.prediction_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referencia a predicción
  prediction_id UUID REFERENCES public.predictions(id) ON DELETE CASCADE,
  prediction_result_id UUID REFERENCES public.predictions_results(id) ON DELETE CASCADE,
  
  -- Vector de embedding (768 dimensiones - Gemini embedding-001)
  context_vector vector(768),
  
  -- Contexto textual (para debug)
  context_text TEXT,
  
  -- Metadatos para filtrar búsquedas
  league_name TEXT,
  market_type TEXT, -- '1X2', 'BTTS', 'Total Goals', etc.
  
  -- Resultado (denormalizado para queries rápidas)
  was_correct BOOLEAN,
  confidence_error FLOAT, -- Abs(predicted_prob - ideal)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ÍNDICE VECTORIAL (IVFFlat para búsquedas rápidas de cosine similarity)
-- Nota: IVFFlat requiere al menos 100 filas para ser eficiente
-- Para datasets pequeños, usaremos exact search primero
CREATE INDEX IF NOT EXISTS idx_prediction_embeddings_vector 
ON public.prediction_embeddings 
USING ivfflat (context_vector vector_cosine_ops)
WITH (lists = 100);

-- 4. ÍNDICES ADICIONALES
CREATE INDEX IF NOT EXISTS idx_prediction_embeddings_market ON public.prediction_embeddings(market_type);
CREATE INDEX IF NOT EXISTS idx_prediction_embeddings_correct ON public.prediction_embeddings(was_correct);
CREATE INDEX IF NOT EXISTS idx_prediction_embeddings_league ON public.prediction_embeddings(league_name);

-- 5. RLS
ALTER TABLE public.prediction_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_prediction_embeddings" ON public.prediction_embeddings;
CREATE POLICY "allow_all_prediction_embeddings" ON public.prediction_embeddings 
FOR ALL USING (true) WITH CHECK (true);

-- 6. FUNCIÓN: find_similar_predictions
-- Busca predicciones similares usando similaridad coseno
CREATE OR REPLACE FUNCTION public.find_similar_predictions(
  query_embedding vector(768),
  match_count INT DEFAULT 10,
  market_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  prediction_id UUID,
  similarity FLOAT,
  was_correct BOOLEAN,
  confidence_error FLOAT,
  context_text TEXT,
  market_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pe.prediction_id,
    1 - (pe.context_vector <=> query_embedding) as similarity,
    pe.was_correct,
    pe.confidence_error,
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

-- 7. FUNCIÓN: calculate_historical_accuracy
-- Calcula el accuracy histórico para un conjunto de predicciones similares
CREATE OR REPLACE FUNCTION public.calculate_historical_accuracy(
  query_embedding vector(768),
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  total_similar INT,
  correct_count INT,
  accuracy_pct FLOAT,
  avg_confidence_error FLOAT,
  recommendation TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INT;
  v_correct INT;
  v_accuracy FLOAT;
  v_avg_error FLOAT;
  v_recommendation TEXT;
BEGIN
  -- Obtener estadísticas de predicciones similares
  SELECT 
    COUNT(*)::INT,
    SUM(CASE WHEN pe.was_correct THEN 1 ELSE 0 END)::INT,
    ROUND(100.0 * SUM(CASE WHEN pe.was_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2),
    ROUND(AVG(pe.confidence_error), 2)
  INTO v_total, v_correct, v_accuracy, v_avg_error
  FROM public.prediction_embeddings pe
  WHERE pe.was_correct IS NOT NULL
  ORDER BY pe.context_vector <=> query_embedding
  LIMIT match_count;
  
  -- Generar recomendación
  IF v_accuracy >= 70 THEN
    v_recommendation := 'HIGH_CONFIDENCE: Historical accuracy supports prediction';
  ELSIF v_accuracy >= 50 THEN
    v_recommendation := 'MEDIUM_CONFIDENCE: Mixed historical results, proceed with caution';
  ELSE
    v_recommendation := 'LOW_CONFIDENCE: Poor historical accuracy, consider reducing confidence';
  END IF;
  
  RETURN QUERY SELECT v_total, v_correct, v_accuracy, v_avg_error, v_recommendation;
END;
$$;

-- =====================================================
-- ✅ FASE 2 COMPLETADA: Embeddings y Memoria Vectorial
-- =====================================================
