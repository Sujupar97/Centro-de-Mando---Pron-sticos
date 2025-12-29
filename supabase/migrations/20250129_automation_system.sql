-- ============================================
-- SPRINT 2: AUTOMATIZACIÓN DIARIA
-- ============================================
-- Tablas y configuración para automatización de análisis diarios
-- Horarios (Colombia/Bogotá):
--   1:00 AM - Scanner de partidos (día siguiente)
--   2:00 AM - Generador de análisis
--   3:00 AM - Generador de parlays
--   11:00 PM - Verificador de resultados

-- ============================================
-- TABLA: LIGAS PERMITIDAS (Seguras)
-- ============================================

CREATE TABLE IF NOT EXISTS public.allowed_leagues (
    id SERIAL PRIMARY KEY,
    api_league_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    tier TEXT CHECK (tier IN ('top', 'major', 'secondary', 'cup')) DEFAULT 'major',
    is_active BOOLEAN DEFAULT true,
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')) DEFAULT 'low',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Crear índice
CREATE INDEX IF NOT EXISTS idx_allowed_leagues_active ON public.allowed_leagues(is_active, api_league_id);

-- ============================================
-- INSERTAR LIGAS SEGURAS (TIER TOP)
-- ============================================

INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
-- INGLATERRA
(39, 'Premier League', 'England', 'top', 'low'),
(40, 'Championship', 'England', 'major', 'low'),
(45, 'FA Cup', 'England', 'cup', 'low'),
(48, 'EFL Cup', 'England', 'cup', 'low'),

-- ESPAÑA
(140, 'La Liga', 'Spain', 'top', 'low'),
(141, 'Segunda División', 'Spain', 'major', 'low'),
(143, 'Copa del Rey', 'Spain', 'cup', 'low'),

-- ALEMANIA
(78, 'Bundesliga', 'Germany', 'top', 'low'),
(79, '2. Bundesliga', 'Germany', 'major', 'low'),
(81, 'DFB Pokal', 'Germany', 'cup', 'low'),

-- ITALIA
(135, 'Serie A', 'Italy', 'top', 'low'),
(136, 'Serie B', 'Italy', 'major', 'low'),
(137, 'Coppa Italia', 'Italy', 'cup', 'low'),

-- FRANCIA
(61, 'Ligue 1', 'France', 'top', 'low'),
(62, 'Ligue 2', 'France', 'major', 'low'),
(66, 'Coupe de France', 'France', 'cup', 'low'),

-- PORTUGAL
(94, 'Primeira Liga', 'Portugal', 'major', 'low'),
(96, 'Taça de Portugal', 'Portugal', 'cup', 'low'),

-- HOLANDA
(88, 'Eredivisie', 'Netherlands', 'major', 'low'),
(89, 'Eerste Divisie', 'Netherlands', 'secondary', 'low'),

-- BÉLGICA
(144, 'Pro League', 'Belgium', 'major', 'low'),

-- TURQUÍA
(203, 'Süper Lig', 'Turkey', 'major', 'medium'),

-- COMPETICIONES EUROPEAS
(2, 'UEFA Champions League', 'World', 'top', 'low'),
(3, 'UEFA Europa League', 'World', 'top', 'low'),
(848, 'UEFA Conference League', 'World', 'major', 'low'),
(531, 'UEFA Super Cup', 'World', 'cup', 'low'),

-- SUDAMÉRICA
(13, 'Copa Libertadores', 'World', 'top', 'low'),
(11, 'Copa Sudamericana', 'World', 'major', 'low'),
(128, 'Liga Profesional Argentina', 'Argentina', 'major', 'low'),
(129, 'Copa Argentina', 'Argentina', 'cup', 'low'),
(71, 'Serie A Brasil', 'Brazil', 'major', 'low'),
(73, 'Copa do Brasil', 'Brazil', 'cup', 'low'),
(239, 'Primera A Colombia', 'Colombia', 'major', 'low'),
(240, 'Copa Colombia', 'Colombia', 'cup', 'low'),
(262, 'Liga MX', 'Mexico', 'major', 'low'),

-- NORTEAMÉRICA
(253, 'MLS', 'USA', 'major', 'low'),

-- COPAS INTERNACIONALES
(1, 'World Cup', 'World', 'top', 'low'),
(4, 'Euro Championship', 'World', 'top', 'low'),
(9, 'Copa America', 'World', 'top', 'low'),
(15, 'Club World Cup', 'World', 'cup', 'low'),

-- ASIA (Solo principales)
(98, 'J1 League', 'Japan', 'major', 'low'),
(292, 'K League 1', 'South Korea', 'major', 'low'),
(169, 'Super League', 'China', 'secondary', 'medium')

ON CONFLICT (api_league_id) DO UPDATE SET
    name = EXCLUDED.name,
    country = EXCLUDED.country,
    tier = EXCLUDED.tier,
    risk_level = EXCLUDED.risk_level,
    updated_at = now();

-- ============================================
-- TABLA: PARTIDOS DIARIOS ESCANEADOS
-- ============================================

CREATE TABLE IF NOT EXISTS public.daily_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_date DATE NOT NULL, -- Fecha en que se escaneó
    match_date DATE NOT NULL, -- Fecha del partido
    api_fixture_id INTEGER NOT NULL,
    league_id INTEGER REFERENCES public.allowed_leagues(api_league_id),
    league_name TEXT,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_team_logo TEXT,
    away_team_logo TEXT,
    match_time TIMESTAMPTZ NOT NULL,
    
    -- Estado del procesamiento
    is_analyzed BOOLEAN DEFAULT false,
    analysis_run_id UUID,
    
    -- Resultado (se actualiza después)
    home_score INTEGER,
    away_score INTEGER,
    match_status TEXT DEFAULT 'NS', -- NS, 1H, HT, 2H, FT, etc.
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(api_fixture_id, match_date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_daily_matches_date ON public.daily_matches(match_date);
CREATE INDEX IF NOT EXISTS idx_daily_matches_pending ON public.daily_matches(is_analyzed, match_date);

-- ============================================
-- TABLA: LOGS DE AUTOMATIZACIÓN
-- ============================================

CREATE TABLE IF NOT EXISTS public.automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL CHECK (job_type IN ('scanner', 'analyzer', 'parlay_generator', 'verifier', 'ml_trainer')),
    execution_date DATE NOT NULL,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status TEXT CHECK (status IN ('running', 'success', 'partial', 'failed')) DEFAULT 'running',
    
    -- Métricas
    items_processed INTEGER DEFAULT 0,
    items_success INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    
    -- Detalles
    details JSONB,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_date ON public.automation_logs(execution_date, job_type);

-- ============================================
-- TABLA: PARLAYS DIARIOS AUTOMÁTICOS
-- ============================================

CREATE TABLE IF NOT EXISTS public.daily_auto_parlays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parlay_date DATE NOT NULL,
    parlay_id UUID, -- Referencia al parlay guardado
    
    -- Datos del parlay
    title TEXT NOT NULL,
    total_odds DECIMAL(10, 2),
    win_probability DECIMAL(5, 2),
    strategy TEXT,
    legs JSONB NOT NULL,
    
    -- Estado
    status TEXT CHECK (status IN ('pending', 'won', 'lost', 'partial')) DEFAULT 'pending',
    is_featured BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_auto_parlays_date ON public.daily_auto_parlays(parlay_date);

-- ============================================
-- FUNCIÓN: OBTENER LIGAS ACTIVAS
-- ============================================

CREATE OR REPLACE FUNCTION public.get_active_leagues()
RETURNS TABLE (
    api_league_id INTEGER,
    name TEXT,
    country TEXT,
    tier TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT al.api_league_id, al.name, al.country, al.tier
    FROM public.allowed_leagues al
    WHERE al.is_active = true
      AND al.risk_level IN ('low', 'medium') -- Excluir alto riesgo
    ORDER BY 
        CASE al.tier 
            WHEN 'top' THEN 1 
            WHEN 'cup' THEN 2 
            WHEN 'major' THEN 3 
            ELSE 4 
        END,
        al.country;
END;
$$;

-- ============================================
-- FUNCIÓN: REGISTRAR EJECUCIÓN DE JOB
-- ============================================

CREATE OR REPLACE FUNCTION public.start_automation_job(
    p_job_type TEXT,
    p_execution_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_job_id UUID;
BEGIN
    INSERT INTO public.automation_logs (job_type, execution_date, status)
    VALUES (p_job_type, p_execution_date, 'running')
    RETURNING id INTO v_job_id;
    
    RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_automation_job(
    p_job_id UUID,
    p_status TEXT,
    p_processed INTEGER DEFAULT 0,
    p_success INTEGER DEFAULT 0,
    p_failed INTEGER DEFAULT 0,
    p_details JSONB DEFAULT NULL,
    p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.automation_logs
    SET 
        status = p_status,
        completed_at = now(),
        items_processed = p_processed,
        items_success = p_success,
        items_failed = p_failed,
        details = p_details,
        error_message = p_error
    WHERE id = p_job_id;
    
    RETURN true;
END;
$$;

-- ============================================
-- POLÍTICAS RLS
-- ============================================

ALTER TABLE public.allowed_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_auto_parlays ENABLE ROW LEVEL SECURITY;

-- Lectura pública para ligas
CREATE POLICY "Anyone can view allowed leagues" ON public.allowed_leagues
    FOR SELECT USING (true);

-- Admin puede gestionar ligas
CREATE POLICY "Admins can manage leagues" ON public.allowed_leagues
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'admin')
        )
    );

-- Partidos diarios: lectura para todos, escritura para service role
CREATE POLICY "Anyone can view daily matches" ON public.daily_matches
    FOR SELECT USING (true);

-- Logs: solo admin puede ver
CREATE POLICY "Admins can view automation logs" ON public.automation_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'admin')
        )
    );

-- Parlays automáticos: lectura para todos
CREATE POLICY "Anyone can view auto parlays" ON public.daily_auto_parlays
    FOR SELECT USING (true);

-- ============================================
-- GRANTS PARA SERVICE ROLE
-- ============================================

GRANT ALL ON public.allowed_leagues TO service_role;
GRANT ALL ON public.daily_matches TO service_role;
GRANT ALL ON public.automation_logs TO service_role;
GRANT ALL ON public.daily_auto_parlays TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
