-- 0006_expand_evidence_types.sql
-- Expand the check constraint to allow saving new types of analysis evidence

ALTER TABLE public.analysis_evidence DROP CONSTRAINT IF EXISTS analysis_evidence_block_type_check;

ALTER TABLE public.analysis_evidence ADD CONSTRAINT analysis_evidence_block_type_check CHECK (block_type IN (
    'H_home_last10',
    'H_away_last10',
    'A_home_last10',
    'A_away_last10',
    'H2H',
    'Season_H',
    'Season_A',
    'Injuries',
    'API_Prediction',
    'Standings_Context'
));
