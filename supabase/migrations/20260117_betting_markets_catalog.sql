-- ═══════════════════════════════════════════════════════════════
-- CATÁLOGO DE MERCADOS DE APUESTAS
-- Esta tabla almacena todos los tipos de mercados disponibles
-- para que el sistema de análisis pueda evaluarlos y recomendar
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS betting_markets_catalog (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,                         -- Categoría del mercado
    market_key TEXT NOT NULL UNIQUE,                -- Clave única del mercado (ej: 'over_2.5')
    market_name_es TEXT NOT NULL,                   -- Nombre en español
    market_name_en TEXT NOT NULL,                   -- Nombre en inglés
    description TEXT,                               -- Descripción del mercado
    typical_odds_min DECIMAL(4,2) DEFAULT 1.10,    -- Cuota típica mínima
    typical_odds_max DECIMAL(4,2) DEFAULT 5.00,    -- Cuota típica máxima
    is_active BOOLEAN DEFAULT true,                 -- Si está activo para uso
    analysis_trigger TEXT,                          -- Qué tipo de análisis activa este mercado
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permisos RLS
ALTER TABLE betting_markets_catalog ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública (solo lectura)
CREATE POLICY "betting_markets_readable_by_all"
    ON betting_markets_catalog FOR SELECT
    USING (true);

-- ═══════════════════════════════════════════════════════════════
-- INSERTAR CATÁLOGO COMPLETO DE 60+ MERCADOS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO betting_markets_catalog (category, market_key, market_name_es, market_name_en, description, typical_odds_min, typical_odds_max, analysis_trigger) VALUES
-- MERCADOS PRINCIPALES (1X2)
('Principal', 'home_win', 'Victoria Local', 'Home Win', 'El equipo local gana el partido', 1.20, 5.00, 'Equipo local fuerte vs débil'),
('Principal', 'draw', 'Empate', 'Draw', 'El partido termina empatado', 3.00, 5.00, 'Equipos parejos, pocos goles'),
('Principal', 'away_win', 'Victoria Visitante', 'Away Win', 'El equipo visitante gana el partido', 1.50, 8.00, 'Equipo visitante superior'),

-- DOBLE OPORTUNIDAD
('Doble Oportunidad', '1x', 'Local o Empate', 'Home or Draw', 'El local gana o empata', 1.10, 2.00, 'Local con ventaja de casa'),
('Doble Oportunidad', 'x2', 'Empate o Visitante', 'Draw or Away', 'Empata o gana visitante', 1.10, 2.50, 'Visitante competitivo'),
('Doble Oportunidad', '12', 'Local o Visitante', 'Home or Away', 'No hay empate', 1.10, 1.80, 'Partido con clara definición'),

-- DRAW NO BET
('Draw No Bet', 'dnb_home', 'Draw No Bet Local', 'DNB Home', 'Local gana, empate devuelve apuesta', 1.15, 2.50, 'Local favorito moderado'),
('Draw No Bet', 'dnb_away', 'Draw No Bet Visitante', 'DNB Away', 'Visitante gana, empate devuelve', 1.30, 4.00, 'Visitante con opciones'),

-- TOTAL GOLES
('Total Goles', 'over_0.5', 'Más de 0.5 Goles', 'Over 0.5 Goals', 'Al menos 1 gol en el partido', 1.05, 1.20, 'Partidos con goles'),
('Total Goles', 'under_0.5', 'Menos de 0.5 Goles', 'Under 0.5 Goals', 'Partido sin goles', 6.00, 15.00, 'Partidos muy defensivos'),
('Total Goles', 'over_1.5', 'Más de 1.5 Goles', 'Over 1.5 Goals', 'Al menos 2 goles', 1.15, 1.50, 'Equipos ofensivos'),
('Total Goles', 'under_1.5', 'Menos de 1.5 Goles', 'Under 1.5 Goals', 'Máximo 1 gol', 2.50, 5.00, 'Partidos cerrados'),
('Total Goles', 'over_2.5', 'Más de 2.5 Goles', 'Over 2.5 Goals', 'Al menos 3 goles', 1.50, 2.50, 'Equipos goleadores'),
('Total Goles', 'under_2.5', 'Menos de 2.5 Goles', 'Under 2.5 Goals', 'Máximo 2 goles', 1.40, 2.20, 'Defensas sólidas'),
('Total Goles', 'over_3.5', 'Más de 3.5 Goles', 'Over 3.5 Goals', 'Al menos 4 goles', 2.00, 4.00, 'Partidos abiertos'),
('Total Goles', 'under_3.5', 'Menos de 3.5 Goles', 'Under 3.5 Goals', 'Máximo 3 goles', 1.20, 1.60, 'Control del partido'),
('Total Goles', 'over_4.5', 'Más de 4.5 Goles', 'Over 4.5 Goals', 'Al menos 5 goles', 3.00, 8.00, 'Goleadas esperadas'),
('Total Goles', 'under_4.5', 'Menos de 4.5 Goles', 'Under 4.5 Goals', 'Máximo 4 goles', 1.08, 1.30, 'Casi todos partidos'),

-- BTTS (AMBOS MARCAN)
('Ambos Marcan', 'btts_yes', 'Ambos Marcan - Sí', 'BTTS Yes', 'Ambos equipos marcan al menos 1 gol', 1.50, 2.50, 'Defensas débiles'),
('Ambos Marcan', 'btts_no', 'Ambos Marcan - No', 'BTTS No', 'Al menos un equipo no marca', 1.40, 2.20, 'Defensa sólida presente'),

-- GOLES EQUIPO LOCAL
('Goles Local', 'home_over_0.5', 'Local +0.5 Goles', 'Home Over 0.5', 'El local marca al menos 1', 1.15, 1.60, 'Local ofensivo'),
('Goles Local', 'home_over_1.5', 'Local +1.5 Goles', 'Home Over 1.5', 'El local marca al menos 2', 1.60, 3.00, 'Local muy goleador'),
('Goles Local', 'home_over_2.5', 'Local +2.5 Goles', 'Home Over 2.5', 'El local marca al menos 3', 2.50, 5.00, 'Local dominante'),

-- GOLES EQUIPO VISITANTE
('Goles Visitante', 'away_over_0.5', 'Visitante +0.5 Goles', 'Away Over 0.5', 'El visitante marca al menos 1', 1.30, 2.00, 'Visitante con llegada'),
('Goles Visitante', 'away_over_1.5', 'Visitante +1.5 Goles', 'Away Over 1.5', 'El visitante marca al menos 2', 2.00, 4.00, 'Visitante goleador'),
('Goles Visitante', 'away_over_2.5', 'Visitante +2.5 Goles', 'Away Over 2.5', 'El visitante marca al menos 3', 3.50, 7.00, 'Visitante muy ofensivo'),

-- PRIMERA MITAD
('Primera Mitad', '1h_over_0.5', '1T +0.5 Goles', '1H Over 0.5', 'Al menos 1 gol en primera mitad', 1.35, 1.80, 'Equipos que arrancan fuerte'),
('Primera Mitad', '1h_over_1.5', '1T +1.5 Goles', '1H Over 1.5', 'Al menos 2 goles en primera mitad', 2.00, 3.50, 'Primeros tiempos movidos'),
('Primera Mitad', '1h_btts_yes', '1T Ambos Marcan', '1H BTTS Yes', 'Ambos marcan en primera mitad', 3.00, 5.00, 'Arranques ofensivos'),
('Primera Mitad', '1h_home_win', '1T Victoria Local', '1H Home Win', 'Local gana al descanso', 2.00, 4.00, 'Local dominante inicio'),
('Primera Mitad', '1h_draw', '1T Empate', '1H Draw', 'Empate al medio tiempo', 2.00, 2.50, 'Partidos igualados'),
('Primera Mitad', '1h_away_win', '1T Victoria Visitante', '1H Away Win', 'Visitante gana al descanso', 3.00, 7.00, 'Visitante sorpresa'),

-- SEGUNDA MITAD
('Segunda Mitad', '2h_over_0.5', '2T +0.5 Goles', '2H Over 0.5', 'Al menos 1 gol en segunda mitad', 1.20, 1.60, 'Segundos tiempos intensos'),
('Segunda Mitad', '2h_over_1.5', '2T +1.5 Goles', '2H Over 1.5', 'Al menos 2 goles en segunda mitad', 1.80, 3.00, 'Equipos que cierran goleando'),
('Segunda Mitad', '2h_btts_yes', '2T Ambos Marcan', '2H BTTS Yes', 'Ambos marcan en segunda mitad', 3.50, 6.00, 'Finales abiertos'),

-- MITAD CON MÁS GOLES
('Mitad Goles', 'most_goals_1h', 'Más Goles en 1T', 'Most Goals 1H', 'Primera mitad tiene más goles', 2.50, 4.50, 'Arranques explosivos'),
('Mitad Goles', 'most_goals_2h', 'Más Goles en 2T', 'Most Goals 2H', 'Segunda mitad tiene más goles', 2.00, 2.80, 'Equipos que reaccionan'),
('Mitad Goles', 'equal_goals', 'Igual Goles Ambas', 'Equal Goals', 'Mismo número de goles ambas mitades', 3.00, 4.50, 'Partidos balanceados'),

-- CLEAN SHEET
('Clean Sheet', 'home_clean_sheet_yes', 'Local Portería a Cero', 'Home Clean Sheet', 'El local no recibe goles', 2.00, 4.00, 'Defensa local sólida'),
('Clean Sheet', 'away_clean_sheet_yes', 'Visitante Portería a Cero', 'Away Clean Sheet', 'El visitante no recibe goles', 2.50, 6.00, 'Defensa visitante fuerte'),

-- WIN TO NIL
('Win to Nil', 'home_win_to_nil', 'Local Gana Sin Recibir', 'Home Win to Nil', 'Local gana y no recibe goles', 2.50, 5.00, 'Local dominante y seguro'),
('Win to Nil', 'away_win_to_nil', 'Visitante Gana Sin Recibir', 'Away Win to Nil', 'Visitante gana y no recibe', 4.00, 10.00, 'Visitante superior'),

-- MARGEN DE VICTORIA
('Margen Victoria', 'home_by_1', 'Local Gana por 1', 'Home Win by 1', 'Local gana por exactamente 1 gol', 3.50, 5.50, 'Victoria ajustada local'),
('Margen Victoria', 'home_by_2', 'Local Gana por 2', 'Home Win by 2+', 'Local gana por 2 o más', 2.50, 4.50, 'Local claro favorito'),
('Margen Victoria', 'away_by_1', 'Visitante Gana por 1', 'Away Win by 1', 'Visitante gana por 1 gol', 5.00, 9.00, 'Victoria ajustada fuera'),
('Margen Victoria', 'away_by_2', 'Visitante Gana por 2', 'Away Win by 2+', 'Visitante gana por 2 o más', 5.00, 12.00, 'Visitante muy superior'),

-- GOLES PAR/IMPAR
('Par/Impar', 'odd_goals', 'Goles Impares', 'Odd Goals', 'Total de goles es impar', 1.80, 2.10, 'Aleatoriedad estadística'),
('Par/Impar', 'even_goals', 'Goles Pares', 'Even Goals', 'Total de goles es par (incluye 0)', 1.80, 2.00, 'Aleatoriedad estadística'),

-- PRIMER GOL
('Primer Gol', 'first_goal_home', 'Primer Gol Local', 'First Goal Home', 'El local marca primero', 1.60, 2.50, 'Local que presiona'),
('Primer Gol', 'first_goal_away', 'Primer Gol Visitante', 'First Goal Away', 'El visitante marca primero', 2.20, 3.50, 'Visitante contraatacador'),
('Primer Gol', 'no_goal', 'Sin Goles', 'No Goal', 'Nadie marca (0-0)', 6.00, 15.00, 'Partido muy cerrado'),

-- ÚLTIMO GOL
('Último Gol', 'last_goal_home', 'Último Gol Local', 'Last Goal Home', 'El local marca el último gol', 2.00, 2.80, 'Local que cierra fuerte'),
('Último Gol', 'last_goal_away', 'Último Gol Visitante', 'Last Goal Away', 'El visitante marca el último', 2.20, 3.20, 'Visitante que reacciona'),

-- HANDICAP EUROPEO
('Handicap', 'home_handicap_-1', 'Local Handicap -1', 'Home -1', 'Local gana por 2+ goles', 2.00, 3.50, 'Local muy superior'),
('Handicap', 'away_handicap_+1', 'Visitante Handicap +1', 'Away +1', 'Visitante no pierde por 2+', 1.40, 2.00, 'Visitante competitivo')

ON CONFLICT (market_key) DO NOTHING;

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_markets_category ON betting_markets_catalog(category);
CREATE INDEX IF NOT EXISTS idx_markets_active ON betting_markets_catalog(is_active);
