-- ============================================================
-- PRESENTATION MODE — 2026-02-20
-- Agrega setting para ocultar resultados en demos/videos
-- ============================================================

INSERT INTO system_settings (key, value, description)
VALUES ('presentation_mode', 'false'::jsonb, 'Oculta resultados (GANADO/PERDIDO) para demos y capturas de pantalla')
ON CONFLICT (key) DO NOTHING;
