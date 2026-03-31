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
  .nav-cta { background: #10b981; color: white !important; padding: 0.5rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; }
  .nav-cta:hover { background: #059669; text-decoration: none !important; color: white !important; }

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
  .byline { display: flex; align-items: center; gap: 0.75rem; color: #6b7280; font-size: 0.8125rem; padding: 0.5rem 0 1.5rem; border-bottom: 1px solid #e5e7eb; margin-bottom: 2rem; flex-wrap: wrap; }
  .byline-dot { width: 3px; height: 3px; background: #d1d5db; border-radius: 50%; }

  /* Hero match card */
  .hero-match { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 1rem; padding: 2rem; margin-bottom: 2.5rem; }
  .hero-teams { display: flex; align-items: center; justify-content: center; gap: 2rem; margin-bottom: 1.25rem; }
  .hero-team { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
  .hero-team img { width: 64px; height: 64px; object-fit: contain; }
  .hero-team-name { font-weight: 700; font-size: 1.125rem; color: #111827; text-align: center; }
  .hero-vs { font-family: Georgia, serif; font-size: 1.5rem; color: #9ca3af; font-weight: 300; }
  .hero-info { display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; }
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
  .premium-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.92); backdrop-filter: blur(4px); padding: 2rem; }
  .premium-lock { font-size: 2.5rem; margin-bottom: 1rem; }
  .premium-title { font-family: Georgia, serif; font-size: 1.375rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem; }
  .premium-sub { color: #6b7280; font-size: 0.9375rem; text-align: center; max-width: 400px; margin-bottom: 1.5rem; line-height: 1.6; }
  .premium-btn { background: #10b981; color: white; font-weight: 700; font-size: 1rem; padding: 0.875rem 2rem; border-radius: 0.75rem; border: none; cursor: pointer; display: inline-block; }
  .premium-btn:hover { background: #059669; text-decoration: none; color: white; }
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

  /* Index page list */
  .match-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .match-item { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 0.5rem; color: #374151; }
  .match-item:hover { border-color: #10b981; text-decoration: none; }
  .match-team { font-weight: 600; color: #111827; }
  .match-vs { color: #9ca3af; margin: 0 0.25rem; font-size: 0.875rem; }

  /* Stats page hero */
  .stats-hero { text-align: center; padding: 3rem 0; }
  .stats-hero h1 { font-family: Georgia, serif; font-size: 2.5rem; color: #111827; margin-bottom: 0.5rem; }
  .stats-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; max-width: 800px; margin: 2rem auto; }
  .stats-kpi { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.25rem; text-align: center; }
  .stats-kpi-value { font-size: 2rem; font-weight: 800; color: #111827; }
  .stats-kpi-value.green { color: #059669; }
  .stats-kpi-label { font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; }

  /* League badges on light bg */
  .league-badge { display: inline-flex; align-items: center; padding: 0.25rem 0.625rem; background: #e0f2fe; color: #0369a1; border-radius: 2rem; font-size: 0.6875rem; font-weight: 600; }

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
    .stats-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .stats-hero h1 { font-size: 1.75rem; }
  }
`;
