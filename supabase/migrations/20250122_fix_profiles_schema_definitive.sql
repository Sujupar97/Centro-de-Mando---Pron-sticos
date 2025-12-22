-- DEFINITIVE FIX: Synchronize Profiles Schema with Auth
-- Description: Ensures profiles table has ALL fields expected by the app (email, avatar_url, full_name) and syncs data.
-- Date: 2025-01-22

-- 1. Ensure Columns Exist (Safe to run multiple times)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. Create Synchronization Function (SECURITY DEFINER to access auth.users)
CREATE OR REPLACE FUNCTION sync_profiles_from_auth()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync Email
  UPDATE profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id
  AND p.email IS NULL;

  -- Sync Metadata (Avatar & Full Name)
  UPDATE profiles p
  SET 
    avatar_url = COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url'),
    full_name = COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email)
  FROM auth.users u
  WHERE p.id = u.id
  AND (p.avatar_url IS NULL OR p.full_name IS NULL);
END;
$$;

-- 3. Execute Sync
SELECT sync_profiles_from_auth();

-- 4. Update Trigger for COMPLETE future sync
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    'user' -- Default role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url);
    
  RETURN NEW;
END;
$$;

-- Ensure trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Grant permissions just in case
GRANT SELECT, UPDATE ON profiles TO authenticated;
