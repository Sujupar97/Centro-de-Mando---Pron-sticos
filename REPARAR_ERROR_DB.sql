-- PASO 1: BORRAR ANÁLISIS EN INGLÉS
-- Ejecuta esto para "reiniciar" los partidos y que vuelvan a aparecer como candidatos.

UPDATE analysis_runs 
SET post_match_analysis = NULL, 
    actual_outcome = NULL 
WHERE post_match_analysis IS NOT NULL;

-- Una vez ejecutado, vuelve al Admin > Análisis Retroactivo y verás los partidos listos para procesar de nuevo.
