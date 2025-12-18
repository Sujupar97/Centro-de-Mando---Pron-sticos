-- Migration: Add RLS policies for analysis tables
-- Date: 2025-12-16
-- Purpose: Allow authenticated users to read analysis results

-- Policy for analysis_runs (reading analysis results)
DROP POLICY IF EXISTS "Auth users view analysis runs" ON public.analysis_runs;
CREATE POLICY "Auth users view analysis runs" 
    ON public.analysis_runs 
    FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Policy for analisis (reading cached analysis)
DROP POLICY IF EXISTS "Auth users view analysis cache" ON public.analisis;
CREATE POLICY "Auth users view analysis cache" 
    ON public.analisis 
    FOR SELECT 
    USING (auth.role() = 'authenticated');
