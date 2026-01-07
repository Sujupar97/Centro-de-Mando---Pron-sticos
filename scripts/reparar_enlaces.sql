-- ============================================================
-- SCRIPT DE REPARACIÓN DE ENLACES (JOBS <-> RUNS)
-- Fecha: 2026-01-05
-- Objetivo: Vincular runs huérfanos con sus jobs correctos
-- ============================================================

-- PASO 1: Diagnóstico previo
-- ¿Cuántos runs tienen un job_id que NO corresponde al job del fixture?
SELECT 'Estado Previo' as fase, COUNT(*) as runs_desvinculados
FROM analysis_runs ar
JOIN predictions p ON p.analysis_run_id = ar.id
JOIN analysis_jobs aj ON aj.api_fixture_id = p.fixture_id
WHERE ar.job_id IS DISTINCT FROM aj.id
  AND aj.status = 'done';

-- PASO 2: Reparación Masiva
-- Actualizar job_id en analysis_runs basado en la predicción vinculada
UPDATE analysis_runs ar
SET job_id = aj.id
FROM predictions p, analysis_jobs aj
WHERE ar.id = p.analysis_run_id        -- Enlace Run -> Prediction
  AND p.fixture_id = aj.api_fixture_id -- Enlace Prediction -> Job (por Fixture)
  AND aj.status = 'done'               -- Solo vincular a jobs exitosos
  AND (ar.job_id IS NULL OR ar.job_id != aj.id); -- Solo si está roto

-- PASO 3: Verificación Final
SELECT 'Estado Post-Fix' as fase, COUNT(*) as runs_desvinculados
FROM analysis_runs ar
JOIN predictions p ON p.analysis_run_id = ar.id
JOIN analysis_jobs aj ON aj.api_fixture_id = p.fixture_id
WHERE ar.job_id IS DISTINCT FROM aj.id
  AND aj.status = 'done';

-- PASO 4: Resumen de Runs Válidos (Lo que TopPicks busca)
SELECT 'Runs Listos para TopPicks' as resultado, COUNT(DISTINCT ar.id)
FROM analysis_runs ar
WHERE ar.job_id IN (
    SELECT id FROM analysis_jobs WHERE status = 'done'
);
