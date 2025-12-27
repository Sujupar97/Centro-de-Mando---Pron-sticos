-- Add match_date column to analysis_runs
-- This stores the official date of the match being analyzed, NOT when the analysis was created.

ALTER TABLE public.analysis_runs 
ADD COLUMN IF NOT EXISTS match_date DATE;

-- Create index for efficient querying by match date
CREATE INDEX IF NOT EXISTS idx_analysis_runs_match_date ON public.analysis_runs(match_date);

-- Backfill existing records using created_at as best guess
-- (Assumes analyses were done on the same day as the match)
UPDATE public.analysis_runs
SET match_date = DATE(created_at AT TIME ZONE 'UTC')
WHERE match_date IS NULL;
