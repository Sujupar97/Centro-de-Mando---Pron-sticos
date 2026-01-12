-- ==============================================================================
-- REPARACIÓN DEFINITIVA: POBLAR TABLA PREDICTIONS (VERSIÓN CORREGIDA)
-- ==============================================================================

DO $$
DECLARE
    run_record RECORD;
    json_data JSONB;
    tip_record JSONB;
    fixture_id_val INTEGER;
    restored_count INTEGER := 0;
BEGIN
    FOR run_record IN 
        SELECT 
            ar.id as run_id, 
            ar.report_pre_jsonb, 
            ar.created_at,
            aj.api_fixture_id
        FROM analysis_runs ar
        INNER JOIN analysis_jobs aj ON ar.job_id = aj.id
        WHERE ar.created_at >= '2026-01-07T00:00:00'
        ORDER BY ar.created_at DESC
    LOOP
        -- Si ya tiene predicciones, saltar
        IF EXISTS (SELECT 1 FROM predictions WHERE analysis_run_id = run_record.run_id LIMIT 1) THEN
            CONTINUE;
        END IF;
        
        -- Usar fixture_id del job (siempre INTEGER)
        fixture_id_val := run_record.api_fixture_id;
        
        IF fixture_id_val IS NULL OR run_record.report_pre_jsonb IS NULL THEN
            CONTINUE;
        END IF;
        
        json_data := run_record.report_pre_jsonb;
        
        IF json_data->'predicciones_finales'->'detalle' IS NULL THEN
            CONTINUE;
        END IF;
        
        FOR tip_record IN 
            SELECT * FROM jsonb_array_elements(json_data->'predicciones_finales'->'detalle')
        LOOP
            BEGIN
                INSERT INTO predictions (
                    analysis_run_id,
                    fixture_id,
                    market_code,
                    selection,
                    probability,
                    confidence,
                    evidence_jsonb,
                    created_at
                ) VALUES (
                    run_record.run_id,
                    fixture_id_val,
                    COALESCE(tip_record->>'mercado', 'Unknown'),
                    COALESCE(tip_record->>'seleccion', 'N/A'),
                    CASE 
                        WHEN (tip_record->>'probabilidad_estimado_porcentaje')::NUMERIC > 1 
                        THEN (tip_record->>'probabilidad_estimado_porcentaje')::NUMERIC / 100
                        ELSE COALESCE((tip_record->>'probabilidad_estimado_porcentaje')::NUMERIC, 0.5)
                    END,
                    80,
                    COALESCE(tip_record->'justificacion_detallada', '{}'::JSONB),
                    run_record.created_at
                );
                
                restored_count := restored_count + 1;
                
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Error: %', SQLERRM;
            END;
        END LOOP;
        
    END LOOP;
    
    RAISE NOTICE 'Predicciones restauradas: %', restored_count;
END $$;
