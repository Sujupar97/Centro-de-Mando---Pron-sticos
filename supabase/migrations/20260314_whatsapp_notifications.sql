-- Migration: WhatsApp Notification System
-- Date: 2026-03-14
-- Description: Add phone_number to profiles, create notification_preferences and notification_log tables

-- ================================================================
-- 1. Add phone fields to profiles
-- ================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS phone_country_code TEXT DEFAULT '+57';

CREATE INDEX IF NOT EXISTS idx_profiles_phone
  ON public.profiles(phone_number) WHERE phone_number IS NOT NULL;

-- ================================================================
-- 2. Table: notification_preferences
-- ================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'push')),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('predictions_ready', 'daily_results', 'special_offers')),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, channel, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user
  ON public.notification_preferences(user_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to notification_preferences"
  ON public.notification_preferences FOR ALL
  USING (auth.role() = 'service_role');

-- ================================================================
-- 3. Table: notification_log
-- ================================================================
CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_number TEXT,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  template_name TEXT,
  whatsapp_message_id TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  error_message TEXT,
  short_url TEXT,
  click_count INTEGER DEFAULT 0,
  short_url_id TEXT,
  metadata JSONB,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_user
  ON public.notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_type_date
  ON public.notification_log(notification_type, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_log_status
  ON public.notification_log(status);
CREATE INDEX IF NOT EXISTS idx_notif_log_wa_msg_id
  ON public.notification_log(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to notification_log"
  ON public.notification_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can read notification_log"
  ON public.notification_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('platform_owner', 'agency_admin')
    )
  );

-- ================================================================
-- 4. Trigger: auto-create notification preferences when phone is added
-- ================================================================
CREATE OR REPLACE FUNCTION public.create_default_notification_prefs()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL AND (OLD.phone_number IS NULL OR OLD.phone_number != NEW.phone_number) THEN
    INSERT INTO public.notification_preferences (user_id, channel, notification_type, enabled)
    VALUES
      (NEW.id, 'whatsapp', 'predictions_ready', true),
      (NEW.id, 'whatsapp', 'daily_results', true)
    ON CONFLICT (user_id, channel, notification_type) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_default_notification_prefs ON public.profiles;
CREATE TRIGGER trg_default_notification_prefs
  AFTER UPDATE OF phone_number ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_notification_prefs();

-- Also handle INSERT (new user with phone already set)
CREATE OR REPLACE FUNCTION public.create_default_notification_prefs_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL THEN
    INSERT INTO public.notification_preferences (user_id, channel, notification_type, enabled)
    VALUES
      (NEW.id, 'whatsapp', 'predictions_ready', true),
      (NEW.id, 'whatsapp', 'daily_results', true)
    ON CONFLICT (user_id, channel, notification_type) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_default_notification_prefs_insert ON public.profiles;
CREATE TRIGGER trg_default_notification_prefs_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_notification_prefs_insert();

-- ================================================================
-- 5. System setting: WhatsApp notifications toggle
-- ================================================================
INSERT INTO public.system_settings (key, value, description, updated_at)
VALUES ('whatsapp_notifications_enabled', 'true'::jsonb, 'Activa/Desactiva notificaciones WhatsApp automáticas', now())
ON CONFLICT (key) DO NOTHING;
