-- MIGRATION: ADD EMAIL TO PROFILES
-- Description: Adds email column to profiles, backfills from auth.users, and ensures future sync.
-- Date: 2025-01-22

-- 1. Add email column
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Create function to backfill email from auth.users (Needs SECURITY DEFINER to read auth.users)
CREATE OR REPLACE FUNCTION sync_emails_to_profiles()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profiles with email from auth.users where missing
  UPDATE profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id
  AND p.email IS NULL;
END;
$$;

-- 3. Run the backfill
SELECT sync_emails_to_profiles();

-- 4. Clean up: Create/Update Trigger to ensure future users get email
-- Assuming there is a handle_new_user function, let's redefine it to include email.
-- If we don't know the exact name, we create a new one safely.
-- But typically Supabase starter has 'handle_new_user'. We will try to replace it if it exists or create new logic.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email -- Now capturing email
  );
  RETURN NEW;
END;
$$;

-- Ensure trigger exists (re-create to be sure it points to our updated function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
