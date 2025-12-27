-- =====================================================
-- ML FASES 2 + 4: SCRIPT CORREGIDO (PARTE 3)
-- =====================================================
-- Ejecutar DESPUÉS de las Partes 1 y 2
-- NOTA: Esta parte contiene funciones y vistas
-- =====================================================

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

-- 10. VISTA: model_performance_comparison (con CAST corregido)
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

-- =====================================================
-- ✅ LISTO: Fases 2 y 4 completadas
-- =====================================================
