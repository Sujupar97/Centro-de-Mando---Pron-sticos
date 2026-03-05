-- ============================================
-- Whop Billing Integration
-- Adds Whop columns alongside existing LS columns (dual-provider)
-- ============================================

-- Agregar columnas Whop a subscription_plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS whop_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS whop_plan_id_annual TEXT;

-- Agregar columnas Whop a user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS whop_membership_id TEXT,
  ADD COLUMN IF NOT EXISTS whop_user_id TEXT;

-- Agregar columna Whop a payment_history
ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS whop_payment_id TEXT;

-- Tabla de webhook events para Whop (idempotencia + auditoría)
CREATE TABLE IF NOT EXISTS public.whop_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  whop_event_id TEXT UNIQUE,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whop_webhook_event_id
  ON public.whop_webhook_events(whop_event_id);
CREATE INDEX IF NOT EXISTS idx_whop_webhook_processed
  ON public.whop_webhook_events(processed);

-- RLS para whop_webhook_events (solo service_role)
ALTER TABLE public.whop_webhook_events ENABLE ROW LEVEL SECURITY;
