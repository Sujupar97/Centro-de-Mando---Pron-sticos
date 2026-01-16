-- =====================================================
-- SMART PARLAYS V2: Combinaciones Multi-Partido
-- =====================================================
-- INSTRUCCIONES: Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. TABLA: smart_parlays_v2
CREATE TABLE IF NOT EXISTS public.smart_parlays_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Fecha del parlay
    date DATE NOT NULL,
    
    -- Nombre descriptivo
    name TEXT,  -- Ej: "Parlay 2 Picks - Alta Confianza"
    
    -- Picks incluidos (JSONB para flexibilidad)
    -- Estructura: [{fixture_id, market, selection, p_model, home_team, away_team, league}]
    picks JSONB NOT NULL,
    
    -- Métricas calculadas
    combined_probability FLOAT NOT NULL,  -- Probabilidad combinada (producto)
    implied_odds FLOAT NOT NULL,          -- 1 / combined_probability
    pick_count INT NOT NULL,              -- 2 o 3
    
    -- Clasificación
    confidence_tier TEXT,  -- 'ultra_safe' (>80%), 'safe' (70-80%), 'balanced' (60-70%)
    
    -- Estado de verificación
    status TEXT DEFAULT 'pending',  -- 'pending', 'won', 'lost', 'partial', 'void'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    verified_at TIMESTAMPTZ
);

-- 2. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_smart_parlays_date ON public.smart_parlays_v2(date);
CREATE INDEX IF NOT EXISTS idx_smart_parlays_status ON public.smart_parlays_v2(status);
CREATE INDEX IF NOT EXISTS idx_smart_parlays_confidence ON public.smart_parlays_v2(confidence_tier);

-- 3. RLS
ALTER TABLE public.smart_parlays_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_smart_parlays" ON public.smart_parlays_v2;
CREATE POLICY "allow_all_smart_parlays" ON public.smart_parlays_v2 
FOR ALL USING (true) WITH CHECK (true);

-- 4. COMENTARIOS
COMMENT ON TABLE public.smart_parlays_v2 IS 'Combinaciones inteligentes de picks de diferentes partidos';
COMMENT ON COLUMN public.smart_parlays_v2.picks IS 'Array JSON de picks: [{fixture_id, market, selection, p_model, home_team, away_team, league}]';
COMMENT ON COLUMN public.smart_parlays_v2.implied_odds IS 'Cuota implícita calculada como 1/probabilidad_combinada';

-- =====================================================
-- ✅ SMART PARLAYS V2 TABLA CREADA
-- =====================================================
