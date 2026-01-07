-- Verificar que el cron se creó correctamente
-- Ejecuta esto en Supabase SQL Editor

SELECT 
    jobid,
    jobname,
    schedule,
    active,
    nodename
FROM cron.job
WHERE jobname = 'daily-results-verifier-schedule';

-- RESULTADO ESPERADO:
-- Debería mostrar 1 fila con:
-- - jobname: daily-results-verifier-schedule
-- - schedule: 0 4 * * *
-- - active: true (o t)
