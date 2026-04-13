-- ============================================================================
-- Migration 206: Consolidate banter tier columns into archetype_tier
-- ============================================================================
--
-- The dungeon_banter table had only decay_tier (Entropy) and attachment_tier
-- (Mother) as columns. Four newer archetypes (Prometheus, Deluge, Awakening,
-- Overthrow) store tier data in Python dicts but it was never persisted to DB.
-- In production, select_banter() tier filtering silently degraded — all banter
-- defaulted to tier 0, losing the carefully authored tier progression.
--
-- Fix: Add a single archetype_tier column used by ALL archetypes.
-- Backfill from existing columns for Entropy/Mother, from Python source data
-- for the 4 newer archetypes.
--
-- The old decay_tier and attachment_tier columns are retained for backwards
-- compatibility but no longer read by select_banter().
-- ============================================================================

-- ── 1. Schema change ────────────────────────────────────────────────────────

ALTER TABLE dungeon_banter ADD COLUMN IF NOT EXISTS archetype_tier INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_banter_archetype_tier
    ON dungeon_banter(archetype, archetype_tier);

-- ── 2. Backfill from existing columns (Entropy + Mother) ────────────────────

UPDATE dungeon_banter SET archetype_tier = COALESCE(decay_tier, 0)
WHERE archetype = 'The Entropy' AND decay_tier IS NOT NULL AND decay_tier > 0;

UPDATE dungeon_banter SET archetype_tier = COALESCE(attachment_tier, 0)
WHERE archetype = 'The Devouring Mother' AND attachment_tier IS NOT NULL AND attachment_tier > 0;

-- ── 3. Backfill from Python source data (4 newer archetypes) ────────────────
-- These archetypes had tier data only in Python dicts, never persisted to DB.

-- Prometheus (insight_tier)
UPDATE dungeon_banter SET archetype_tier = 1 WHERE id IN ($DQ$pb_04$DQ$, $DQ$pb_05$DQ$, $DQ$pb_06$DQ$, $DQ$pb_12$DQ$);
UPDATE dungeon_banter SET archetype_tier = 2 WHERE id IN ($DQ$pb_07$DQ$, $DQ$pb_08$DQ$, $DQ$pb_13$DQ$);
UPDATE dungeon_banter SET archetype_tier = 3 WHERE id IN ($DQ$pb_09$DQ$, $DQ$pb_10$DQ$);

-- Deluge (water_tier)
UPDATE dungeon_banter SET archetype_tier = 1 WHERE id IN ($DQ$db_03$DQ$, $DQ$db_04$DQ$, $DQ$db_10$DQ$, $DQ$db_12$DQ$, $DQ$db_14$DQ$, $DQ$db_16$DQ$, $DQ$db_18$DQ$, $DQ$db_20$DQ$);
UPDATE dungeon_banter SET archetype_tier = 2 WHERE id IN ($DQ$db_05$DQ$, $DQ$db_06$DQ$, $DQ$db_19$DQ$, $DQ$db_21$DQ$, $DQ$db_25$DQ$);
UPDATE dungeon_banter SET archetype_tier = 3 WHERE id IN ($DQ$db_07$DQ$, $DQ$db_08$DQ$, $DQ$db_22$DQ$, $DQ$db_23$DQ$, $DQ$db_26$DQ$);

-- Awakening (awareness_tier)
UPDATE dungeon_banter SET archetype_tier = 1 WHERE id IN ($DQ$ab_03$DQ$, $DQ$ab_04$DQ$, $DQ$ab_17$DQ$, $DQ$ab_22$DQ$, $DQ$ab_28$DQ$);
UPDATE dungeon_banter SET archetype_tier = 2 WHERE id IN ($DQ$ab_05$DQ$, $DQ$ab_06$DQ$, $DQ$ab_10$DQ$, $DQ$ab_12$DQ$, $DQ$ab_14$DQ$, $DQ$ab_16$DQ$, $DQ$ab_18$DQ$, $DQ$ab_19$DQ$, $DQ$ab_23$DQ$, $DQ$ab_27$DQ$);
UPDATE dungeon_banter SET archetype_tier = 3 WHERE id IN ($DQ$ab_07$DQ$, $DQ$ab_08$DQ$, $DQ$ab_20$DQ$, $DQ$ab_21$DQ$);

-- Overthrow (fracture_tier)
UPDATE dungeon_banter SET archetype_tier = 1 WHERE id IN ($DQ$ob_07$DQ$, $DQ$ob_08$DQ$, $DQ$ob_09$DQ$, $DQ$ob_10$DQ$, $DQ$ob_11$DQ$, $DQ$ob_12$DQ$, $DQ$ob_13$DQ$);
UPDATE dungeon_banter SET archetype_tier = 2 WHERE id IN ($DQ$ob_14$DQ$, $DQ$ob_15$DQ$, $DQ$ob_16$DQ$, $DQ$ob_17$DQ$, $DQ$ob_18$DQ$, $DQ$ob_19$DQ$, $DQ$ob_28$DQ$);
UPDATE dungeon_banter SET archetype_tier = 3 WHERE id IN ($DQ$ob_20$DQ$, $DQ$ob_21$DQ$, $DQ$ob_22$DQ$, $DQ$ob_23$DQ$, $DQ$ob_24$DQ$, $DQ$ob_25$DQ$, $DQ$ob_26$DQ$, $DQ$ob_27$DQ$);
