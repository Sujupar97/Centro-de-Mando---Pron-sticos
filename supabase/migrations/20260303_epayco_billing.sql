-- ============================================
-- ePayco Billing Integration
-- Adds ePayco columns alongside existing LS columns (dual-provider)
-- ============================================

-- Agregar columnas ePayco a subscription_plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS epayco_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS epayco_plan_id_annual TEXT;

-- Agregar columnas ePayco a user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS epayco_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS epayco_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS epayco_token_card TEXT;

-- Agregar columna ePayco a payment_history
ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS epayco_ref TEXT,
  ADD COLUMN IF NOT EXISTS epayco_transaction_id TEXT;

-- Tabla de webhook events para ePayco (idempotencia + auditoría)
CREATE TABLE IF NOT EXISTS public.epayco_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  epayco_ref TEXT,
  ref_payco TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_epayco_webhook_ref
  ON public.epayco_webhook_events(ref_payco);
CREATE INDEX IF NOT EXISTS idx_epayco_webhook_processed
  ON public.epayco_webhook_events(processed);

-- RLS para epayco_webhook_events (solo service_role)
ALTER TABLE public.epayco_webhook_events ENABLE ROW LEVEL SECURITY;
