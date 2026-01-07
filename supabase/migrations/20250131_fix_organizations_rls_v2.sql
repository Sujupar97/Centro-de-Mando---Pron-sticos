-- ============================================
-- DIAGNÓSTICO Y FIX: Error en consulta de organizations
-- ============================================
-- 
-- PROBLEMA DETECTADO:
-- La aplicación muestra "0 clientes" y hay errores en consola.
-- Posible causa: La función is_admin() o la política RLS tiene un error.

-- ============================================
-- PASO 1: Verificar que la función is_admin existe
-- ============================================

-- Verificar función
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'is_admin';

-- Si no existe, recrearla:
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = COALESCE(user_id, auth.uid())
    AND role IN ('superadmin', 'platform_owner', 'agency_admin')
  );
END;
$$;

-- ============================================
-- PASO 2: Verificar políticas actuales
-- ============================================

-- Ver todas las políticas de organizations
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'organizations';

-- ============================================
-- PASO 3: SOLUCIÓN TEMPORAL - Política más simple
-- ============================================

-- Eliminar política problemática
DROP POLICY IF EXISTS "Admin can view all, users view their orgs" ON public.organizations;

-- Crear política simplificada (sin función helper por ahora)
CREATE POLICY "Admin can view all, users view their orgs" ON public.organizations
  FOR SELECT USING (
    -- BYPASS: Admins ven TODO (verificación directa sin función)
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('superadmin', 'platform_owner', 'agency_admin')
    )
    OR
    -- Usuarios normales solo ven organizaciones donde son miembros
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
    )
  );

-- ============================================
-- PASO 4: Verificar que RLS está habilitado
-- ============================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 5: Testing manual
-- ============================================

-- Probar la consulta directamente
SELECT id, name, status, created_at 
FROM public.organizations 
ORDER BY created_at DESC;

-- Si esto funciona, el problema está resuelto
