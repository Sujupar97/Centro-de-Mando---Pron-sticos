-- Migración: Agregar tracking de versión del modelo a predictions
-- Fecha: 2026-01-03
-- Propósito: Diferenciar predicciones de v1-stable vs v2-learning

-- PASO 1: Agregar columna model_version
ALTER TABLE predictions 
ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) DEFAULT NULL;

-- PASO 2: Comentario en la columna
COMMENT ON COLUMN predictions.model_version IS 
'Versión del modelo ML que generó la predicción: v1-stable (sin ML), v2-learning (con ML), null (antes de A/B testing)';

-- PASO 3: Crear índice para queries rápidas
CREATE INDEX IF NOT EXISTS idx_predictions_model_version 
ON predictions(model_version) 
WHERE model_version IS NOT NULL;

-- PASO 4: Verificar que se creó correctamente
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'predictions' 
AND column_name = 'model_version';

-- PASO 5: Verificar índice
SELECT 
    indexname, 
    indexdef
FROM pg_indexes
WHERE tablename = 'predictions' 
AND indexname = 'idx_predictions_model_version';

-- PASO 6: Ver distribución actual (debería ser todo NULL por ahora)
SELECT 
    model_version,
    COUNT(*) as total,
    COUNT(CASE WHEN is_won IS NOT NULL THEN 1 END) as verificadas
FROM predictions
GROUP BY model_version
ORDER BY model_version;
