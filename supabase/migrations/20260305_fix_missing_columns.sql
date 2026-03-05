-- ============================================
-- Fix Missing Columns
-- Columnas que el código referencia pero nunca se crearon en producción
-- (migración 20260221_lemon_squeezy_saas.sql nunca fue ejecutada)
-- ============================================

-- user_subscriptions: columnas faltantes
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS renews_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_portal_url TEXT,
  ADD COLUMN IF NOT EXISTS ls_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS ls_customer_id TEXT;

-- subscription_plans: columnas faltantes
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS analysis_percentage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_price_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_discount_percentage INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS ls_product_id TEXT,
  ADD COLUMN IF NOT EXISTS ls_variant_id_monthly TEXT,
  ADD COLUMN IF NOT EXISTS ls_variant_id_annual TEXT;

-- Poblar analysis_percentage según plan
UPDATE public.subscription_plans SET analysis_percentage = 0 WHERE name = 'free';
UPDATE public.subscription_plans SET analysis_percentage = 50 WHERE name = 'starter';
UPDATE public.subscription_plans SET analysis_percentage = 90 WHERE name = 'pro';
UPDATE public.subscription_plans SET analysis_percentage = 100 WHERE name = 'premium';

-- Poblar annual_price_cents (20% descuento sobre precio mensual × 12)
UPDATE public.subscription_plans SET annual_price_cents = 0 WHERE name = 'free';
UPDATE public.subscription_plans SET annual_price_cents = 19190 WHERE name = 'starter';
UPDATE public.subscription_plans SET annual_price_cents = 47990 WHERE name = 'pro';
UPDATE public.subscription_plans SET annual_price_cents = 143990 WHERE name = 'premium';
