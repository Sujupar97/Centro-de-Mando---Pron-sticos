-- Fix User Registration: Auto-create Personal Organizations
-- Description: Updates handle_new_user() trigger to create a personal organization for each new user
-- Date: 2025-12-30

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved function that handles organization creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate unique organization slug from email
  org_slug := LOWER(SPLIT_PART(NEW.email, '@', 1));
  
  -- Ensure slug is unique by appending counter if needed
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) LOOP
    counter := counter + 1;
    org_slug := LOWER(SPLIT_PART(NEW.email, '@', 1)) || '-' || counter;
  END LOOP;

  -- 1. Create personal organization for the user
  INSERT INTO public.organizations (
    name,
    slug,
    status,
    subscription_plan,
    created_by
  ) VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)) || '''s Organization',
    org_slug,
    'active',
    'free', -- Default to free plan
    NEW.id
  )
  RETURNING id INTO new_org_id;

  -- 2. Create profile with organization assignment
  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url,
    email,
    role,
    organization_id,
    is_org_owner
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    'user', -- Default role
    new_org_id,
    true -- User is owner of their personal org
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    organization_id = COALESCE(profiles.organization_id, EXCLUDED.organization_id);

  -- 3. Create organization membership (user as owner)
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    invited_by
  ) VALUES (
    new_org_id,
    NEW.id,
    'owner',
    NEW.id
  )
  ON CONFLICT (organization_id, user_id) DO NOTHING;
    
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates personal organization, profile, and membership for new users';
