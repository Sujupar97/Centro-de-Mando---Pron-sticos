# SEO Editorial Redesign — Design Spec

## Context

The programmatic SEO pages at `/predicciones/*` currently use a dark-mode app-style layout. This redesign transforms them into editorial articles styled like ESPN/Marca to improve engagement, SEO performance, and conversion from organic visitors.

## Design Decisions

- **Style**: ESPN/Marca — headline, author byline, hero image, narrative paragraphs, sidebar-free
- **Tone**: Neutral sports journalist — objective, informative, third person
- **Color scheme**: Light mode (white background) for SEO pages; app stays dark mode
- **Ads**: 3 Google AdSense placements per article (standard editorial positioning)
- **Language**: Spanish only, matching current URL structure (`/predicciones/`)

## Article Structure

```
[Nav: Logo | Predicciones | Ligas | Estadísticas | Registrarse]
[Breadcrumbs: Predicciones > Liga > Partido]

[Category badge] ANÁLISIS | LIGA | FECHA

[H1 serif] Equipo A vs Equipo B: Análisis Completo y Pronóstico

[Byline] Por Derbix AI Engine · Actualizado hace Xh · X min lectura

[Hero: team logos + match info badges (date, time, stadium, confidence)]

── Resumen del Partido ──
[2-3 narrative paragraphs from resumen_ejecutivo]

══ ADSENSE #1 ══

── Contexto de la Temporada ──
[Narrative paragraphs from contexto_competitivo]

── Análisis Táctico ──
[Narrative from estilo_y_tactica, formaciones]

── Estadísticas Clave ──
[Tables: recent form W/D/L, H2H, avg goals]

══ ADSENSE #2 ══

── Factores Decisivos ──
[Injuries, news, streaks from factores_situacionales, advertencias]

── Predicción y Apuestas ──
[BLURRED premium content + registration CTA]

══ ADSENSE #3 ══

── Resultado (if match finished) ──
[Score + ✓ Acertada / ✗ Fallada badge]

── Partidos Relacionados ──
[Same league matches + same team history]

[Footer: internal links, legal, branding]
```

## Visual Style

- **Background**: White `#ffffff`, alternating sections in `#f8fafc`
- **Title font**: Serif (Georgia) — journalistic feel
- **Body font**: Sans-serif (Inter) — readable for long text
- **Accent color**: Emerald `#10b981` for badges, links, CTAs
- **Max content width**: 720px (Medium/The Athletic reading width)
- **Tables**: Soft borders, alternating row backgrounds, subtle colors
- **Hero**: Large team crests with match info badges

## Content Transformation

Gemini's `report_packet` bullet points are reformatted into narrative paragraphs:

**Input** (bullets from report_packet):
- "Real Madrid lidera con 3 puntos de ventaja"
- "Barcelona viene de perder 2 de sus últimos 5"

**Output** (editorial narrative):
> El Real Madrid llega a este clásico con la ventaja moral y numérica en La Liga. Con tres puntos de distancia sobre su eterno rival, una victoria en el Santiago Bernabéu prácticamente sentenciaría el título de esta temporada.

The Edge Function transforms bullets into flowing paragraphs by joining related points and adding transitional language.

## Google AdSense Integration

3 horizontal responsive ad blocks (`display:block`, Google auto-size):
1. After the analysis summary — reader is engaged, natural break
2. Before the prediction section — just before premium content
3. Before the footer — captures readers who scrolled to the end

AdSense requires a separate account setup (manual step, not code).

## Files to Modify

### Netlify Edge Functions (SSR — what Google sees):
- `netlify/edge-functions/seo-prediccion.ts` — complete rewrite of HTML output
- `netlify/edge-functions/_shared/seo-styles.ts` — new light-mode CSS
- `netlify/edge-functions/_shared/html-template.ts` — updated base template
- `netlify/edge-functions/seo-predicciones-index.ts` — light-mode index pages
- `netlify/edge-functions/seo-estadisticas.ts` — light-mode statistics page

### React Components (SPA — what logged-in users see):
- `components/seo/PrediccionPage.tsx` — editorial layout
- `components/seo/PrediccionesIndex.tsx` — light-mode index
- `components/seo/EstadisticasPage.tsx` — light-mode stats
- `components/seo/MatchHeader.tsx` — hero section redesign
- `components/seo/PremiumBlur.tsx` — light-mode blur overlay
- `components/seo/Breadcrumbs.tsx` — light-mode breadcrumbs
- `components/seo/RelatedContent.tsx` — light-mode cards

### New utility:
- `netlify/edge-functions/_shared/content-formatter.ts` — transforms bullets to narrative paragraphs

## What Does NOT Change

- URL routes (`/predicciones/[liga]/[match]`)
- Database schema (`seo_pages` table)
- Pipeline (`v3-ai-analyzer → seo-publish-page`)
- Schema.org structured data
- Sitemap/robots.txt
- GTM/GA4 tracking
- Admin SEO dashboard
