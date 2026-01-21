-- ============================================================================
-- MIGRACIÓN: Soporte para Verificación de Resultados de Parlays
-- Fecha: 2026-01-20
-- ============================================================================

-- 1. Añadir columnas de estado a la tabla 'parlays'
ALTER TABLE public.parlays 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('PENDING', 'WON', 'LOST', 'VOID', 'PUSH', 'PARTIAL')) DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS result_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS actual_total_odds NUMERIC,
ADD COLUMN IF NOT EXISTS verification_metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Índices para consultas rápidas de verificación
CREATE INDEX IF NOT EXISTS idx_parlays_status ON public.parlays(status);
CREATE INDEX IF NOT EXISTS idx_parlays_date_status ON public.parlays(date, status);

COMMENT ON COLUMN public.parlays.status IS 'Estado del resultado del parlay (WON, LOST, etc.)';
COMMENT ON COLUMN public.parlays.actual_total_odds IS 'Cuota real final (ajustada por VOID/PUSH)';
COMMENT ON COLUMN public.parlays.verification_metadata IS 'Detalles del resultado (ej: score real, explicación IA)';
