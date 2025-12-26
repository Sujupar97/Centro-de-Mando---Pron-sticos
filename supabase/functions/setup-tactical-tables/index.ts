import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');

    if (!dbUrl) {
        return new Response(JSON.stringify({
            error: "SUPABASE_DB_URL not configured"
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.4/mod.js");
        const sql = postgres(dbUrl);

        // Create match_tactical_data table
        await sql`
      CREATE TABLE IF NOT EXISTS public.match_tactical_data (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        fixture_id BIGINT NOT NULL,
        team_id BIGINT NOT NULL,
        team_name VARCHAR(255),
        formation VARCHAR(10),
        starting_eleven JSONB,
        substitutes JSONB,
        coach_name VARCHAR(255),
        tactical_notes TEXT,
        match_date DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(fixture_id, team_id)
      )
    `;

        await sql`CREATE INDEX IF NOT EXISTS idx_match_tactical_fixture ON public.match_tactical_data(fixture_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_match_tactical_team ON public.match_tactical_data(team_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_match_tactical_formation ON public.match_tactical_data(formation)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_match_tactical_date ON public.match_tactical_data(match_date DESC)`;

        // Create referee_stats table
        await sql`
      CREATE TABLE IF NOT EXISTS public.referee_stats (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        referee_id BIGINT,
        referee_name VARCHAR(255) NOT NULL,
        league_id BIGINT,
        league_name VARCHAR(255),
        season INTEGER,
        total_games INTEGER DEFAULT 0,
        avg_yellow_cards DECIMAL(4,2) DEFAULT 0,
        avg_red_cards DECIMAL(4,2) DEFAULT 0,
        avg_fouls DECIMAL(5,2) DEFAULT 0,
        avg_penalties DECIMAL(4,2) DEFAULT 0,
        home_yellow_avg DECIMAL(4,2) DEFAULT 0,
        away_yellow_avg DECIMAL(4,2) DEFAULT 0,
        games_analyzed JSONB,
        last_updated TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(referee_name, league_id, season)
      )
    `;

        await sql`CREATE INDEX IF NOT EXISTS idx_referee_stats_name ON public.referee_stats(referee_name)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_referee_stats_league ON public.referee_stats(league_id, season)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_referee_stats_updated ON public.referee_stats(last_updated DESC)`;

        // Enable RLS
        await sql`ALTER TABLE public.match_tactical_data ENABLE ROW LEVEL SECURITY`;
        await sql`ALTER TABLE public.referee_stats ENABLE ROW LEVEL SECURITY`;

        // RLS Policies
        await sql`DROP POLICY IF EXISTS "Anyone can read tactical data" ON public.match_tactical_data`;
        await sql`
      CREATE POLICY "Anyone can read tactical data" 
        ON public.match_tactical_data 
        FOR SELECT 
        USING (true)
    `;

        await sql`DROP POLICY IF EXISTS "Service can manage tactical data" ON public.match_tactical_data`;
        await sql`
      CREATE POLICY "Service can manage tactical data" 
        ON public.match_tactical_data 
        FOR ALL
        USING (true)
        WITH CHECK (true)
    `;

        await sql`DROP POLICY IF EXISTS "Anyone can read referee stats" ON public.referee_stats`;
        await sql`
      CREATE POLICY "Anyone can read referee stats" 
        ON public.referee_stats 
        FOR SELECT 
        USING (true)
    `;

        await sql`DROP POLICY IF EXISTS "Service can manage referee stats" ON public.referee_stats`;
        await sql`
      CREATE POLICY "Service can manage referee stats" 
        ON public.referee_stats 
        FOR ALL
        USING (true)
        WITH CHECK (true)
    `;

        await sql.end();

        return new Response(JSON.stringify({
            success: true,
            message: "Tactical analysis tables created successfully"
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        return new Response(JSON.stringify({
            success: false,
            error: err.message,
            stack: err.stack
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
