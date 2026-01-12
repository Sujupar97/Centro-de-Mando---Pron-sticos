-- Actualizar campo confidence en predictions restauradas
UPDATE predictions
SET confidence = CASE 
    WHEN probability >= 70 THEN 'Alta'
    WHEN probability >= 50 THEN 'Media'
    ELSE 'Baja'
END
WHERE confidence IS NULL
  AND created_at >= '2026-01-07T00:00:00';
