-- Migration: Fix predictions RLS policy to allow public read access
-- Date: 2025-12-26

-- Drop existing policies
DROP POLICY IF EXISTS "Public predictions are viewable by everyone" ON public.predictions;
DROP POLICY IF EXISTS "Auth users can insert predictions" ON public.predictions;

-- Create new policies
CREATE POLICY "Anyone can read predictions" 
  ON public.predictions 
  FOR SELECT 
  USING (true);

CREATE POLICY "Service can manage predictions" 
  ON public.predictions 
  FOR ALL
  USING (true)
  WITH CHECK (true);
