/**
 * Grouping helpers for the field-level conflict view (D2).
 *
 * D1 (backend) emits conflicts at the finest path where the two sides
 * actually collide — e.g. `.banter[id=sb_01].trigger.emotion`. Two admins
 * editing different fields of the same entry therefore surface as TWO
 * conflict rows under the same `.banter[id=sb_01]` root. D2's goal is to
 * group those rows visually so the admin reads "one entry with N
 * conflicting fields" instead of a flat N-item list.
 *
 * Pure function — factored out of `VelgContentDraftConflictView.ts` so
 * the algorithm can be unit-tested without a DOM.
 */

/**
 * Extract the "entry root" from a conflict path. Result is the longest
 * prefix that identifies a single conceptual entry:
 *
 *   `.banter[id=sb_01].trigger.emotion`  → `.banter[id=sb_01]`
 *   `.banter[id=sb_01]`                  → `.banter[id=sb_01]`
 *   `.metadata.tier`                     → `.metadata`
 *   `.metadata`                          → `.metadata`
 *   `.name`                              → `.name`
 *
 * Two rules, in order:
 *
 * 1. **Id-list entry**: if the path contains a `[id=...]` segment, the
 *    root is everything up to and including the closing `]`. This keeps
 *    all field-level conflicts inside one id-list entry in the same
 *    group regardless of nesting depth.
 *
 * 2. **Top-level key fallback**: otherwise, the root is the first path
 *    segment after the leading `.`. This groups `.metadata.tier` and
 *    `.metadata.difficulty` under a single `.metadata` bucket, and
 *    leaves top-level scalars like `.name` as one-item groups.
 */
export function entryRootPath(path: string): string {
  // Rule 1: id-list entry. Anchored at the start so a stray `[id=` buried
  // deeper in a string value can't hijack the match.
  const idListMatch = path.match(/^(\.[^.[]+\[id=[^\]]+\])/);
  if (idListMatch) return idListMatch[1];

  // Rule 2: fall back to the first dot-delimited segment after the
  // leading `.`. `split('.')` on `.foo.bar` yields `['', 'foo', 'bar']`.
  // The `parts[0] === ''` guard rejects paths that don't start with `.` —
  // those are off-contract for merge_service output, but malformed input
  // should round-trip verbatim rather than silently re-rooting under
  // `parts[1]` (which would group `.metadata.tier` with `metadata.tier`
  // in two different buckets).
  const parts = path.split('.');
  if (parts[0] === '' && parts.length >= 2 && parts[1]) return `.${parts[1]}`;

  // Degenerate input (empty, `.` only, or no leading dot). Return verbatim
  // so the group label is visible to the admin and not silently swallowed.
  return path;
}

/**
 * Derive a short human-readable label for the group header from its root.
 *
 *   `.banter[id=sb_01]`  → `banter / sb_01`
 *   `.metadata`          → `metadata`
 *   `.name`              → `name`
 *
 * The slash separator for id-list groups matches the editor's existing
 * `pack_slug / resource_path` heading convention so the admin perceives
 * the same style of path readout throughout the draft UI.
 */
export function entryGroupLabel(rootPath: string): string {
  const idListMatch = rootPath.match(/^\.([^.[]+)\[id=([^\]]+)\]$/);
  if (idListMatch) return `${idListMatch[1]} / ${idListMatch[2]}`;
  return rootPath.startsWith('.') ? rootPath.slice(1) : rootPath;
}

/**
 * Strip the group root from a conflict path to get the sub-path an admin
 * reads inside the card. Falls back to the full path when the conflict
 * addresses the root itself (whole-entry edge cases like MODIFY_DELETE).
 *
 *   `.banter[id=sb_01]`, `.banter[id=sb_01].trigger.emotion` → `.trigger.emotion`
 *   `.banter[id=sb_01]`, `.banter[id=sb_01]`                 → `.banter[id=sb_01]`
 *   `.metadata`,         `.metadata.tier`                    → `.tier`
 *   `.name`,             `.name`                             → `.name`
 */
export function conflictSubPath(rootPath: string, fullPath: string): string {
  if (fullPath === rootPath) return fullPath;
  if (fullPath.startsWith(rootPath)) {
    const suffix = fullPath.slice(rootPath.length);
    return suffix || fullPath;
  }
  // Mismatch (shouldn't happen given our grouping invariant) — show the
  // full path so the admin isn't left staring at a truncated identifier.
  return fullPath;
}

/**
 * Group a flat conflict list by entry root while preserving first-seen
 * order. Stable order matters for the staggered entrance animation and
 * for keeping the admin's mental map fixed across re-renders.
 */
export function groupByEntryRoot<T extends { path: string }>(
  conflicts: readonly T[],
): Array<{ rootPath: string; label: string; items: T[] }> {
  const groupsByRoot = new Map<string, { rootPath: string; label: string; items: T[] }>();

  for (const conflict of conflicts) {
    const root = entryRootPath(conflict.path);
    const existing = groupsByRoot.get(root);
    if (existing) {
      existing.items.push(conflict);
      continue;
    }
    groupsByRoot.set(root, {
      rootPath: root,
      label: entryGroupLabel(root),
      items: [conflict],
    });
  }

  return Array.from(groupsByRoot.values());
}
