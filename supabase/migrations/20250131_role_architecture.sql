-- ============================================
-- ARQUITECTURA DE ROLES MEJORADA
-- Fecha: 2025-12-30
-- Autor: BetCommand
-- ============================================
-- 
-- Este script implementa un sistema de roles de 5 niveles:
-- 1. platform_owner: Owner único de la plataforma (Julian)
-- 2. agency_admin: Empleados de agencia con acceso total
-- 3. org_owner: Dueños de organizaciones/clientes
-- 4. org_member: Miembros de organizaciones
-- 5. user: Usuarios individuales

-- ============================================
-- PASO 1: CREAR NUEVO ENUM DE ROLES
-- ============================================

-- Renombrar el enum actual para mantener compatibilidad temporal
DO $$ 
BEGIN
    -- Solo renombrar si no existe ya el nuevo
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_new') THEN
        -- Crear el nuevo enum
        CREATE TYPE user_role_new AS ENUM (
            'platform_owner',
            'agency_admin',
            'org_owner',
            'org_member',
            'user'
        );
    END IF;
END $$;

-- ============================================
-- PASO 2: MIGRAR COLUMNA DE ROLES EN PROFILES
-- ============================================

-- Agregar columna temporal con nuevo tipo
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_new user_role_new;

-- Migrar datos existentes con lógica de mapeo
UPDATE public.profiles SET role_new = CASE
    -- Migrar superadmin específico (Julian) a platform_owner
    WHEN email LIKE '%julian%' AND role::text = 'superadmin' THEN 'platform_owner'::user_role_new
    
    -- Otros superadmins a agency_admin
    WHEN role::text = 'superadmin' THEN 'agency_admin'::user_role_new
    
    -- Admins regulares a org_owner
    WHEN role::text = 'admin' THEN 'org_owner'::user_role_new
    
    -- Resto a user
    ELSE 'user'::user_role_new
END;

-- Eliminar columna anterior y renombrar la nueva
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role CASCADE;
ALTER TABLE public.profiles RENAME COLUMN role_new TO role;

-- Establecer NOT NULL y default
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user'::user_role_new;

-- ============================================
-- PASO 3: ACTUALIZAR FUNCIÓN get_user_plan
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
DECLARE
  v_user_role user_role_new;
BEGIN
  -- PASO 1: Obtener rol del usuario
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_user_id;

  -- PASO 2: BYPASS TOTAL para platform_owner y agency_admin
  IF v_user_role IN ('platform_owner', 'agency_admin') THEN
    RETURN QUERY
    SELECT 
      NULL::UUID,                                -- plan_id (virtual)
      'unlimited'::TEXT,                         -- plan_name
      CASE 
        WHEN v_user_role = 'platform_owner' THEN 'Owner'::TEXT
        ELSE 'Agencia'::TEXT
      END,                                       -- display_name
      100,                                       -- predictions_percentage
      999999,                                    -- monthly_parlay_limit
      NULL::INTEGER,                             -- monthly_analysis_limit (ilimitado)
      true,                                      -- can_analyze_own_tickets
      true,                                      -- can_access_ml_dashboard
      true,                                      -- can_access_full_stats
      true,                                      -- has_priority_support
      'active'::TEXT,                            -- status
      NULL::TIMESTAMPTZ;                         -- current_period_end
    RETURN;
  END IF;

  -- PASO 3: Para otros roles (org_owner, org_member, user), buscar suscripción
  -- Si es org_owner u org_member, buscar suscripción de la organización
  -- Si es user individual, buscar suscripción personal
  
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

  -- PASO 4: Si no tiene suscripción, retornar plan free
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

COMMENT ON FUNCTION public.get_user_plan IS 
'Obtiene el plan de suscripción del usuario con BYPASS para platform_owner y agency_admin.
Los 5 roles son: platform_owner, agency_admin, org_owner, org_member, user.';

-- ============================================
-- PASO 4: ACTUALIZAR RLS POLICIES
-- ============================================

-- Actualizar política de admin para incluir platform_owner y agency_admin
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.user_subscriptions;

CREATE POLICY "Platform and Agency admins can manage subscriptions" ON public.user_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
        AND p.role IN ('platform_owner', 'agency_admin')
    )
  );

-- ============================================
-- PASO 5: ÍNDICES Y OPTIMIZACIONES
-- ============================================

-- Crear índice para búsquedas por rol
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================
-- PASO 6: DOCUMENTACIÓN EN COMENTARIOS
-- ============================================

COMMENT ON COLUMN public.profiles.role IS 
'Rol del usuario en el sistema:
- platform_owner: Dueño único de la plataforma (acceso total)
- agency_admin: Empleado de agencia (acceso total + impersonación)
- org_owner: Dueño de organización (según plan)
- org_member: Miembro de organización (según plan org)
- user: Usuario individual (según plan personal)';
