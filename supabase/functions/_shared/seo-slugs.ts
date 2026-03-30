// supabase/functions/_shared/seo-slugs.ts
// Slug generation utilities for SEO pages

/**
 * Convert any text to a URL-safe slug.
 * Removes accents, lowercases, replaces spaces/special chars with hyphens.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // Remove non-alphanumeric (keep spaces and hyphens)
    .replace(/\s+/g, '-')           // Spaces to hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '');         // Trim leading/trailing hyphens
}

/**
 * Generate a URL slug for a team name.
 * Strips common suffixes (FC, CF, SC, etc.) but keeps the core name readable.
 */
export function slugifyTeam(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Remove common football club suffixes/prefixes but keep them readable
    .replace(/\b(fc|cf|sc|cd|ac|as|sv|vfb|fk|bk|sk|pk|if|aik)\b/gi, '')
    .trim();

  return slugify(cleaned);
}

/**
 * Build the match slug: "home-team-vs-away-team-YYYY-MM-DD"
 */
export function buildMatchSlug(homeTeam: string, awayTeam: string, matchDate: string): string {
  const home = slugifyTeam(homeTeam);
  const away = slugifyTeam(awayTeam);
  // matchDate should already be YYYY-MM-DD format
  return `${home}-vs-${away}-${matchDate}`;
}

/**
 * Build the full SEO page path.
 */
export function buildFullPath(leagueSlug: string, matchSlug: string): string {
  return `/predicciones/${leagueSlug}/${matchSlug}`;
}

/**
 * Generate the meta title for a prediction page.
 */
export function buildMetaTitle(homeTeam: string, awayTeam: string, leagueName: string, matchDate: string): string {
  // Format date as DD/MM/YYYY
  const [year, month, day] = matchDate.split('-');
  const formattedDate = `${day}/${month}/${year}`;
  return `Pronóstico ${homeTeam} vs ${awayTeam} | ${leagueName} ${formattedDate} — Derbix`;
}

/**
 * Generate the meta description for a prediction page.
 */
export function buildMetaDescription(homeTeam: string, awayTeam: string, leagueName: string): string {
  return `Análisis con IA de ${homeTeam} vs ${awayTeam} (${leagueName}). Nuestro algoritmo analizó 5,000+ variables. Predicción, estadísticas H2H, y picks de valor.`;
}

/**
 * Fallback league slug generation from league name.
 * Used when a league doesn't have a slug in allowed_leagues.
 */
export function slugifyLeague(name: string): string {
  return slugify(name);
}
