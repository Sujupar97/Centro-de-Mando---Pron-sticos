-- 0005_comparable_method_schema.sql

-- 1. Table: Match Context (Contexto del Partido)
-- Stores the high-level context inferred or fetched for the analysis.
CREATE TABLE IF NOT EXISTS public.match_context (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    analysis_run_id UUID REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
    
    -- Classification
    competition_type TEXT CHECK (competition_type IN ('League', 'Cup', 'International', 'Friendly', 'Unknown')),
    
    -- Pressure / Stakes
    pressure_level TEXT CHECK (pressure_level IN ('High', 'Medium', 'Low', 'Unknown')),
    pressure_reason TEXT, -- Ex: "Relegation zone", "Top 4 contender"
    
    -- Priority
    priority_competition TEXT, -- Ex: "La Liga", "Champions League"
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Table: Analysis Evidence (Evidencia del Análisis - Los Bloques)
-- Stores the specific list of fixtures used to build the "Comparable Blocks".
-- This allows us to say: "Review based on THESE 10 matches".
CREATE TABLE IF NOT EXISTS public.analysis_evidence (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    analysis_run_id UUID REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
    
    -- The fixture used as evidence (referenced by API ID for portability)
    fixture_api_id BIGINT NOT NULL,
    
    -- The specific block this evidence belongs to
    block_type TEXT CHECK (block_type IN (
        'H_home_last10',   -- Home Team played at Home
        'H_away_last10',   -- Home Team played Away
        'A_home_last10',   -- Away Team played at Home
        'A_away_last10',   -- Away Team played Away
        'H2H',             -- Head to Head
        'Season_H',        -- Home Team Season Result
        'Season_A'         -- Away Team Season Result
    )),
    
    -- Snapshot of the stats at the moment of analysis (to freeze the evidence)
    stats_snapshot JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Security Policies (RLS)
ALTER TABLE public.match_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_evidence ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (public dashboard)
DROP POLICY IF EXISTS "Public read match_context" ON public.match_context;
CREATE POLICY "Public read match_context" ON public.match_context FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read analysis_evidence" ON public.analysis_evidence;
CREATE POLICY "Public read analysis_evidence" ON public.analysis_evidence FOR SELECT USING (true);

-- Allow insert/update only to authenticated users (including service role)
DROP POLICY IF EXISTS "Auth manage match_context" ON public.match_context;
CREATE POLICY "Auth manage match_context" ON public.match_context FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Auth manage analysis_evidence" ON public.analysis_evidence;
CREATE POLICY "Auth manage analysis_evidence" ON public.analysis_evidence FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
