-- Add column to store the AI-generated editorial article HTML
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS article_html TEXT;

-- Add column to track when the article was generated
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS article_generated_at TIMESTAMPTZ;
