// Light-mode editorial HTML template for SEO pages

import { SEO_CRITICAL_CSS } from "./seo-styles.ts";

export interface PageMeta {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string;
  schemas?: string[];
}

const SITE_URL = "https://derbix.co";
const GTM_ID = "GTM-P7V936CJ";

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
  <meta name="google-site-verification" content="Bk4lF_kTaPtp2SINZBl1djLWn1VeeduiV-ca_k4eEfc">
  <meta property="og:title" content="${escapeHtml(meta.title)}">
  <meta property="og:description" content="${escapeHtml(meta.description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${meta.canonicalUrl}">
  <meta property="og:site_name" content="Derbix">
  ${meta.ogImage ? `<meta property="og:image" content="${meta.ogImage}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(meta.title)}">
  <meta name="twitter:description" content="${escapeHtml(meta.description)}">
  ${schemasHtml}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${GTM_ID}');</script>
  <style>${SEO_CRITICAL_CSS}</style>
</head>
<body>
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  ${bodyContent}
</body>
</html>`;
}

export function renderNav(): string {
  return `
  <nav class="nav-bar">
    <div class="nav-inner">
      <a href="/" class="nav-logo">Derbix</a>
      <div class="nav-links">
        <a href="/predicciones">Predicciones</a>
        <a href="/estadisticas">Estadisticas</a>
        <a href="/pricing">Planes</a>
        <a href="/signup" class="nav-cta">Registrarse</a>
      </div>
    </div>
  </nav>`;
}

export function renderBreadcrumbs(items: Array<{ label: string; href?: string }>): string {
  const parts = items
    .map((item, i) => {
      if (i === items.length - 1) return `<span>${escapeHtml(item.label)}</span>`;
      return `<a href="${item.href}">${escapeHtml(item.label)}</a><span class="sep">/</span>`;
    })
    .join(" ");
  return `<div class="breadcrumbs">${parts}</div>`;
}

export function renderFooter(): string {
  return `
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-grid">
        <div>
          <a href="/" class="nav-logo" style="font-size:1.125rem;">Derbix</a>
          <p style="margin-top:0.75rem;font-size:0.8125rem;max-width:280px;line-height:1.6;">
            Plataforma de inteligencia deportiva con IA. Analisis de mas de 5,000 variables por partido.
          </p>
        </div>
        <div class="footer-col">
          <h4>Predicciones</h4>
          <a href="/predicciones">Hoy</a>
          <a href="/predicciones/premier-league">Premier League</a>
          <a href="/predicciones/la-liga">La Liga</a>
          <a href="/predicciones/serie-a">Serie A</a>
          <a href="/predicciones/bundesliga">Bundesliga</a>
        </div>
        <div class="footer-col">
          <h4>Plataforma</h4>
          <a href="/pricing">Planes</a>
          <a href="/estadisticas">Estadisticas</a>
          <a href="/signup">Registrarse</a>
          <a href="/login">Iniciar Sesion</a>
        </div>
        <div class="footer-col">
          <h4>Legal</h4>
          <a href="/terms">Terminos</a>
          <a href="/privacy">Privacidad</a>
          <a href="/refund">Reembolsos</a>
        </div>
      </div>
      <div class="footer-bottom">&copy; ${new Date().getFullYear()} Derbix. Todos los derechos reservados.</div>
    </div>
  </footer>`;
}

export function renderCTA(heading: string, subtext: string, buttonText: string, buttonHref: string): string {
  return `
  <div class="cta-block">
    <div class="cta-title">${escapeHtml(heading)}</div>
    <p class="cta-sub">${escapeHtml(subtext)}</p>
    <a href="${buttonHref}" class="premium-btn">${escapeHtml(buttonText)}</a>
  </div>`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
