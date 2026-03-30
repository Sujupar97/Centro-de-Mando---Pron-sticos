// Critical CSS for SEO pages (inline Tailwind-like styles)
// Dark theme matching the main Derbix app

export const SEO_CRITICAL_CSS = `
  /* Base */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  body { background: #020617; color: #e2e8f0; line-height: 1.6; min-height: 100vh; }
  a { color: #10b981; text-decoration: none; }
  a:hover { text-decoration: underline; }
  img { max-width: 100%; height: auto; }

  /* Layout */
  .container { max-width: 1024px; margin: 0 auto; padding: 0 1rem; }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .items-center { align-items: center; }
  .justify-center { justify-content: center; }
  .justify-between { justify-content: space-between; }
  .gap-2 { gap: 0.5rem; }
  .gap-3 { gap: 0.75rem; }
  .gap-4 { gap: 1rem; }
  .gap-6 { gap: 1.5rem; }
  .flex-wrap { flex-wrap: wrap; }
  .grid { display: grid; }
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .w-full { width: 100%; }

  /* Spacing */
  .p-4 { padding: 1rem; }
  .p-6 { padding: 1.5rem; }
  .p-8 { padding: 2rem; }
  .px-4 { padding-left: 1rem; padding-right: 1rem; }
  .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
  .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
  .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
  .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
  .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
  .mb-2 { margin-bottom: 0.5rem; }
  .mb-4 { margin-bottom: 1rem; }
  .mb-6 { margin-bottom: 1.5rem; }
  .mb-8 { margin-bottom: 2rem; }
  .mt-4 { margin-top: 1rem; }
  .mt-8 { margin-top: 2rem; }

  /* Typography */
  h1 { font-family: 'Outfit', sans-serif; font-size: 1.875rem; font-weight: 700; color: #f8fafc; line-height: 1.2; }
  h2 { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 600; color: #f8fafc; margin-bottom: 1rem; }
  h3 { font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 600; color: #f8fafc; margin-bottom: 0.75rem; }
  .text-sm { font-size: 0.875rem; }
  .text-lg { font-size: 1.125rem; }
  .text-xl { font-size: 1.25rem; }
  .text-2xl { font-size: 1.5rem; }
  .text-3xl { font-size: 1.875rem; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .font-medium { font-weight: 500; }
  .text-slate-300 { color: #cbd5e1; }
  .text-slate-400 { color: #94a3b8; }
  .text-slate-500 { color: #64748b; }
  .text-emerald-400 { color: #34d399; }
  .text-emerald-500 { color: #10b981; }
  .text-white { color: #ffffff; }
  .text-center { text-align: center; }

  /* Cards & Surfaces */
  .card { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.05); border-radius: 1rem; padding: 1.5rem; backdrop-filter: blur(12px); }
  .card-sm { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 0.75rem; padding: 1rem; }
  .bg-slate-900 { background: #0f172a; }
  .bg-slate-800 { background: #1e293b; }

  /* Badges */
  .badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
  .badge-emerald { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
  .badge-blue { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
  .badge-amber { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
  .badge-red { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 600; font-size: 1rem; transition: all 0.2s; cursor: pointer; border: none; text-decoration: none; }
  .btn-primary { background: #10b981; color: white; }
  .btn-primary:hover { background: #059669; text-decoration: none; }
  .btn-outline { background: transparent; color: #10b981; border: 1px solid #10b981; }
  .btn-outline:hover { background: rgba(16, 185, 129, 0.1); text-decoration: none; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 0.75rem 1rem; background: rgba(15, 23, 42, 0.6); color: #94a3b8; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.05); }
  td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); }
  tr:hover td { background: rgba(255,255,255,0.02); }

  /* Blur overlay for premium content */
  .premium-blur { filter: blur(8px); user-select: none; pointer-events: none; }
  .premium-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px); border-radius: 1rem; padding: 2rem; }
  .relative { position: relative; }

  /* Breadcrumbs */
  .breadcrumbs { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: #64748b; margin-bottom: 1.5rem; }
  .breadcrumbs a { color: #94a3b8; }
  .breadcrumbs a:hover { color: #10b981; }
  .breadcrumbs .separator { color: #475569; }

  /* Result badges */
  .result-won { color: #34d399; font-weight: 700; }
  .result-lost { color: #f87171; font-weight: 700; }
  .result-pending { color: #94a3b8; }

  /* Team logos */
  .team-logo { width: 48px; height: 48px; object-fit: contain; }
  .team-logo-sm { width: 24px; height: 24px; object-fit: contain; }

  /* Navigation */
  .nav { display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 2rem; }
  .nav-logo { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 800; color: #10b981; }

  /* Footer */
  .footer { margin-top: 4rem; padding: 2rem 0; border-top: 1px solid rgba(255,255,255,0.05); color: #64748b; font-size: 0.875rem; }

  /* Form factor bullets */
  .bullet-list { list-style: none; padding: 0; }
  .bullet-list li { padding: 0.5rem 0; padding-left: 1.5rem; position: relative; }
  .bullet-list li::before { content: '\\2022'; color: #10b981; position: absolute; left: 0; font-weight: bold; }

  /* W/D/L form indicators */
  .form-w { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: rgba(16, 185, 129, 0.2); color: #34d399; }
  .form-d { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
  .form-l { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: rgba(239, 68, 68, 0.2); color: #f87171; }

  /* Responsive */
  @media (max-width: 768px) {
    h1 { font-size: 1.5rem; }
    .grid-2 { grid-template-columns: 1fr; }
    .container { padding: 0 0.75rem; }
    .team-logo { width: 36px; height: 36px; }
  }
`;
