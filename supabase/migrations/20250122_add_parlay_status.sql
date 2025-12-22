-- Add status column to parlays table
ALTER TABLE parlays 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add comment to explain the column
COMMENT ON COLUMN parlays.status IS 'Status of the parlay: pending, won, lost, void';
