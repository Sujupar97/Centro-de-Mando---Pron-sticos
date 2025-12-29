-- =====================================================
-- ACTUALIZAR CRON JOB: DAILY ANALYSIS GENERATOR
-- Ejecutar cada 5 minutos desde 2:00 AM hasta 4:00 AM
-- =====================================================

-- Primero, eliminar el cron job anterior si existe
SELECT cron.unschedule('daily-analysis-generator');

-- Crear nuevo cron job que se ejecuta cada 5 minutos
-- Entre 2:00 AM y 4:00 AM Colombia (7:00-9:00 AM UTC)
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

-- Verificar cron job actualizado
SELECT jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'daily-analysis-generator';
