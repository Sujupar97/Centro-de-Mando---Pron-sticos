-- ============================================
-- ROLLBACK CORREGIDO - Restaurar Sistema
-- Fecha: 2025-12-30
-- ============================================

-- ============================================
-- PASO 1: ELIMINAR POLÍTICAS DEPENDIENTES PRIMERO
-- ============================================

-- Eliminar política que creamos nueva
DROP POLICY IF EXISTS "Platform and Agency admins can manage subscriptions" ON public.user_subscriptions;

-- Eliminar todas las políticas de profiles que puedan referenciar role
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- ============================================
-- PASO 2: MODIFICAR COLUMNA ROLE
-- ============================================

-- Eliminar columna actual (con tipo user_role_new)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role CASCADE;

-- Recrear tipo original si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_original') THEN
        CREATE TYPE user_role_original AS ENUM ('superadmin', 'admin', 'usuario');
    END IF;
END $$;

-- Añadir columna con tipo original
ALTER TABLE public.profiles ADD COLUMN role user_role_original NOT NULL DEFAULT 'usuario'::user_role_original;

-- Restaurar rol de Julian a 'superadmin'
-- IMPORTANTE: Cambia el email por el tuyo real
UPDATE public.profiles 
SET role = 'superadmin'::user_role_original
WHERE email LIKE '%julian%' OR email LIKE '%parra%';

-- ============================================
-- PASO 3: RECREAR POLÍTICAS RLS ORIGINALES
-- ============================================

-- Política para que usuarios vean su propio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Política para que usuarios actualicen su propio perfil
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Política para que superadmins vean todos los perfiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'superadmin'
    )
  );

-- Política original para subscriptions
CREATE POLICY "Admins can manage all subscriptions" ON public.user_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'superadmin'
    )
  );

-- ============================================
-- PASO 4: RESTAURAR FUNCIÓN get_user_plan
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
  can_analyze_own_tickets BOOLEAN,
  can_access_ml_dashboard BOOLEAN,
  can_access_full_stats BOOLEAN,
  has_priority_support BOOLEAN,
  status TEXT,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
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
  
  -- Si no tiene suscripción, retornar plan free
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
-- PASO 5: LIMPIAR TIPOS NO UTILIZADOS
-- ============================================

DROP TYPE IF EXISTS user_role_new CASCADE;

-- ============================================
-- PASO 6: VERIFICACIÓN
-- ============================================

-- Verificar que tu usuario tenga superadmin
SELECT id, email, role, full_name 
FROM public.profiles 
WHERE email LIKE '%julian%' OR email LIKE '%parra%';

COMMENT ON TABLE public.profiles IS 'Sistema restaurado a estado funcional - 2025-12-30';
