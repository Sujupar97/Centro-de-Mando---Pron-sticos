// supabase/functions/_shared/team-normalization.ts

// 1. Master Alias Dictionary (The "Professional" MDM Layer)
// This maps common variations/nicknames to a canonical key or directly handles known mismatches.
export const KNOWN_ALIASES: Record<string, string[]> = {
  // English Premier League
  'wolverhamptonwanderers': ['wolves'],
  'wolves': ['wolverhamptonwanderers'],
  'tottenhamhotspur': ['spurs'],
  'spurs': ['tottenhamhotspur', 'tottenham'],
  'manchesterunited': ['manutd', 'manunited'],
  'manutd': ['manchesterunited'],
  'manchestercity': ['mancity'],
  'mancity': ['manchestercity'],
  'newcastleunited': ['newcastle'],
  'westhamunited': ['westham'],
  'brightonandhovealbion': ['brighton'],
  'leedsunited': ['leeds'],
  
  // Spanish La Liga
  'championship': ['champ'],
  'athleticclub': ['athleticbilbao', 'bilbao'],
  'athleticbilbao': ['athleticclub'],
  'atleticomadrid': ['atletico'],
  'realsociedad': ['realsociedad'], // often matches well, but good to have
  'realbetis': ['betis'],
  
  // Italian Serie A
  'inter': ['internazionale', 'intermilan'],
  'internazionale': ['inter'],
  'acmilan': ['milan'],
  
  // Germany
  'bayerleverkusen': ['leverkusen'],
  'borussiadortmund': ['dortmund'],
  'borussiamonchengladbach': ['gladbach', 'mgladbach'],
  
  // Global
  'parissaintgermain': ['psg'],
  'psg': ['parissaintgermain']
};

/**
 * Professional Normalizer
 * Removing "FC", "CF", "AS", etc., and special characters to get the "Core Name".
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .toLowerCase()
    .replace(/\b(fc|cf|sc|cd|ac|as|sv|vfb|borussia|sporthera|club|deportiva|atletico|real|sporting|olympique|inter)\b/g, '') // Remove common prefixes/suffixes
    .replace(/[^a-z0-9]/g, "") // Keep only alphanumeric
    .trim();
}

/**
 * Sorensen-Dice Coefficient (String Similarity)
 * Professional standard for fuzzy matching names (better than Levenshtein for partial matches).
 * Returns 0.0 to 1.0
 */
export function getSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length < 2 || str2.length < 2) return 0.0;

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < str1.length - 1; i++) {
    const bigram = str1.substring(i, i + 2);
    bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < str2.length - 1; i++) {
    const bigram = str2.substring(i, i + 2);
    const count = bigrams1.get(bigram);
    if (count && count > 0) {
      bigrams1.set(bigram, count - 1);
      intersection++;
    }
  }

  return (2.0 * intersection) / (str1.length + str2.length - 2);
}

/**
 * The "Smart Matcher" Logic
 */
export function areTeamsEqual(nameA: string, nameB: string): boolean {
  // 1. Direct Normalization Check
  const normA = nameA.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normB = nameB.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // 2. Alias Check
  if (KNOWN_ALIASES[normA]?.includes(normB)) return true;
  if (KNOWN_ALIASES[normB]?.includes(normA)) return true;

  // 3. Core Name Similarity (Dice Check)
  // Use the aggressive normalizer here (strips FC, Real, etc)
  const coreA = normalizeName(nameA);
  const coreB = normalizeName(nameB);
  
  if (!coreA || !coreB) return false; // Safety

  const score = getSimilarity(coreA, coreB);
  
  // Threshold: 0.6 is usually good for team names (allows some variaiton)
  // "manchester united" vs "man utd" -> might fail Dice, but caught by alias.
  // "chelsea" vs "chelsea fc" -> core is "chelsea" vs "chelsea" -> 1.0
  return score >= 0.65;
}
