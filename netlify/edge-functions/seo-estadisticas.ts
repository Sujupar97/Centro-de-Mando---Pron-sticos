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

export default async function handler(_req: Request) {
  try {
    const supabase = getSupabaseClient();

    // Fetch stats from value_picks_v2 directly (edge function has read access)
    const { data: allPicks } = await supabase
      .from("value_picks_v2")
      .select("result, market, fixture_id, p_model, odds, created_at, is_opportunity")
      .in("result", ["WON", "LOST"])
      .eq("is_opportunity", true);

    const picks = allPicks || [];
    const won = picks.filter((p: any) => p.result === "WON").length;
    const total = picks.length;
    const winRate = total > 0 ? Math.round((won / total) * 1000) / 10 : 0;

    // By market
    const marketStats: Record<string, { won: number; total: number }> = {};
    for (const p of picks) {
      const m = p.market || "Otro";
      if (!marketStats[m]) marketStats[m] = { won: 0, total: 0 };
      marketStats[m].total++;
      if (p.result === "WON") marketStats[m].won++;
    }

    // Recent periods
    const now = Date.now();
    const last7d = picks.filter((p: any) => new Date(p.created_at).getTime() > now - 7 * 86400000);
    const last30d = picks.filter((p: any) => new Date(p.created_at).getTime() > now - 30 * 86400000);

    const wr7d = last7d.length > 0 ? Math.round((last7d.filter((p: any) => p.result === "WON").length / last7d.length) * 1000) / 10 : 0;
    const wr30d = last30d.length > 0 ? Math.round((last30d.filter((p: any) => p.result === "WON").length / last30d.length) * 1000) / 10 : 0;

    // Active leagues count
    const { count: leagueCount } = await supabase
      .from("allowed_leagues")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    const body = buildStatsPage({
      total, won, winRate,
      wr7d, wr30d,
      count7d: last7d.length,
      count30d: last30d.length,
      marketStats,
      leagueCount: leagueCount || 0,
    });

    const meta: PageMeta = {
      title: "Estadisticas de Efectividad | Pronosticos Verificados — Derbix",
      description: `Track record verificado de Derbix: ${winRate}% de efectividad en ${total}+ pronosticos. Resultados 100% publicos, transparentes y auditables.`,
      canonicalUrl: `${SITE_URL}/estadisticas`,
    };

    return new Response(renderPage(meta, body), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  } catch (err) {
    console.error("[seo-estadisticas] Error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

interface StatsData {
  total: number;
  won: number;
  winRate: number;
  wr7d: number;
  wr30d: number;
  count7d: number;
  count30d: number;
  marketStats: Record<string, { won: number; total: number }>;
  leagueCount: number;
}

function buildStatsPage(stats: StatsData): string {
  let html = renderNav();
  html += `<main class="container py-8">`;

  html += renderBreadcrumbs([
    { label: "Inicio", href: "/" },
    { label: "Estadisticas" },
  ]);

  // Hero stats
  html += `
  <header class="text-center mb-12">
    <h1 class="mb-4" style="font-size:2.5rem;">Track Record Verificado</h1>
    <p class="text-slate-400 text-lg mb-8">Resultados 100% publicos. Sin editar. Sin esconder. Cada pronostico es verificado automaticamente contra resultados reales.</p>

    <div class="grid grid-2 gap-4" style="max-width:800px; margin:0 auto; grid-template-columns: repeat(4, 1fr);">
      <div class="card text-center">
        <div class="text-3xl font-bold text-emerald-400">${stats.winRate}%</div>
        <div class="text-slate-500 text-sm">Efectividad Total</div>
      </div>
      <div class="card text-center">
        <div class="text-3xl font-bold text-white">${stats.total}+</div>
        <div class="text-slate-500 text-sm">Pronosticos Verificados</div>
      </div>
      <div class="card text-center">
        <div class="text-3xl font-bold text-emerald-400">${stats.wr7d}%</div>
        <div class="text-slate-500 text-sm">Ultimos 7 Dias (${stats.count7d})</div>
      </div>
      <div class="card text-center">
        <div class="text-3xl font-bold text-white">${stats.leagueCount}+</div>
        <div class="text-slate-500 text-sm">Ligas Cubiertas</div>
      </div>
    </div>
  </header>`;

  // Period comparison
  html += `
  <section class="card mb-8">
    <h2>Efectividad por Periodo</h2>
    <table>
      <thead>
        <tr><th>Periodo</th><th>Pronosticos</th><th>Acertados</th><th>Efectividad</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Ultimos 7 dias</td>
          <td>${stats.count7d}</td>
          <td>${Math.round(stats.count7d * stats.wr7d / 100)}</td>
          <td><span class="${stats.wr7d >= 60 ? 'text-emerald-400' : 'text-white'} font-bold">${stats.wr7d}%</span></td>
        </tr>
        <tr>
          <td>Ultimos 30 dias</td>
          <td>${stats.count30d}</td>
          <td>${Math.round(stats.count30d * stats.wr30d / 100)}</td>
          <td><span class="${stats.wr30d >= 60 ? 'text-emerald-400' : 'text-white'} font-bold">${stats.wr30d}%</span></td>
        </tr>
        <tr>
          <td>Historico Total</td>
          <td>${stats.total}</td>
          <td>${stats.won}</td>
          <td><span class="${stats.winRate >= 60 ? 'text-emerald-400' : 'text-white'} font-bold">${stats.winRate}%</span></td>
        </tr>
      </tbody>
    </table>
  </section>`;

  // CTA
  html += renderCTA(
    "Accede a Pronosticos con Esta Efectividad",
    "1 pronostico gratis al dia, para siempre. Sin tarjeta de credito.",
    "Crear Cuenta Gratis",
    "/signup"
  );

  // By market type
  const marketEntries = Object.entries(stats.marketStats)
    .map(([market, s]) => ({
      market,
      total: s.total,
      won: s.won,
      wr: s.total > 0 ? Math.round((s.won / s.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  if (marketEntries.length) {
    html += `
    <section class="card mb-8">
      <h2>Efectividad por Tipo de Mercado</h2>
      <table>
        <thead>
          <tr><th>Mercado</th><th>Pronosticos</th><th>Acertados</th><th>Efectividad</th></tr>
        </thead>
        <tbody>`;

    for (const m of marketEntries) {
      html += `
          <tr>
            <td>${escapeHtml(m.market)}</td>
            <td>${m.total}</td>
            <td>${m.won}</td>
            <td><span class="${m.wr >= 60 ? 'text-emerald-400' : m.wr >= 50 ? 'text-white' : 'text-red-400'} font-bold">${m.wr}%</span></td>
          </tr>`;
    }

    html += `
        </tbody>
      </table>
    </section>`;
  }

  // Chart placeholder (hydrated client-side)
  html += `
  <section class="card mb-8">
    <h2>Tendencia de Efectividad</h2>
    <div id="stats-chart-container" style="min-height:300px;" class="flex items-center justify-center">
      <p class="text-slate-500">Grafico de tendencia disponible en la version interactiva.</p>
    </div>
  </section>`;

  // Methodology
  html += `
  <section class="card mb-8">
    <h2>Metodologia</h2>
    <ul class="bullet-list">
      <li>Cada pronostico es generado por nuestro motor de IA que analiza mas de 5,000 variables por partido usando datos de SportMonks API.</li>
      <li>Solo mostramos oportunidades con probabilidad calculada >= 83% y cuotas >= 1.40.</li>
      <li>Los resultados se verifican automaticamente cada hora contra los resultados reales de los partidos.</li>
      <li>Ningun resultado es editado o eliminado. El historial es 100% publico y transparente.</li>
      <li>Los administradores pueden corregir manualmente resultados en caso de errores de la API, pero estos cambios se reflejan inmediatamente.</li>
    </ul>
  </section>`;

  // Final CTA
  html += renderCTA(
    "Empieza a Ganar con Datos",
    "Unete a los apostadores que usan inteligencia artificial, no corazonadas.",
    "Registrate Gratis",
    "/signup"
  );

  html += `</main>`;
  html += renderFooter();

  return html;
}

export const config = { path: "/estadisticas" };
