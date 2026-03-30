import { getSupabaseClient } from "./_shared/supabase-client.ts";
import {
  renderPage,
  renderNav,
  renderBreadcrumbs,
  renderFooter,
  renderCTA,
  escapeHtml,
  type PageMeta,
} from "./_shared/html-template.ts";

const SITE_URL = "https://derbix.co";
const PAGE_SIZE = 20;

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  // "predicciones" | "predicciones/equipo/real-madrid" | "predicciones/premier-league"

  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const offset = (page - 1) * PAGE_SIZE;

  try {
    const supabase = getSupabaseClient();

    // Determine which index to render
    if (pathParts.length === 1 && pathParts[0] === "predicciones") {
      return renderMainIndex(supabase, page, offset);
    }

    if (pathParts.length === 3 && pathParts[1] === "equipo") {
      return renderTeamIndex(supabase, pathParts[2], page, offset);
    }

    if (pathParts.length === 2) {
      return renderLeagueIndex(supabase, pathParts[1], page, offset);
    }

    return new Response("Not Found", { status: 404 });
  } catch (err) {
    console.error("[seo-predicciones-index] Error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// ─── Main Index: /predicciones/ ───

async function renderMainIndex(supabase: any, page: number, offset: number): Promise<Response> {
  // Get today's and upcoming predictions grouped by league
  const { data: pages, count } = await supabase
    .from("seo_pages")
    .select("full_path, home_team, away_team, league_name, league_slug, match_date, has_results, result_correct, home_logo, away_logo", { count: "exact" })
    .order("match_date", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  // Get distinct leagues for navigation
  const { data: leagues } = await supabase
    .from("seo_pages")
    .select("league_slug, league_name")
    .order("league_name");

  // Deduplicate leagues
  const uniqueLeagues = leagues
    ? [...new Map(leagues.map((l: any) => [l.league_slug, l])).values()]
    : [];

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  let body = renderNav();
  body += `<main class="container py-8">`;
  body += renderBreadcrumbs([
    { label: "Inicio", href: "/" },
    { label: "Predicciones" },
  ]);

  body += `<h1 class="mb-6">Predicciones de Futbol con IA</h1>
    <p class="text-slate-400 mb-8">Pronosticos generados por nuestro algoritmo de inteligencia artificial. Analisis de mas de 5,000 variables por partido.</p>`;

  // League navigation
  if (uniqueLeagues.length) {
    body += `<div class="flex flex-wrap gap-2 mb-8">`;
    for (const league of uniqueLeagues as any[]) {
      body += `<a href="/predicciones/${league.league_slug}" class="badge badge-blue" style="text-decoration:none;">${escapeHtml(league.league_name)}</a>`;
    }
    body += `</div>`;
  }

  // Predictions list
  body += renderMatchList(pages || []);

  // Pagination
  body += renderPagination("/predicciones", page, totalPages);

  body += renderCTA(
    "Desbloquea Predicciones Premium",
    "1 pronostico gratis al dia, para siempre. Accede a analisis completos con probabilidades exactas.",
    "Crear Cuenta Gratis",
    "/signup"
  );

  body += `</main>`;
  body += renderFooter();

  const meta: PageMeta = {
    title: "Predicciones de Futbol con IA | Derbix",
    description: "Pronosticos de futbol generados por IA para 40+ ligas. Analisis profundo con mas de 5,000 variables. Track record verificable. Predicciones para hoy y proximos partidos.",
    canonicalUrl: `${SITE_URL}/predicciones${page > 1 ? `?page=${page}` : ""}`,
  };

  return new Response(renderPage(meta, body), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

// ─── League Index: /predicciones/[league-slug] ───

async function renderLeagueIndex(supabase: any, leagueSlug: string, page: number, offset: number): Promise<Response> {
  const { data: pages, count } = await supabase
    .from("seo_pages")
    .select("full_path, home_team, away_team, league_name, match_date, has_results, result_correct, home_logo, away_logo", { count: "exact" })
    .eq("league_slug", leagueSlug)
    .order("match_date", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (!pages?.length) {
    return new Response("Not Found", { status: 404 });
  }

  const leagueName = pages[0].league_name;
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  let body = renderNav();
  body += `<main class="container py-8">`;
  body += renderBreadcrumbs([
    { label: "Inicio", href: "/" },
    { label: "Predicciones", href: "/predicciones" },
    { label: leagueName },
  ]);

  body += `<h1 class="mb-6">Predicciones ${escapeHtml(leagueName)}</h1>
    <p class="text-slate-400 mb-8">Todos los pronosticos de ${escapeHtml(leagueName)} generados por nuestro algoritmo de IA.</p>`;

  body += renderMatchList(pages);
  body += renderPagination(`/predicciones/${leagueSlug}`, page, totalPages);

  body += renderCTA(
    `Pronosticos Premium de ${leagueName}`,
    "Accede a probabilidades exactas, picks de valor y analisis profundo.",
    "Ver Planes",
    "/pricing"
  );

  body += `</main>`;
  body += renderFooter();

  const meta: PageMeta = {
    title: `Predicciones ${leagueName} | Pronosticos con IA — Derbix`,
    description: `Pronosticos de ${leagueName} con inteligencia artificial. Analisis detallado de cada partido, estadisticas H2H, y picks de valor.`,
    canonicalUrl: `${SITE_URL}/predicciones/${leagueSlug}${page > 1 ? `?page=${page}` : ""}`,
  };

  return new Response(renderPage(meta, body), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

// ─── Team Index: /predicciones/equipo/[team-slug] ───

async function renderTeamIndex(supabase: any, teamSlug: string, page: number, offset: number): Promise<Response> {
  const { data: pages, count } = await supabase
    .from("seo_pages")
    .select("full_path, home_team, away_team, league_name, match_date, has_results, result_correct, home_logo, away_logo", { count: "exact" })
    .or(`home_team_slug.eq.${teamSlug},away_team_slug.eq.${teamSlug}`)
    .order("match_date", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (!pages?.length) {
    return new Response("Not Found", { status: 404 });
  }

  // Derive team name from first result
  const firstMatch = pages[0];
  const teamName = firstMatch.home_team_slug === teamSlug
    ? firstMatch.home_team
    : firstMatch.away_team || teamSlug;

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  let body = renderNav();
  body += `<main class="container py-8">`;
  body += renderBreadcrumbs([
    { label: "Inicio", href: "/" },
    { label: "Predicciones", href: "/predicciones" },
    { label: teamName },
  ]);

  body += `<h1 class="mb-6">Predicciones ${escapeHtml(teamName)}</h1>
    <p class="text-slate-400 mb-8">Historial completo de pronosticos para ${escapeHtml(teamName)}.</p>`;

  body += renderMatchList(pages);
  body += renderPagination(`/predicciones/equipo/${teamSlug}`, page, totalPages);

  body += `</main>`;
  body += renderFooter();

  const meta: PageMeta = {
    title: `Predicciones ${teamName} | Pronosticos con IA — Derbix`,
    description: `Pronosticos de ${teamName} con inteligencia artificial. Historial completo de analisis, resultados verificados y tendencias.`,
    canonicalUrl: `${SITE_URL}/predicciones/equipo/${teamSlug}${page > 1 ? `?page=${page}` : ""}`,
  };

  return new Response(renderPage(meta, body), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

// ─── Shared renderers ───

function renderMatchList(matches: any[]): string {
  if (!matches.length) {
    return `<p class="text-slate-500">No hay predicciones disponibles.</p>`;
  }

  let html = `<div class="flex flex-col gap-3">`;
  for (const m of matches) {
    const resultBadge = m.has_results
      ? m.result_correct
        ? `<span class="result-won text-sm">&#10003; Acertada</span>`
        : `<span class="result-lost text-sm">&#10007; Fallada</span>`
      : `<span class="text-slate-500 text-sm">Pendiente</span>`;

    html += `
    <a href="${m.full_path}" class="card-sm flex items-center justify-between" style="text-decoration:none;">
      <div class="flex items-center gap-3">
        ${m.home_logo ? `<img src="${m.home_logo}" alt="" class="team-logo-sm">` : ""}
        <span class="text-white font-medium">${escapeHtml(m.home_team)} vs ${escapeHtml(m.away_team)}</span>
        ${m.away_logo ? `<img src="${m.away_logo}" alt="" class="team-logo-sm">` : ""}
      </div>
      <div class="flex items-center gap-3">
        <span class="badge badge-blue text-sm">${escapeHtml(m.league_name || "")}</span>
        <span class="text-slate-500 text-sm">${m.match_date}</span>
        ${resultBadge}
      </div>
    </a>`;
  }
  html += `</div>`;
  return html;
}

function renderPagination(basePath: string, currentPage: number, totalPages: number): string {
  if (totalPages <= 1) return "";

  let html = `<div class="flex justify-center gap-2 mt-8">`;

  if (currentPage > 1) {
    html += `<a href="${basePath}${currentPage > 2 ? `?page=${currentPage - 1}` : ""}" class="btn btn-outline text-sm" style="padding:0.5rem 1rem;">Anterior</a>`;
  }

  html += `<span class="flex items-center text-slate-400 text-sm px-4">Pagina ${currentPage} de ${totalPages}</span>`;

  if (currentPage < totalPages) {
    html += `<a href="${basePath}?page=${currentPage + 1}" class="btn btn-outline text-sm" style="padding:0.5rem 1rem;">Siguiente</a>`;
  }

  html += `</div>`;
  return html;
}

export const config = { path: "/predicciones/*" };
