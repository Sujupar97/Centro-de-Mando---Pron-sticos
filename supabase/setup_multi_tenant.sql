/**
 * ONE-TIME MIGRATION SCRIPT - FIXED VERSION
 * Execute this ONCE to create multi-tenant structure
 * 
 * Usage:
 * 1. Go to Supabase Dashboard → SQL Editor
 * 2. Copy and paste this entire script
 * 3. Click "Run"
 */

-- =====================================================
-- PART 1: CREATE ALL TABLES FIRST (No policies yet)
-- =====================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'pro', 'enterprise')),
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  subscription_starts_at TIMESTAMP WITH TIME ZONE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'usuario')),
  invited_by UUID,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'usuario')),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID
);

-- =====================================================
-- PART 2: CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);

CREATE INDEX IF NOT EXISTS idx_invitations_org ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON organization_invitations(expires_at);

-- =====================================================
-- PART 3: MODIFY EXISTING TABLES
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='organization_id') THEN
    ALTER TABLE profiles ADD COLUMN organization_id UUID REFERENCES organizations(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='is_org_owner') THEN
    ALTER TABLE profiles ADD COLUMN is_org_owner BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bets' AND column_name='organization_id') THEN
    ALTER TABLE bets ADD COLUMN organization_id UUID REFERENCES organizations(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='analysis_runs' AND column_name='organization_id') THEN
    ALTER TABLE analysis_runs ADD COLUMN organization_id UUID REFERENCES organizations(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='analysis_jobs' AND column_name='organization_id') THEN
    ALTER TABLE analysis_jobs ADD COLUMN organization_id UUID REFERENCES organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='analysis_jobs' AND column_name='organization_id') THEN
    ALTER TABLE analysis_jobs ADD COLUMN organization_id UUID REFERENCES organizations(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='predictions' AND column_name='organization_id') THEN
    ALTER TABLE predictions ADD COLUMN organization_id UUID REFERENCES organizations(id);
  END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_bets_org ON bets(organization_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_org ON analysis_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_org ON analysis_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_predictions_org ON predictions(organization_id);

-- =====================================================
-- PART 4: MIGRATE EXISTING DATA
-- =====================================================

-- Create default organization
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

-- Update profiles
UPDATE profiles 
SET 
  organization_id = '00000000-0000-0000-0000-000000000001'::uuid,
  is_org_owner = (role = 'superadmin')
WHERE organization_id IS NULL;

-- Create org members
INSERT INTO organization_members (organization_id, user_id, role, joined_at)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  id,
  CASE 
    WHEN role = 'superadmin' THEN 'owner'
    WHEN role = 'admin' THEN 'admin'
    ELSE 'usuario'
  END,
  NOW()
FROM profiles
WHERE id NOT IN (SELECT user_id FROM organization_members)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Update bets
UPDATE bets 
SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE organization_id IS NULL;

-- Update analysis_runs
UPDATE analysis_runs 
SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE organization_id IS NULL;

-- Update analysis_jobs
UPDATE analysis_jobs 
SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE organization_id IS NULL;

-- Update predictions
UPDATE predictions 
SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE organization_id IS NULL;

-- =====================================================
-- PART 5: ENABLE RLS AND CREATE POLICIES
-- =====================================================

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Superadmins can do everything on organizations" ON organizations;
DROP POLICY IF EXISTS "Organization members can view their organization" ON organizations;

CREATE POLICY "Superadmins can do everything on organizations"
  ON organizations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'));

CREATE POLICY "Organization members can view their organization"
  ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

-- Organization Members
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Superadmins can manage all memberships" ON organization_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON organization_members;
DROP POLICY IF EXISTS "Organization owners/admins can view their org members" ON organization_members;
DROP POLICY IF EXISTS "Organization owners/admins can invite members" ON organization_members;
DROP POLICY IF EXISTS "Organization owners/admins can remove members" ON organization_members;

CREATE POLICY "Superadmins can manage all memberships"
  ON organization_members FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'));

CREATE POLICY "Users can view their own memberships"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Organization owners/admins can view their org members"
  ON organization_members FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Organization owners/admins can invite members"
  ON organization_members FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Organization owners/admins can remove members"
  ON organization_members FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Organization Invitations
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Superadmins can manage all invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Organization admins can manage invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON organization_invitations;

CREATE POLICY "Superadmins can manage all invitations"
  ON organization_invitations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'));

CREATE POLICY "Organization admins can manage invitations"
  ON organization_invitations FOR ALL
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Users can view invitations sent to their email"
  ON organization_invitations FOR SELECT
  USING (email IN (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Bets
DROP POLICY IF EXISTS "Users can only see their own bets" ON bets;
DROP POLICY IF EXISTS "Users can see bets from their organizations" ON bets;
DROP POLICY IF EXISTS "Users can create bets in their organizations" ON bets;
DROP POLICY IF EXISTS "Users can update their own bets" ON bets;
DROP POLICY IF EXISTS "Users can delete their own bets" ON bets;

CREATE POLICY "Users can see bets from their organizations"
  ON bets FOR SELECT
  USING (
    user_id = auth.uid() 
    OR organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "Users can create bets in their organizations"
  ON bets FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    AND (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    )
  );

CREATE POLICY "Users can update their own bets"
  ON bets FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own bets"
  ON bets FOR DELETE
  USING (user_id = auth.uid());

-- Analysis Runs
DROP POLICY IF EXISTS "Users can view analysis_runs from their organizations" ON analysis_runs;
CREATE POLICY "Users can view analysis_runs from their organizations"
  ON analysis_runs FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Analysis Jobs
DROP POLICY IF EXISTS "Users can view analysis_jobs from their organizations" ON analysis_jobs;
CREATE POLICY "Users can view analysis_jobs from their organizations"
  ON analysis_jobs FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- =====================================================
-- PART 6: UTILITY FUNCTIONS & TRIGGERS
-- =====================================================

-- Predictions
DROP POLICY IF EXISTS "Public predictions are viewable by everyone" ON predictions;
DROP POLICY IF EXISTS "Users can view predictions from their organizations" ON predictions;

CREATE POLICY "Users can view predictions from their organizations"
  ON predictions FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- =====================================================
-- PART 6: UTILITY FUNCTIONS & TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at 
  BEFORE UPDATE ON organizations
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  org_slug TEXT,
  user_role TEXT,
  joined_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, o.slug, om.role, om.joined_at
  FROM organizations o
  INNER JOIN organization_members om ON o.id = om.organization_id
  WHERE om.user_id = p_user_id
  ORDER BY om.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_org_admin(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = p_user_id AND organization_id = p_org_id AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- UPDATED RPC FOR BETS (Multi-tenant)
CREATE OR REPLACE FUNCTION create_bet_with_legs(
    p_date TIMESTAMP WITH TIME ZONE,
    p_event TEXT,
    p_market TEXT,
    p_stake NUMERIC,
    p_odds NUMERIC,
    p_status TEXT,
    p_payout NUMERIC,
    p_image TEXT,
    p_legs JSONB,
    p_organization_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bet_id BIGINT;
    v_leg JSONB;
BEGIN
    -- Insert Bet
    INSERT INTO bets (
        user_id,
        organization_id,
        date,
        event,
        market,
        stake,
        odds,
        status,
        payout,
        image
    ) VALUES (
        auth.uid(),
        p_organization_id,
        p_date,
        p_event,
        p_market,
        p_stake,
        p_odds,
        p_status,
        p_payout,
        p_image
    )
    RETURNING id INTO v_bet_id;

    -- Insert Legs
    IF p_legs IS NOT NULL AND jsonb_array_length(p_legs) > 0 THEN
        FOR v_leg IN SELECT * FROM jsonb_array_elements(p_legs)
        LOOP
            INSERT INTO bet_legs (
                bet_id,
                sport,
                league,
                event,
                market,
                odds,
                status
            ) VALUES (
                v_bet_id,
                v_leg->>'sport',
                v_leg->>'league',
                v_leg->>'event',
                v_leg->>'market',
                (v_leg->>'odds')::numeric,
                v_leg->>'status'
            );
        END LOOP;
    END IF;

    RETURN v_bet_id;
END;
$$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

SELECT 'Organizations created:' as status, COUNT(*) as count FROM organizations;
SELECT 'Organization members created:' as status, COUNT(*) as count FROM organization_members;
SELECT 'Profiles migrated:' as status, COUNT(*) as count FROM profiles WHERE organization_id IS NOT NULL;
SELECT 'Bets migrated:' as status, COUNT(*) as count FROM bets WHERE organization_id IS NOT NULL;
SELECT 'Predictions migrated:' as status, COUNT(*) as count FROM predictions WHERE organization_id IS NOT NULL;
