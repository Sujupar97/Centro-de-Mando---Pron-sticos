-- =====================================================
-- CRON JOBS COMPLETOS PARA AUTOMATIZACIÓN DIARIA
-- Sistema de análisis y parlays automáticos
-- Zona horaria: Colombia (UTC-5)
-- =====================================================

-- =====================================================
-- PASO 1: Eliminar cron jobs anteriores (si existen)
-- =====================================================
SELECT cron.unschedule('daily-match-scanner');
SELECT cron.unschedule('daily-analysis-generator');
SELECT cron.unschedule('daily-parlay-generator');
SELECT cron.unschedule('daily-results-verifier');

-- =====================================================
-- PASO 2: Configurar nuevos cron jobs
-- =====================================================

-- 1. SCANNER DE PARTIDOS - 1:00 AM Colombia (6:00 AM UTC)
-- Ejecuta UNA VEZ al día para escanear partidos del día siguiente
SELECT cron.schedule(
    'daily-match-scanner',
    '0 6 * * *',  -- 6:00 AM UTC = 1:00 AM Colombia
    $$
    SELECT
      net.http_post(
          url:='https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/daily-match-scanner',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.cMBnVvWGmxyTBqLqQQtPcymKdXMqF0Xr1_EI_Y1G3ZU"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);

-- 2. ANALIZADOR DE PARTIDOS - Cada 5 minutos entre 2:00-3:55 AM Colombia (7:00-8:55 AM UTC)
-- Procesa 3 partidos por ejecución hasta completar todos
SELECT cron.schedule(
    'daily-analysis-generator',
    '*/5 7-8 * * *',  -- Cada 5 minutos entre 7:00-8:59 AM UTC (2:00-3:59 AM Colombia)
    $$
    SELECT
      net.http_post(
          url:='https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/daily-analysis-generator',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.cMBnVvWGmxyTBqLqQQtPcymKdXMqF0Xr1_EI_Y1G3ZU"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);

-- 3. GENERADOR DE PARLAYS - 4:00 AM Colombia (9:00 AM UTC)
-- Ejecuta DESPUÉS de que el analizador haya terminado
SELECT cron.schedule(
    'daily-parlay-generator',
    '0 9 * * *',  -- 9:00 AM UTC = 4:00 AM Colombia
    $$
    SELECT
      net.http_post(
          url:='https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/daily-parlay-generator',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.cMBnVvWGmxyTBqLqQQtPcymKdXMqF0Xr1_EI_Y1G3ZU"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);

-- 4. VERIFICADOR DE RESULTADOS - 11:00 PM Colombia (4:00 AM UTC del día siguiente)
-- Ejecuta al final del día para verificar resultados de partidos
SELECT cron.schedule(
    'daily-results-verifier',
    '0 4 * * *',  -- 4:00 AM UTC = 11:00 PM Colombia del día anterior
    $$
    SELECT
      net.http_post(
          url:='https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/daily-results-verifier',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.cMBnVvWGmxyTBqLqQQtPcymKdXMqF0Xr1_EI_Y1G3ZU"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);

-- =====================================================
-- PASO 3: Verificar configuración
-- =====================================================
SELECT 
    jobname,
    schedule,
    active,
    jobid
FROM cron.job 
ORDER BY jobname;

-- =====================================================
-- RESUMEN DEL FLUJO DIARIO:
-- =====================================================
-- 1:00 AM → Scanner escanea partidos del siguiente día
-- 2:00 AM → Analyzer empieza (3 partidos cada 5 min)
-- 2:05 AM → Analyzer continúa (3 partidos)
-- 2:10 AM → Analyzer continúa (3 partidos)
-- ... (cada 5 minutos hasta ~3:55 AM)
-- 4:00 AM → Parlay Generator crea parlays automáticos
-- 11:00 PM → Verifier actualiza resultados de partidos finalizados
-- =====================================================
