-- ============================================
-- Sistema de Suscripciones BetCommand
-- Creado: 2025-12-27
-- ============================================

-- 1. TABLA DE PLANES DE SUSCRIPCIÓN
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- 'free', 'starter', 'pro', 'premium'
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- Precios
  price_cents INTEGER NOT NULL DEFAULT 0, -- En centavos (999 = $9.99)
  currency TEXT DEFAULT 'USD',
  billing_period TEXT DEFAULT 'monthly', -- 'monthly', 'yearly'
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Solo uno puede ser default (free)
  sort_order INTEGER DEFAULT 0,
  
  -- Límites de Features (NULL = ilimitado)
  predictions_percentage INTEGER DEFAULT 0, -- % de pronósticos de alta prob. (0, 35, 70, 100)
  monthly_parlay_limit INTEGER DEFAULT 0,
  monthly_analysis_limit INTEGER, -- NULL = ilimitado
  
  -- Acceso a Features
  can_analyze_own_tickets BOOLEAN DEFAULT false,
  can_access_ml_dashboard BOOLEAN DEFAULT false,
  can_access_full_stats BOOLEAN DEFAULT false,
  has_priority_support BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLA DE SUSCRIPCIONES DE USUARIOS
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  
  -- Estado
  status TEXT DEFAULT 'active' 
    CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'trialing')),
  
  -- Período actual
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  
  -- Integración Wompi
  wompi_transaction_id TEXT,
  wompi_subscription_id TEXT,
  payment_method_token TEXT, -- Token de tarjeta para pagos recurrentes
  
  -- Metadata
  assigned_by UUID REFERENCES auth.users(id), -- NULL = auto, ID = asignación manual
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Un usuario solo puede tener una suscripción activa por organización
  UNIQUE(user_id, organization_id)
);

-- 3. TABLA DE TRACKING DE USO
CREATE TABLE IF NOT EXISTS public.feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Período (se resetea cada mes)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Contadores
  predictions_viewed INTEGER DEFAULT 0,
  parlays_created INTEGER DEFAULT 0,
  analyses_ran INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, organization_id, period_start)
);

-- 4. HISTORIAL DE PAGOS
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.user_subscriptions(id),
  
  -- Info del pago
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'declined', 'voided', 'error')),
  
  -- Wompi
  wompi_transaction_id TEXT,
  wompi_reference TEXT,
  payment_method TEXT, -- 'card', 'nequi', 'bancolombia', etc.
  
  -- Metadata
  description TEXT,
  error_message TEXT,
  raw_response JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INSERTAR PLANES DEFAULT
-- ============================================

INSERT INTO public.subscription_plans (name, display_name, description, price_cents, predictions_percentage, monthly_parlay_limit, monthly_analysis_limit, can_analyze_own_tickets, can_access_ml_dashboard, can_access_full_stats, has_priority_support, is_default, sort_order)
VALUES
  ('free', 'Gratis', 'Plan gratuito con acceso básico', 0, 0, 0, 0, false, false, false, false, true, 0),
  ('starter', 'Starter', 'Acceso al 35% de pronósticos premium', 999, 35, 2, 10, false, false, false, false, false, 1),
  ('pro', 'Pro', 'Acceso al 70% de pronósticos + 8 parlays', 2399, 70, 8, NULL, false, true, true, false, false, 2),
  ('premium', 'Premium', 'Acceso completo + soporte prioritario', 9999, 100, 24, NULL, true, true, true, true, false, 3)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  predictions_percentage = EXCLUDED.predictions_percentage,
  monthly_parlay_limit = EXCLUDED.monthly_parlay_limit,
  monthly_analysis_limit = EXCLUDED.monthly_analysis_limit,
  can_analyze_own_tickets = EXCLUDED.can_analyze_own_tickets,
  can_access_ml_dashboard = EXCLUDED.can_access_ml_dashboard,
  can_access_full_stats = EXCLUDED.can_access_full_stats,
  has_priority_support = EXCLUDED.has_priority_support,
  updated_at = now();

-- ============================================
-- FUNCIONES HELPER
-- ============================================

-- Función para obtener el plan actual de un usuario
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id UUID, p_org_id UUID DEFAULT NULL)
RETURNS TABLE (
  plan_name TEXT,
  display_name TEXT,
  predictions_percentage INTEGER,
  monthly_parlay_limit INTEGER,
  monthly_analysis_limit INTEGER,
  can_analyze_own_tickets BOOLEAN,
  can_access_ml_dashboard BOOLEAN,
  subscription_status TEXT,
  period_end TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.name,
    sp.display_name,
    sp.predictions_percentage,
    sp.monthly_parlay_limit,
    sp.monthly_analysis_limit,
    sp.can_analyze_own_tickets,
    sp.can_access_ml_dashboard,
    us.status,
    us.current_period_end
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND (p_org_id IS NULL OR us.organization_id = p_org_id)
    AND us.status IN ('active', 'trialing')
  ORDER BY sp.sort_order DESC
  LIMIT 1;
  
  -- Si no tiene suscripción, retornar plan free
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      sp.name,
      sp.display_name,
      sp.predictions_percentage,
      sp.monthly_parlay_limit,
      sp.monthly_analysis_limit,
      sp.can_analyze_own_tickets,
      sp.can_access_ml_dashboard,
      'active'::TEXT,
      NULL::TIMESTAMPTZ
    FROM public.subscription_plans sp
    WHERE sp.name = 'free' AND sp.is_active = true
    LIMIT 1;
  END IF;
END;
$$;

-- Función para obtener uso del período actual
CREATE OR REPLACE FUNCTION public.get_current_usage(p_user_id UUID, p_org_id UUID DEFAULT NULL)
RETURNS TABLE (
  predictions_used INTEGER,
  parlays_used INTEGER,
  analyses_used INTEGER,
  period_start DATE,
  period_end DATE
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_period_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
  v_period_end DATE := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(fu.predictions_viewed, 0),
    COALESCE(fu.parlays_created, 0),
    COALESCE(fu.analyses_ran, 0),
    v_period_start,
    v_period_end
  FROM public.feature_usage fu
  WHERE fu.user_id = p_user_id
    AND (p_org_id IS NULL OR fu.organization_id = p_org_id)
    AND fu.period_start = v_period_start
  LIMIT 1;
  
  -- Si no existe registro, retornar ceros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, 0, v_period_start, v_period_end;
  END IF;
END;
$$;

-- Función para incrementar uso
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_user_id UUID, 
  p_org_id UUID,
  p_feature TEXT -- 'predictions', 'parlays', 'analyses'
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_period_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
  v_period_end DATE := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
BEGIN
  -- Insertar o actualizar registro de uso
  INSERT INTO public.feature_usage (user_id, organization_id, period_start, period_end)
  VALUES (p_user_id, p_org_id, v_period_start, v_period_end)
  ON CONFLICT (user_id, organization_id, period_start) DO NOTHING;
  
  -- Incrementar el contador según feature
  IF p_feature = 'predictions' THEN
    UPDATE public.feature_usage 
    SET predictions_viewed = predictions_viewed + 1, updated_at = now()
    WHERE user_id = p_user_id AND organization_id = p_org_id AND period_start = v_period_start;
  ELSIF p_feature = 'parlays' THEN
    UPDATE public.feature_usage 
    SET parlays_created = parlays_created + 1, updated_at = now()
    WHERE user_id = p_user_id AND organization_id = p_org_id AND period_start = v_period_start;
  ELSIF p_feature = 'analyses' THEN
    UPDATE public.feature_usage 
    SET analyses_ran = analyses_ran + 1, updated_at = now()
    WHERE user_id = p_user_id AND organization_id = p_org_id AND period_start = v_period_start;
  END IF;
  
  RETURN true;
END;
$$;

-- ============================================
-- POLÍTICAS RLS
-- ============================================

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Planes: Lectura pública (para mostrar pricing)
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

-- Suscripciones: Solo el usuario puede ver la suya (o admin)
CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all subscriptions" ON public.user_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'Superadmin'
    )
  );

-- Uso: Solo el usuario puede ver el suyo
CREATE POLICY "Users can view own usage" ON public.feature_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Historial de pagos: Solo el usuario puede ver el suyo
CREATE POLICY "Users can view own payment history" ON public.payment_history
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_period ON public.feature_usage(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_payment_history_user ON public.payment_history(user_id);

-- ============================================
-- TRIGGER para updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feature_usage_updated_at ON public.feature_usage;
CREATE TRIGGER update_feature_usage_updated_at
  BEFORE UPDATE ON public.feature_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
