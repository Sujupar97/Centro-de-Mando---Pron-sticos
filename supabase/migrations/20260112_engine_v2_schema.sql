-- ============================================================================
-- MOTOR DE ANÁLISIS V2 - MIGRACIONES DE BASE DE DATOS
-- Fecha: 2026-01-12
-- Descripción: Schema completo para el pipeline V2 (5 motores)
-- ============================================================================

-- ============================================================================
-- TABLA 1: system_config_v2 (Feature Flags)
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_config_v2 (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature flags iniciales
INSERT INTO system_config_v2 (key, value, description) VALUES
  ('ANALYSIS_ENGINE_V2_ENABLED', '{"enabled": false, "canary_percent": 0}'::jsonb, 'Master switch for V2 engine'),
  ('V2_ENABLED_FIXTURES', '[]'::jsonb, 'List of fixture IDs where V2 is forced ON'),
  ('V2_ENABLED_LEAGUES', '[]'::jsonb, 'List of league IDs where V2 is forced ON'),
  ('V2_MARKET_THRESHOLDS', '{
    "over_2.5_goals": {"min_edge": 0.05, "min_confidence": 60},
    "btts_yes": {"min_edge": 0.06, "min_confidence": 55},
    "corners_over_9.5": {"min_edge": 0.10, "min_confidence": 50},
    "cards_over_4.5": {"min_edge": 0.12, "min_confidence": 50}
  }'::jsonb, 'Edge thresholds by market type')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- TABLA 2: analysis_jobs_v2 (Control de Pipeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS analysis_jobs_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'etl', 'features', 'models', 'value', 'interpret', 'done', 'failed')),
  current_motor TEXT, -- A, B, C, D, E
  input_payload_hash TEXT,
  data_coverage_score INTEGER CHECK (data_coverage_score >= 0 AND data_coverage_score <= 100),
  engine_version TEXT NOT NULL DEFAULT '2.0.0',
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_v2_fixture ON analysis_jobs_v2(fixture_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_v2_status ON analysis_jobs_v2(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_v2_created ON analysis_jobs_v2(created_at DESC);

-- ============================================================================
-- TABLA 3: derived_metrics_v2 (Métricas Cocinadas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS derived_metrics_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES analysis_jobs_v2(id) ON DELETE CASCADE,
  fixture_id INTEGER NOT NULL,
  
  -- Métricas estructuradas
  metrics JSONB NOT NULL,
  -- Ejemplo de estructura:
  -- {
  --   "goals": {"home": {"avg": 1.8, "std": 0.9, "last5": 2.1}, "away": {...}},
  --   "corners": {"home_as_home": {"avg": 5.2, "std": 1.8}, ...},
  --   "cards": {"home": {"avg": 1.9}, "away": {...}, "referee_factor": 1.2},
  --   "clean_sheet_rate": {"home": 0.35, "away": 0.25},
  --   "btts_rate": {"home": 0.65, "away": 0.55}
  -- }
  
  quality_flags JSONB DEFAULT '{}'::jsonb,
  -- Ejemplo:
  -- {
  --   "high_variance_goals": false,
  --   "low_coverage_corners": true,
  --   "missing_lineup": true,
  --   "referee_unknown": false
  -- }
  
  input_summary JSONB, -- Resumen de datos de entrada (para debugging)
  engine_version TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_derived_metrics_v2_fixture ON derived_metrics_v2(fixture_id);
CREATE INDEX IF NOT EXISTS idx_derived_metrics_v2_job ON derived_metrics_v2(job_id);

-- ============================================================================
-- TABLA 4: market_probs_v2 (Probabilidades por Mercado)
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_probs_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES analysis_jobs_v2(id) ON DELETE CASCADE,
  fixture_id INTEGER NOT NULL,
  
  market TEXT NOT NULL, -- 'over_2.5_goals', 'btts_yes', 'corners_over_9.5', '1x2_home', etc.
  selection TEXT NOT NULL, -- 'Over 2.5', 'Yes', 'Home', etc.
  
  p_model NUMERIC(5,4) NOT NULL CHECK (p_model >= 0 AND p_model <= 1),
  uncertainty NUMERIC(5,4) CHECK (uncertainty >= 0 AND uncertainty <= 1),
  
  model_name TEXT NOT NULL, -- 'poisson_baseline', 'xg_regression', 'historical_rate'
  model_inputs JSONB, -- Inputs usados para reproducibilidad
  rationale TEXT, -- Explicación breve del cálculo
  
  engine_version TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_probs_v2_fixture ON market_probs_v2(fixture_id);
CREATE INDEX IF NOT EXISTS idx_market_probs_v2_job ON market_probs_v2(job_id);
CREATE INDEX IF NOT EXISTS idx_market_probs_v2_market ON market_probs_v2(market);

-- ============================================================================
-- TABLA 5: value_picks_v2 (Picks Finales con Decisión)
-- ============================================================================
CREATE TABLE IF NOT EXISTS value_picks_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES analysis_jobs_v2(id) ON DELETE CASCADE,
  fixture_id INTEGER NOT NULL,
  
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  
  -- Odds y probabilidades
  odds NUMERIC(6,2), -- Puede ser null si no hay odds disponibles
  p_implied NUMERIC(5,4), -- 1/odds, null si no hay odds
  p_model NUMERIC(5,4) NOT NULL,
  edge NUMERIC(5,4), -- p_model - p_implied, null si no hay odds
  
  -- Decisión final
  decision TEXT NOT NULL CHECK (decision IN ('BET', 'WATCH', 'AVOID')),
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  
  -- Justificación estructurada
  risk_notes JSONB DEFAULT '{}'::jsonb,
  -- Ejemplo:
  -- {
  --   "reasons": ["Edge suficiente", "Datos completos"],
  --   "risks": ["Alta varianza en corners"],
  --   "data_gaps": false
  -- }
  
  is_primary_pick BOOLEAN DEFAULT false, -- True para el pick principal
  rank INTEGER, -- 1, 2, 3 para ordenar picks
  
  engine_version TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_value_picks_v2_fixture ON value_picks_v2(fixture_id);
CREATE INDEX IF NOT EXISTS idx_value_picks_v2_job ON value_picks_v2(job_id);
CREATE INDEX IF NOT EXISTS idx_value_picks_v2_decision ON value_picks_v2(decision);

-- ============================================================================
-- TABLA 6: interpretation_v2 (Interpretación de Gemini)
-- ============================================================================
CREATE TABLE IF NOT EXISTS interpretation_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES analysis_jobs_v2(id) ON DELETE CASCADE,
  fixture_id INTEGER NOT NULL,
  
  interpretation_packet JSONB NOT NULL,
  -- Estructura:
  -- {
  --   "tactical_analysis": {...},
  --   "scenario_projection": {"probable": {...}, "alternate": {...}},
  --   "risk_assessment": {...},
  --   "referee_impact": {...}
  -- }
  
  prompt_version TEXT NOT NULL,
  tokens_used INTEGER,
  generation_time_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interpretation_v2_fixture ON interpretation_v2(fixture_id);
CREATE INDEX IF NOT EXISTS idx_interpretation_v2_job ON interpretation_v2(job_id);

-- ============================================================================
-- TABLA 7: reports_v2 (Reporte Final Estructurado)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reports_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES analysis_jobs_v2(id) ON DELETE CASCADE,
  fixture_id INTEGER NOT NULL,
  
  report_packet JSONB NOT NULL,
  -- Estructura completa del reporte según spec (ver implementation_plan.md)
  
  prompt_version TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_v2_fixture ON reports_v2(fixture_id);
CREATE INDEX IF NOT EXISTS idx_reports_v2_job ON reports_v2(job_id);

-- ============================================================================
-- TABLA 8: pick_results_v2 (Backtesting - Resultados Reales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pick_results_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID REFERENCES value_picks_v2(id) ON DELETE SET NULL,
  fixture_id INTEGER NOT NULL,
  
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  
  -- Resultado real
  result TEXT CHECK (result IN ('WON', 'LOST', 'VOID', 'PUSH', 'PENDING')),
  actual_value NUMERIC, -- Valor real (goles, corners, tarjetas, etc.)
  
  -- Métricas de performance
  profit NUMERIC(10,2), -- Ganancia/pérdida en unidades
  stake NUMERIC(10,2) DEFAULT 1, -- Stake usado
  
  verified_at TIMESTAMPTZ,
  verified_by TEXT, -- 'auto' o 'manual'
  
  -- Datos del pick al momento de creación (para análisis post-hoc)
  p_model_at_time NUMERIC(5,4),
  edge_at_time NUMERIC(5,4),
  odds_at_time NUMERIC(6,2),
  engine_version TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pick_results_v2_pick ON pick_results_v2(pick_id);
CREATE INDEX IF NOT EXISTS idx_pick_results_v2_fixture ON pick_results_v2(fixture_id);
CREATE INDEX IF NOT EXISTS idx_pick_results_v2_result ON pick_results_v2(result);
CREATE INDEX IF NOT EXISTS idx_pick_results_v2_market ON pick_results_v2(market);

-- ============================================================================
-- VISTA: v2_performance_summary (Métricas de Backtesting)
-- ============================================================================
CREATE OR REPLACE VIEW v2_performance_summary AS
SELECT 
  engine_version,
  market,
  COUNT(*) AS total_picks,
  COUNT(CASE WHEN result = 'WON' THEN 1 END) AS wins,
  COUNT(CASE WHEN result = 'LOST' THEN 1 END) AS losses,
  ROUND(COUNT(CASE WHEN result = 'WON' THEN 1 END)::NUMERIC / 
        NULLIF(COUNT(CASE WHEN result IN ('WON', 'LOST') THEN 1 END), 0) * 100, 2) AS win_rate,
  ROUND(SUM(COALESCE(profit, 0))::NUMERIC, 2) AS total_profit,
  ROUND(SUM(COALESCE(profit, 0))::NUMERIC / NULLIF(SUM(stake), 0) * 100, 2) AS roi_percent,
  ROUND(AVG(p_model_at_time)::NUMERIC, 4) AS avg_p_model,
  ROUND(AVG(edge_at_time)::NUMERIC, 4) AS avg_edge
FROM pick_results_v2
WHERE result IN ('WON', 'LOST')
GROUP BY engine_version, market
ORDER BY engine_version DESC, market;

-- ============================================================================
-- RLS POLICIES (Lectura pública, escritura restringida)
-- ============================================================================
ALTER TABLE system_config_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE derived_metrics_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_probs_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_picks_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE interpretation_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_results_v2 ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública
CREATE POLICY "Public read system_config_v2" ON system_config_v2 FOR SELECT USING (true);
CREATE POLICY "Public read analysis_jobs_v2" ON analysis_jobs_v2 FOR SELECT USING (true);
CREATE POLICY "Public read derived_metrics_v2" ON derived_metrics_v2 FOR SELECT USING (true);
CREATE POLICY "Public read market_probs_v2" ON market_probs_v2 FOR SELECT USING (true);
CREATE POLICY "Public read value_picks_v2" ON value_picks_v2 FOR SELECT USING (true);
CREATE POLICY "Public read interpretation_v2" ON interpretation_v2 FOR SELECT USING (true);
CREATE POLICY "Public read reports_v2" ON reports_v2 FOR SELECT USING (true);
CREATE POLICY "Public read pick_results_v2" ON pick_results_v2 FOR SELECT USING (true);

-- Políticas de escritura (service role)
CREATE POLICY "Service write system_config_v2" ON system_config_v2 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write analysis_jobs_v2" ON analysis_jobs_v2 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write derived_metrics_v2" ON derived_metrics_v2 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write market_probs_v2" ON market_probs_v2 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write value_picks_v2" ON value_picks_v2 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write interpretation_v2" ON interpretation_v2 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write reports_v2" ON reports_v2 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write pick_results_v2" ON pick_results_v2 FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- FUNCIÓN: Actualizar updated_at automáticamente
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_v2()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_analysis_jobs_v2_updated
  BEFORE UPDATE ON analysis_jobs_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_v2();

CREATE TRIGGER trigger_system_config_v2_updated
  BEFORE UPDATE ON system_config_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_v2();

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================
COMMENT ON TABLE system_config_v2 IS 'Feature flags y configuración del Motor V2';
COMMENT ON TABLE analysis_jobs_v2 IS 'Control de estado del pipeline V2 por fixture';
COMMENT ON TABLE derived_metrics_v2 IS 'Métricas cocinadas (Motor B)';
COMMENT ON TABLE market_probs_v2 IS 'Probabilidades por mercado (Motor C)';
COMMENT ON TABLE value_picks_v2 IS 'Picks finales con decisión BET/WATCH/AVOID (Motor D)';
COMMENT ON TABLE interpretation_v2 IS 'Interpretación táctica de Gemini (Motor E)';
COMMENT ON TABLE reports_v2 IS 'Reporte final estructurado (Motor E)';
COMMENT ON TABLE pick_results_v2 IS 'Resultados reales para backtesting';
