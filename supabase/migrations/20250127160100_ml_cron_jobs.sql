-- ML Cron Jobs Configuration
-- Habilitar extensiones requeridas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron Job 1: Sync Results (3:00 AM UTC)
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

-- Cron Job 2: Analyze Failures (4:00 AM UTC)
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
