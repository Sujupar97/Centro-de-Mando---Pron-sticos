-- ==============================================================================
-- FIX CRÍTICO: VISIBILIDAD DE OPORTUNIDADES (RLS)
-- Fecha: 7 Enero 2026
-- Descripción: Habilita la lectura de tablas de análisis para el Frontend.
-- Diagnóstico: El frontend no podía "cruzar" los datos de matches con jobs/predictions
-- debido a restricciones de seguridad por defecto (deny-all).
-- ==============================================================================

-- 1. Analysis Jobs (Necesario para saber qué partidos tienen análisis 'done')
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de jobs" ON analysis_jobs;
CREATE POLICY "Lectura publica de jobs" 
ON analysis_jobs FOR SELECT 
TO public, authenticated, anon
USING (true); 
-- Nota: Security permissive. Si se requiere privacidad user-specific, cambiar a:
-- USING (auth.uid() = user_id OR status = 'done')

-- 2. Analysis Runs (Enlace entre Job y Predicciones)
ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de runs" ON analysis_runs;
CREATE POLICY "Lectura publica de runs" 
ON analysis_runs FOR SELECT 
TO public, authenticated, anon
USING (true);

-- 3. Predictions (Datos reales de la apuesta para Top Picks y Parlays)
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de predicciones" ON predictions;
CREATE POLICY "Lectura publica de predicciones" 
ON predictions FOR SELECT 
TO public, authenticated, anon
USING (true);

-- 4. Daily Matches (Ya visible, pero reforzamos)
ALTER TABLE daily_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de daily matches" ON daily_matches;
CREATE POLICY "Lectura publica de daily matches" 
ON daily_matches FOR SELECT 
TO public, authenticated, anon
USING (true);

-- Fin del script
