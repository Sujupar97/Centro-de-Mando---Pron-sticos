// Shared HTML template for Netlify Edge Functions
// Renders the base HTML shell with dark theme, fonts, GTM, and SEO tags

import { SEO_CRITICAL_CSS } from "./seo-styles.ts";

export interface PageMeta {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string;
  schemas?: string[]; // JSON-LD strings
}

const SITE_URL = "https://derbix.co";
// Replace with actual GTM container ID after setup
const GTM_ID = "GTM-P7V936CJ";

/**
 * Render the complete HTML page with head, body, and all SEO tags.
 */
export function renderPage(meta: PageMeta, bodyContent: string): string {
  const schemasHtml = (meta.schemas || [])
    .map((s) => `<script type="application/ld+json">${s}</script>`)
    .join("\n  ");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}">
  <link rel="canonical" href="${meta.canonicalUrl}">

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(meta.title)}">
  <meta property="og:description" content="${escapeHtml(meta.description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${meta.canonicalUrl}">
  <meta property="og:site_name" content="Derbix">
  ${meta.ogImage ? `<meta property="og:image" content="${meta.ogImage}">` : ""}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(meta.title)}">
  <meta name="twitter:description" content="${escapeHtml(meta.description)}">

  <!-- Schema.org -->
  ${schemasHtml}

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@500;700;800&display=swap" rel="stylesheet">

  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${GTM_ID}');</script>

  <!-- Critical CSS -->
  <style>${SEO_CRITICAL_CSS}</style>
</head>
<body>
  <!-- GTM noscript -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

  ${bodyContent}
</body>
</html>`;
}

/**
 * Render the top navigation bar.
 */
export function renderNav(): string {
  return `
  <div class="container">
    <nav class="nav">
      <a href="/" class="nav-logo">Derbix</a>
      <div class="flex gap-3 items-center">
        <a href="/predicciones" class="text-slate-300 text-sm">Predicciones</a>
        <a href="/estadisticas" class="text-slate-300 text-sm">Estadisticas</a>
        <a href="/pricing" class="text-slate-300 text-sm">Planes</a>
        <a href="/signup" class="btn btn-primary text-sm" style="padding:0.5rem 1rem;">Registrarse</a>
      </div>
    </nav>
  </div>`;
}

/**
 * Render breadcrumbs navigation.
 */
export function renderBreadcrumbs(
  items: Array<{ label: string; href?: string }>
): string {
  const parts = items
    .map((item, i) => {
      if (i === items.length - 1) {
        return `<span class="text-slate-300">${escapeHtml(item.label)}</span>`;
      }
      return `<a href="${item.href}">${escapeHtml(item.label)}</a><span class="separator">/</span>`;
    })
    .join(" ");

  return `<nav class="breadcrumbs" aria-label="breadcrumb">${parts}</nav>`;
}

/**
 * Render the footer with internal links.
 */
export function renderFooter(): string {
  return `
  <footer class="footer">
    <div class="container">
      <div class="flex justify-between flex-wrap gap-4">
        <div>
          <span class="nav-logo" style="font-size:1.25rem;">Derbix</span>
          <p class="mt-4 text-sm" style="max-width:400px;">
            Plataforma de inteligencia deportiva con IA. Analisis de mas de 5,000 variables por partido en 40+ ligas.
          </p>
        </div>
        <div class="flex gap-6">
          <div>
            <h4 class="font-semibold text-sm text-white mb-2">Predicciones</h4>
            <div class="flex flex-col gap-2 text-sm">
              <a href="/predicciones">Hoy</a>
              <a href="/predicciones/premier-league">Premier League</a>
              <a href="/predicciones/la-liga">La Liga</a>
              <a href="/predicciones/serie-a">Serie A</a>
              <a href="/predicciones/bundesliga">Bundesliga</a>
            </div>
          </div>
          <div>
            <h4 class="font-semibold text-sm text-white mb-2">Plataforma</h4>
            <div class="flex flex-col gap-2 text-sm">
              <a href="/pricing">Planes</a>
              <a href="/estadisticas">Estadisticas</a>
              <a href="/signup">Registrarse</a>
              <a href="/login">Iniciar Sesion</a>
            </div>
          </div>
          <div>
            <h4 class="font-semibold text-sm text-white mb-2">Legal</h4>
            <div class="flex flex-col gap-2 text-sm">
              <a href="/terms">Terminos</a>
              <a href="/privacy">Privacidad</a>
              <a href="/refund">Reembolsos</a>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-8 text-center text-sm text-slate-500">
        &copy; ${new Date().getFullYear()} Derbix. Todos los derechos reservados.
      </div>
    </div>
  </footer>`;
}

/**
 * Render a CTA section (for between content blocks).
 */
export function renderCTA(
  heading: string,
  subtext: string,
  buttonText: string,
  buttonHref: string
): string {
  return `
  <section class="card" style="text-align:center; margin: 2rem 0;">
    <h3>${escapeHtml(heading)}</h3>
    <p class="text-slate-400 mb-4">${escapeHtml(subtext)}</p>
    <a href="${buttonHref}" class="btn btn-primary">${escapeHtml(buttonText)}</a>
  </section>`;
}

/**
 * Escape HTML special characters.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
