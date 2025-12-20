ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS is_won BOOLEAN;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS result_verified_at TIMESTAMP WITH TIME ZONE;
