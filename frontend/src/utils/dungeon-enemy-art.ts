/**
 * Dungeon enemy scene art — pure (storage path) → image-URL lookup, no DOM.
 *
 * The graphical view drew hostiles as clip-path silhouettes until Phase 3a,
 * because no creature art existed. It does now: 42 keyed cutouts, one per
 * enemy template, published to `simulation.assets/dungeon-enemies/` by
 * `scripts/ingest_dungeon_enemy_art.py`.
 *
 * WHY THE BACKEND SHIPS A PATH AND NOT A URL
 * `EnemyCombatStateClient.image_path` carries a bucket-relative object path
 * (`dungeon-enemies/shadow_wisp-384.avif`). The value reaches the database
 * through a checked-in content-pack seed migration that runs against local
 * Supabase and CI as well as production, so it must not carry a host — the
 * environment supplies that here, exactly as it does for the backdrops.
 *
 * Pattern: `dungeon-backdrop-data.ts` (STORAGE_BASE + per-item URL).
 */

const STORAGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/simulation.assets`;

/**
 * Absolute URL for a creature's scene art, or null when it has none — the
 * caller then draws the silhouette, which stays the fallback for every enemy
 * whose art is missing, unpublished, or fails to load.
 *
 * @param imagePath bucket-relative path from `EnemyCombatStateClient.image_path`
 */
export function dungeonEnemyArtUrl(imagePath: string | null | undefined): string | null {
  return imagePath ? `${STORAGE_BASE}/${imagePath}` : null;
}
