-- ============================================================
-- SCRIPT PASO A PASO DE REGENERACIÓN
-- Ejecutar CADA paso por separado para verificar
-- Fecha: 2026-01-04
-- ============================================================

-- ============================================================
-- PASO 1: VERIFICAR ESTADO INICIAL (ejecutar solo)
-- ============================================================
SELECT 'analysis_jobs' as tabla, COUNT(*) as total FROM analysis_jobs
UNION ALL
SELECT 'analysis_runs', COUNT(*) FROM analysis_runs
UNION ALL
SELECT 'predictions', COUNT(*) FROM predictions;

-- ============================================================
-- PASO 2: VERIFICAR QUÉ DATOS TENEMOS EN PREDICTIONS
-- (ejecutar solo)
-- ============================================================
SELECT 
    fixture_id,
    analysis_run_id,
    DATE(created_at) as fecha,
    COUNT(*) as predicciones
FROM predictions
WHERE fixture_id IS NOT NULL
GROUP BY fixture_id, analysis_run_id, DATE(created_at)
ORDER BY fecha DESC
LIMIT 20;

-- ============================================================
-- PASO 3: INSERTAR UN SOLO JOB DE PRUEBA (ejecutar solo)
-- ============================================================
INSERT INTO analysis_jobs (api_fixture_id, status, completeness_score, created_at)
SELECT 
    fixture_id as api_fixture_id,
    'done' as status,
    100 as completeness_score,
    MIN(created_at) as created_at
FROM predictions
WHERE fixture_id IS NOT NULL
GROUP BY fixture_id
LIMIT 1;

-- Verificar
SELECT 'Jobs después de insert:' as info, COUNT(*) as total FROM analysis_jobs;

-- ============================================================
-- PASO 4: SI PASO 3 FUNCIONÓ, INSERTAR TODOS LOS JOBS
-- (ejecutar solo)
-- ============================================================
INSERT INTO analysis_jobs (api_fixture_id, status, completeness_score, created_at)
SELECT 
    fixture_id as api_fixture_id,
    'done' as status,
    100 as completeness_score,
    MIN(created_at) as created_at
FROM predictions
WHERE fixture_id IS NOT NULL
  AND fixture_id NOT IN (SELECT api_fixture_id FROM analysis_jobs)
GROUP BY fixture_id;

SELECT 'Jobs totales:' as info, COUNT(*) as total FROM analysis_jobs;

-- ============================================================
-- PASO 5: INSERTAR RUNS (ejecutar solo)
-- ============================================================
INSERT INTO analysis_runs (id, job_id, match_date, model_version, created_at)
SELECT DISTINCT ON (p.analysis_run_id)
    p.analysis_run_id as id,
    aj.id as job_id,
    DATE(p.created_at) as match_date,
    'gemini-3-pro-preview' as model_version,
    p.created_at
FROM predictions p
LEFT JOIN analysis_jobs aj ON aj.api_fixture_id = p.fixture_id
WHERE p.analysis_run_id IS NOT NULL
  AND p.analysis_run_id NOT IN (SELECT id FROM analysis_runs)
ORDER BY p.analysis_run_id, p.created_at DESC
ON CONFLICT (id) DO NOTHING;

SELECT 'Runs totales:' as info, COUNT(*) as total FROM analysis_runs;

-- ============================================================
-- PASO 6: VERIFICAR CONEXIÓN JOBS-RUNS-PREDICTIONS
-- ============================================================
SELECT 
    aj.id as job_id,
    aj.api_fixture_id,
    aj.status,
    COUNT(ar.id) as runs,
    COUNT(p.id) as predictions
FROM analysis_jobs aj
LEFT JOIN analysis_runs ar ON ar.job_id = aj.id
LEFT JOIN predictions p ON p.analysis_run_id = ar.id
GROUP BY aj.id, aj.api_fixture_id, aj.status
LIMIT 10;
