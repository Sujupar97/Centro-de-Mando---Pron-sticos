# SEO Content Quality — Cleanup + AI Copywriter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete empty/broken SEO pages and replace the rudimentary bullet-to-paragraph formatter with a Gemini-powered sports copywriter that transforms the full `report_packet` into a professional editorial article.

**Architecture:** A new Supabase Edge Function (`seo-generate-article`) receives the `report_packet` JSON and calls Gemini to produce a ~1200-word journalistic article in Spanish. The article is stored in a new `article_html` column on `seo_pages`. The Netlify Edge Function (`seo-prediccion.ts`) reads `article_html` directly instead of transforming bullets at render time. The `seo-publish-page` function calls `seo-generate-article` after creating the seo_pages row, and stores the result. A cleanup script deletes pages with no real content.

**Tech Stack:** Supabase Edge Functions (Deno), Gemini 3.1 Pro, Netlify Edge Functions, PostgreSQL

---

## File Structure

| File | Responsibility |
|------|---------------|
| `supabase/functions/seo-generate-article/index.ts` | NEW — Gemini-powered sports copywriter. Takes report_packet + match metadata, returns editorial HTML article |
| `supabase/functions/seo-publish-page/index.ts` | MODIFY — After creating seo_pages row, call seo-generate-article and store result |
| `supabase/migrations/20260403_seo_article_column.sql` | NEW — Add `article_html` TEXT column to seo_pages |
| `netlify/edge-functions/seo-prediccion.ts` | MODIFY — If `article_html` exists, render it directly; fallback to old bullet formatter |
| `netlify/edge-functions/_shared/content-formatter.ts` | KEEP — Remains as fallback for pages without article_html |
| `scripts/seo-cleanup-empty-pages.sql` | NEW — One-time SQL to delete pages with no report data |

---

### Task 1: Clean up empty/broken SEO pages

**Files:**
- Create: `scripts/seo-cleanup-empty-pages.sql`

- [ ] **Step 1: Create cleanup SQL script**

Create `scripts/seo-cleanup-empty-pages.sql`:

```sql
-- Delete SEO pages that have no corresponding report in reports_v2
-- These are pages that were created but the analysis failed or has no data
DELETE FROM seo_pages
WHERE fixture_id NOT IN (
    SELECT DISTINCT fixture_id FROM reports_v2 WHERE report_packet IS NOT NULL
);

-- Verify remaining pages all have reports
SELECT sp.fixture_id, sp.home_team, sp.away_team,
  CASE WHEN r.id IS NOT NULL THEN 'OK' ELSE 'MISSING' END as report_status
FROM seo_pages sp
LEFT JOIN reports_v2 r ON r.fixture_id = sp.fixture_id
ORDER BY sp.match_date DESC;
```

- [ ] **Step 2: Execute the cleanup on remote DB**

```bash
cat scripts/seo-cleanup-empty-pages.sql | SUPABASE_ACCESS_TOKEN="sbp_XXX" npx supabase db query --linked
```

Expected: Pages with no reports are deleted. Remaining pages all show "OK".

- [ ] **Step 3: Commit**

```bash
git add scripts/seo-cleanup-empty-pages.sql
git commit -m "chore: add script to clean empty SEO pages"
```

---

### Task 2: Add article_html column to seo_pages

**Files:**
- Create: `supabase/migrations/20260403_seo_article_column.sql`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/20260403_seo_article_column.sql`:

```sql
-- Add column to store the AI-generated editorial article HTML
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS article_html TEXT;

-- Add column to track when the article was generated
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS article_generated_at TIMESTAMPTZ;
```

- [ ] **Step 2: Apply migration to remote DB**

```bash
echo "ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS article_html TEXT;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS article_generated_at TIMESTAMPTZ;" | SUPABASE_ACCESS_TOKEN="sbp_XXX" npx supabase db query --linked
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260403_seo_article_column.sql
git commit -m "feat: add article_html column to seo_pages"
```

---

### Task 3: Create seo-generate-article Edge Function (Gemini copywriter)

**Files:**
- Create: `supabase/functions/seo-generate-article/index.ts`

This is the core of the feature. It receives the full `report_packet` and match metadata, then calls Gemini with a carefully crafted prompt that instructs it to write like a professional sports journalist.

- [ ] **Step 1: Create the function directory and file**

```bash
mkdir -p supabase/functions/seo-generate-article
```

Create `supabase/functions/seo-generate-article/index.ts`:

The function:
1. Receives `{ fixture_id }` in the request body
2. Fetches `report_packet` from `reports_v2` and match metadata from `daily_matches`
3. Constructs a detailed prompt instructing Gemini to act as a senior sports editor
4. The prompt includes ALL data from `report_packet`: analisis_profundo (razonamiento_central, contexto_competitivo, matchup_tactico, factor_psicologico), escenarios_proyectados, factores_riesgo, patrones_detectados, datos_modelo, pronosticos justifications (NOT the actual predictions)
5. Gemini returns HTML article sections (no full page, just content blocks)
6. Stores the result in `seo_pages.article_html`

**The Gemini prompt must instruct:**
- Write in Spanish, neutral journalistic tone, third person
- Structure: engaging lead paragraph → context → tactical deep-dive → key stats → risk factors → scenarios → closing
- Use HTML tags: `<h2 class="section-title">`, `<p>`, `<ul class="key-points"><li>`, `<table class="stats-table">`
- Minimum 1200 words, maximum 2000 words
- Include ALL information from the report — nothing left out
- Do NOT reveal the actual prediction/selection/probability — only the analysis leading up to it
- Write as if for a premium sports publication (ESPN, Marca, AS)
- Use copywriting techniques: strong opening hook, tension/release, specific data points woven into narrative, rhetorical questions
- Each section should flow naturally into the next

- [ ] **Step 2: Deploy the function**

```bash
SUPABASE_ACCESS_TOKEN="sbp_XXX" npx supabase functions deploy seo-generate-article --no-verify-jwt --project-ref nokejmhlpsaoerhddcyc
```

- [ ] **Step 3: Test with a real fixture**

```bash
curl -X POST "https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/seo-generate-article" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -d '{"fixture_id": 19636343}'
```

Expected: Returns `{ success: true, article_length: 1200+ }` and `seo_pages.article_html` is populated for fixture 19636343.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/seo-generate-article/
git commit -m "feat: Gemini-powered sports copywriter for SEO articles"
```

---

### Task 4: Modify seo-publish-page to call article generator

**Files:**
- Modify: `supabase/functions/seo-publish-page/index.ts`

- [ ] **Step 1: Add article generation call after seo_pages upsert**

After the existing upsert into `seo_pages` (around line 95), add a call to `seo-generate-article`:

```typescript
// After successful upsert, generate the editorial article
try {
    const articleUrl = `${supabaseUrl}/functions/v1/seo-generate-article`;
    const articleRes = await fetch(articleUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ fixture_id })
    });
    if (articleRes.ok) {
        console.log(`[SEO-PUBLISH-PAGE] Article generated for fixture ${fixture_id}`);
    } else {
        console.warn(`[SEO-PUBLISH-PAGE] Article generation failed: ${articleRes.status}`);
    }
} catch (artErr) {
    console.warn('[SEO-PUBLISH-PAGE] Article generation failed (non-critical):', artErr);
}
```

- [ ] **Step 2: Deploy**

```bash
SUPABASE_ACCESS_TOKEN="sbp_XXX" npx supabase functions deploy seo-publish-page --no-verify-jwt --project-ref nokejmhlpsaoerhddcyc
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/seo-publish-page/index.ts
git commit -m "feat: seo-publish-page now triggers article generation"
```

---

### Task 5: Update seo-prediccion.ts to use article_html

**Files:**
- Modify: `netlify/edge-functions/seo-prediccion.ts`

- [ ] **Step 1: Modify the Supabase query to include article_html**

In the handler, when querying `seo_pages`, the `select("*")` already includes `article_html`. No query change needed.

- [ ] **Step 2: In buildArticle(), check for article_html first**

At the beginning of `buildArticle()`, after the hero-match card and result banner, check if `page.article_html` exists. If it does, insert it directly instead of calling `bulletsToNarrative()` for each section.

The article_html from Gemini already contains all the `<h2 class="section-title">`, `<p>`, tables, and key-points formatted as editorial content. We insert it as-is, then add the ad slots, premium blur, and related content around it.

The structure becomes:
1. Nav + breadcrumbs + category badges + H1 + byline + hero card + result banner (unchanged)
2. **If article_html exists**: insert `page.article_html` directly (replaces sections 7-14 of current flow)
3. **If no article_html**: fallback to existing bulletsToNarrative() flow (backward compatible)
4. Ad slot #2 + premium blur + ad slot #3 + CTA + related content (unchanged)

Move ad slot #1 into the article_html output (Gemini places `<!-- AD_SLOT_1 -->` markers that we replace).

- [ ] **Step 3: Deploy to Netlify**

```bash
git push origin main
npx netlify deploy --build --prod
```

- [ ] **Step 4: Commit**

```bash
git add netlify/edge-functions/seo-prediccion.ts
git commit -m "feat: render Gemini editorial article on SEO prediction pages"
```

---

### Task 6: Backfill existing pages with articles

**Files:** None (script execution only)

- [ ] **Step 1: Generate articles for all existing seo_pages**

For each existing seo_page that has a report but no article_html, call seo-generate-article:

```bash
# Get all fixture_ids that need articles
for FID in $(echo "SELECT fixture_id FROM seo_pages WHERE article_html IS NULL;" | SUPABASE_ACCESS_TOKEN="sbp_XXX" npx supabase db query --linked --output json | jq -r '.rows[].fixture_id'); do
  echo "Generating article for fixture $FID..."
  curl -s -X POST "https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/seo-generate-article" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer SERVICE_ROLE_KEY" \
    -d "{\"fixture_id\": $FID}"
  echo ""
  sleep 5  # Rate limit: avoid Gemini quota
done
```

- [ ] **Step 2: Verify articles were generated**

```bash
echo "SELECT fixture_id, home_team, away_team,
  LENGTH(article_html) as article_length,
  article_generated_at
FROM seo_pages ORDER BY match_date DESC;" | SUPABASE_ACCESS_TOKEN="sbp_XXX" npx supabase db query --linked
```

Expected: All pages show `article_length > 3000` (minimum ~1200 words of HTML).

---

### Task 7: Add validation — prevent empty pages from being created

**Files:**
- Modify: `supabase/functions/seo-publish-page/index.ts`

- [ ] **Step 1: Add check for report existence before creating seo_page**

Before the upsert into `seo_pages`, verify that the fixture has a report:

```typescript
// Verify report exists before creating SEO page
const { data: reportCheck } = await supabase
    .from('reports_v2')
    .select('id')
    .eq('fixture_id', fixture_id)
    .limit(1)
    .single();

if (!reportCheck) {
    console.warn(`[SEO-PUBLISH-PAGE] No report for fixture ${fixture_id}, skipping page creation`);
    return new Response(
        JSON.stringify({ success: false, reason: 'No report data available' }),
        { status: 200, headers: corsHeaders }
    );
}
```

- [ ] **Step 2: Deploy and commit**

```bash
SUPABASE_ACCESS_TOKEN="sbp_XXX" npx supabase functions deploy seo-publish-page --no-verify-jwt --project-ref nokejmhlpsaoerhddcyc
git add supabase/functions/seo-publish-page/index.ts
git commit -m "fix: prevent creating SEO pages without report data"
```

---

### Task 8: Full deploy and verify

- [ ] **Step 1: Push all changes to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Deploy Netlify**

```bash
npx netlify deploy --build --prod
```

- [ ] **Step 3: Verify a page with the new editorial article**

Visit: `https://derbix.co/predicciones/liga-profesional-de-futbol/san-lorenzo-vs-estudiantes-2026-04-03`

Expected: A full journalistic article with ~1200+ words covering the complete analysis in a professional, readable editorial format.

- [ ] **Step 4: Run a new analysis and verify end-to-end**

Analyze a new match in Derbix. After it completes:
1. Check `seo_pages` for the new row
2. Check that `article_html` is populated
3. Visit the SEO page URL
4. Verify the article is complete and well-written
