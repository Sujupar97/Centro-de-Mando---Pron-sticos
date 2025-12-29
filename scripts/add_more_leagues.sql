-- Agregar más ligas que tienen partidos el 29 de diciembre

INSERT INTO public.allowed_leagues (api_league_id, name, country, tier, risk_level) VALUES
-- A-League (Australia) - Liga decente
(188, 'A-League', 'Australia', 'secondary', 'low'),

-- Turkish 1. Lig (Segunda división turca)
(204, '1. Lig', 'Turkey', 'secondary', 'medium'),

-- Qatar Stars League
(305, 'Stars League', 'Qatar', 'secondary', 'low'),

-- UAE Pro League
(307, 'Pro League', 'UAE', 'secondary', 'low'),

-- Copa África de Naciones (importante)
(6, 'Africa Cup of Nations', 'Africa', 'cup', 'low')

ON CONFLICT (api_league_id) DO NOTHING;

-- Verificar cuántas ligas tenemos ahora
SELECT COUNT(*) as total_ligas FROM public.allowed_leagues;

-- Mostrar las ligas
SELECT api_league_id, name, country, tier FROM public.allowed_leagues ORDER BY tier, country;
