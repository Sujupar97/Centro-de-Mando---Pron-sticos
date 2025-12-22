-- FINAL FIX: Comprehensive RLS Policy Overhaul
-- Description: Replaces recursive RLS policies with SECURITY DEFINER functions for ALL tables
-- Date: 2025-01-22

-- 1. Helper: Get IDs of Organizations where I am Admin or Owner
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

-- 2. Helper: Get IDs of Organizations where I am a Member (Any role)
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

-- 3. Helper: Check if Superadmin
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

-- =====================================================
-- FIX ORGANIZATION_MEMBERS POLICIES
-- =====================================================
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmins can manage all memberships" ON organization_members;
CREATE POLICY "Superadmins can manage all memberships"
  ON organization_members FOR ALL
  USING (auth_is_superadmin());

DROP POLICY IF EXISTS "Organization owners/admins can view their org members" ON organization_members;
CREATE POLICY "Organization owners/admins can view their org members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (SELECT * FROM auth_get_my_admin_org_ids())
  );

DROP POLICY IF EXISTS "Organization owners/admins can invite members" ON organization_members;
CREATE POLICY "Organization owners/admins can invite members"
  ON organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT * FROM auth_get_my_admin_org_ids())
  );

DROP POLICY IF EXISTS "Organization owners/admins can remove members" ON organization_members;
CREATE POLICY "Organization owners/admins can remove members"
  ON organization_members FOR DELETE
  USING (
    organization_id IN (SELECT * FROM auth_get_my_admin_org_ids())
  );

-- Keep "Users can view their own memberships" (safe, non-recursive)
DROP POLICY IF EXISTS "Users can view their own memberships" ON organization_members;
CREATE POLICY "Users can view their own memberships"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());


-- =====================================================
-- FIX ORGANIZATION_INVITATIONS POLICIES
-- =====================================================
ALTER TABLE organization_invitations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmins can manage all invitations" ON organization_invitations;
CREATE POLICY "Superadmins can manage all invitations"
  ON organization_invitations FOR ALL
  USING (auth_is_superadmin());

DROP POLICY IF EXISTS "Organization admins can manage invitations" ON organization_invitations;
CREATE POLICY "Organization admins can manage invitations"
  ON organization_invitations FOR ALL
  USING (
    organization_id IN (SELECT * FROM auth_get_my_admin_org_ids())
  );

-- Keep "Users can view invitations sent to their email" (safe)
DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON organization_invitations;
CREATE POLICY "Users can view invitations sent to their email"
  ON organization_invitations FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );


-- =====================================================
-- FIX PROFILES POLICIES
-- =====================================================
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmins can view all profiles" ON profiles;
CREATE POLICY "Superadmins can view all profiles"
  ON profiles FOR ALL
  USING (auth_is_superadmin());

DROP POLICY IF EXISTS "Members can view profiles in same org" ON profiles;
CREATE POLICY "Members can view profiles in same org"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT user_id
      FROM organization_members
      WHERE organization_id IN (SELECT * FROM auth_get_my_org_ids())
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());
