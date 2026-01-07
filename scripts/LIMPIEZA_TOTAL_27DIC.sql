-- FASE 4: LIMPIEZA TOTAL - Script SQL
-- ⚠️  ESTE SCRIPT BORRA TODOS LOS DATOS DEL 27/12/2025 EN ADELANTE
-- Ejecutar en Supabase Dashboard → SQL Editor

-- ════════════════════════════════════════════════════════════
-- PASO 1: Backup (opcional pero recomendado)
-- ════════════════════════════════════════════════════════════

-- Crear tabla de backup de predictions_results
CREATE TABLE IF NOT EXISTS predictions_results_backup_20260103 AS
SELECT * FROM predictions_results
WHERE verified_at >= '2025-12-27 00:00:00';

-- Crear tabla de backup de predictions
CREATE TABLE IF NOT EXISTS predictions_backup_20260103 AS
SELECT * FROM predictions
WHERE result_verified_at >= '2025-12-27 00:00:00';

-- Verificar backups
SELECT 
    'predictions_results_backup' as table_name,
    COUNT(*) as backed_up_records
FROM predictions_results_backup_20260103
UNION ALL
SELECT 
    'predictions_backup' as table_name,
    COUNT(*) as backed_up_records
FROM predictions_backup_20260103;

-- ════════════════════════════════════════════════════════════
-- PASO 2: LIMPIEZA - predictions_results
-- ════════════════════════════════════════════════════════════

-- Ver cuántos registros se eliminarán
SELECT 
    COUNT(*) as registros_a_eliminar,
    verification_source,
    MIN(verified_at) as fecha_mas_antigua,
    MAX(verified_at) as fecha_mas_reciente
FROM predictions_results
WHERE verified_at >= '2025-12-27 00:00:00'
GROUP BY verification_source;

-- ELIMINAR (descomentar cuando estés listo)
-- DELETE FROM predictions_results 
-- WHERE verified_at >= '2025-12-27 00:00:00';

-- ════════════════════════════════════════════════════════════
-- PASO 3: RESETEAR - predictions
-- ════════════════════════════════════════════════════════════

-- Ver cuántas predicciones se resetearán
SELECT 
    COUNT(*) as predicciones_a_resetear,
    COUNT(CASE WHEN is_won = true THEN 1 END) as ganadas,
    COUNT(CASE WHEN is_won = false THEN 1 END) as perdidas
FROM predictions
WHERE result_verified_at >= '2025-12-27 00:00:00';

-- RESETEAR (descomentar cuando estés listo)
-- UPDATE predictions 
-- SET 
--     is_won = NULL,
--     result_verified_at = NULL,
--     verification_status = NULL
-- WHERE result_verified_at >= '2025-12-27 00:00:00';

-- ════════════════════════════════════════════════════════════
-- PASO 4: LIMPIAR - learned_lessons (si existen)
-- ════════════════════════════════════════════════════════════

-- Ver cuántas lecciones se eliminarán
SELECT COUNT(*) as lecciones_a_eliminar
FROM learned_lessons
WHERE created_at >= '2025-12-27 00:00:00';

-- ELIMINAR (descomentar cuando estés listo)
-- DELETE FROM learned_lessons 
-- WHERE created_at >= '2025-12-27 00:00:00';

-- ════════════════════════════════════════════════════════════
-- PASO 5: LIMPIAR - prediction_embeddings (si existen)
-- ════════════════════════════════════════════════════════════

-- Ver cuántos embeddings se eliminarán
SELECT COUNT(*) as embeddings_a_eliminar
FROM prediction_embeddings
WHERE created_at >= '2025-12-27 00:00:00';

-- ELIMINAR (descomentar cuando estés listo)
-- DELETE FROM prediction_embeddings 
-- WHERE created_at >= '2025-12-27 00:00:00';

-- ════════════════════════════════════════════════════════════
-- PASO 6: VALIDAR LIMPIEZA
-- ════════════════════════════════════════════════════════════

-- Verificar que predictions_results esté vacía desde 27/12
SELECT COUNT(*) as registros_restantes
FROM predictions_results
WHERE verified_at >= '2025-12-27 00:00:00';
-- Esperado: 0

-- Verificar predicciones reseteadas
SELECT 
    COUNT(*) as total_predicciones,
    COUNT(CASE WHEN is_won IS NULL THEN 1 END) as pendientes,
    COUNT(CASE WHEN is_won IS NOT NULL THEN 1 END) as verificadas
FROM predictions
WHERE created_at >= '2025-12-27 00:00:00';
-- Esperado: todas pendientes (is_won = NULL)

-- ════════════════════════════════════════════════════════════
-- RESUMEN FINAL
-- ════════════════════════════════════════════════════════════

SELECT 
    'predictions_results' as tabla,
    COUNT(*) as registros_desde_27dic
FROM predictions_results
WHERE verified_at >= '2025-12-27 00:00:00'
UNION ALL
SELECT 
    'predictions (verificadas)' as tabla,
    COUNT(*) as registros_desde_27dic
FROM predictions
WHERE result_verified_at >= '2025-12-27 00:00:00'
UNION ALL
SELECT 
    'learned_lessons' as tabla,
    COUNT(*) as registros_desde_27dic
FROM learned_lessons
WHERE created_at >= '2025-12-27 00:00:00'
UNION ALL
SELECT 
    'prediction_embeddings' as tabla,
    COUNT(*) as registros_desde_27dic
FROM prediction_embeddings
WHERE created_at >= '2025-12-27 00:00:00';

-- ════════════════════════════════════════════════════════════
-- INSTRUCCIONES
-- ════════════════════════════════════════════════════════════
--
-- 1. Ejecuta PASO 1 (Backup) - OBLIGATORIO
-- 2. Ejecuta consultas SELECT de cada paso para ver qué se eliminará
-- 3. Descomenta los DELETE/UPDATE uno por uno
-- 4. Ejecuta PASO 6 (Validar) para confirmar limpieza
--
-- IMPORTANTE: Guarda este script antes de ejecutar
-- ════════════════════════════════════════════════════════════
