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
import {
  generateSportsEventSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
} from "./_shared/schema-org.ts";

const SITE_URL = "https://derbix.co";

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Expected: ["predicciones", leagueSlug, matchSlug]

  if (pathParts.length < 3 || pathParts[0] !== "predicciones") {
    return new Response("Not Found", { status: 404 });
  }

  const leagueSlug = pathParts[1];
  const matchSlug = pathParts[2];

  try {
    const supabase = getSupabaseClient();

    // 1. Get SEO page data
    const { data: page, error: pageErr } = await supabase
      .from("seo_pages")
      .select("*")
      .eq("league_slug", leagueSlug)
      .eq("match_slug", matchSlug)
      .single();

    if (pageErr || !page) {
      return render404(leagueSlug);
    }

    // 2. Get analysis report
    const { data: report } = await supabase
      .from("reports_v2")
      .select("report_packet")
      .eq("fixture_id", page.fixture_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 3. Get value picks (for stats display)
    const { data: picks } = await supabase
      .from("value_picks_v2")
      .select("market, selection, p_model, odds, edge, decision, confidence, result, is_opportunity")
      .eq("fixture_id", page.fixture_id)
      .order("p_model", { ascending: false });

    // 4. Get related matches (same league, recent)
    const { data: relatedLeague } = await supabase
      .from("seo_pages")
      .select("full_path, home_team, away_team, match_date, has_results, result_correct")
      .eq("league_slug", leagueSlug)
      .neq("fixture_id", page.fixture_id)
      .order("match_date", { ascending: false })
      .limit(6);

    // 5. Get related matches (same teams)
    const { data: relatedTeam } = await supabase
      .from("seo_pages")
      .select("full_path, home_team, away_team, match_date, league_name, has_results, result_correct")
      .or(`home_team_slug.eq.${page.home_team_slug},away_team_slug.eq.${page.home_team_slug}`)
      .neq("fixture_id", page.fixture_id)
      .order("match_date", { ascending: false })
      .limit(6);

    // Parse report data
    const rp = report?.report_packet;
    const resumen = rp?.resumen_ejecutivo;
    const detallado = rp?.analisis_detallado;
    const veredicto = rp?.veredicto_analista;
    const predicciones = rp?.predicciones_finales?.detalle || [];
    const advertencias = rp?.advertencias;

    // Build page HTML
    const bodyHtml = buildPredictionPage(page, {
      resumen,
      detallado,
      veredicto,
      predicciones,
      advertencias,
      picks: picks || [],
      relatedLeague: relatedLeague || [],
      relatedTeam: relatedTeam || [],
    });

    // Schema.org
    const sportsEventSchema = generateSportsEventSchema({
      homeTeam: page.home_team,
      awayTeam: page.away_team,
      leagueName: page.league_name,
      matchDate: page.match_date,
      matchTime: page.match_time,
      homeLogo: page.home_logo,
      awayLogo: page.away_logo,
      homeScore: page.home_score,
      awayScore: page.away_score,
      hasResults: page.has_results,
      url: `${SITE_URL}${page.full_path}`,
    });

    const faqSchema = generateFAQSchema(
      page.home_team,
      page.away_team,
      page.league_name,
      !!report
    );

    const breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Inicio", url: SITE_URL },
      { name: "Predicciones", url: `${SITE_URL}/predicciones` },
      { name: page.league_name, url: `${SITE_URL}/predicciones/${leagueSlug}` },
      { name: `${page.home_team} vs ${page.away_team}`, url: `${SITE_URL}${page.full_path}` },
    ]);

    const meta: PageMeta = {
      title: page.meta_title,
      description: page.meta_description,
      canonicalUrl: `${SITE_URL}${page.full_path}`,
      schemas: [sportsEventSchema, faqSchema, breadcrumbSchema],
    };

    const html = renderPage(meta, bodyHtml);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("[seo-prediccion] Error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// ─── Build the full prediction page body ───

interface AnalysisData {
  resumen: any;
  detallado: any;
  veredicto: any;
  predicciones: any[];
  advertencias: any;
  picks: any[];
  relatedLeague: any[];
  relatedTeam: any[];
}

function buildPredictionPage(page: any, data: AnalysisData): string {
  const { resumen, detallado, veredicto, predicciones, advertencias, picks, relatedLeague, relatedTeam } = data;

  const [year, month, day] = (page.match_date || "").split("-");
  const formattedDate = day && month && year ? `${day}/${month}/${year}` : page.match_date;

  let html = renderNav();

  html += `<main class="container py-8">`;

  // Breadcrumbs
  html += renderBreadcrumbs([
    { label: "Inicio", href: "/" },
    { label: "Predicciones", href: "/predicciones" },
    { label: page.league_name, href: `/predicciones/${page.league_slug}` },
    { label: `${page.home_team} vs ${page.away_team}` },
  ]);

  // ─── Section 1: Match Header ───
  html += `
  <header class="card mb-6">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center gap-4">
        ${page.home_logo ? `<img src="${page.home_logo}" alt="${escapeHtml(page.home_team)}" class="team-logo">` : ""}
        <div>
          <h1>Pronostico ${escapeHtml(page.home_team)} vs ${escapeHtml(page.away_team)}</h1>
          <p class="text-slate-400 text-sm">${escapeHtml(page.league_name)} &middot; ${formattedDate}${page.match_time ? ` &middot; ${page.match_time}` : ""}</p>
        </div>
        ${page.away_logo ? `<img src="${page.away_logo}" alt="${escapeHtml(page.away_team)}" class="team-logo">` : ""}
      </div>
      <div class="flex gap-2">
        <span class="badge badge-blue">${escapeHtml(page.league_name)}</span>
        ${veredicto?.nivel_confianza ? `<span class="badge badge-emerald">${escapeHtml(veredicto.nivel_confianza)} confianza</span>` : ""}
      </div>
    </div>`;

  // Result banner if available
  if (page.has_results && page.home_score != null && page.away_score != null) {
    const resultClass = page.result_correct ? "result-won" : "result-lost";
    const resultIcon = page.result_correct ? "&#10003;" : "&#10007;";
    html += `
    <div class="mt-4 p-4 card-sm flex items-center justify-between">
      <div>
        <span class="font-bold text-xl">${page.home_score} - ${page.away_score}</span>
        <span class="text-slate-400 text-sm ml-2">Resultado Final</span>
      </div>
      <span class="${resultClass} text-lg">${resultIcon} ${page.result_correct ? "Prediccion Acertada" : "Prediccion Fallada"}</span>
    </div>`;
  }

  html += `</header>`;

  // ─── Section 2: Analysis Summary (PUBLIC) ───
  if (resumen) {
    html += `
    <section class="card mb-6">
      <h2>Analisis del Partido</h2>
      ${resumen.frase_principal ? `<p class="text-lg text-slate-300 mb-4">${escapeHtml(resumen.frase_principal)}</p>` : ""}
      ${resumen.puntos_clave?.length ? `
      <ul class="bullet-list">
        ${resumen.puntos_clave.map((p: string) => `<li>${escapeHtml(p)}</li>`).join("")}
      </ul>` : ""}
    </section>`;
  }

  // ─── Section 3: Key Stats (PUBLIC) ───
  if (detallado) {
    html += `<section class="card mb-6">
      <h2>Estadisticas Clave</h2>`;

    // Competitive context
    if (detallado.contexto_competitivo?.bullets?.length) {
      html += `<h3 class="text-emerald-400">Contexto Competitivo</h3>
      <ul class="bullet-list mb-4">
        ${detallado.contexto_competitivo.bullets.map((b: string) => `<li>${escapeHtml(b)}</li>`).join("")}
      </ul>`;
    }

    // Tactical analysis
    if (detallado.estilo_y_tactica?.bullets?.length) {
      html += `<h3 class="text-emerald-400">Estilo y Tactica</h3>
      <ul class="bullet-list mb-4">
        ${detallado.estilo_y_tactica.bullets.map((b: string) => `<li>${escapeHtml(b)}</li>`).join("")}
      </ul>`;
    }

    html += `</section>`;
  }

  // ─── Section 4: Key Factors (PUBLIC) ───
  const factorSections = [
    { key: "alineaciones_y_bajas", title: "Alineaciones y Bajas" },
    { key: "factores_situacionales", title: "Factores Situacionales" },
    { key: "escenarios_de_partido", title: "Escenarios de Partido" },
  ];

  const hasFactors = detallado && factorSections.some((s) => detallado[s.key]?.bullets?.length);
  if (hasFactors) {
    html += `<section class="card mb-6">
      <h2>Factores Clave</h2>`;

    for (const section of factorSections) {
      const bullets = detallado[section.key]?.bullets;
      if (bullets?.length) {
        html += `<h3 class="text-emerald-400">${section.title}</h3>
        <ul class="bullet-list mb-4">
          ${bullets.map((b: string) => `<li>${escapeHtml(b)}</li>`).join("")}
        </ul>`;
      }
    }

    // Warnings
    if (advertencias?.bullets?.length) {
      html += `<h3 class="text-amber-400" style="color:#fbbf24;">Advertencias</h3>
      <ul class="bullet-list mb-4">
        ${advertencias.bullets.map((b: string) => `<li>${escapeHtml(b)}</li>`).join("")}
      </ul>`;
    }

    html += `</section>`;
  }

  // ─── Section 5: Prediction (PREMIUM — blurred) ───
  html += `
  <section class="card mb-6 relative" style="overflow:hidden; min-height:300px;">
    <h2>Prediccion y Apuestas Recomendadas</h2>
    <div class="premium-blur" aria-hidden="true">`;

  // Render actual predictions (blurred)
  if (veredicto) {
    html += `
      <div class="card-sm mb-4">
        <p class="font-bold text-xl">${escapeHtml(veredicto.decision || "APOSTAR")}</p>
        <p class="text-slate-300">${escapeHtml(veredicto.seleccion_clave || "Ver prediccion completa")}</p>
        <p class="text-sm text-slate-400">Probabilidad: ${veredicto.probabilidad || 0}% | ${escapeHtml(veredicto.nivel_confianza || "Media")} confianza</p>
      </div>`;
  }

  if (predicciones.length) {
    html += `<table>
      <thead><tr><th>Mercado</th><th>Seleccion</th><th>Probabilidad</th><th>Cuota</th></tr></thead>
      <tbody>`;
    for (const pred of predicciones.slice(0, 5)) {
      html += `<tr>
        <td>${escapeHtml(pred.mercado || "")}</td>
        <td>${escapeHtml(pred.seleccion || "")}</td>
        <td>${pred.probabilidad_estimado_porcentaje || 0}%</td>
        <td>${pred.odds ? `@${pred.odds}` : "-"}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `</div>`;

  // Overlay CTA
  html += `
    <div class="premium-overlay">
      <div style="font-size:3rem; margin-bottom:1rem;">&#128274;</div>
      <h3 class="text-xl font-bold mb-2 text-white">Desbloquea las Predicciones Premium</h3>
      <p class="text-slate-400 mb-4 text-center" style="max-width:400px;">
        Accede a probabilidades exactas, picks de valor y el analisis profundo completo. 1 pronostico gratis al dia, para siempre.
      </p>
      <a href="/signup" class="btn btn-primary">Crear Cuenta Gratis</a>
      <p class="text-slate-500 text-sm mt-4">Ya tienes cuenta? <a href="/login">Inicia sesion</a></p>
    </div>
  </section>`;

  // CTA between sections
  html += renderCTA(
    "Pronosticos con IA para 40+ Ligas",
    "Nuestro algoritmo analiza mas de 5,000 variables por partido. Track record 100% verificable.",
    "Ver Planes",
    "/pricing"
  );

  // ─── Section 6: Related Content ───
  html += `<section class="mb-8">`;

  // Related from same league
  if (relatedLeague?.length) {
    html += `<h2>Otros Partidos de ${escapeHtml(page.league_name)}</h2>
    <div class="grid grid-2 gap-3 mb-6">`;
    for (const r of relatedLeague) {
      const resultBadge = r.has_results
        ? r.result_correct
          ? `<span class="result-won text-sm">&#10003;</span>`
          : `<span class="result-lost text-sm">&#10007;</span>`
        : "";
      html += `<a href="${r.full_path}" class="card-sm flex items-center justify-between" style="text-decoration:none;">
        <span class="text-white text-sm">${escapeHtml(r.home_team)} vs ${escapeHtml(r.away_team)}</span>
        <span class="flex items-center gap-2">
          <span class="text-slate-500 text-sm">${r.match_date}</span>
          ${resultBadge}
        </span>
      </a>`;
    }
    html += `</div>`;
  }

  // Related from same team
  if (relatedTeam?.length) {
    html += `<h2>Ultimos Pronosticos de ${escapeHtml(page.home_team)}</h2>
    <div class="grid grid-2 gap-3 mb-6">`;
    for (const r of relatedTeam) {
      const resultBadge = r.has_results
        ? r.result_correct
          ? `<span class="result-won text-sm">&#10003;</span>`
          : `<span class="result-lost text-sm">&#10007;</span>`
        : "";
      html += `<a href="${r.full_path}" class="card-sm flex items-center justify-between" style="text-decoration:none;">
        <span class="text-white text-sm">${escapeHtml(r.home_team)} vs ${escapeHtml(r.away_team)}</span>
        <span class="flex items-center gap-2">
          <span class="text-slate-500 text-sm">${escapeHtml(r.league_name || "")}</span>
          ${resultBadge}
        </span>
      </a>`;
    }
    html += `</div>`;
  }

  html += `</section>`;
  html += `</main>`;
  html += renderFooter();

  return html;
}

// ─── 404 fallback ───

function render404(leagueSlug: string): Response {
  const meta: PageMeta = {
    title: "Pronostico no encontrado — Derbix",
    description: "La pagina de pronostico que buscas no existe o aun no ha sido generada.",
    canonicalUrl: `${SITE_URL}/predicciones`,
  };

  const body = `
  ${renderNav()}
  <main class="container py-12 text-center">
    <h1 class="mb-4">Pronostico No Encontrado</h1>
    <p class="text-slate-400 mb-6">Este pronostico aun no ha sido generado o la URL es incorrecta.</p>
    <div class="flex gap-3 justify-center">
      <a href="/predicciones/${leagueSlug}" class="btn btn-outline">Ver liga</a>
      <a href="/predicciones" class="btn btn-primary">Ver todos los pronosticos</a>
    </div>
  </main>
  ${renderFooter()}`;

  const html = renderPage(meta, body);
  return new Response(html, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const config = { path: "/predicciones/*/*" };
