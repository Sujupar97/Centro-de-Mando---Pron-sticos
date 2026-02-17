-- Migration: Profitability Tracking System
-- Date: 2026-02-14
-- Purpose: Track ROI, yield, and bankroll evolution for all picks

CREATE TABLE IF NOT EXISTS profitability_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  pick_id TEXT NOT NULL,
  job_id UUID,
  fixture_id BIGINT,
  home_team TEXT,
  away_team TEXT,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  odds NUMERIC(6,2) NOT NULL,
  probability NUMERIC(5,2) NOT NULL,
  confidence_tier TEXT NOT NULL,       -- '80-84', '85-89', '90+'
  stake_percentage NUMERIC(4,2) NOT NULL,  -- 2, 3, 4, 5
  stake_amount NUMERIC(10,2),         -- Calculated with reference bankroll
  result TEXT DEFAULT 'pending',       -- 'pending', 'won', 'lost', 'void', 'push'
  profit_loss NUMERIC(10,2),          -- +profit or -loss
  bankroll_after NUMERIC(10,2),       -- Running bankroll total
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_profit_date ON profitability_tracking(date);
CREATE INDEX idx_profit_result ON profitability_tracking(result);
CREATE INDEX idx_profit_job ON profitability_tracking(job_id);
CREATE INDEX idx_profit_market ON profitability_tracking(market);
CREATE INDEX idx_profit_created ON profitability_tracking(created_at DESC);

-- RLS: Allow service role full access, authenticated users read-only
ALTER TABLE profitability_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON profitability_tracking
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read" ON profitability_tracking
  FOR SELECT USING (auth.role() = 'authenticated');
