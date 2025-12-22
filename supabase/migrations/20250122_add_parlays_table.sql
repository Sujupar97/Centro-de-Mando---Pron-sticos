
-- Create parlays table
CREATE TABLE IF NOT EXISTS public.parlays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    title TEXT NOT NULL,
    total_odds NUMERIC NOT NULL,
    legs JSONB NOT NULL, -- Array of leg objects
    justification TEXT,
    strategy TEXT, -- overallStrategy from AI
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Index for fast lookup by date and org
CREATE INDEX idx_parlays_org_date ON public.parlays(organization_id, date);

-- Enable RLS
ALTER TABLE public.parlays ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view parlays from their organization"
    ON public.parlays
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins and privileged users can insert parlays"
    ON public.parlays
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_members 
            WHERE user_id = auth.uid()
            AND (role IN ('owner', 'admin') OR (permissions->>'can_create_bets')::boolean = true)
        )
    );
