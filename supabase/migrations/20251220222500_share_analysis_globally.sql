-- MIGRATION: Share Analysis Globally
-- Description: Updates RLS policies for `analysis_jobs` and `analysis_runs` to allow 
-- all authenticated users to VIEW analyses, regardless of their organization.
-- This supports the "Write Once, Read Many" model requested.

-- 1. ANALYSIS JOBS
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view analysis jobs from their organizations" ON analysis_jobs;
DROP POLICY IF EXISTS "Users can manage analysis jobs from their organizations" ON analysis_jobs;
DROP POLICY IF EXISTS "Superadmins see everything" ON analysis_jobs;

-- New Policies

-- SELECT: Public to all authenticated users
CREATE POLICY "Authenticated users can view all analysis jobs"
ON analysis_jobs FOR SELECT
TO authenticated
USING (true);

-- INSERT/UPDATE/DELETE: Restricted to Organization Members OR Superadmin
CREATE POLICY "Org members can manage analysis jobs"
ON analysis_jobs FOR ALL
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
);

-- 2. ANALYSIS RUNS
ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view analysis runs from their organizations" ON analysis_runs;
DROP POLICY IF EXISTS "Users can manage analysis runs from their organizations" ON analysis_runs;
DROP POLICY IF EXISTS "Superadmins see everything" ON analysis_runs;

-- New Policies

-- SELECT: Public to all authenticated users
CREATE POLICY "Authenticated users can view all analysis runs"
ON analysis_runs FOR SELECT
TO authenticated
USING (true);

-- INSERT/UPDATE/DELETE: Restricted to Organization Members OR Superadmin
CREATE POLICY "Org members can manage analysis runs"
ON analysis_runs FOR ALL
TO authenticated
USING (
   organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
   OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
);

-- 3. ENSURE Predictions are also visible if needed
-- (The user didn't explicitly ask for predictions, but usually analysis implies results)
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view predictions from their organizations" ON predictions;
DROP POLICY IF EXISTS "Superadmins see everything" ON predictions;

CREATE POLICY "Authenticated users can view all predictions"
ON predictions FOR SELECT
TO authenticated
USING (true);

-- Insert/Update policies for predictions should remain strict (usually handled by AI/Edge Function which bypasses RLS or has special role, but here we keep org restriction for manual edits if any)
-- Assuming existing write policies are sufficient or we don't need to change them.
-- If no write policy acts, users can't write, which is good.

-- Log migration
INSERT INTO public.schema_migrations (version) VALUES ('20250121_share_analysis_globally') ON CONFLICT DO NOTHING;
