-- Migration: Fix Profiles RLS for Multi-Tenant Visibility
-- Description: Allows members to view profiles of their colleagues
-- Author: Sistema SaaS Implementation
-- Date: 2025-01-22

-- 1. Enable RLS on profiles (ensure it's on)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies if any (to avoid conflicts, though we usually add NEW ones)
-- We'll just add new permissive ones. If there's a strict "view own only" policy, these OR policies will open it up.

-- Policy: Superadmins can view/edit ALL profiles
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON profiles;
CREATE POLICY "Superadmins can view all profiles"
  ON profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- Policy: Organization Members can view profiles of users in the SAME organization
DROP POLICY IF EXISTS "Members can view profiles in same org" ON profiles;
CREATE POLICY "Members can view profiles in same org"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM organization_members my_mem
      JOIN organization_members other_mem ON my_mem.organization_id = other_mem.organization_id
      WHERE my_mem.user_id = auth.uid() 
        AND other_mem.user_id = profiles.id
    )
  );
  
-- Policy: Organization Admins/Owners can UPDATE profiles of members in their org (optional, but requested "manage data")
-- Actually, usually users manage their own profile. Admins manage "Role" (in org_members), not the user's name/avatar.
-- But user asked "manage my data as organization and user".
-- We will allow users to edit THEIR OWN profile.

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Fix for "Permission denied for table users" often implies specific grant issues if profiles is a view, but here it's a table.
-- The RLS above should fix the "SELECT * FROM profiles WHERE id IN (...)" failing for other users.
