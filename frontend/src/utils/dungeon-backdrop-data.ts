/**
 * Dungeon scene backdrops — pure (archetype) → image-URL lookup, no DOM.
 *
 * The graphical view paints a full-bleed establishing image behind the
 * environment FX so the stage reads as a real chamber, not a void (the P0
 * prototype proved "meter = environment" only works over real art).
 *
 * INTERIM source: the per-archetype showcase establishing shot already in
 * `simulation.assets/showcase` (the same art the landing page uses). It is
 * archetype-level — every room of a run shares the establishing shot.
 *
 * Phase 3 (see docs/plans/graphical-dungeon-rollout.md §3b) replaces this with
 * depth-band-specific generated room art at `simulation.assets/dungeon-backdrops`;
 * when that lands, swap the base path + add a depth-band argument here. Until
 * then this single lookup keeps the stage populated with no backend work.
 *
 * Pattern: components/landing/dungeon-showcase-data.ts (STORAGE_BASE + per-slug URL).
 */

const STORAGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/simulation.assets/showcase`;

/** Canonical archetype name → showcase image slug. Names match
 *  backend/services/dungeon/dungeon_archetypes.py and the resolver input. */
const SLUG_BY_ARCHETYPE: Record<string, string> = {
  'The Shadow': 'shadow',
  'The Tower': 'tower',
  'The Devouring Mother': 'mother',
  'The Entropy': 'entropy',
  'The Prometheus': 'prometheus',
  'The Deluge': 'deluge',
  'The Awakening': 'awakening',
  'The Overthrow': 'overthrow',
};

/** Backdrop image URL for an archetype, or null if unmapped (caller falls back
 *  to the CSS-only chamber). */
export function dungeonBackdropUrl(archetype: string | null | undefined): string | null {
  if (!archetype) return null;
  const slug = SLUG_BY_ARCHETYPE[archetype];
  return slug ? `${STORAGE_BASE}/dungeon-${slug}.avif` : null;
}
