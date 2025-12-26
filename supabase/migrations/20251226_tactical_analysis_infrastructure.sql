-- Migration: Add tactical analysis infrastructure
-- Date: 2025-12-26
-- Purpose: Support tactical formation analysis and referee statistics

-- Table 1: Match Tactical Data (formations, lineups)
CREATE TABLE IF NOT EXISTS public.match_tactical_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fixture_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    team_name VARCHAR(255),
    formation VARCHAR(10), -- "4-3-3", "4-4-2", etc.
    starting_eleven JSONB, -- [{player_id, name, position, number, grid}]
    substitutes JSONB, -- [{player_id, name, position, number}]
    coach_name VARCHAR(255),
    tactical_notes TEXT, -- AI-generated tactical insights
    match_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(fixture_id, team_id)
);

-- Indexes for tactical data
CREATE INDEX IF NOT EXISTS idx_match_tactical_fixture ON public.match_tactical_data(fixture_id);
CREATE INDEX IF NOT EXISTS idx_match_tactical_team ON public.match_tactical_data(team_id);
CREATE INDEX IF NOT EXISTS idx_match_tactical_formation ON public.match_tactical_data(formation);
CREATE INDEX IF NOT EXISTS idx_match_tactical_date ON public.match_tactical_data(match_date DESC);

-- Table 2: Referee Statistics
CREATE TABLE IF NOT EXISTS public.referee_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referee_id BIGINT,
    referee_name VARCHAR(255) NOT NULL,
    league_id BIGINT,
    league_name VARCHAR(255),
    season INTEGER,
    total_games INTEGER DEFAULT 0,
    avg_yellow_cards DECIMAL(4,2) DEFAULT 0,
    avg_red_cards DECIMAL(4,2) DEFAULT 0,
    avg_fouls DECIMAL(5,2) DEFAULT 0,
    avg_penalties DECIMAL(4,2) DEFAULT 0,
    home_yellow_avg DECIMAL(4,2) DEFAULT 0,
    away_yellow_avg DECIMAL(4,2) DEFAULT 0,
    games_analyzed JSONB, -- [{fixture_id, date, yellow_cards, red_cards}]
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(referee_name, league_id, season)
);

-- Indexes for referee stats
CREATE INDEX IF NOT EXISTS idx_referee_stats_name ON public.referee_stats(referee_name);
CREATE INDEX IF NOT EXISTS idx_referee_stats_league ON public.referee_stats(league_id, season);
CREATE INDEX IF NOT EXISTS idx_referee_stats_updated ON public.referee_stats(last_updated DESC);

-- Enable RLS
ALTER TABLE public.match_tactical_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referee_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read access
DROP POLICY IF EXISTS "Anyone can read tactical data" ON public.match_tactical_data;
CREATE POLICY "Anyone can read tactical data" 
    ON public.match_tactical_data 
    FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Service can manage tactical data" ON public.match_tactical_data;
CREATE POLICY "Service can manage tactical data" 
    ON public.match_tactical_data 
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read referee stats" ON public.referee_stats;
CREATE POLICY "Anyone can read referee stats" 
    ON public.referee_stats 
    FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Service can manage referee stats" ON public.referee_stats;
CREATE POLICY "Service can manage referee stats" 
    ON public.referee_stats 
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.match_tactical_data IS 'Stores tactical formations and lineups for analyzed matches';
COMMENT ON TABLE public.referee_stats IS 'Cached referee statistics for tactical analysis';
