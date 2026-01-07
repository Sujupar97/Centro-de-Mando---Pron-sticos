-- ============================================
-- CONFIGURACIÓN DE CRON PARA daily-results-verifier
-- ============================================
-- 
-- Este script configura un cron job usando pg_cron para ejecutar
-- daily-results-verifier automáticamente cada día a las 4 AM UTC
--
-- Horario: 4:00 AM UTC = 11:00 PM Colombia (día anterior)
-- ============================================

-- Habilitar extensión pg_cron si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Eliminar cron existente si existe (para evitar duplicados)
-- Usar DO block para manejar si no existe
DO $$
BEGIN
    PERFORM cron.unschedule('daily-results-verifier-cron');
EXCEPTION WHEN OTHERS THEN
    -- Ignorar error si el job no existe
    NULL;
END $$;

-- Crear nuevo cron job
-- Ejecuta daily-results-verifier cada día a las 4 AM UTC
SELECT cron.schedule(
    'daily-results-verifier-cron',           -- nombre del job
    '0 4 * * *',                              -- cron expression (4 AM UTC diario)
    $$
    SELECT
      net.http_post(
        url := 'https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/daily-results-verifier',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
        body := '{}'::jsonb
      ) as request_id;
    $$
);

-- Verificar que el cron se creó correctamente
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active
FROM cron.job
WHERE jobname = 'daily-results-verifier-cron';

-- RESULTADO ESPERADO:
-- Debería mostrar 1 fila con el cron configurado y active = true

-- ============================================
-- NOTAS:
-- ============================================
-- 1. pg_cron requiere que la extensión esté habilitada en Supabase
-- 2. Si pg_cron no está disponible, usar Management API o Dashboard
-- 3. El service_role_key debe estar configurado como setting
-- 4. Alternativamente, usar Supabase Edge Functions Schedule desde Dashboard
