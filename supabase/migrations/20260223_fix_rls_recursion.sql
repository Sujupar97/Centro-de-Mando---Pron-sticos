-- ============================================
-- HOTFIX: Corregir recursión infinita en RLS de profiles
-- Fecha: 2026-02-23
-- Error: 42P17 infinite recursion detected in policy for relation "profiles"
-- ============================================
-- La policy "Admins can view all profiles" consulta profiles DENTRO de profiles RLS,
-- causando recursión infinita. Solución: función SECURITY DEFINER que bypasea RLS.

-- ============================================
-- PASO 1: Crear función SECURITY DEFINER para verificar admin
-- ============================================
-- SECURITY DEFINER = se ejecuta con privilegios del creador (postgres),
-- bypasea RLS completamente. No hay recursión.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('platform_owner', 'agency_admin')
  );
$$;

-- ============================================
-- PASO 2: Reemplazar policy rota en profiles
-- ============================================

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_platform_admin());

-- ============================================
-- PASO 3: Actualizar otras policies para usar la función
-- ============================================
-- Aunque no causan recursión directa (son en otras tablas),
-- es más limpio y performante usar la misma función.

-- user_subscriptions
DROP POLICY IF EXISTS "Platform and Agency admins can manage subscriptions" ON public.user_subscriptions;
CREATE POLICY "Platform and Agency admins can manage subscriptions" ON public.user_subscriptions
  FOR ALL USING (public.is_platform_admin());

-- organizations
DROP POLICY IF EXISTS "admin_select_all_v4" ON public.organizations;
CREATE POLICY "admin_select_all_v4" ON public.organizations
  FOR SELECT USING (
    public.is_platform_admin()
    OR id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- organization_members
DROP POLICY IF EXISTS "Superadmins can manage all memberships" ON public.organization_members;
CREATE POLICY "Superadmins can manage all memberships" ON public.organization_members
  FOR ALL USING (public.is_platform_admin());
