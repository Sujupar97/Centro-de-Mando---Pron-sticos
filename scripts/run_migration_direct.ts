
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate keys
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const SQL = `
CREATE TABLE IF NOT EXISTS team_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_football_id INTEGER NOT NULL,
    team_name_api_football TEXT,
    team_name_odds_api TEXT NOT NULL,
    league_id INTEGER,
    is_verified BOOLEAN DEFAULT false,
    confidence_score NUMERIC(5,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(api_football_id, team_name_odds_api)
);

CREATE INDEX IF NOT EXISTS idx_mappings_api_id ON team_mappings(api_football_id);
CREATE INDEX IF NOT EXISTS idx_mappings_odds_name ON team_mappings(team_name_odds_api);

ALTER TABLE team_mappings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'team_mappings' AND policyname = 'Public read team_mappings'
    ) THEN
        CREATE POLICY "Public read team_mappings" ON team_mappings FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'team_mappings' AND policyname = 'Service write team_mappings'
    ) THEN
        CREATE POLICY "Service write team_mappings" ON team_mappings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
`;

async function run() {
    console.log("Running manual migration...");
    // Supabase JS client doesn't support raw SQL on the client side usually unless via rpc.
    // However, we can verify if we have a pg driver or if we can use an Edge Function to run it?
    // Actually, we can use the 'postgres' npm package if we had it, but we don't.
    // So we will use the 'rpc' approach if a generic query function exists, OR we can try to use the CLI to execute raw SQL.
    // Wait, I can use `npx supabase db execute --query "..."`? No, `db execute` takes a file? `db reset`?
    // There is no direct `db execute` command in older CLIs?
    // Wait, I can use the `run_command` to echo the SQL into `supabase db reset`? NO.

    // Better idea: Since I can't easily run raw SQL via JS client without an RPC, 
    // I will try to use `npx supabase db psql` if available or just `psql` if configured.
    // But I don't have the connection string easily exposed to `psql` command.

    // Alternative: Use the previously created migration file and force it? No.

    // Let's assume there is a 'exec_sql' RPC function? Likely not.

    // OK, I will try to use the `supabase migration up`? No.

    // I will simply use `npx supabase db push --include-all`. It warned it would apply them. 
    // Since I'm in a dev environment/pair programming, it's *probably* fine to sync the schema.
    // But I'll try to be safer:

    // I'll use the CLI to run the specific file!
    // `cat migrations/2026... | npx supabase db reset`? NO.

    // I'll try `npx supabase db push --include-all`. The user wants it fixed.
    // The previous error message was a hint: "Rerun the command with --include-all flag".
    // I will do that.
}

run();
