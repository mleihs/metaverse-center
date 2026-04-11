/**
 * Shared fuzzy matching utilities.
 *
 * Levenshtein distance + multi-strategy entity matching.
 * Used by: Bureau Terminal (command/entity matching), Guide search.
 */

// ── Levenshtein Distance ───────────────────────────────────────────────────

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ── Fuzzy Entity Matching ──────────────────────────────────────────────────

export interface NamedEntity {
  id: string;
  name: string;
}

/**
 * Find entities matching a search string.
 * 1. Exact case-insensitive match
 * 2. Substring match
 * 3. Levenshtein distance <= maxDistance (default 2)
 */
export function fuzzyMatch<T extends NamedEntity>(
  query: string,
  entities: T[],
  maxDistance = 2,
): T[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  // Exact match
  const exact = entities.filter((e) => e.name.toLowerCase() === q);
  if (exact.length > 0) return exact;

  // Substring match
  const substring = entities.filter((e) => e.name.toLowerCase().includes(q));
  if (substring.length > 0) return substring;

  // Levenshtein fallback (match against individual words in name)
  const lev = entities.filter((e) => {
    const words = e.name.toLowerCase().split(/\s+/);
    return words.some((w) => levenshtein(q, w) <= maxDistance);
  });
  return lev;
}

/**
 * Convenience: fuzzy match a query against a plain string list.
 * Returns the matched name or null. Used by dungeon command handlers.
 */
export function fuzzyName(query: string, names: string[]): string | null {
  const entities = names.map((n) => ({ id: n, name: n }));
  const matches = fuzzyMatch(query, entities);
  return matches.length > 0 ? matches[0].name : null;
}
