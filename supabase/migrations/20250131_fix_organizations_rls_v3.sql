-- ============================================
-- FIX DEFINITIVO V3 (Con nombres nuevos)
-- ============================================

-- 1. Eliminar política problemática (con el nombre exacto que dio error)
DROP POLICY IF EXISTS "Admin can view all, users view their orgs" ON public.organizations;

-- 2. Eliminar otras políticas antiguas por si acaso
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;

-- 3. Crear nueva política con nombre SIN espacios (snake_case) para evitar problemas
CREATE POLICY "admin_select_all_orgs" ON public.organizations
  FOR SELECT USING (
    -- Opción A: Es Admin (verificación directa en tabla profiles)
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('superadmin', 'platform_owner', 'agency_admin')
    )
    OR
    -- Opción B: Es Miembro de la organización
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
    )
  );

-- 4. Asegurar RLS activo
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 5. Verificación inmediata
-- Si esto devuelve filas, todo está arreglado
SELECT count(*) as total_organizaciones FROM public.organizations;
