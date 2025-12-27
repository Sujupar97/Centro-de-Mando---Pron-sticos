-- =====================================================
-- ML CRON JOBS: Automatización del Sistema de Aprendizaje
-- =====================================================
-- INSTRUCCIONES:
-- 1. Ir a https://supabase.com/dashboard/project/nokejmhlpsaoerhddcyc/sql
-- 2. Primero habilitar pg_cron si no está habilitado
-- 3. Ejecutar este script
-- =====================================================

-- HABILITAR EXTENSIÓN PG_CRON (ya debería estar habilitada en Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- HABILITAR EXTENSIÓN PG_NET (para llamadas HTTP)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- CRON JOB 1: Verificar Resultados de Predicciones
-- Se ejecuta cada día a las 3:00 AM UTC (10:00 PM COL)
-- =====================================================
SELECT cron.schedule(
  'ml-sync-results-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/sync-results',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- =====================================================
-- CRON JOB 2: Analizar Predicciones Fallidas (Post-Mortem)
-- Se ejecuta cada día a las 4:00 AM UTC (11:00 PM COL)
-- =====================================================
SELECT cron.schedule(
  'ml-analyze-failures-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/analyze-failures',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- =====================================================
-- VER CRON JOBS PROGRAMADOS
-- =====================================================
-- SELECT * FROM cron.job;

-- =====================================================
-- PARA ELIMINAR UN CRON JOB (si es necesario):
-- SELECT cron.unschedule('ml-sync-results-daily');
-- SELECT cron.unschedule('ml-analyze-failures-daily');
-- =====================================================

-- =====================================================
-- ALTERNATIVA: Usar el Dashboard de Supabase
-- =====================================================
-- Si pg_cron no está disponible o da errores, puedes configurar
-- los cron jobs manualmente en:
-- Dashboard > Database > Cron Jobs > New Job
--
-- Job 1: "ML Sync Results"
--   Schedule: 0 3 * * * (3 AM UTC daily)
--   Command: SELECT net.http_post('https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/sync-results', ...);
--
-- Job 2: "ML Analyze Failures"  
--   Schedule: 0 4 * * * (4 AM UTC daily)
--   Command: SELECT net.http_post('https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/analyze-failures', ...);
-- =====================================================
