
-- ============================================================================
-- MIGRATION: TEAM MAPPINGS (Apple vs OTS)
-- Fecha: 2026-01-26
-- Descripción: Tabla de Verdad para vincular IDs de API-Football con Nombres de The Odds API
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_football_id INTEGER NOT NULL,      -- ID en tu sistema (ej. 46 para Leicester)
    team_name_api_football TEXT,         -- Nombre legible (referencia)
    team_name_odds_api TEXT NOT NULL,    -- Nombre EXACTO en The Odds API
    league_id INTEGER,                   -- Contexto de liga (opcional)
    
    is_verified BOOLEAN DEFAULT false,   -- True = Humano o Script confiable; False = Auto-learned
    confidence_score NUMERIC(5,4),       -- Score de similitud con el que se creó (si fue auto)
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un equipo puede tener varios alias en OTS si cambia, pero lo normal es 1-1
    -- Permitimos duplicados de api_football_id por si un equipo cambia de nombre en OTS
    UNIQUE(api_football_id, team_name_odds_api)
);

CREATE INDEX IF NOT EXISTS idx_mappings_api_id ON team_mappings(api_football_id);
CREATE INDEX IF NOT EXISTS idx_mappings_odds_name ON team_mappings(team_name_odds_api);

-- RLS
ALTER TABLE team_mappings ENABLE ROW LEVEL SECURITY;

-- Lectura pública (para el frontend si lo necesita, o funciones anon)
CREATE POLICY "Public read team_mappings" ON team_mappings FOR SELECT USING (true);

-- Escritura solo Service Role (Edge Functions) y Admins
CREATE POLICY "Service write team_mappings" ON team_mappings FOR ALL USING (true) WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE team_mappings IS 'Mapeo entre API-Football IDs y Nombres de The Odds API';
