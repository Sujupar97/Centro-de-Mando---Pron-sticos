-- ============================================================
-- FIX RESULTS SYSTEM — 2026-02-20
-- Corrige: staking incorrecto, datos viejos, pick_type faltante
-- ============================================================

-- 1. Agregar columna pick_type a profitability_tracking
ALTER TABLE profitability_tracking
  ADD COLUMN IF NOT EXISTS pick_type TEXT DEFAULT 'oportunidad';

CREATE INDEX IF NOT EXISTS idx_profit_pick_type ON profitability_tracking(pick_type);

-- 2. Limpiar datos viejos (calculados con Fractional Kelly incorrecto)
DELETE FROM profitability_tracking;

-- 3. Reset results en value_picks_v2 para re-verificar con lógica correcta
UPDATE value_picks_v2 SET result = 'PENDING', verified_at = NULL, actual_score = NULL
WHERE result IN ('WON', 'LOST', 'VOID');

-- 4. Índice optimizado para queries del verificador
CREATE INDEX IF NOT EXISTS idx_vp2_pending_oportunidad
  ON value_picks_v2(p_model, odds) WHERE result = 'PENDING';
