-- ============================================
-- Migración: Profesionalizar Sistema de Roles
-- Fecha: 2026-02-23
-- ============================================
-- Migra profiles.role de enum a TEXT con 5 roles modernos.
-- Crea trigger de sincronización automática para miembros de la org de agencia.
-- Fix inmediato para Johann (johanngonza1999@gmail.com).

-- ============================================
-- PASO 0: Eliminar TODAS las dependencias de profiles.role
-- ============================================
-- Policies en user_subscriptions
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Platform and Agency admins can manage subscriptions" ON public.user_subscriptions;

-- Policies en organizations que referencian profiles.role
DROP POLICY IF EXISTS "admin_select_all_v4" ON public.organizations;
DROP POLICY IF EXISTS "admin_select_all_v3" ON public.organizations;
DROP POLICY IF EXISTS "admin_select_all_v2" ON public.organizations;
DROP POLICY IF EXISTS "admin_select_all" ON public.organizations;
DROP POLICY IF EXISTS "Superadmins can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Agency admins can view all organizations" ON public.organizations;

-- Policies en profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON public.profiles;

-- Policies en organization_members
DROP POLICY IF EXISTS "Superadmins can manage all memberships" ON public.organization_members;

-- Policies en analisis
DROP POLICY IF EXISTS "analisis_select_policy" ON public.analisis;
DROP POLICY IF EXISTS "analisis_insert_policy" ON public.analisis;

-- Función get_user_plan (depende de profiles.role)
DROP FUNCTION IF EXISTS public.get_user_plan(UUID, UUID);

-- Función handle_new_user (inserta en profiles.role)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Índice en profiles.role
DROP INDEX IF EXISTS idx_profiles_role;

-- ============================================
-- PASO 1: Migrar profiles.role de ENUM a TEXT
-- ============================================

-- 1a. Guardar datos actuales en columna temporal
ALTER TABLE public.profiles ADD COLUMN role_text TEXT;
UPDATE public.profiles SET role_text = role::TEXT;

-- 1b. Eliminar columna enum (ya no tiene dependencias) y recrear como TEXT
ALTER TABLE public.profiles DROP COLUMN role CASCADE;
ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';

-- 1c. Restaurar datos con mapeo a nombres modernos
UPDATE public.profiles SET role = CASE
  WHEN role_text = 'superadmin' THEN 'platform_owner'
  WHEN role_text = 'admin' THEN 'user'
  WHEN role_text = 'usuario' THEN 'user'
  WHEN role_text = 'user' THEN 'user'
  WHEN role_text IN ('platform_owner', 'agency_admin', 'org_owner', 'org_member') THEN role_text
  ELSE 'user'
END;

-- 1d. Limpiar columna temporal
ALTER TABLE public.profiles DROP COLUMN role_text;

-- 1e. Constraint para validar valores permitidos
ALTER TABLE public.profiles ADD CONSTRAINT valid_profile_role
  CHECK (role IN ('platform_owner', 'agency_admin', 'org_owner', 'org_member', 'user'));

-- 1f. Índice para búsquedas por rol
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================
-- PASO 2: Recrear RLS policies con TEXT roles
-- ============================================

-- user_subscriptions: agency admins can manage all
CREATE POLICY "Platform and Agency admins can manage subscriptions" ON public.user_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('platform_owner', 'agency_admin')
    )
  );

-- organizations: agency can view all
CREATE POLICY "admin_select_all_v4" ON public.organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('platform_owner', 'agency_admin')
    )
    OR
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- profiles: users can view own
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid()
        AND p2.role IN ('platform_owner', 'agency_admin')
    )
  );

-- organization_members: superadmins can manage all
CREATE POLICY "Superadmins can manage all memberships" ON public.organization_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('platform_owner', 'agency_admin')
    )
  );

-- ============================================
-- PASO 3: Marcar organización de la agencia
-- ============================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_agency BOOLEAN DEFAULT false;

-- La org del platform_owner es la org de agencia
UPDATE public.organizations SET is_agency = true
WHERE id = (
  SELECT organization_id FROM public.profiles
  WHERE role = 'platform_owner'
  LIMIT 1
);

-- ============================================
-- PASO 4: Fix inmediato para Johann
-- ============================================

UPDATE public.profiles
SET role = 'agency_admin'
WHERE email = 'johanngonza1999@gmail.com';

-- Asegurar que Johann es miembro de la org de agencia
INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
SELECT
  o.id,
  p.id,
  'admin',
  (SELECT id FROM public.profiles WHERE role = 'platform_owner' LIMIT 1)
FROM public.profiles p
CROSS JOIN public.organizations o
WHERE p.email = 'johanngonza1999@gmail.com'
  AND o.is_agency = true
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'admin';

-- ============================================
-- PASO 5: Trigger de sincronización automática
-- ============================================

-- 5a. Función para INSERT/UPDATE en organization_members
CREATE OR REPLACE FUNCTION public.sync_agency_member_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_is_agency BOOLEAN;
BEGIN
  SELECT is_agency INTO v_is_agency
  FROM public.organizations
  WHERE id = NEW.organization_id;

  IF v_is_agency = true THEN
    IF NEW.role = 'owner' THEN
      UPDATE public.profiles SET role = 'platform_owner' WHERE id = NEW.user_id;
    ELSIF NEW.role = 'admin' THEN
      UPDATE public.profiles SET role = 'agency_admin' WHERE id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_agency_member_role ON public.organization_members;
CREATE TRIGGER trg_sync_agency_member_role
  AFTER INSERT OR UPDATE OF role ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_agency_member_role();

-- 5b. Función para DELETE de organization_members
CREATE OR REPLACE FUNCTION public.unsync_agency_member_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_is_agency BOOLEAN;
BEGIN
  SELECT is_agency INTO v_is_agency
  FROM public.organizations
  WHERE id = OLD.organization_id;

  IF v_is_agency = true THEN
    UPDATE public.profiles SET role = 'user' WHERE id = OLD.user_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_unsync_agency_member_role ON public.organization_members;
CREATE TRIGGER trg_unsync_agency_member_role
  AFTER DELETE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.unsync_agency_member_role();

-- ============================================
-- PASO 6: Recrear handle_new_user() para TEXT
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_slug TEXT;
  counter INTEGER := 0;
BEGIN
  org_slug := LOWER(SPLIT_PART(NEW.email, '@', 1));
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) LOOP
    counter := counter + 1;
    org_slug := LOWER(SPLIT_PART(NEW.email, '@', 1)) || '-' || counter;
  END LOOP;

  INSERT INTO public.organizations (name, slug, status, subscription_plan, created_by)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)) || '''s Organization',
    org_slug, 'active', 'free', NEW.id
  ) RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, full_name, avatar_url, email, role, organization_id, is_org_owner)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    'user',
    new_org_id,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    organization_id = COALESCE(profiles.organization_id, EXCLUDED.organization_id);

  INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
  VALUES (new_org_id, NEW.id, 'owner', NEW.id)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
'Crea org personal, perfil y membresía para nuevos usuarios. Rol default: user (TEXT).';

-- ============================================
-- PASO 7: Recrear get_user_plan para TEXT
-- ============================================

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
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_user_id;

  -- Admin bypass: platform_owner y agency_admin tienen acceso total
  IF v_user_role IN ('platform_owner', 'agency_admin') THEN
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

  -- Usuarios normales: buscar suscripción activa
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

  -- Sin suscripción = plan free
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
'Plan de suscripción del usuario. platform_owner y agency_admin reciben acceso ilimitado.
Roles válidos: platform_owner, agency_admin, org_owner, org_member, user.';

-- ============================================
-- PASO 8: Limpiar enums antiguos
-- ============================================

DROP TYPE IF EXISTS user_role_original CASCADE;
DROP TYPE IF EXISTS user_role_new CASCADE;
