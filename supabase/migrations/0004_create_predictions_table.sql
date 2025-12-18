-- Create Predictions Table
CREATE TABLE IF NOT EXISTS public.predictions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    analysis_run_id UUID REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
    fixture_id BIGINT NOT NULL, -- API Fixture ID
    market TEXT NOT NULL,
    selection TEXT NOT NULL,
    probability NUMERIC NOT NULL,
    confidence TEXT,
    reasoning TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Public predictions are viewable by everyone" ON public.predictions;
CREATE POLICY "Public predictions are viewable by everyone" ON public.predictions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users can insert predictions" ON public.predictions;
CREATE POLICY "Auth users can insert predictions" ON public.predictions FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');
