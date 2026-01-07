-- Crear plan ADMIN en subscription_plans
INSERT INTO subscription_plans (
  id,
  name,
  display_name,
  price_monthly,
  price_annual,
  features,
  predictions_percentage,
  monthly_parlay_limit,
  monthly_analysis_limit,
  can_access_ml_dashboard,
  can_analyze_own_tickets,
  has_priority_support,
  sort_order
) VALUES (
  gen_random_uuid(),
  'admin',
  'Acceso Total (Admin)',
  0,
  0,
  ARRAY[
    'Acceso ilimitado a todas las predicciones',
    'Parlays ilimitados',
    'Análisis ilimitados',
    'ML Dashboard completo',
    'Soporte prioritario',
    'Gestión de organización'
  ],
  100,
  999999,
  NULL, -- NULL = ilimitado
  true,
  true,
  true,
  999 -- Último en la lista
);

-- Ver el ID del plan admin recién creado
SELECT id, name, display_name FROM subscription_plans WHERE name = 'admin';

-- DESPUÉS, con el ID obtenido, crear tu suscripción:
-- INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
-- VALUES (
--   '894e709c-cbfb-4a45-9771-c3307b7c2c07',
--   'AQUI_EL_ID_DEL_PLAN_ADMIN',
--   'active',
--   NOW(),
--   NOW() + INTERVAL '100 years'
-- );
