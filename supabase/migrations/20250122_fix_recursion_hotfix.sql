-- HOTFIX: Fix Infinite Recursion in RLS Policies
-- Description: Uses SECURITY DEFINER functions to bypass RLS loops between profiles and organization_members
-- Date: 2025-01-22

-- 1. Helper to check superadmin without triggering RLS recursively
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

-- 2. Helper to get my organizations without triggering RLS recursively
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

-- 3. Replace the recursive Profiles policies

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

DROP POLICY IF EXISTS "Superadmins can view all profiles" ON profiles;
CREATE POLICY "Superadmins can view all profiles"
  ON profiles FOR ALL
  USING (auth_is_superadmin());

-- 4. Update Organization Members Superadmin policy to be safe too
DROP POLICY IF EXISTS "Superadmins can manage all memberships" ON organization_members;
CREATE POLICY "Superadmins can manage all memberships"
  ON organization_members FOR ALL
  USING (auth_is_superadmin());
