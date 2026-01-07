-- ============================================
-- ROLLBACK URGENTE - Restaurar Sistema
-- Fecha: 2025-12-30
-- ============================================
-- 
-- Este script REVIERTE la migración de roles que rompió
-- las organizaciones y el sistema de agencia.

-- ============================================
-- PASO 1: RESTAURAR ENUM DE ROLES ORIGINAL
-- ============================================

-- Eliminar columna nueva
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Recrear enum original
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_original') THEN
        CREATE TYPE user_role_original AS ENUM ('superadmin', 'admin', 'usuario');
    END IF;
END $$;

-- Añadir columna con tipo original
ALTER TABLE public.profiles ADD COLUMN role user_role_original DEFAULT 'usuario'::user_role_original;

-- Restaurar rol de Julian a 'superadmin'
UPDATE public.profiles 
SET role = 'superadmin'::user_role_original
WHERE email LIKE '%julian%' OR id = (SELECT auth.uid());

-- ============================================
-- PASO 2: RESTAURAR FUNCIÓN get_user_plan ORIGINAL
-- ============================================

DROP FUNCTION IF EXISTS public.get_user_plan(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id UUID, p_org_id UUID DEFAULT NULL)
RETURNS TABLE (
  plan_name TEXT,
  display_name TEXT,
  predictions_percentage INTEGER,
  monthly_parlay_limit INTEGER,
  monthly_analysis_limit INTEGER,
  can_analyze_own_tickets BOOLEAN,
  can_access_ml_dashboard BOOLEAN,
  subscription_status TEXT,
  period_end TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.name,
    sp.display_name,
    sp.predictions_percentage,
    sp.monthly_parlay_limit,
    sp.monthly_analysis_limit,
    sp.can_analyze_own_tickets,
    sp.can_access_ml_dashboard,
    us.status,
    us.current_period_end
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND (p_org_id IS NULL OR us.organization_id = p_org_id)
    AND us.status IN ('active', 'trialing')
  ORDER BY sp.sort_order DESC
  LIMIT 1;
  
  -- Si no tiene suscripción, retornar plan free
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      sp.name,
      sp.display_name,
      sp.predictions_percentage,
      sp.monthly_parlay_limit,
      sp.monthly_analysis_limit,
      sp.can_analyze_own_tickets,
      sp.can_access_ml_dashboard,
      'active'::TEXT,
      NULL::TIMESTAMPTZ
    FROM public.subscription_plans sp
    WHERE sp.name = 'free' AND sp.is_active = true
    LIMIT 1;
  END IF;
END;
$$;

-- ============================================
-- PASO 3: RESTAURAR POLÍTICA RLS ORIGINAL
-- ============================================

DROP POLICY IF EXISTS "Platform and Agency admins can manage subscriptions" ON public.user_subscriptions;

CREATE POLICY "Admins can manage all subscriptions" ON public.user_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'superadmin'
    )
  );

-- ============================================
-- PASO 4: LIMPIAR TIPOS NO UTILIZADOS
-- ============================================

DROP TYPE IF EXISTS user_role_new CASCADE;

COMMENT ON TABLE public.profiles IS 'Restaurado a estado funcional anterior';
