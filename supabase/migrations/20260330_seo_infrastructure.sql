-- ============================================
-- SEO Infrastructure: seo_pages table + league slugs
-- Enables programmatic SEO pages for every analyzed match
-- ============================================

-- 1. Add slug column to allowed_leagues
ALTER TABLE public.allowed_leagues ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 2. Populate league slugs based on existing data
UPDATE public.allowed_leagues SET slug = CASE api_league_id
  -- England
  WHEN 39 THEN 'premier-league'
  WHEN 40 THEN 'championship'
  WHEN 45 THEN 'fa-cup'
  WHEN 48 THEN 'efl-cup'
  -- Spain
  WHEN 140 THEN 'la-liga'
  WHEN 141 THEN 'segunda-division'
  WHEN 143 THEN 'copa-del-rey'
  -- Germany
  WHEN 78 THEN 'bundesliga'
  WHEN 79 THEN '2-bundesliga'
  WHEN 81 THEN 'dfb-pokal'
  -- Italy
  WHEN 135 THEN 'serie-a'
  WHEN 136 THEN 'serie-b'
  WHEN 137 THEN 'coppa-italia'
  -- France
  WHEN 61 THEN 'ligue-1'
  WHEN 62 THEN 'ligue-2'
  WHEN 66 THEN 'coupe-de-france'
  -- Portugal
  WHEN 94 THEN 'primeira-liga'
  WHEN 96 THEN 'taca-de-portugal'
  -- Netherlands
  WHEN 88 THEN 'eredivisie'
  WHEN 89 THEN 'eerste-divisie'
  -- Belgium
  WHEN 144 THEN 'pro-league'
  -- Turkey
  WHEN 203 THEN 'super-lig'
  -- European competitions
  WHEN 2 THEN 'champions-league'
  WHEN 3 THEN 'europa-league'
  WHEN 848 THEN 'conference-league'
  WHEN 531 THEN 'uefa-super-cup'
  -- South America
  WHEN 13 THEN 'copa-libertadores'
  WHEN 11 THEN 'copa-sudamericana'
  WHEN 128 THEN 'liga-profesional-argentina'
  WHEN 129 THEN 'copa-argentina'
  WHEN 71 THEN 'serie-a-brasil'
  WHEN 73 THEN 'copa-do-brasil'
  WHEN 239 THEN 'primera-a-colombia'
  WHEN 240 THEN 'copa-colombia'
  WHEN 262 THEN 'liga-mx'
  -- North America
  WHEN 253 THEN 'mls'
  -- International
  WHEN 1 THEN 'world-cup'
  WHEN 4 THEN 'euro-championship'
  WHEN 9 THEN 'copa-america'
  WHEN 15 THEN 'club-world-cup'
  -- Asia
  WHEN 98 THEN 'j1-league'
  WHEN 292 THEN 'k-league-1'
  WHEN 169 THEN 'super-league-china'
  ELSE NULL
END
WHERE slug IS NULL;

-- 3. Create seo_pages table
CREATE TABLE IF NOT EXISTS public.seo_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id INTEGER NOT NULL,
    league_slug TEXT NOT NULL,
    match_slug TEXT NOT NULL,
    home_team_slug TEXT NOT NULL,
    away_team_slug TEXT NOT NULL,
    full_path TEXT NOT NULL UNIQUE,

    -- Denormalized data for fast edge rendering
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    league_name TEXT NOT NULL,
    match_date DATE NOT NULL,
    match_time TEXT,
    home_logo TEXT,
    away_logo TEXT,

    -- SEO metadata
    meta_title TEXT NOT NULL,
    meta_description TEXT NOT NULL,

    -- Content state
    has_analysis BOOLEAN DEFAULT false,
    has_results BOOLEAN DEFAULT false,
    result_correct BOOLEAN,
    home_score INTEGER,
    away_score INTEGER,

    -- Timestamps
    published_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes for frequent query patterns
CREATE INDEX IF NOT EXISTS idx_seo_pages_path ON public.seo_pages(full_path);
CREATE INDEX IF NOT EXISTS idx_seo_pages_league ON public.seo_pages(league_slug, match_date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_pages_home_team ON public.seo_pages(home_team_slug, match_date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_pages_away_team ON public.seo_pages(away_team_slug, match_date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_pages_date ON public.seo_pages(match_date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_pages_fixture ON public.seo_pages(fixture_id);

-- 5. RLS: public read, service_role write
ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read seo_pages"
  ON public.seo_pages FOR SELECT
  USING (true);

CREATE POLICY "Service role manages seo_pages"
  ON public.seo_pages FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_seo_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seo_pages_updated_at
  BEFORE UPDATE ON public.seo_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_pages_updated_at();
