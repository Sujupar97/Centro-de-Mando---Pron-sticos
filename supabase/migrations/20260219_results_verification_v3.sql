-- Migration: Results Verification System V3
-- Date: 2026-02-19
-- Purpose: Add result tracking columns to value_picks_v2, enrich pick_results_v2, create verification_runs log table

-- ═══════════════════════════════════════════════════════════════
-- 1. value_picks_v2: Add result tracking columns
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE value_picks_v2
  ADD COLUMN IF NOT EXISTS result TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_score TEXT;

CREATE INDEX IF NOT EXISTS idx_value_picks_v2_result ON value_picks_v2(result);
CREATE INDEX IF NOT EXISTS idx_value_picks_v2_verified_at ON value_picks_v2(verified_at);

-- ═══════════════════════════════════════════════════════════════
-- 2. pick_results_v2: Add enrichment columns for display
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE pick_results_v2
  ADD COLUMN IF NOT EXISTS league_name TEXT,
  ADD COLUMN IF NOT EXISTS home_team TEXT,
  ADD COLUMN IF NOT EXISTS away_team TEXT,
  ADD COLUMN IF NOT EXISTS actual_score TEXT;

-- ═══════════════════════════════════════════════════════════════
-- 3. verification_runs: CRON execution log
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS verification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  fixtures_checked INTEGER DEFAULT 0,
  picks_verified INTEGER DEFAULT 0,
  parlays_verified INTEGER DEFAULT 0,
  gemini_calls INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running', -- running, success, partial, failed
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_runs_date ON verification_runs(run_date);
CREATE INDEX IF NOT EXISTS idx_verification_runs_status ON verification_runs(status);

-- RLS
ALTER TABLE verification_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on verification_runs" ON verification_runs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users read verification_runs" ON verification_runs
  FOR SELECT USING (auth.role() = 'authenticated');
