-- ============================================
-- Migración: Agregar soporte Paddle Billing (dual-provider)
-- Fecha: 2026-02-25
-- ============================================
-- Agrega columnas de Paddle junto a las existentes de Lemon Squeezy.
-- Permite transición gradual: suscripciones LS existentes siguen funcionando,
-- nuevos usuarios van a Paddle.

-- ============================================
-- PASO 1: Columnas Paddle en subscription_plans
-- ============================================

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS paddle_product_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_price_id_monthly TEXT,
  ADD COLUMN IF NOT EXISTS paddle_price_id_annual TEXT;

-- ============================================
-- PASO 2: Columnas Paddle en user_subscriptions
-- ============================================

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_transaction_id TEXT;

-- ============================================
-- PASO 3: Columna Paddle en payment_history
-- ============================================

ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS paddle_transaction_id TEXT;

-- ============================================
-- PASO 4: Tabla webhook events para Paddle (idempotencia + auditoría)
-- ============================================

CREATE TABLE IF NOT EXISTS public.paddle_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  paddle_event_id TEXT UNIQUE,
  paddle_notification_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paddle_webhook_event_type
  ON public.paddle_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_paddle_webhook_processed
  ON public.paddle_webhook_events(processed);

-- RLS: solo service_role puede escribir (Edge Functions con SERVICE_ROLE_KEY)
ALTER TABLE public.paddle_webhook_events ENABLE ROW LEVEL SECURITY;

-- Admins pueden leer para auditoría
CREATE POLICY "Admins can view paddle events" ON public.paddle_webhook_events
  FOR SELECT USING (public.is_platform_admin());
