import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Overall effectiveness (only verified opportunity picks)
    const { data: overallData } = await supabase.rpc("seo_overall_stats").single();

    // Fallback: manual query if RPC doesn't exist
    let overall = overallData;
    if (!overall) {
      const { data: allPicks } = await supabase
        .from("value_picks_v2")
        .select("result, p_model, odds, is_opportunity")
        .in("result", ["WON", "LOST"])
        .eq("is_opportunity", true);

      const won = allPicks?.filter((p: any) => p.result === "WON").length || 0;
      const total = allPicks?.length || 0;

      overall = {
        total_picks: total,
        won,
        lost: total - won,
        win_rate: total > 0 ? Math.round((won / total) * 1000) / 10 : 0,
      };
    }

    // 2. By league (join daily_matches for league_name)
    const { data: byLeagueRaw } = await supabase
      .from("value_picks_v2")
      .select(`
        result,
        fixture_id,
        is_opportunity
      `)
      .in("result", ["WON", "LOST"])
      .eq("is_opportunity", true);

    // Get fixture → league mapping
    const fixtureIds = [...new Set((byLeagueRaw || []).map((p: any) => p.fixture_id))];
    const { data: matches } = await supabase
      .from("daily_matches")
      .select("api_fixture_id, league_name")
      .in("api_fixture_id", fixtureIds.slice(0, 500));

    const leagueMap = new Map<number, string>();
    (matches || []).forEach((m: any) => leagueMap.set(m.api_fixture_id, m.league_name));

    const leagueStats: Record<string, { won: number; total: number }> = {};
    for (const pick of byLeagueRaw || []) {
      const league = leagueMap.get(pick.fixture_id) || "Otra";
      if (!leagueStats[league]) leagueStats[league] = { won: 0, total: 0 };
      leagueStats[league].total++;
      if (pick.result === "WON") leagueStats[league].won++;
    }

    const byLeague = Object.entries(leagueStats)
      .map(([league, stats]) => ({
        league,
        total: stats.total,
        won: stats.won,
        win_rate: Math.round((stats.won / stats.total) * 1000) / 10,
      }))
      .sort((a, b) => b.total - a.total);

    // 3. By market type
    const { data: byMarketRaw } = await supabase
      .from("value_picks_v2")
      .select("market, result")
      .in("result", ["WON", "LOST"])
      .eq("is_opportunity", true);

    const marketStats: Record<string, { won: number; total: number }> = {};
    for (const pick of byMarketRaw || []) {
      const market = pick.market || "Otro";
      if (!marketStats[market]) marketStats[market] = { won: 0, total: 0 };
      marketStats[market].total++;
      if (pick.result === "WON") marketStats[market].won++;
    }

    const byMarket = Object.entries(marketStats)
      .map(([market, stats]) => ({
        market,
        total: stats.total,
        won: stats.won,
        win_rate: Math.round((stats.won / stats.total) * 1000) / 10,
      }))
      .sort((a, b) => b.total - a.total);

    // 4. By time period
    const now = new Date();
    const periods = [
      { label: "7d", days: 7 },
      { label: "30d", days: 30 },
      { label: "90d", days: 90 },
    ];

    const byPeriod: Record<string, { total: number; won: number; win_rate: number }> = {};
    for (const period of periods) {
      const since = new Date(now.getTime() - period.days * 24 * 60 * 60 * 1000).toISOString();
      const { data: periodPicks } = await supabase
        .from("value_picks_v2")
        .select("result")
        .in("result", ["WON", "LOST"])
        .eq("is_opportunity", true)
        .gte("created_at", since);

      const won = periodPicks?.filter((p: any) => p.result === "WON").length || 0;
      const total = periodPicks?.length || 0;
      byPeriod[period.label] = {
        total,
        won,
        win_rate: total > 0 ? Math.round((won / total) * 1000) / 10 : 0,
      };
    }

    // 5. Daily trend (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: trendPicks } = await supabase
      .from("value_picks_v2")
      .select("result, created_at")
      .in("result", ["WON", "LOST"])
      .eq("is_opportunity", true)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: true });

    const dailyTrend: Record<string, { won: number; total: number }> = {};
    for (const pick of trendPicks || []) {
      const day = pick.created_at.split("T")[0];
      if (!dailyTrend[day]) dailyTrend[day] = { won: 0, total: 0 };
      dailyTrend[day].total++;
      if (pick.result === "WON") dailyTrend[day].won++;
    }

    const trend = Object.entries(dailyTrend)
      .map(([date, stats]) => ({
        date,
        total: stats.total,
        won: stats.won,
        win_rate: stats.total > 0 ? Math.round((stats.won / stats.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 6. Count total pages and leagues
    const { count: totalPages } = await supabase
      .from("seo_pages")
      .select("id", { count: "exact", head: true });

    const { data: leaguesList } = await supabase
      .from("allowed_leagues")
      .select("name")
      .eq("is_active", true);

    return new Response(
      JSON.stringify({
        overall,
        byLeague,
        byMarket,
        byPeriod,
        trend,
        totalPages: totalPages || 0,
        totalLeagues: leaguesList?.length || 0,
      }),
      { headers: { ...corsHeaders, "Cache-Control": "public, max-age=300" } }
    );
  } catch (e: any) {
    console.error("[SEO-PUBLIC-STATS] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
