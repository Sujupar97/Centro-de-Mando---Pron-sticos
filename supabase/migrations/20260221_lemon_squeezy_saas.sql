-- ============================================
-- Migracion SaaS: Lemon Squeezy + Nuevos Planes + Enforcement
-- Fecha: 2026-02-21
-- ============================================

-- ============================================
-- 1. AGREGAR COLUMNAS A subscription_plans
-- ============================================

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS ls_product_id TEXT,
  ADD COLUMN IF NOT EXISTS ls_variant_id_monthly TEXT,
  ADD COLUMN IF NOT EXISTS ls_variant_id_annual TEXT,
  ADD COLUMN IF NOT EXISTS annual_price_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_discount_percentage INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS analysis_percentage INTEGER DEFAULT 0;

-- ============================================
-- 2. ACTUALIZAR PLANES CON NUEVOS PRECIOS Y FEATURES
-- ============================================

UPDATE public.subscription_plans SET
  price_cents = 0,
  annual_price_cents = 0,
  predictions_percentage = 1,  -- Sentinel: "1 high-prob daily"
  monthly_parlay_limit = 0,
  monthly_analysis_limit = 0,
  analysis_percentage = 0,
  can_analyze_own_tickets = false,
  can_access_ml_dashboard = false,
  can_access_full_stats = false,
  has_priority_support = false,
  description = '1 prediccion diaria de alta probabilidad + historial completo de resultados',
  updated_at = now()
WHERE name = 'free';

UPDATE public.subscription_plans SET
  price_cents = 1999,
  annual_price_cents = 19190,
  predictions_percentage = 35,
  monthly_parlay_limit = 4,
  monthly_analysis_limit = NULL,
  analysis_percentage = 50,
  can_analyze_own_tickets = false,
  can_access_ml_dashboard = false,
  can_access_full_stats = false,
  has_priority_support = false,
  description = '35% de predicciones + 4 parlays/mes + analisis del 50% de partidos',
  display_name = 'Starter',
  updated_at = now()
WHERE name = 'starter';

UPDATE public.subscription_plans SET
  price_cents = 4999,
  annual_price_cents = 47990,
  predictions_percentage = 80,
  monthly_parlay_limit = 20,
  monthly_analysis_limit = NULL,
  analysis_percentage = 90,
  can_analyze_own_tickets = false,
  can_access_ml_dashboard = false,
  can_access_full_stats = true,
  has_priority_support = false,
  description = '80% de predicciones + 20 parlays/mes + analisis del 90% de partidos + stats completas',
  display_name = 'Pro',
  updated_at = now()
WHERE name = 'pro';

UPDATE public.subscription_plans SET
  price_cents = 14999,
  annual_price_cents = 143990,
  predictions_percentage = 100,
  monthly_parlay_limit = -1,  -- -1 = ilimitado
  monthly_analysis_limit = NULL,
  analysis_percentage = 100,
  can_analyze_own_tickets = true,
  can_access_ml_dashboard = false,
  can_access_full_stats = true,
  has_priority_support = true,
  description = '100% predicciones + parlays ilimitados + soporte prioritario + ticket analytics',
  display_name = 'Premium',
  updated_at = now()
WHERE name = 'premium';

-- ============================================
-- 3. AGREGAR COLUMNAS A user_subscriptions (Lemon Squeezy)
-- ============================================

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS ls_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS ls_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS ls_order_id TEXT,
  ADD COLUMN IF NOT EXISTS ls_variant_id TEXT,
  ADD COLUMN IF NOT EXISTS ls_product_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS renews_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS card_brand TEXT,
  ADD COLUMN IF NOT EXISTS card_last_four TEXT,
  ADD COLUMN IF NOT EXISTS customer_portal_url TEXT;

-- Actualizar constraint de status para incluir nuevos estados
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_check
    CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'trialing', 'paused', 'on_trial'));

-- ============================================
-- 4. AGREGAR COLUMNAS A payment_history (Lemon Squeezy)
-- ============================================

ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS ls_subscription_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS ls_order_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_reason TEXT,
  ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Actualizar constraint de status
ALTER TABLE public.payment_history DROP CONSTRAINT IF EXISTS payment_history_status_check;
ALTER TABLE public.payment_history
  ADD CONSTRAINT payment_history_status_check
    CHECK (status IN ('pending', 'approved', 'declined', 'voided', 'error', 'refunded', 'paid'));

-- ============================================
-- 5. TABLA DE EVENTOS WEBHOOK (Audit + Idempotency)
-- ============================================

CREATE TABLE IF NOT EXISTS public.ls_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  ls_event_id TEXT UNIQUE,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ls_webhook_events_name ON public.ls_webhook_events(event_name);
CREATE INDEX IF NOT EXISTS idx_ls_webhook_events_processed ON public.ls_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_ls_webhook_events_created ON public.ls_webhook_events(created_at DESC);

ALTER TABLE public.ls_webhook_events ENABLE ROW LEVEL SECURITY;
-- Solo service_role accede (webhook handler). Sin policy = bloqueado para usuarios normales.

-- ============================================
-- 6. INDICES PARA LEMON SQUEEZY
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_subs_ls_sub_id ON public.user_subscriptions(ls_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subs_ls_customer_id ON public.user_subscriptions(ls_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subs_billing_period ON public.user_subscriptions(billing_period);

-- ============================================
-- 7. FIX: RLS Policy de admin (bug: 'Superadmin' vs 'superadmin')
-- ============================================

DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can manage all subscriptions" ON public.user_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'platform_owner', 'agency_admin', 'admin')
    )
  );

-- Agency puede ver todos los pagos
DROP POLICY IF EXISTS "Agency can view all payments" ON public.payment_history;
CREATE POLICY "Agency can view all payments" ON public.payment_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'platform_owner', 'agency_admin')
    )
  );

-- Agency puede ver uso de todos los usuarios
DROP POLICY IF EXISTS "Agency can view all usage" ON public.feature_usage;
CREATE POLICY "Agency can view all usage" ON public.feature_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'platform_owner', 'agency_admin')
    )
  );

-- Agency puede leer eventos webhook
CREATE POLICY "Agency can view webhook events" ON public.ls_webhook_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'platform_owner', 'agency_admin')
    )
  );

-- ============================================
-- 8. ACTUALIZAR FUNCION get_user_plan (nuevos campos)
-- ============================================

DROP FUNCTION IF EXISTS public.get_user_plan(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id UUID, p_org_id UUID DEFAULT NULL)
RETURNS TABLE (
  plan_id UUID,
  plan_name TEXT,
  display_name TEXT,
  predictions_percentage INTEGER,
  monthly_parlay_limit INTEGER,
  monthly_analysis_limit INTEGER,
  analysis_percentage INTEGER,
  can_analyze_own_tickets BOOLEAN,
  can_access_ml_dashboard BOOLEAN,
  can_access_full_stats BOOLEAN,
  has_priority_support BOOLEAN,
  subscription_status TEXT,
  period_end TIMESTAMPTZ,
  billing_period TEXT,
  renews_at TIMESTAMPTZ,
  ls_subscription_id TEXT,
  customer_portal_url TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- PASO 1: Verificar rol admin
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_user_id;

  -- PASO 2: Admin bypass - acceso ilimitado
  IF v_user_role IN ('admin', 'superadmin', 'platform_owner', 'agency_admin') THEN
    RETURN QUERY
    SELECT
      NULL::UUID,
      'unlimited'::TEXT,
      ('Acceso Total (' || COALESCE(v_user_role, 'Admin') || ')')::TEXT,
      100,
      999999,
      NULL::INTEGER,
      100,
      true,
      true,
      true,
      true,
      'active'::TEXT,
      NULL::TIMESTAMPTZ,
      'monthly'::TEXT,
      NULL::TIMESTAMPTZ,
      NULL::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;

  -- PASO 3: Usuarios regulares - buscar suscripcion activa
  RETURN QUERY
  SELECT
    sp.id,
    sp.name,
    sp.display_name,
    sp.predictions_percentage,
    sp.monthly_parlay_limit,
    sp.monthly_analysis_limit,
    COALESCE(sp.analysis_percentage, 0),
    sp.can_analyze_own_tickets,
    sp.can_access_ml_dashboard,
    sp.can_access_full_stats,
    sp.has_priority_support,
    us.status,
    us.current_period_end,
    COALESCE(us.billing_period, 'monthly'),
    us.renews_at,
    us.ls_subscription_id,
    us.customer_portal_url
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND (p_org_id IS NULL OR us.organization_id = p_org_id)
    AND us.status IN ('active', 'trialing', 'on_trial')
  ORDER BY sp.sort_order DESC
  LIMIT 1;

  -- PASO 4: Sin suscripcion = plan free
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      sp.id,
      sp.name,
      sp.display_name,
      sp.predictions_percentage,
      sp.monthly_parlay_limit,
      sp.monthly_analysis_limit,
      COALESCE(sp.analysis_percentage, 0),
      sp.can_analyze_own_tickets,
      sp.can_access_ml_dashboard,
      sp.can_access_full_stats,
      sp.has_priority_support,
      'active'::TEXT,
      NULL::TIMESTAMPTZ,
      'monthly'::TEXT,
      NULL::TIMESTAMPTZ,
      NULL::TEXT,
      NULL::TEXT
    FROM public.subscription_plans sp
    WHERE sp.name = 'free' AND sp.is_active = true
    LIMIT 1;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_user_plan IS
'Obtiene el plan de suscripcion del usuario con soporte Lemon Squeezy.
Admin/superadmin/platform_owner/agency_admin reciben acceso ilimitado automaticamente.
Incluye campos de billing_period, renews_at, ls_subscription_id, customer_portal_url, analysis_percentage.';
