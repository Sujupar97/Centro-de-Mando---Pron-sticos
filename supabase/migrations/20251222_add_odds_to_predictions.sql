
-- Add 'odds' column to predictions table to store real-time odds
ALTER TABLE predictions 
ADD COLUMN IF NOT EXISTS odds numeric;

-- Comment on column
COMMENT ON COLUMN predictions.odds IS 'Real-time odds fetched from The Odds API (decimal format)';
