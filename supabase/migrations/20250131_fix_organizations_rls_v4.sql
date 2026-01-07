-- ============================================
-- FIX DEFINITIVO V4 (Error de Tipos ENUM)
-- ============================================

-- PROBLEMA IDENTIFICADO:
-- La columna 'role' es un tipo ENUM, no texto. 
-- Al comparar con valores no existentes en el ENUM ('platform_owner'), Postgres lanza error 22P02.

-- SOLUCIÓN:
-- Convertir (castear) la columna role a ::text antes de comparar.
-- "role::text" permite comparar con CUALQUIER cadena sin dar error.

-- 1. Limpieza de intentos anteriores
DROP POLICY IF EXISTS "admin_select_all_orgs" ON public.organizations;
DROP POLICY IF EXISTS "Admin can view all, users view their orgs" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;

-- 2. Crear Política Robusta (Type-Safe)
CREATE POLICY "admin_select_all_v4" ON public.organizations
  FOR SELECT USING (
    -- Opción A: Es Admin (Con casting seguro a texto)
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      -- 👇 EL CAMBIO CLAVE ESTÁ AQUÍ: role::text
      AND role::text IN ('superadmin', 'platform_owner', 'agency_admin', 'admin')
    )
    OR
    -- Opción B: Es Miembro
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
    )
  );

-- 3. Asegurar RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 4. Verificación
SELECT count(*) as total_organizaciones FROM public.organizations;
