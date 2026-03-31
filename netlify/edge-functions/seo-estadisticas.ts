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
import { renderAdSlot } from "./_shared/content-formatter.ts";

const SITE_URL = "https://derbix.co";

export default async function handler(_req: Request) {
  try {
    const supabase = getSupabaseClient();

    const { data: allPicks } = await supabase
      .from("value_picks_v2")
      .select("result, market, fixture_id, p_model, odds, created_at, is_opportunity")
      .in("result", ["WON", "LOST"])
      .eq("is_opportunity", true);

    const picks = allPicks || [];
    const won = picks.filter((p: any) => p.result === "WON").length;
    const total = picks.length;
    const winRate = total > 0 ? Math.round((won / total) * 1000) / 10 : 0;

    const marketStats: Record<string, { won: number; total: number }> = {};
    for (const p of picks) {
      const m = p.market || "Otro";
      if (!marketStats[m]) marketStats[m] = { won: 0, total: 0 };
      marketStats[m].total++;
      if (p.result === "WON") marketStats[m].won++;
    }

    const now = Date.now();
    const last7d = picks.filter((p: any) => new Date(p.created_at).getTime() > now - 7 * 86400000);
    const last30d = picks.filter((p: any) => new Date(p.created_at).getTime() > now - 30 * 86400000);
    const wr7d = last7d.length > 0 ? Math.round((last7d.filter((p: any) => p.result === "WON").length / last7d.length) * 1000) / 10 : 0;
    const wr30d = last30d.length > 0 ? Math.round((last30d.filter((p: any) => p.result === "WON").length / last30d.length) * 1000) / 10 : 0;

    const { count: leagueCount } = await supabase
      .from("allowed_leagues")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    const body = buildStatsPage({
      total, won, winRate, wr7d, wr30d,
      count7d: last7d.length, count30d: last30d.length,
      marketStats, leagueCount: leagueCount || 0,
    });

    const meta: PageMeta = {
      title: "Estadisticas de Efectividad | Pronosticos Verificados — Derbix",
      description: `Track record verificado de Derbix: ${winRate}% de efectividad en ${total}+ pronosticos. Resultados 100% publicos y auditables.`,
      canonicalUrl: `${SITE_URL}/estadisticas`,
    };

    return new Response(renderPage(meta, body), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch (err) {
    console.error("[seo-estadisticas] Error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

interface StatsData {
  total: number; won: number; winRate: number;
  wr7d: number; wr30d: number; count7d: number; count30d: number;
  marketStats: Record<string, { won: number; total: number }>;
  leagueCount: number;
}

function buildStatsPage(stats: StatsData): string {
  let html = renderNav();
  html += `<div class="article-wide">`;

  html += renderBreadcrumbs([
    { label: "Inicio", href: "/" },
    { label: "Estadisticas" },
  ]);

  // Hero
  html += `
  <div class="stats-hero">
    <h1>Track Record Verificado</h1>
    <p style="color:#6b7280;font-size:1.125rem;max-width:600px;margin:0 auto 2rem;">
      Resultados 100% publicos. Sin editar. Sin esconder. Cada pronostico es verificado automaticamente contra resultados reales.
    </p>
    <div class="stats-kpi-grid">
      <div class="stats-kpi">
        <div class="stats-kpi-value green">${stats.winRate}%</div>
        <div class="stats-kpi-label">Efectividad Total</div>
      </div>
      <div class="stats-kpi">
        <div class="stats-kpi-value">${stats.total}+</div>
        <div class="stats-kpi-label">Pronosticos Verificados</div>
      </div>
      <div class="stats-kpi">
        <div class="stats-kpi-value green">${stats.wr7d}%</div>
        <div class="stats-kpi-label">Ultimos 7 Dias (${stats.count7d})</div>
      </div>
      <div class="stats-kpi">
        <div class="stats-kpi-value">${stats.leagueCount}+</div>
        <div class="stats-kpi-label">Ligas Cubiertas</div>
      </div>
    </div>
  </div>`;

  // Period table
  html += `
  <h2 class="section-title">Efectividad por Periodo</h2>
  <table class="stats-table">
    <thead><tr><th>Periodo</th><th>Pronosticos</th><th>Acertados</th><th>Efectividad</th></tr></thead>
    <tbody>
      <tr><td>Ultimos 7 dias</td><td class="num">${stats.count7d}</td><td class="num">${Math.round(stats.count7d * stats.wr7d / 100)}</td><td class="num" style="color:${stats.wr7d >= 60 ? '#059669' : '#111827'};font-weight:700;">${stats.wr7d}%</td></tr>
      <tr><td>Ultimos 30 dias</td><td class="num">${stats.count30d}</td><td class="num">${Math.round(stats.count30d * stats.wr30d / 100)}</td><td class="num" style="color:${stats.wr30d >= 60 ? '#059669' : '#111827'};font-weight:700;">${stats.wr30d}%</td></tr>
      <tr><td>Historico Total</td><td class="num">${stats.total}</td><td class="num">${stats.won}</td><td class="num" style="color:${stats.winRate >= 60 ? '#059669' : '#111827'};font-weight:700;">${stats.winRate}%</td></tr>
    </tbody>
  </table>`;

  html += renderAdSlot(1);

  html += renderCTA(
    "Accede a Pronosticos con Esta Efectividad",
    "1 pronostico gratis al dia, para siempre. Sin tarjeta de credito.",
    "Crear Cuenta Gratis",
    "/signup"
  );

  // By market
  const marketEntries = Object.entries(stats.marketStats)
    .map(([market, s]) => ({ market, total: s.total, won: s.won, wr: s.total > 0 ? Math.round((s.won / s.total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total);

  if (marketEntries.length) {
    html += `
    <h2 class="section-title">Efectividad por Tipo de Mercado</h2>
    <table class="stats-table">
      <thead><tr><th>Mercado</th><th>Pronosticos</th><th>Acertados</th><th>Efectividad</th></tr></thead>
      <tbody>`;
    for (const m of marketEntries) {
      const color = m.wr >= 60 ? '#059669' : m.wr >= 50 ? '#111827' : '#dc2626';
      html += `<tr><td>${escapeHtml(m.market)}</td><td class="num">${m.total}</td><td class="num">${m.won}</td><td class="num" style="color:${color};font-weight:700;">${m.wr}%</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  html += renderAdSlot(2);

  // Methodology
  html += `
  <h2 class="section-title">Metodologia</h2>
  <ul class="key-points">
    <li>Cada pronostico es generado por nuestro motor de IA que analiza mas de 5,000 variables por partido usando datos de SportMonks API.</li>
    <li>Solo mostramos oportunidades con probabilidad calculada &ge; 83% y cuotas &ge; 1.40.</li>
    <li>Los resultados se verifican automaticamente cada hora contra los resultados reales de los partidos.</li>
    <li>Ningun resultado es editado o eliminado. El historial es 100% publico y transparente.</li>
  </ul>`;

  html += renderCTA(
    "Empieza a Ganar con Datos",
    "Unete a los apostadores que usan inteligencia artificial, no corazonadas.",
    "Registrate Gratis",
    "/signup"
  );

  html += `</div>`;
  html += renderFooter();

  return html;
}

export const config = { path: "/estadisticas" };
