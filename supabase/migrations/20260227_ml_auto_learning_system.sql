-- ============================================================
-- ML Auto-Learning System
-- Sistema de aprendizaje automatizado con auditoría humana
-- 2026-02-27
-- ============================================================

-- 1. Training Runs: registro idempotente de entrenamiento por día
CREATE TABLE IF NOT EXISTS ml_training_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_date DATE NOT NULL,
  triggered_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'rolled_back')),
  picks_processed INTEGER NOT NULL DEFAULT 0,
  picks_won INTEGER NOT NULL DEFAULT 0,
  picks_lost INTEGER NOT NULL DEFAULT 0,
  picks_void INTEGER NOT NULL DEFAULT 0,
  calibration_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  new_calibration JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(training_date)
);

-- 2. Calibration Factors: factores de corrección activos por dimensión
CREATE TABLE IF NOT EXISTS ml_calibration_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension TEXT NOT NULL,
  dimension_key TEXT NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  actual_wr NUMERIC(5,2) NOT NULL DEFAULT 0,
  predicted_avg NUMERIC(5,2) NOT NULL DEFAULT 0,
  calibration_factor NUMERIC(5,4) NOT NULL DEFAULT 1.0,
  confidence_adjustment INTEGER DEFAULT 0,
  roi NUMERIC(6,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dimension, dimension_key)
);

-- 3. Learned Patterns: patrones descubiertos (blacklist, boost, warning)
CREATE TABLE IF NOT EXISTS ml_learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('blacklist', 'boost', 'warning', 'insight')),
  scope TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
  based_on_sample INTEGER NOT NULL DEFAULT 0,
  based_on_wr NUMERIC(5,2),
  auto_generated BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  training_run_id UUID REFERENCES ml_training_runs(id)
);

-- 4. Parlay Calibration: calibración específica para parlays
CREATE TABLE IF NOT EXISTS ml_parlay_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legs_count INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  actual_wr NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_odds NUMERIC(6,2),
  roi NUMERIC(6,2),
  recommended_max_legs INTEGER,
  recommended_min_leg_prob NUMERIC(5,2),
  status TEXT DEFAULT 'active',
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(legs_count, risk_level)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ml_training_runs_date ON ml_training_runs(training_date);
CREATE INDEX IF NOT EXISTS idx_ml_training_runs_status ON ml_training_runs(status);
CREATE INDEX IF NOT EXISTS idx_ml_calibration_factors_active ON ml_calibration_factors(dimension, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ml_learned_patterns_active ON ml_learned_patterns(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_ml_parlay_calibration_active ON ml_parlay_calibration(status) WHERE status = 'active';

-- RLS policies
ALTER TABLE ml_training_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_calibration_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_parlay_calibration ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated users (data is global, not per-org)
CREATE POLICY "ml_training_runs_select" ON ml_training_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "ml_calibration_factors_select" ON ml_calibration_factors FOR SELECT TO authenticated USING (true);
CREATE POLICY "ml_learned_patterns_select" ON ml_learned_patterns FOR SELECT TO authenticated USING (true);
CREATE POLICY "ml_parlay_calibration_select" ON ml_parlay_calibration FOR SELECT TO authenticated USING (true);

-- Write access for all authenticated (edge functions use service role anyway)
CREATE POLICY "ml_training_runs_insert" ON ml_training_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ml_calibration_factors_all" ON ml_calibration_factors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ml_learned_patterns_all" ON ml_learned_patterns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ml_parlay_calibration_all" ON ml_parlay_calibration FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add ml_auto_learning_enabled to system_settings if not exists
INSERT INTO system_settings (key, value, description)
VALUES ('ml_auto_learning_enabled', 'false'::jsonb, 'Activa/Desactiva el sistema de aprendizaje automatizado')
ON CONFLICT (key) DO NOTHING;
