-- ==============================================================================
-- FIX FINAL ESPECÍFICO: VISIBILIDAD DE PREDICCIONES
-- Fecha: 7 Enero 2026 - 10:55 AM
-- Diagnóstico: Los Jobs y Runs YA SON VISIBLES (Fix anterior funcionó parcialmente).
-- Pero las Predicciones siguen bloqueadas (0 visibles). Sin esto, no hay "Oportunidad".
-- ==============================================================================

-- Asegurar que RLS está activo (por seguridad)
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Eliminar política anterior si quedó corrupta o mal aplicada
DROP POLICY IF EXISTS "Lectura publica de predicciones" ON predictions;
DROP POLICY IF EXISTS "Enable read access for all users" ON predictions;

-- Crear política PERMISIVA definitiva
CREATE POLICY "Lectura publica de predicciones" 
ON predictions FOR SELECT 
TO public, authenticated, anon
USING (true);

-- Verificación simple (Opcional, correr tras crear política)
-- SELECT count(*) FROM predictions WHERE created_at > NOW() - INTERVAL '24 hours';
