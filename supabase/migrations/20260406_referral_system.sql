-- Referral/Affiliate system for YouTuber partnerships
-- Tracks affiliate codes, links them to signups, and enables commission calculation

-- Table: Affiliate registry
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,              -- e.g., 'juanYT', 'futbolmania'
    affiliate_name TEXT NOT NULL,           -- Full name of the YouTuber/affiliate
    channel_name TEXT,                      -- YouTube channel or social handle
    channel_url TEXT,                       -- Link to their channel
    contact_email TEXT,                     -- Email for communication
    contact_phone TEXT,                     -- WhatsApp or phone
    whop_username TEXT,                     -- Their Whop username (for payouts)
    commission_pct NUMERIC(5,2) NOT NULL DEFAULT 30.00,  -- Commission percentage
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,                             -- Internal notes
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: Commission ledger — one row per payment that generated a commission
CREATE TABLE IF NOT EXISTS referral_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_code_id UUID NOT NULL REFERENCES referral_codes(id),
    referred_user_id UUID NOT NULL REFERENCES profiles(id),
    payment_id UUID REFERENCES payment_history(id),
    payment_amount_cents INTEGER NOT NULL DEFAULT 0,
    commission_pct NUMERIC(5,2) NOT NULL,
    commission_amount_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'void')),
    paid_at TIMESTAMPTZ,
    paid_via TEXT,                          -- e.g., 'whop', 'transfer', 'crypto'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON referral_commissions(status);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_code_id ON referral_commissions(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_profiles_utm_ref ON profiles(utm_ref);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_referral_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_referral_codes_updated_at
    BEFORE UPDATE ON referral_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_referral_codes_updated_at();

COMMENT ON TABLE referral_codes IS 'Registry of affiliate partners (YouTubers, influencers). Each gets a unique code used in signup URLs.';
COMMENT ON TABLE referral_commissions IS 'Ledger of commissions owed/paid to affiliates. One row per qualifying payment.';
