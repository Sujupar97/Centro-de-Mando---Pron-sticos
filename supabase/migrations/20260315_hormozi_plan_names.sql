-- Update plan display names and descriptions (Hormozi "Grand Slam Offer" redesign)
-- Internal names (free/starter/pro/premium) remain unchanged for payment system compatibility

UPDATE subscription_plans
SET display_name = 'Explorador',
    description = 'Explora el sistema con 1 oportunidad diaria'
WHERE name = 'free';

UPDATE subscription_plans
SET display_name = 'Ventaja',
    description = 'Tu ventaja competitiva con datos reales'
WHERE name = 'starter';

UPDATE subscription_plans
SET display_name = 'Elite',
    description = 'Acceso mayoritario a la inteligencia deportiva'
WHERE name = 'pro';

UPDATE subscription_plans
SET display_name = 'Máquina',
    description = 'El sistema completo. Sin límites.'
WHERE name = 'premium';
