-- Add win_probability column to parlays table
ALTER TABLE parlays 
ADD COLUMN IF NOT EXISTS win_probability DECIMAL(5, 2);

-- Add comment to explain the column
COMMENT ON COLUMN parlays.win_probability IS 'Probability of winning the parlay (0-100)';
