-- Migration: Create Multi-Tenant SaaS Structure
-- Description: Adds organizations, organization_members, and organization_invitations tables
-- Author: Sistema SaaS Implementation
-- Date: 2025-12-20

-- =====================================================
-- 1. CREATE ORGANIZATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  
  -- Subscription management (for future)
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'pro', 'enterprise')),
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  subscription_starts_at TIMESTAMP WITH TIME ZONE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  
  -- Metadata & settings
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_created_at ON organizations(created_at DESC);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Superadmins can do everything on organizations"
  ON organizations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Organization members can view their organization"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at 
  BEFORE UPDATE ON organizations
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. CREATE ORGANIZATION_MEMBERS TABLE (Junction)
-- =====================================================

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role within the organization
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'usuario')),
  
  -- Audit
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate memberships
  UNIQUE(organization_id, user_id)
);

-- Indexes
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(role);

-- Enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Superadmins can manage all memberships"
  ON organization_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Users can view their own memberships"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Organization owners/admins can view their org members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Organization owners/admins can invite members"
  ON organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Organization owners/admins can remove members"
  ON organization_members FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- 3. CREATE ORGANIZATION_INVITATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'usuario')),
  
  -- Token for magic link
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Audit
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_invitations_org ON organization_invitations(organization_id);
CREATE INDEX idx_invitations_email ON organization_invitations(email);
CREATE INDEX idx_invitations_token ON organization_invitations(token);
CREATE INDEX idx_invitations_expires ON organization_invitations(expires_at);

-- Enable RLS
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Superadmins can manage all invitations"
  ON organization_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Organization admins can manage invitations"
  ON organization_invitations FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can view invitations sent to their email"
  ON organization_invitations FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- =====================================================
-- 4. MODIFY PROFILES TABLE
-- =====================================================

-- Add organization_id column to profiles (nullable for migration)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS is_org_owner BOOLEAN DEFAULT false;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);

-- =====================================================
-- 5. MODIFY BETS TABLE
-- =====================================================

-- Add organization_id column to bets (nullable for migration)
ALTER TABLE bets 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_bets_org ON bets(organization_id);

-- Update RLS policy for bets
DROP POLICY IF EXISTS "Users can only see their own bets" ON bets;

CREATE POLICY "Users can see bets from their organizations"
  ON bets FOR SELECT
  USING (
    user_id = auth.uid() 
    OR organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Users can create bets in their organizations"
  ON bets FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    AND (
      organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'superadmin'
      )
    )
  );

CREATE POLICY "Users can update their own bets"
  ON bets FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own bets"
  ON bets FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- 6. MODIFY ANALYSIS_RUNS TABLE
-- =====================================================

ALTER TABLE analysis_runs 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_org ON analysis_runs(organization_id);

-- RLS Policy
CREATE POLICY "Users can view analysis_runs from their organizations"
  ON analysis_runs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- =====================================================
-- 7. MODIFY ANALYSIS_JOBS TABLE
-- =====================================================

ALTER TABLE analysis_jobs 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_org ON analysis_jobs(organization_id);

-- RLS Policy
CREATE POLICY "Users can view analysis_jobs from their organizations"
  ON analysis_jobs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- =====================================================
-- 8. CREATE DEFAULT ORGANIZATION & MIGRATE DATA
-- =====================================================

-- Create default organization for existing data
INSERT INTO organizations (id, name, slug, status, subscription_plan, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Organización Principal',
  'default',
  'active',
  'enterprise',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Migrate existing profiles to default organization
UPDATE profiles 
SET 
  organization_id = '00000000-0000-0000-0000-000000000001'::uuid,
  is_org_owner = (role = 'superadmin')
WHERE organization_id IS NULL;

-- Create organization_members entries for existing users
INSERT INTO organization_members (organization_id, user_id, role, joined_at)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  id,
  CASE 
    WHEN role = 'superadmin' THEN 'owner'
    WHEN role = 'admin' THEN 'admin'
    ELSE 'usuario'
  END,
  created_at
FROM profiles
WHERE id NOT IN (SELECT user_id FROM organization_members)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Migrate existing bets to default organization
UPDATE bets 
SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE organization_id IS NULL;

-- Migrate existing analysis_runs to default organization
UPDATE analysis_runs 
SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE organization_id IS NULL;

-- Migrate existing analysis_jobs to default organization
UPDATE analysis_jobs 
SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE organization_id IS NULL;

-- =====================================================
-- 9. MAKE organization_id NOT NULL (After migration)
-- =====================================================

-- Now that all data is migrated, make organization_id required
ALTER TABLE bets 
  ALTER COLUMN organization_id SET NOT NULL;

-- =====================================================
-- 10. UTILITY FUNCTIONS
-- =====================================================

-- Function to get user's current organizations
CREATE OR REPLACE FUNCTION get_user_organizations(user_id UUID)
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  org_slug TEXT,
  user_role TEXT,
  joined_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.slug,
    om.role,
    om.joined_at
  FROM organizations o
  INNER JOIN organization_members om ON o.id = om.organization_id
  WHERE om.user_id = $1
  ORDER BY om.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is org admin
CREATE OR REPLACE FUNCTION is_org_admin(user_id UUID, org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = $1
      AND organization_members.organization_id = $2
      AND organization_members.role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Comments
COMMENT ON TABLE organizations IS 'Multi-tenant organizations (accounts/agencies)';
COMMENT ON TABLE organization_members IS 'Junction table for user-organization memberships';
COMMENT ON TABLE organization_invitations IS 'Email invitations to join organizations';
COMMENT ON COLUMN profiles.organization_id IS 'Primary organization for legacy single-org support';
COMMENT ON COLUMN profiles.is_org_owner IS 'Flag for organization owner (deprecated, use organization_members)';
