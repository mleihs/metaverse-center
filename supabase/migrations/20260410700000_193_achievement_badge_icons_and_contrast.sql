-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 193: Achievement badge icons — game-icons.net cohesive set
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Problem:
--   Most badge icon_keys referenced non-existent icons.ts entries, causing
--   fallback to a generic trophy icon. Only ~12 of 35 badges showed real icons.
--
-- Fix:
--   Update all icon_keys to use either existing icons.ts entries or new
--   game-icons.net SVGs added as badge* prefixed functions (CC BY 3.0).
--   Archetype badges keep their existing archetype* icons (already correct).
--
-- Idempotent: plain UPDATEs on existing rows.

-- Initiation
UPDATE achievement_definitions SET icon_key = 'footprints'       WHERE id = 'first_steps';
UPDATE achievement_definitions SET icon_key = 'badgeSpy'         WHERE id = 'first_operative';
UPDATE achievement_definitions SET icon_key = 'badgeDungeonGate' WHERE id = 'first_dungeon';
UPDATE achievement_definitions SET icon_key = 'badgeAnvil'       WHERE id = 'forgemaster';

-- Dungeon (archetype badges already correct from migration 192)
UPDATE achievement_definitions SET icon_key = 'badgeCompass'     WHERE id = 'archetype_explorer';
UPDATE achievement_definitions SET icon_key = 'crown'            WHERE id = 'all_archetypes';
UPDATE achievement_definitions SET icon_key = 'badgeCave'        WHERE id = 'depth_master';

-- Epoch
UPDATE achievement_definitions SET icon_key = 'shield'           WHERE id = 'iron_guardian';
UPDATE achievement_definitions SET icon_key = 'eye'              WHERE id = 'shadow_operative';
UPDATE achievement_definitions SET icon_key = 'handshake'        WHERE id = 'the_diplomat';
UPDATE achievement_definitions SET icon_key = 'badgeChessQueen'  WHERE id = 'master_strategist';
UPDATE achievement_definitions SET icon_key = 'badgeGhost'       WHERE id = 'undefeated';

-- Collection
UPDATE achievement_definitions SET icon_key = 'badgeChest'       WHERE id = 'loot_collector';
UPDATE achievement_definitions SET icon_key = 'book'             WHERE id = 'literary_collector';
UPDATE achievement_definitions SET icon_key = 'anchor'           WHERE id = 'objektanker_finder';
UPDATE achievement_definitions SET icon_key = 'badgeSpeech'      WHERE id = 'banter_connoisseur';

-- Social
UPDATE achievement_definitions SET icon_key = 'building'         WHERE id = 'embassy_builder';
UPDATE achievement_definitions SET icon_key = 'badgeWave'        WHERE id = 'echo_sender';
UPDATE achievement_definitions SET icon_key = 'lock'             WHERE id = 'cipher_decoder';
UPDATE achievement_definitions SET icon_key = 'badgeWard'        WHERE id = 'ward_master';

-- Challenge
UPDATE achievement_definitions SET icon_key = 'badgeStar'        WHERE id = 'flawless_run';
UPDATE achievement_definitions SET icon_key = 'badgeLightning'   WHERE id = 'speed_runner';
UPDATE achievement_definitions SET icon_key = 'badgeDove'        WHERE id = 'pacifist';

-- Secret
UPDATE achievement_definitions SET icon_key = 'skull'            WHERE id = 'the_remnant';
UPDATE achievement_definitions SET icon_key = 'badgeHeart'       WHERE id = 'mothers_embrace';
UPDATE achievement_definitions SET icon_key = 'badgeRevolution'  WHERE id = 'political_vertigo';
