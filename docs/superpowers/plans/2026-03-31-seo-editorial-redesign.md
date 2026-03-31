# SEO Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform SEO prediction pages from dark-mode app layout to light-mode editorial articles (ESPN/Marca style) with Google AdSense integration.

**Architecture:** Rewrite the CSS, HTML templates, and Edge Function renderers to output a white-background, serif-title, narrative-style article. Add a content-formatter utility that transforms Gemini's bullet points into journalistic paragraphs. Insert 3 AdSense slots. Update React SPA components to match.

**Tech Stack:** Netlify Edge Functions (Deno), React 19, TypeScript, inline CSS

---

### Task 1: Rewrite light-mode CSS

**Files:**
- Modify: `netlify/edge-functions/_shared/seo-styles.ts` (complete rewrite)

- [ ] **Step 1: Replace the entire CSS with light-mode editorial styles**

Replace all contents of `netlify/edge-functions/_shared/seo-styles.ts` with:

```typescript
// Light-mode editorial CSS for SEO pages (ESPN/Marca style)

export const SEO_CRITICAL_CSS = `
  /* Reset */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* Base — Light mode */
  html { font-family: 'Inter', system-ui, -apple-system, sans-serif; scroll-behavior: smooth; }
  body { background: #ffffff; color: #1a1a2e; line-height: 1.8; min-height: 100vh; font-size: 17px; }
  a { color: #10b981; text-decoration: none; }
  a:hover { text-decoration: underline; }
  img { max-width: 100%; height: auto; }

  /* Article container — 720px reading width */
  .article { max-width: 720px; margin: 0 auto; padding: 0 1.25rem; }
  .article-wide { max-width: 960px; margin: 0 auto; padding: 0 1.25rem; }

  /* Navigation */
  .nav-bar { background: #ffffff; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 50; }
  .nav-inner { max-width: 960px; margin: 0 auto; padding: 0.875rem 1.25rem; display: flex; align-items: center; justify-content: space-between; }
  .nav-logo { font-family: 'Outfit', sans-serif; font-size: 1.375rem; font-weight: 800; color: #10b981; }
  .nav-links { display: flex; align-items: center; gap: 1.5rem; }
  .nav-links a { color: #6b7280; font-size: 0.875rem; font-weight: 500; }
  .nav-links a:hover { color: #1a1a2e; text-decoration: none; }
  .nav-cta { background: #10b981; color: white; padding: 0.5rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; }
  .nav-cta:hover { background: #059669; text-decoration: none; }

  /* Breadcrumbs */
  .breadcrumbs { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: #9ca3af; padding: 1.25rem 0 0; }
  .breadcrumbs a { color: #6b7280; }
  .breadcrumbs a:hover { color: #10b981; }
  .breadcrumbs .sep { color: #d1d5db; }

  /* Category badge */
  .category-bar { padding: 1.5rem 0 0.5rem; display: flex; gap: 0.5rem; align-items: center; }
  .cat-badge { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 0.25rem 0.625rem; border-radius: 0.25rem; }
  .cat-analysis { background: #10b981; color: white; }
  .cat-league { background: #e0f2fe; color: #0369a1; }
  .cat-date { color: #9ca3af; font-size: 0.75rem; font-weight: 500; }

  /* H1 — Serif, editorial */
  .article-title { font-family: Georgia, 'Times New Roman', serif; font-size: 2.25rem; font-weight: 700; color: #111827; line-height: 1.2; margin: 0.75rem 0; }

  /* Byline */
  .byline { display: flex; align-items: center; gap: 0.75rem; color: #6b7280; font-size: 0.8125rem; padding: 0.5rem 0 1.5rem; border-bottom: 1px solid #e5e7eb; margin-bottom: 2rem; }
  .byline-dot { width: 3px; height: 3px; background: #d1d5db; border-radius: 50%; }

  /* Hero match card */
  .hero-match { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 1rem; padding: 2rem; margin-bottom: 2.5rem; }
  .hero-teams { display: flex; align-items: center; justify-content: center; gap: 2rem; margin-bottom: 1.25rem; }
  .hero-team { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
  .hero-team img { width: 64px; height: 64px; object-fit: contain; }
  .hero-team-name { font-weight: 700; font-size: 1.125rem; color: #111827; }
  .hero-vs { font-family: Georgia, serif; font-size: 1.5rem; color: #9ca3af; font-weight: 300; }
  .hero-info { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }
  .hero-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.75rem; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 2rem; font-size: 0.75rem; color: #475569; font-weight: 500; }
  .hero-confidence { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }

  /* Section headings */
  .section-title { font-family: Georgia, serif; font-size: 1.5rem; font-weight: 700; color: #111827; margin: 2.5rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #10b981; }

  /* Body paragraphs */
  .article p { margin-bottom: 1.25rem; color: #374151; }

  /* Key points as editorial bullets */
  .key-points { list-style: none; padding: 0; margin: 1rem 0 1.5rem; }
  .key-points li { padding: 0.625rem 0 0.625rem 1.5rem; position: relative; color: #374151; border-bottom: 1px solid #f3f4f6; }
  .key-points li:last-child { border-bottom: none; }
  .key-points li::before { content: ''; position: absolute; left: 0; top: 1rem; width: 6px; height: 6px; background: #10b981; border-radius: 50%; }

  /* Stats tables */
  .stats-table { width: 100%; border-collapse: collapse; margin: 1rem 0 2rem; font-size: 0.9375rem; }
  .stats-table th { text-align: left; padding: 0.75rem 1rem; background: #f8fafc; color: #6b7280; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb; }
  .stats-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; color: #374151; }
  .stats-table tr:hover td { background: #fafafa; }
  .stats-table .num { font-weight: 700; font-variant-numeric: tabular-nums; }

  /* Form indicators W/D/L */
  .form-w { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 4px; font-size: 0.6875rem; font-weight: 800; background: #d1fae5; color: #065f46; }
  .form-d { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 4px; font-size: 0.6875rem; font-weight: 800; background: #fef3c7; color: #92400e; }
  .form-l { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 4px; font-size: 0.6875rem; font-weight: 800; background: #fee2e2; color: #991b1b; }

  /* Premium blur section */
  .premium-section { position: relative; margin: 2rem 0; border-radius: 1rem; overflow: hidden; min-height: 280px; border: 1px solid #e5e7eb; }
  .premium-blur { filter: blur(8px); user-select: none; pointer-events: none; padding: 2rem; }
  .premium-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.90); backdrop-filter: blur(4px); padding: 2rem; }
  .premium-lock { font-size: 2.5rem; margin-bottom: 1rem; }
  .premium-title { font-family: Georgia, serif; font-size: 1.375rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem; }
  .premium-sub { color: #6b7280; font-size: 0.9375rem; text-align: center; max-width: 400px; margin-bottom: 1.5rem; }
  .premium-btn { background: #10b981; color: white; font-weight: 700; font-size: 1rem; padding: 0.875rem 2rem; border-radius: 0.75rem; border: none; cursor: pointer; display: inline-block; }
  .premium-btn:hover { background: #059669; text-decoration: none; }
  .premium-login { color: #6b7280; font-size: 0.8125rem; margin-top: 1rem; }
  .premium-login a { color: #10b981; }

  /* Result banner */
  .result-banner { padding: 1.25rem 1.5rem; border-radius: 0.75rem; display: flex; align-items: center; justify-content: space-between; margin: 2rem 0; }
  .result-won { background: #ecfdf5; border: 1px solid #a7f3d0; }
  .result-lost { background: #fef2f2; border: 1px solid #fecaca; }
  .result-score { font-size: 1.5rem; font-weight: 800; color: #111827; }
  .result-label { font-size: 0.875rem; color: #6b7280; margin-left: 0.5rem; }
  .result-tag { font-weight: 700; font-size: 0.875rem; }
  .result-tag-won { color: #065f46; }
  .result-tag-lost { color: #991b1b; }

  /* AdSense container */
  .ad-slot { max-width: 720px; margin: 2rem auto; padding: 1rem 0; text-align: center; min-height: 90px; border-top: 1px solid #f3f4f6; border-bottom: 1px solid #f3f4f6; }
  .ad-label { font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.1em; color: #d1d5db; margin-bottom: 0.25rem; }

  /* Related content */
  .related-section { margin: 3rem 0; padding-top: 2rem; border-top: 1px solid #e5e7eb; }
  .related-title { font-family: Georgia, serif; font-size: 1.25rem; font-weight: 700; color: #111827; margin-bottom: 1rem; }
  .related-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .related-card { display: flex; align-items: center; justify-content: space-between; padding: 0.875rem 1rem; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 0.5rem; font-size: 0.875rem; color: #374151; font-weight: 500; }
  .related-card:hover { border-color: #10b981; text-decoration: none; color: #111827; }
  .related-meta { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: #9ca3af; }
  .related-won { color: #065f46; font-weight: 700; }
  .related-lost { color: #991b1b; font-weight: 700; }

  /* CTA block */
  .cta-block { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 1rem; padding: 2.5rem; text-align: center; margin: 3rem 0; }
  .cta-title { font-family: Georgia, serif; font-size: 1.375rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem; }
  .cta-sub { color: #6b7280; margin-bottom: 1.25rem; }

  /* Footer */
  .footer { background: #111827; color: #9ca3af; margin-top: 4rem; }
  .footer-inner { max-width: 960px; margin: 0 auto; padding: 3rem 1.25rem; }
  .footer-grid { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 2rem; }
  .footer-col h4 { color: #ffffff; font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
  .footer-col a { display: block; color: #9ca3af; font-size: 0.8125rem; margin-bottom: 0.5rem; }
  .footer-col a:hover { color: #10b981; }
  .footer-bottom { text-align: center; padding-top: 2rem; margin-top: 2rem; border-top: 1px solid #1f2937; font-size: 0.75rem; }

  /* Alternating section backgrounds */
  .section-alt { background: #f8fafc; margin: 0 -1.25rem; padding: 2rem 1.25rem; }

  /* Responsive */
  @media (max-width: 768px) {
    body { font-size: 16px; }
    .article-title { font-size: 1.625rem; }
    .hero-teams { gap: 1rem; }
    .hero-team img { width: 48px; height: 48px; }
    .hero-vs { font-size: 1.25rem; }
    .related-grid { grid-template-columns: 1fr; }
    .nav-links { gap: 0.75rem; }
    .section-title { font-size: 1.25rem; }
  }
`;
```

- [ ] **Step 2: Commit**

```bash
git add netlify/edge-functions/_shared/seo-styles.ts
git commit -m "style: rewrite SEO CSS to light-mode editorial theme"
```

---

### Task 2: Create content formatter utility

**Files:**
- Create: `netlify/edge-functions/_shared/content-formatter.ts`

- [ ] **Step 1: Create the content formatter that converts bullets to narrative paragraphs**

Create `netlify/edge-functions/_shared/content-formatter.ts`:

```typescript
// Transforms Gemini's bullet-point analysis into editorial narrative paragraphs

/**
 * Convert an array of bullet points into flowing narrative paragraphs.
 * Groups every 2-3 bullets into a paragraph, adding transitional words.
 */
export function bulletsToNarrative(bullets: string[]): string {
  if (!bullets || !bullets.length) return "";

  // If 1-2 bullets, just join them as one paragraph
  if (bullets.length <= 2) {
    return `<p>${bullets.join(". ")}.</p>`;
  }

  // Group into paragraphs of 2-3 sentences
  const paragraphs: string[] = [];
  const transitions = [
    "Además, ", "Por otro lado, ", "En ese sentido, ",
    "Cabe destacar que ", "Asimismo, ", "De igual manera, ",
    "En cuanto a ", "Respecto a esto, ",
  ];

  let tIdx = 0;
  for (let i = 0; i < bullets.length; i += 3) {
    const chunk = bullets.slice(i, i + 3);
    const sentences = chunk.map((b, j) => {
      let s = b.replace(/^[-•*]\s*/, "").trim();
      // Capitalize first letter
      s = s.charAt(0).toUpperCase() + s.slice(1);
      // Ensure ends with period
      if (!/[.!?]$/.test(s)) s += ".";
      // Add transition to middle sentences (not first of first paragraph)
      if (i > 0 && j === 0) {
        s = transitions[tIdx % transitions.length] + s.charAt(0).toLowerCase() + s.slice(1);
        tIdx++;
      }
      return s;
    });
    paragraphs.push(`<p>${sentences.join(" ")}</p>`);
  }

  return paragraphs.join("\n");
}

/**
 * Format a reading time estimate based on word count.
 */
export function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(3, Math.ceil(words / 200));
}

/**
 * Format a relative time string ("hace 2 horas", "hace 3 días").
 */
export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays} dias`;
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

/**
 * Render an AdSense slot placeholder.
 * Replace ADSENSE_CLIENT_ID with actual publisher ID when available.
 */
export function renderAdSlot(slotNumber: number): string {
  return `
  <div class="ad-slot">
    <div class="ad-label">Publicidad</div>
    <!-- Google AdSense slot ${slotNumber} — replace with real ad unit after AdSense approval -->
    <div style="min-height:90px;display:flex;align-items:center;justify-content:center;color:#d1d5db;font-size:0.75rem;">
      Espacio publicitario
    </div>
  </div>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add netlify/edge-functions/_shared/content-formatter.ts
git commit -m "feat: add content formatter for editorial narrative conversion"
```

---

### Task 3: Rewrite HTML template (nav, footer, page shell)

**Files:**
- Modify: `netlify/edge-functions/_shared/html-template.ts` (complete rewrite)

- [ ] **Step 1: Replace html-template.ts with light-mode editorial template**

Replace all contents of `netlify/edge-functions/_shared/html-template.ts` with:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add netlify/edge-functions/_shared/html-template.ts
git commit -m "style: rewrite HTML template to light-mode editorial layout"
```

---

### Task 4: Rewrite the prediction page Edge Function

**Files:**
- Modify: `netlify/edge-functions/seo-prediccion.ts` (complete rewrite of `buildPredictionPage` and `render404`)

- [ ] **Step 1: Replace the entire `seo-prediccion.ts` file**

Replace all contents of `netlify/edge-functions/seo-prediccion.ts` with the editorial article renderer. This is the largest change — the function now outputs a white-background, serif-title article with narrative paragraphs and 3 ad slots.

The file keeps the same handler structure (URL parsing, Supabase queries, Schema.org, related content queries) but rewrites `buildPredictionPage()` to output editorial HTML using the new CSS classes and `bulletsToNarrative()` for content transformation.

Key changes in the output HTML:
- `<nav class="nav-bar">` instead of dark nav
- `<div class="article">` wrapper at 720px width
- Serif `<h1 class="article-title">` with byline
- Hero match card with centered team logos on light background
- Narrative paragraphs via `bulletsToNarrative()` instead of bullet lists
- 3 `renderAdSlot()` calls at positions 1 (after summary), 2 (before premium), 3 (before footer)
- Light-mode premium blur with white overlay
- Light-mode result banner (green/red backgrounds)
- Editorial related content cards

Import the new formatter:
```typescript
import { bulletsToNarrative, estimateReadingTime, timeAgo, renderAdSlot } from "./_shared/content-formatter.ts";
```

The `buildPredictionPage` function renders these sections in order:
1. Nav bar
2. Article container with breadcrumbs
3. Category badges (ANÁLISIS | LIGA | FECHA)
4. Article title (serif H1)
5. Byline (Derbix AI Engine · time ago · reading time)
6. Hero match card (team logos, badges)
7. Result banner (if match finished)
8. Section: "Resumen del Partido" — narrative paragraphs from `resumen_ejecutivo`
9. **AdSense slot #1**
10. Section: "Contexto de la Temporada" — narrative from `contexto_competitivo`
11. Section: "Analisis Tactico" — narrative from `estilo_y_tactica`
12. Section: "Estadisticas Clave" — tables (kept as tables, not narrative)
13. **AdSense slot #2**
14. Section: "Factores Decisivos" — narrative from `factores_situacionales` + `advertencias`
15. Section: "Prediccion y Apuestas" — premium blur with CTA
16. **AdSense slot #3**
17. CTA block
18. Related content (same league + same team)
19. Footer

- [ ] **Step 2: Commit**

```bash
git add netlify/edge-functions/seo-prediccion.ts
git commit -m "feat: rewrite prediction page as editorial article with ads"
```

---

### Task 5: Update index pages and statistics to light mode

**Files:**
- Modify: `netlify/edge-functions/seo-predicciones-index.ts`
- Modify: `netlify/edge-functions/seo-estadisticas.ts`

- [ ] **Step 1: Update index pages to use light-mode classes**

In `seo-predicciones-index.ts`, update `renderMatchList()` to use light-mode card classes (`.related-card` instead of `.card-sm`), and update the page wrapper from dark classes to the article container. The structure stays the same — only CSS classes change.

- [ ] **Step 2: Update statistics page to light mode**

In `seo-estadisticas.ts`, update the stat cards, tables, and CTA sections to use the new light-mode classes. Hero stats use dark text on white background instead of light text on dark background.

- [ ] **Step 3: Commit**

```bash
git add netlify/edge-functions/seo-predicciones-index.ts netlify/edge-functions/seo-estadisticas.ts
git commit -m "style: update index and stats pages to light-mode editorial theme"
```

---

### Task 6: Update React SPA components to match editorial style

**Files:**
- Modify: `components/seo/PrediccionPage.tsx`
- Modify: `components/seo/PrediccionesIndex.tsx`
- Modify: `components/seo/EstadisticasPage.tsx`
- Modify: `components/seo/MatchHeader.tsx`
- Modify: `components/seo/PremiumBlur.tsx`
- Modify: `components/seo/Breadcrumbs.tsx`
- Modify: `components/seo/RelatedContent.tsx`

- [ ] **Step 1: Update all SPA components from dark Tailwind classes to light-mode equivalents**

For each component, swap:
- `bg-slate-950` / `bg-slate-900` → `bg-white` / `bg-gray-50`
- `text-white` → `text-gray-900`
- `text-slate-300/400` → `text-gray-600/500`
- `border-white/5` → `border-gray-200`
- `backdrop-blur-xl` → remove (not needed on white)
- Font for titles: add `font-serif` where Georgia should apply
- `PremiumBlur`: change overlay from dark to white (`bg-white/90`)

These are Tailwind class replacements — the component structure and logic stay identical.

- [ ] **Step 2: Commit**

```bash
git add components/seo/
git commit -m "style: update React SEO components to light-mode editorial theme"
```

---

### Task 7: Build, verify, and deploy

**Files:** None (build/deploy only)

- [ ] **Step 1: Run vite build to verify no errors**

```bash
npx vite build
```

Expected: Build succeeds in ~4s with no errors.

- [ ] **Step 2: Push to GitHub**

```bash
git push origin main
```

Expected: Netlify auto-deploys.

- [ ] **Step 3: Trigger Netlify production deploy**

```bash
npx netlify deploy --build --prod
```

Expected: Deploy completes, Edge Functions serve new light-mode pages.

- [ ] **Step 4: Verify production pages**

Test these URLs and confirm light-mode editorial layout:
- `https://derbix.co/predicciones/friendly-international/colombia-vs-france-2026-03-29`
- `https://derbix.co/predicciones`
- `https://derbix.co/estadisticas`
