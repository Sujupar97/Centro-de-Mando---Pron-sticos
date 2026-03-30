// Shared Supabase client for Netlify Edge Functions
// Uses SUPABASE_URL and SUPABASE_ANON_KEY from Netlify env vars

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
  }

  _client = createClient(url, key);
  return _client;
}
