-- Migration: Cola de aprobación admin/owner para pronósticos con cuotas sospechosas
-- Fecha: 2026-05-22
--
-- Contexto:
-- Cuando un pronóstico tiene una combinación de probabilidad alta + cuota alta
-- (ej: probability >= 70% AND odds >= 2.5), es probable que la cuota esté mal
-- (error de captura, arbitraje, línea movida). Para evitar publicar cuotas
-- erróneas, esos pronósticos quedan en "pending_review" y solo aparecen a
-- administradores/dueños con opción de aprobar/rechazar.
--
-- Estados:
--   'auto_approved'  → cuota normal, visible para todos (DEFAULT)
--   'pending_review' → cuota sospechosa, visible solo admin/superadmin
--   'admin_approved' → admin la validó manualmente, visible para todos
--   'admin_rejected' → admin la descartó, no visible para nadie

-- 1) Columnas nuevas (aditivo, idempotente)
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'auto_approved',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspicious_reason TEXT;

-- 2) Constraint de valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'predictions_review_status_check'
  ) THEN
    ALTER TABLE public.predictions
      ADD CONSTRAINT predictions_review_status_check
      CHECK (review_status IN ('auto_approved','pending_review','admin_approved','admin_rejected'));
  END IF;
END $$;

-- 3) Índice para listados rápidos de pendientes
CREATE INDEX IF NOT EXISTS idx_predictions_review_status
  ON public.predictions (review_status)
  WHERE review_status IN ('pending_review','admin_approved','admin_rejected');

-- 4) Función de detección de cuota sospechosa
CREATE OR REPLACE FUNCTION public.flag_suspicious_prediction()
RETURNS TRIGGER AS $$
DECLARE
  v_prob_pct NUMERIC;
  v_odds NUMERIC;
  v_value_ratio NUMERIC;
BEGIN
  -- Si admin ya tocó el estado (approved/rejected), respetar su decisión.
  IF NEW.review_status IN ('admin_approved','admin_rejected') THEN
    RETURN NEW;
  END IF;

  v_prob_pct := NEW.probability;
  v_odds := NEW.odds;

  -- Sin cuota = sin evidencia para sospechar → auto_approved
  IF v_odds IS NULL OR v_odds <= 1.0 THEN
    NEW.review_status := 'auto_approved';
    NEW.suspicious_reason := NULL;
    RETURN NEW;
  END IF;

  -- Normalizar probability: aceptar tanto 0-1 como 0-100
  IF v_prob_pct IS NOT NULL AND v_prob_pct <= 1 THEN
    v_prob_pct := v_prob_pct * 100;
  END IF;

  IF v_prob_pct IS NULL THEN
    NEW.review_status := 'auto_approved';
    NEW.suspicious_reason := NULL;
    RETURN NEW;
  END IF;

  -- value_ratio = (probability_decimal) * odds
  -- Si > 1.5, el "valor esperado" implícito es >50%, banderazo rojo
  v_value_ratio := (v_prob_pct / 100.0) * v_odds;

  -- Regla A: probabilidad alta + cuota alta (contradictorio)
  IF v_prob_pct >= 70 AND v_odds >= 2.5 THEN
    NEW.review_status := 'pending_review';
    NEW.suspicious_reason := format(
      'prob_alta_cuota_alta: probability=%s%% odds=%s value_ratio=%s',
      round(v_prob_pct,1), round(v_odds,2), round(v_value_ratio,2)
    );
    RETURN NEW;
  END IF;

  -- Regla B: value ratio implausible (>= 1.5)
  IF v_value_ratio >= 1.5 THEN
    NEW.review_status := 'pending_review';
    NEW.suspicious_reason := format(
      'value_ratio_implausible: probability=%s%% odds=%s value_ratio=%s',
      round(v_prob_pct,1), round(v_odds,2), round(v_value_ratio,2)
    );
    RETURN NEW;
  END IF;

  -- Normal
  NEW.review_status := 'auto_approved';
  NEW.suspicious_reason := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5) Trigger: se dispara ante INSERT o cuando cambian odds/probability.
-- Intencionalmente NO incluimos review_status en UPDATE OF: la aprobación/rechazo
-- admin se gestiona desde la Edge Function y no debe re-evaluar la heurística.
DROP TRIGGER IF EXISTS trg_flag_suspicious_prediction ON public.predictions;
CREATE TRIGGER trg_flag_suspicious_prediction
  BEFORE INSERT OR UPDATE OF odds, probability
  ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.flag_suspicious_prediction();

-- 6) Re-evaluar histórico: recalcular review_status para filas existentes con odds
-- (solo las que NO han sido tocadas manualmente por admin)
UPDATE public.predictions
SET odds = odds  -- no-op que dispara el trigger
WHERE odds IS NOT NULL
  AND review_status NOT IN ('admin_approved','admin_rejected');
