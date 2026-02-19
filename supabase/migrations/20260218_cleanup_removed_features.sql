-- ============================================================
-- MIGRACIÓN: Limpieza de funcionalidades eliminadas del MVP
-- Fecha: 2026-02-18
-- Descripción: Elimina tablas, funciones y configuraciones
--   asociadas a funcionalidades removidas en la simplificación
--   del MVP (apuestas manuales, ML, ticket scanner, settings).
--
-- INSTRUCCIONES:
--   1. Verificar que la app funciona correctamente en producción
--      durante al menos 1 semana sin estas funcionalidades.
--   2. Descomentariar las sentencias y ejecutar manualmente.
--   3. Hacer backup de la DB antes de ejecutar.
-- ============================================================

-- =====================
-- 1. APUESTAS MANUALES
-- =====================
-- DROP FUNCTION IF EXISTS create_bet_with_legs(jsonb);
-- DROP TABLE IF EXISTS bet_legs CASCADE;
-- DROP TABLE IF EXISTS bets CASCADE;

-- =====================
-- 2. ML / AUTO-LEARNING
-- =====================
-- DROP TABLE IF EXISTS learned_lessons CASCADE;
-- DROP TABLE IF EXISTS model_stats CASCADE;
-- DROP TABLE IF EXISTS model_versions CASCADE;

-- =====================
-- 3. TICKET SCANNER
-- =====================
-- La Edge Function scan-ticket ya fue eliminada del código.
-- Si existe un bucket de storage para tickets escaneados:
-- DELETE FROM storage.objects WHERE bucket_id = 'scanned-tickets';
-- DELETE FROM storage.buckets WHERE id = 'scanned-tickets';

-- =====================
-- 4. SYSTEM SETTINGS (entradas obsoletas)
-- =====================
-- DELETE FROM system_settings WHERE key IN (
--     'auto_learning_enabled',
--     'verification_v2_enabled'
-- );

-- =====================
-- 5. CONFIGURACIÓN INICIAL (capital/bankroll)
-- =====================
-- Si existe una tabla settings separada para capital inicial:
-- DROP TABLE IF EXISTS user_settings CASCADE;

-- =====================
-- 6. CRON JOBS DE ML (si existen)
-- =====================
-- SELECT cron.unschedule('ml-daily-training');
-- SELECT cron.unschedule('ml-feedback-collection');

-- =====================
-- NOTAS:
-- - Las tablas de predicciones (predictions, analysis_runs, etc.)
--   NO se eliminan porque siguen siendo parte del pipeline activo.
-- - Las tablas de parlays NO se eliminan (sistema activo).
-- - Las tablas de suscripciones/organizaciones NO se eliminan (SaaS core).
-- =====================
