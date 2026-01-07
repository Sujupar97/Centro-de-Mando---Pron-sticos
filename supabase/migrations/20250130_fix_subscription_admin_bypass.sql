-- ============================================
-- CORRECCIÓN URGENTE: Bypass Admin en Sistema de Suscripciones
-- Fecha: 2025-12-30
-- Autor: Sistema BetCommand
-- ============================================

-- Problema: Los usuarios con rol 'admin' o 'superadmin' están siendo
-- limitados por el sistema de suscripciones como si fueran usuarios 'free'.
-- 
-- Solución: Modificar get_user_plan para verificar el rol ANTES de 
-- buscar la suscripción. Si es admin/superadmin, retornar acceso ilimitado.

-- ============================================
-- 1. ELIMINAR FUNCIÓN ANTERIOR
-- ============================================

DROP FUNCTION IF EXISTS public.get_user_plan(UUID, UUID);

-- ============================================
-- 2. CREAR FUNCIÓN MEJORADA CON BYPASS ADMIN
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id UUID, p_org_id UUID DEFAULT NULL)
RETURNS TABLE (
  plan_id UUID,
  plan_name TEXT,
  display_name TEXT,
  predictions_percentage INTEGER,
  monthly_parlay_limit INTEGER,
  monthly_analysis_limit INTEGER,
  can_analyze_own_tickets BOOLEAN,
  can_access_ml_dashboard BOOLEAN,
  can_access_full_stats BOOLEAN,
  has_priority_support BOOLEAN,
  status TEXT,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- PASO 1: Verificar el rol del usuario desde profiles
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_user_id;

  -- PASO 2: Si es admin o superadmin, retornar acceso ILIMITADO
  IF v_user_role IN ('admin', 'superadmin') THEN
    RETURN QUERY
    SELECT 
      NULL::UUID,                    -- plan_id (virtual)
      'unlimited'::TEXT,             -- plan_name
      'Acceso Total (Admin)'::TEXT,  -- display_name
      100,                           -- predictions_percentage
      999999,                        -- monthly_parlay_limit (ilimitado)
      NULL::INTEGER,                 -- monthly_analysis_limit (NULL = ilimitado)
      true,                          -- can_analyze_own_tickets
      true,                          -- can_access_ml_dashboard
      true,                          -- can_access_full_stats
      true,                          -- has_priority_support
      'active'::TEXT,                -- status
      NULL::TIMESTAMPTZ;             -- current_period_end
    RETURN;
  END IF;

  -- PASO 3: Para usuarios regulares, buscar suscripción activa
  RETURN QUERY
  SELECT 
    sp.id,
    sp.name,
    sp.display_name,
    sp.predictions_percentage,
    sp.monthly_parlay_limit,
    sp.monthly_analysis_limit,
    sp.can_analyze_own_tickets,
    sp.can_access_ml_dashboard,
    sp.can_access_full_stats,
    sp.has_priority_support,
    us.status,
    us.current_period_end
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND (p_org_id IS NULL OR us.organization_id = p_org_id)
    AND us.status IN ('active', 'trialing')
  ORDER BY sp.sort_order DESC
  LIMIT 1;

  -- PASO 4: Si no tiene suscripción, retornar plan free por defecto
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      sp.id,
      sp.name,
      sp.display_name,
      sp.predictions_percentage,
      sp.monthly_parlay_limit,
      sp.monthly_analysis_limit,
      sp.can_analyze_own_tickets,
      sp.can_access_ml_dashboard,
      sp.can_access_full_stats,
      sp.has_priority_support,
      'active'::TEXT,
      NULL::TIMESTAMPTZ
    FROM public.subscription_plans sp
    WHERE sp.name = 'free' AND sp.is_active = true
    LIMIT 1;
  END IF;
END;
$$;

-- ============================================
-- 3. COMENTARIOS Y DOCUMENTACIÓN
-- ============================================

COMMENT ON FUNCTION public.get_user_plan IS 
'Obtiene el plan de suscripción del usuario. 
IMPORTANTE: Los usuarios con rol admin/superadmin reciben acceso ilimitado automáticamente, 
sin importar si tienen una suscripción registrada o no.';
