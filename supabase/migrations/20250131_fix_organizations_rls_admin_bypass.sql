-- ============================================
-- FIX: Política RLS de Organizations para Admin
-- Fecha: 2025-12-31
-- ============================================
-- 
-- PROBLEMA:
-- Los superadmin/platform_owner no pueden ver organizaciones
-- de las que no son miembros explícitos.
-- 
-- SOLUCIÓN:
-- Agregar bypass de admin en la política RLS.
-- Los roles admin deben ver TODAS las organizaciones.

-- ============================================
-- PASO 1: Crear función helper is_admin()
-- ============================================
-- Esta función será reutilizada en múltiples políticas RLS

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
    AND role IN ('superadmin', 'platform_owner', 'agency_admin')
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin IS 'Verifica si el usuario tiene un rol administrativo (superadmin, platform_owner, agency_admin)';

-- ============================================
-- PASO 2: Identificar y eliminar política existente
-- ============================================

-- Primero, listar políticas existentes (para debugging)
-- Esto no devuelve nada, solo se ejecuta internamente
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'organizations' 
        AND cmd = 'SELECT'
    LOOP
        RAISE NOTICE 'Encontrada política SELECT: %', policy_name;
    END LOOP;
END $$;

-- Eliminar políticas SELECT existentes en organizations
-- (pueden existir múltiples con nombres diferentes)
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view own organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Allow members to view their organization" ON public.organizations;

-- ============================================
-- PASO 3: Crear nueva política con bypass de admin
-- ============================================

CREATE POLICY "Admin can view all, users view their orgs" ON public.organizations
  FOR SELECT USING (
    -- BYPASS: Admins ven TODO
    public.is_admin(auth.uid())
    OR
    -- Usuarios normales solo ven organizaciones donde son miembros
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Admin can view all, users view their orgs" ON public.organizations IS 
  'Superadmin/platform_owner/agency_admin pueden ver todas las organizaciones. Usuarios normales solo ven organizaciones donde son miembros.';

-- ============================================
-- PASO 4: Verificar que RLS sigue habilitado
-- ============================================

-- Asegurar que RLS está activo
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 5: Testing (comentado para producción)
-- ============================================

-- Para testing manual después de la migración:
-- 
-- 1. Como superadmin:
--    SELECT COUNT(*) FROM organizations;
--    -- Debe retornar TODAS las organizaciones
--
-- 2. Como usuario normal:
--    SELECT COUNT(*) FROM organizations;
--    -- Debe retornar solo organizaciones donde es miembro
--
-- 3. Verificar función helper:
--    SELECT is_admin('USER_ID_AQUI');
--    -- Debe retornar true para superadmin, false para usuario normal

-- ============================================
-- PASO 6: Políticas adicionales (si no existen)
-- ============================================

-- Asegurar que existen políticas básicas para INSERT/UPDATE/DELETE
-- (Solo crear si no existen)

DO $$
BEGIN
    -- Política INSERT: Solo admins o miembros con permisos
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organizations' 
        AND policyname = 'Admin or owner can insert organizations'
    ) THEN
        CREATE POLICY "Admin or owner can insert organizations" ON public.organizations
          FOR INSERT WITH CHECK (
            public.is_admin(auth.uid())
          );
    END IF;

    -- Política UPDATE: Admins o owners de la org
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organizations' 
        AND policyname = 'Admin or owner can update organizations'
    ) THEN
        CREATE POLICY "Admin or owner can update organizations" ON public.organizations
          FOR UPDATE USING (
            public.is_admin(auth.uid())
            OR
            EXISTS (
              SELECT 1 FROM public.organization_members
              WHERE organization_id = organizations.id
              AND user_id = auth.uid()
              AND role = 'owner'
            )
          );
    END IF;

    -- Política DELETE: Solo admins
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organizations' 
        AND policyname = 'Only admin can delete organizations'
    ) THEN
        CREATE POLICY "Only admin can delete organizations" ON public.organizations
          FOR DELETE USING (
            public.is_admin(auth.uid())
          );
    END IF;
END $$;

-- ============================================
-- Registro de cambios
-- ============================================

COMMENT ON TABLE public.organizations IS 'Organizaciones - RLS actualizado 2025-12-31: Superadmin puede ver todas las orgs';

-- Fin de migración
