-- =====================================================
-- AGREGAR LIGAS PERMITIDAS ADICIONALES
-- Tiers válidos: 'top', 'major', 'secondary', 'cup'
-- Risk levels válidos: 'low', 'medium', 'high'
-- =====================================================

-- TURQUÍA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(204, '1. Lig', 'Turkey', 'secondary', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- PORTUGAL (Primeira Liga ya existe)
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(95, 'Liga Portugal 2', 'Portugal', 'secondary', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- COPA AFRICA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(6, 'Africa Cup of Nations', 'Africa', 'cup', 'low'),
(12, 'CAF Champions League', 'Africa', 'cup', 'medium'),
(20, 'World Cup Qualification CAF', 'Africa', 'cup', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- ARABIA SAUDITA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(307, 'Saudi Pro League', 'Saudi-Arabia', 'major', 'low'),
(308, 'First Division', 'Saudi-Arabia', 'secondary', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- QATAR
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(305, 'Stars League', 'Qatar', 'major', 'low'),
(726, 'Emir Cup', 'Qatar', 'cup', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- UAE (Emiratos)
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(301, 'Pro League', 'UAE', 'major', 'low'),
(302, 'First Division', 'UAE', 'secondary', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- GRECIA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(197, 'Super League 1', 'Greece', 'major', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- HOLANDA (Eredivisie ya existe)
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(90, 'KNVB Beker', 'Netherlands', 'cup', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- BÉLGICA (Pro League ya existe)
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(145, 'First Division B', 'Belgium', 'secondary', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- AUSTRIA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(218, 'Bundesliga', 'Austria', 'major', 'low'),
(219, '2. Liga', 'Austria', 'secondary', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- SUIZA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(207, 'Super League', 'Switzerland', 'major', 'low'),
(208, 'Challenge League', 'Switzerland', 'secondary', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- AUSTRALIA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(188, 'A-League', 'Australia', 'major', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- JAPÓN (J1 ya existe)
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(99, 'J2 League', 'Japan', 'secondary', 'low'),
(100, 'J3 League', 'Japan', 'secondary', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- COREA DEL SUR (K1 ya existe)
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(293, 'K League 2', 'South-Korea', 'secondary', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- ESCOCIA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(179, 'Premiership', 'Scotland', 'major', 'low'),
(180, 'Championship', 'Scotland', 'secondary', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- DINAMARCA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(119, 'Superliga', 'Denmark', 'major', 'low'),
(120, '1st Division', 'Denmark', 'secondary', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- NORUEGA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(103, 'Eliteserien', 'Norway', 'major', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- SUECIA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(113, 'Allsvenskan', 'Sweden', 'major', 'low'),
(114, 'Superettan', 'Sweden', 'secondary', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- CROACIA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(210, 'HNL', 'Croatia', 'major', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- SERBIA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(286, 'Super Liga', 'Serbia', 'major', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- UCRANIA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(333, 'Premier League', 'Ukraine', 'major', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- REPÚBLICA CHECA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(345, 'First League', 'Czech-Republic', 'major', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- ISRAEL
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(384, 'Ligat Haal', 'Israel', 'major', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- IRÁN
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(290, 'Persian Gulf Pro League', 'Iran', 'major', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- MARRUECOS
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(200, 'Botola Pro', 'Morocco', 'major', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- EGIPTO
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(233, 'Premier League', 'Egypt', 'major', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- SUDÁFRICA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(288, 'Premier Soccer League', 'South-Africa', 'major', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- TÚNEZ
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(202, 'Ligue 1', 'Tunisia', 'major', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- ARGELIA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(186, 'Ligue 1', 'Algeria', 'major', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- POLONIA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(106, 'Ekstraklasa', 'Poland', 'major', 'low')
ON CONFLICT (api_league_id) DO NOTHING;

-- HUNGRÍA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(271, 'NB I', 'Hungary', 'major', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- RUMANIA
INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
(283, 'Liga I', 'Romania', 'major', 'medium')
ON CONFLICT (api_league_id) DO NOTHING;

-- VERIFICAR TOTAL
SELECT COUNT(*) as total_ligas FROM public.allowed_leagues;
