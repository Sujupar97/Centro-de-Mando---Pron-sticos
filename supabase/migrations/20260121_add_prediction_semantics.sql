-- Migration: Add Semantic Tags to Predictions
-- Description: Allow storing AI qualitative tags (Anchor, Value, Volatility)

BEGIN;

-- Add columns if they don't exist
ALTER TABLE public.predictions 
ADD COLUMN IF NOT EXISTS is_anchor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_value BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create index for fast retrieval by type
CREATE INDEX IF NOT EXISTS idx_predictions_anchor ON public.predictions(is_anchor) WHERE is_anchor = TRUE;
CREATE INDEX IF NOT EXISTS idx_predictions_tags ON public.predictions USING GIN(tags);

COMMIT;
