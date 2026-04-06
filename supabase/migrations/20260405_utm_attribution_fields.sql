-- Add UTM attribution fields to profiles for tracking signup sources
-- Used by Meta Ads, Telegram campaigns, and YouTuber referral links

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_ref TEXT;

COMMENT ON COLUMN profiles.utm_source IS 'UTM source parameter captured at signup (e.g., meta, telegram, youtube)';
COMMENT ON COLUMN profiles.utm_medium IS 'UTM medium parameter captured at signup (e.g., cpc, organic, referral)';
COMMENT ON COLUMN profiles.utm_campaign IS 'UTM campaign parameter captured at signup (e.g., registros_directos, telegram_growth)';
COMMENT ON COLUMN profiles.utm_ref IS 'Referral code captured at signup (e.g., YouTuber affiliate code)';
