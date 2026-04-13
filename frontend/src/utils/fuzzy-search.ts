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
 *
 * Match hierarchy (first non-empty tier wins):
 * 1. Exact case-insensitive match
 * 2. Prefix match — query is a prefix of the entity name
 * 3. Word-start match — query matches the start of any word in the name
 *    (favours distinctive tokens: "awak" → "The Awakening")
 * 4. General substring match
 * 5. Levenshtein distance ≤ maxDistance against individual words
 */
export function fuzzyMatch<T extends NamedEntity>(
  query: string,
  entities: T[],
  maxDistance = 2,
): T[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  // 1. Exact match
  const exact = entities.filter((e) => e.name.toLowerCase() === q);
  if (exact.length > 0) return exact;

  // 2. Prefix match — "The Awak" → "The Awakening"
  const prefix = entities.filter((e) => e.name.toLowerCase().startsWith(q));
  if (prefix.length > 0) return prefix;

  // 3. Word-start match — "awak" matches word "Awakening" in "The Awakening"
  const wordStart = entities.filter((e) =>
    e.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)),
  );
  if (wordStart.length > 0) return wordStart;

  // 4. General substring match
  const substring = entities.filter((e) => e.name.toLowerCase().includes(q));
  if (substring.length > 0) return substring;

  // 5. Levenshtein fallback (match against individual words in name)
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

/**
 * Resolve a multi-word token from the start of an args array.
 *
 * Tries progressively shorter prefixes (longest first) against a known
 * set of candidates via fuzzyName.  Returns the match and remaining args.
 *
 * Used by dungeon commands where agent names ("General Aldric Wolf"),
 * ability names ("Precision Strike"), and archetype names ("The Awakening")
 * must be extracted from a flat whitespace-split arg list.
 *
 * @param args     - Remaining args to parse (not mutated).
 * @param candidates - Known valid names to match against.
 * @param maxWords - Maximum prefix length to try (default: args.length).
 * @returns `{ match, rest }` — matched name (or null) and unconsumed args.
 */
export function resolveToken(
  args: string[],
  candidates: string[],
  maxWords?: number,
): { match: string | null; rest: string[] } {
  const limit = Math.min(maxWords ?? args.length, args.length);
  for (let end = limit; end >= 1; end--) {
    const candidate = args.slice(0, end).join(' ');
    const match = fuzzyName(candidate, candidates);
    if (match) return { match, rest: args.slice(end) };
  }
  return { match: null, rest: args };
}
