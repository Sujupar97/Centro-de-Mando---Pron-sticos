-- ============================================
-- Migración: Parlays por porcentaje (no conteo fijo)
-- Fecha: 2026-02-22
-- ============================================

-- 1. Agregar columna parlay_percentage a subscription_plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS parlay_percentage INTEGER DEFAULT 0;

-- 2. Actualizar planes: Free y Starter no ven parlays, Pro 30%, Premium 80%, Unlimited 100%
UPDATE public.subscription_plans SET parlay_percentage = 0 WHERE name = 'free';
UPDATE public.subscription_plans SET parlay_percentage = 0 WHERE name = 'starter';
UPDATE public.subscription_plans SET parlay_percentage = 30 WHERE name = 'pro';
UPDATE public.subscription_plans SET parlay_percentage = 80 WHERE name = 'premium';
UPDATE public.subscription_plans SET parlay_percentage = 100 WHERE name = 'unlimited';

-- 3. Recrear función get_user_plan con parlay_percentage
-- DROP necesario porque RETURNS TABLE cambió (nueva columna parlay_percentage)
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
  customer_portal_url TEXT,
  parlay_percentage INTEGER
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
      NULL::TEXT,
      100;
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
    us.customer_portal_url,
    COALESCE(sp.parlay_percentage, 0)
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
      NULL::TEXT,
      COALESCE(sp.parlay_percentage, 0)
    FROM public.subscription_plans sp
    WHERE sp.name = 'free' AND sp.is_active = true
    LIMIT 1;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_user_plan IS
'Obtiene el plan de suscripcion del usuario con parlay_percentage.
Admin/superadmin/platform_owner/agency_admin reciben acceso ilimitado automaticamente.
Incluye campos de billing_period, renews_at, ls_subscription_id, customer_portal_url, analysis_percentage, parlay_percentage.';
