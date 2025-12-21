-- MIGRATION: Fix Infinite Recursion in Organization Members RLS
-- Description: Uses a SECURITY DEFINER function to break the recursion loop in RLS policies.

-- 1. Create a helper function to get user's org IDs without triggering RLS
-- This runs with the privileges of the creator (postgres/superuser), confusing RLS.
CREATE OR REPLACE FUNCTION get_auth_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid();
$$;

-- 2. Update RLS on organization_members
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Drop problematic policies
DROP POLICY IF EXISTS "Organization owners/admins can view their org members" ON organization_members;
DROP POLICY IF EXISTS "Organization owners/admins can invite members" ON organization_members;
DROP POLICY IF EXISTS "Organization owners/admins can remove members" ON organization_members;

-- Generic "Members can view other members of the same org" policy
-- Using the function avoids the recursion because the function bypasses RLS.
CREATE POLICY "View members of my organizations"
ON organization_members FOR SELECT
USING (
    organization_id IN (SELECT get_auth_user_org_ids())
);

-- Re-implement admin management policies safely
CREATE POLICY "Admins can invite members"
ON organization_members FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
    -- This insert check might still be recursive if not careful.
    -- However, INSERT WITH CHECK is evaluated against the *new* row. 
    -- The subquery filters `organization_members` for `auth.uid()`. 
    -- If SELECT policy is fixed (above), this subquery should work fine.
    -- To be extra safe, let's use a similar function for admin orgs.
);

CREATE OR REPLACE FUNCTION get_auth_user_admin_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin');
$$;

DROP POLICY IF EXISTS "Admins can invite members" ON organization_members; -- Redefine

CREATE POLICY "Admins can invite members"
ON organization_members FOR INSERT
WITH CHECK (
    organization_id IN (SELECT get_auth_user_admin_org_ids())
);

CREATE POLICY "Admins can remove members"
ON organization_members FOR DELETE
USING (
    organization_id IN (SELECT get_auth_user_admin_org_ids())
);

-- 3. Optimization: Update other tables to use these functions for speed & safety
-- (Optional but recommended to prevent future recursions)

DROP POLICY IF EXISTS "Users can view analysis_jobs from their organizations" ON analysis_jobs;
-- (We already made analysis global, so no change needed there)

-- Bets still use org isolation
DROP POLICY IF EXISTS "Users can see bets from their organizations" ON bets;

CREATE POLICY "Users can see bets from their organizations"
ON bets FOR SELECT
USING (
    user_id = auth.uid() 
    OR organization_id IN (SELECT get_auth_user_org_ids())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
);
