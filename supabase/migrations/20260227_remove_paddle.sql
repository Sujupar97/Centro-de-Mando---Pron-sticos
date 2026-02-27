-- ============================================
-- Remove Paddle Billing (rejected by Paddle)
-- Cleans up columns and table added in 20260225_paddle_billing.sql
-- ============================================

-- Eliminar columnas Paddle de subscription_plans
ALTER TABLE public.subscription_plans
  DROP COLUMN IF EXISTS paddle_product_id,
  DROP COLUMN IF EXISTS paddle_price_id_monthly,
  DROP COLUMN IF EXISTS paddle_price_id_annual;

-- Eliminar columnas Paddle de user_subscriptions
ALTER TABLE public.user_subscriptions
  DROP COLUMN IF EXISTS paddle_subscription_id,
  DROP COLUMN IF EXISTS paddle_customer_id,
  DROP COLUMN IF EXISTS paddle_transaction_id;

-- Eliminar columna Paddle de payment_history
ALTER TABLE public.payment_history
  DROP COLUMN IF EXISTS paddle_transaction_id;

-- Eliminar tabla de webhook events de Paddle
DROP TABLE IF EXISTS public.paddle_webhook_events;
