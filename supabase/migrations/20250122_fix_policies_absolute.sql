-- ABSOLUTE FIX: Reset and Re-apply RLS Policies (Final Version)
-- Description: Drops ALL RLS policies, uses SECURITY DEFINER, and fixes auth.users permission errors.
-- Date: 2025-01-22

-- 1. Ensure public schema permissions are correct
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Define SECURITY DEFINER functions with CASCADE drop
DROP FUNCTION IF EXISTS auth_get_my_admin_org_ids() CASCADE;
DROP FUNCTION IF EXISTS auth_get_my_org_ids() CASCADE;
DROP FUNCTION IF EXISTS auth_is_superadmin() CASCADE;

CREATE OR REPLACE FUNCTION auth_get_my_admin_org_ids()
RETURNS TABLE (org_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid() 
  AND role IN ('owner', 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION auth_get_my_org_ids()
RETURNS TABLE (org_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION auth_is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
END;
$$;

-- 3. Reset PROFILES RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Members can view profiles in same org" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Superadmins can view all profiles"
  ON profiles FOR ALL
  USING (auth_is_superadmin());

CREATE POLICY "Members can view profiles in same org"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT user_id
      FROM organization_members
      WHERE organization_id IN (SELECT * FROM auth_get_my_org_ids())
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());
  
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

GRANT SELECT ON profiles TO authenticated;


-- 4. Reset ORGANIZATION_MEMBERS RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Superadmins can manage all memberships" ON organization_members;
DROP POLICY IF EXISTS "Organization admins can view members" ON organization_members;
DROP POLICY IF EXISTS "Organization admins can insert members" ON organization_members;
DROP POLICY IF EXISTS "Organization admins can delete members" ON organization_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON organization_members;

CREATE POLICY "Superadmins can manage all memberships"
  ON organization_members FOR ALL
  USING (auth_is_superadmin());

CREATE POLICY "Organization admins can view members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (SELECT * FROM auth_get_my_admin_org_ids())
  );

-- FIX: Admins also need to be able to INSERT without checking 'admin' status recursively if it's the first member? 
-- No, usually they are already admins of the org.
CREATE POLICY "Organization admins can insert members"
  ON organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT * FROM auth_get_my_admin_org_ids())
  );

CREATE POLICY "Organization admins can delete members"
  ON organization_members FOR DELETE
  USING (
    organization_id IN (SELECT * FROM auth_get_my_admin_org_ids())
  );

CREATE POLICY "Users can view own memberships"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

GRANT SELECT ON organization_members TO authenticated;


-- 5. Reset ORGANIZATION_INVITATIONS RLS
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Superadmins can manage all invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Organization admins can manage invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON organization_invitations;
DROP POLICY IF EXISTS "Users can view own invitations" ON organization_invitations;

CREATE POLICY "Superadmins can manage all invitations"
  ON organization_invitations FOR ALL
  USING (auth_is_superadmin());

CREATE POLICY "Organization admins can manage invitations"
  ON organization_invitations FOR ALL
  USING (
    organization_id IN (SELECT * FROM auth_get_my_admin_org_ids())
  );

-- CRITICAL FIX: Use auth.jwt() ->> 'email' instad of SELECT FROM auth.users
-- Authenticated users CANNOT select from auth.users table directly.
CREATE POLICY "Users can view own invitations"
  ON organization_invitations FOR SELECT
  USING (
    email = (auth.jwt() ->> 'email')
  );

GRANT SELECT ON organization_invitations TO authenticated;
