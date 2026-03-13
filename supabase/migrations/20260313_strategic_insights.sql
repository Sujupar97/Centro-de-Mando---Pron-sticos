-- ============================================
-- Strategic Insights ML System
-- Reemplaza el sistema numérico (Platt Scaling + factores) con aprendizajes cualitativos.
-- Los insights se generan con Gemini analizando POR QUÉ los picks ganan/pierden.
-- ============================================

-- 1. Tabla de lotes de entrenamiento
CREATE TABLE IF NOT EXISTS ml_training_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number INTEGER NOT NULL,
    picks_analyzed INTEGER NOT NULL DEFAULT 0,
    picks_won INTEGER NOT NULL DEFAULT 0,
    picks_lost INTEGER NOT NULL DEFAULT 0,
    pick_ids UUID[] NOT NULL DEFAULT '{}',
    gemini_raw_response JSONB,
    insights_generated INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'deactivated')),
    triggered_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(batch_number)
);

-- 2. Tabla de insights estratégicos
CREATE TABLE IF NOT EXISTS ml_strategic_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES ml_training_batches(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL CHECK (insight_type IN (
        'winning_pattern',
        'losing_pattern',
        'market_insight',
        'league_insight',
        'methodology_insight'
    )),
    insight_text TEXT NOT NULL,
    insight_context TEXT,
    based_on_picks INTEGER NOT NULL DEFAULT 0,
    based_on_won INTEGER NOT NULL DEFAULT 0,
    based_on_lost INTEGER NOT NULL DEFAULT 0,
    confidence_score NUMERIC(3,2) DEFAULT 0.50,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategic_insights_active
    ON ml_strategic_insights(active, batch_id) WHERE active = true;

-- 3. Pool de picks pendientes de procesar
CREATE TABLE IF NOT EXISTS ml_insight_pick_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_id UUID NOT NULL UNIQUE,
    fixture_id INTEGER NOT NULL,
    market TEXT NOT NULL,
    selection TEXT NOT NULL,
    p_model NUMERIC NOT NULL,
    odds NUMERIC,
    result TEXT NOT NULL CHECK (result IN ('WON', 'LOST')),
    league_name TEXT,
    home_team TEXT,
    away_team TEXT,
    match_date DATE,
    razonamiento TEXT,
    processed_in_batch UUID REFERENCES ml_training_batches(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pick_pool_unprocessed
    ON ml_insight_pick_pool(processed_in_batch) WHERE processed_in_batch IS NULL;

-- 4. Trigger: poblar pool automáticamente cuando se verifica un pick
CREATE OR REPLACE FUNCTION fn_populate_insight_pool()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_razonamiento TEXT;
BEGIN
    -- Solo picks que cambian a WON/LOST con p_model >= 0.83
    IF (NEW.result IN ('WON', 'LOST') AND
        (OLD.result IS NULL OR OLD.result = 'PENDING') AND
        NEW.p_model IS NOT NULL AND NEW.p_model >= 0.83) THEN

        -- Datos del partido
        SELECT league_name, home_team, away_team, match_date
        INTO v_match
        FROM daily_matches
        WHERE api_fixture_id = NEW.fixture_id
        LIMIT 1;

        -- Razonamiento del report_packet
        SELECT LEFT(r.report_packet->'analisis_profundo'->>'razonamiento_central', 500)
        INTO v_razonamiento
        FROM reports_v2 r
        WHERE r.fixture_id = NEW.fixture_id
        ORDER BY r.created_at DESC
        LIMIT 1;

        INSERT INTO ml_insight_pick_pool (
            pick_id, fixture_id, market, selection, p_model, odds, result,
            league_name, home_team, away_team, match_date, razonamiento
        ) VALUES (
            NEW.id, NEW.fixture_id, NEW.market, NEW.selection, NEW.p_model, NEW.odds, NEW.result,
            v_match.league_name, v_match.home_team, v_match.away_team, v_match.match_date,
            v_razonamiento
        ) ON CONFLICT (pick_id) DO UPDATE SET
            result = EXCLUDED.result;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '[fn_populate_insight_pool] Error: %', SQLERRM;
        RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_insight_pool ON value_picks_v2;

CREATE TRIGGER trg_populate_insight_pool
    AFTER UPDATE ON value_picks_v2
    FOR EACH ROW
    EXECUTE FUNCTION fn_populate_insight_pool();

-- 5. Setting para toggle
INSERT INTO system_settings (key, value, description)
VALUES ('ml_strategic_insights_enabled', 'false'::jsonb, 'Activa/Desactiva los Aprendizajes Estratégicos en el prompt del analyzer')
ON CONFLICT (key) DO NOTHING;

-- 6. RLS
ALTER TABLE ml_training_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_strategic_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_insight_pick_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_batches" ON ml_training_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write_batches" ON ml_training_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_insights" ON ml_strategic_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write_insights" ON ml_strategic_insights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_pool" ON ml_insight_pick_pool FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write_pool" ON ml_insight_pick_pool FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE ml_training_batches IS 'Lotes de entrenamiento del sistema de Aprendizajes Estratégicos';
COMMENT ON TABLE ml_strategic_insights IS 'Insights cualitativos generados por Gemini analizando picks verificados';
COMMENT ON TABLE ml_insight_pick_pool IS 'Pool de picks verificados pendientes de procesamiento por el trainer';
