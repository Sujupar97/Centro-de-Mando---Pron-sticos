-- MIGRATION: Add Permissions Column to Organization Members
-- Description: Adds a JSONB column to store granular permissions flags for each member.
-- Date: 2025-01-22

-- 1. Add permissions column
ALTER TABLE organization_members 
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- 2. Update existing members to have default permissions based on role
-- Owners/Admins get all permissions enabled by default (conceptually or explicitly)
-- Users get basic permissions.

UPDATE organization_members
SET permissions = '{"can_manage_team": true, "can_view_analysis": true, "can_create_bets": true, "can_view_financials": true}'::jsonb
WHERE role IN ('owner', 'admin');

UPDATE organization_members
SET permissions = '{"can_manage_team": false, "can_view_analysis": true, "can_create_bets": true, "can_view_financials": false}'::jsonb
WHERE role = 'usuario';

-- 3. Grant usage if needed (covered by existing RLS mostly, but good to be safe)
-- No extra grants needed for column addition usually if table is accessible.
