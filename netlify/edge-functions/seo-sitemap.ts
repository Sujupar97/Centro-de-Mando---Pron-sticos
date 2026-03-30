import { getSupabaseClient } from "./_shared/supabase-client.ts";

const SITE_URL = "https://derbix.co";

export default async function handler(_req: Request) {
  try {
    const supabase = getSupabaseClient();

    // Get all published SEO pages
    const { data: pages, error } = await supabase
      .from("seo_pages")
      .select("full_path, updated_at, match_date")
      .order("match_date", { ascending: false });

    if (error) {
      console.error("[seo-sitemap] Error fetching pages:", error);
      return new Response("Error generating sitemap", { status: 500 });
    }

    // Get distinct league slugs for league index pages
    const { data: leagues } = await supabase
      .from("seo_pages")
      .select("league_slug")
      .order("league_slug");

    const uniqueLeagues = leagues
      ? [...new Set(leagues.map((l: any) => l.league_slug))]
      : [];

    // Get distinct team slugs for team index pages
    const { data: homeTeams } = await supabase
      .from("seo_pages")
      .select("home_team_slug");
    const { data: awayTeams } = await supabase
      .from("seo_pages")
      .select("away_team_slug");

    const teamSlugs = new Set<string>();
    homeTeams?.forEach((t: any) => teamSlugs.add(t.home_team_slug));
    awayTeams?.forEach((t: any) => teamSlugs.add(t.away_team_slug));

    const now = new Date().toISOString().split("T")[0];
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static pages -->
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/predicciones</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE_URL}/estadisticas</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${SITE_URL}/pricing</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;

    // League index pages
    for (const slug of uniqueLeagues) {
      xml += `
  <url>
    <loc>${SITE_URL}/predicciones/${slug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    // Team index pages
    for (const slug of teamSlugs) {
      xml += `
  <url>
    <loc>${SITE_URL}/predicciones/equipo/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    }

    // Individual prediction pages
    for (const page of pages || []) {
      const isRecent = page.match_date >= oneWeekAgo;
      const priority = isRecent ? "0.8" : "0.6";
      const changefreq = isRecent ? "daily" : "monthly";

      xml += `
  <url>
    <loc>${SITE_URL}${page.full_path}</loc>
    <lastmod>${page.updated_at ? page.updated_at.split("T")[0] : now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    }

    xml += `
</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (err) {
    console.error("[seo-sitemap] Error:", err);
    return new Response("Error generating sitemap", { status: 500 });
  }
}

export const config = { path: "/sitemap.xml" };
