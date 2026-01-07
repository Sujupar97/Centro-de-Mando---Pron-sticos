-- ============================================================
-- PASO 0: VERIFICAR ESQUEMA REAL DE LAS TABLAS
-- Ejecutar PRIMERO esto para ver la estructura
-- ============================================================

-- Ver columnas de analysis_jobs
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'analysis_jobs'
ORDER BY ordinal_position;

-- Ver constraints de analysis_jobs
SELECT 
    constraint_name, 
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'analysis_jobs';

-- Ver columnas de analysis_runs
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'analysis_runs'
ORDER BY ordinal_position;

-- Ver constraints de analysis_runs
SELECT 
    constraint_name, 
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'analysis_runs';

-- ============================================================
-- Con esta información, podré crear el INSERT correcto
-- ============================================================
