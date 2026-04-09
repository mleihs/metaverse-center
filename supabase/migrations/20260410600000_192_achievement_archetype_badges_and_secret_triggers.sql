-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 192: Achievement system — 5 missing archetype badges + trigger fix
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Problem:
--   Migration 190 seeded only 3/8 archetype completion badges (Shadow, Tower,
--   Entropy) and the dungeon trigger's CASE statement only mapped those 3.
--   Five archetypes (Mother, Prometheus, Deluge, Awakening, Overthrow) were
--   unrewarded on completion. Additionally, the icon_keys for the original 3
--   badges didn't match actual frontend icon identifiers, causing fallback to
--   a generic trophy icon.
--
-- Changes:
--   1. Seed 5 new archetype-completion badges (sort_order 206–210)
--   2. Fix icon_keys for all 8 archetype badges to use actual icons.ts keys
--   3. Replace trg_ach_dungeon_complete() with full 8-archetype CASE mapping
--
-- Idempotent: ON CONFLICT DO UPDATE for seeds, CREATE OR REPLACE for trigger.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. SEED 5 NEW ARCHETYPE BADGES + FIX ICON KEYS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO achievement_definitions (id, category, name_en, name_de, description_en, description_de, hint_en, hint_de, icon_key, rarity, is_secret, sort_order) VALUES
-- 5 new archetype badges
('mother_bond',       'dungeon', 'Mother''s Bond',   'Mutterband',       'Complete a Devouring Mother dungeon.',   'Schliesse einen Verschlingende-Mutter-Dungeon ab.',   'Sever the bond.',             'Trenne das Band.',            'archetypeDevouringMother', 'common', FALSE, 206),
('prometheus_bearer', 'dungeon', 'Flame Bearer',     'Flammenträger',    'Complete a Prometheus dungeon.',         'Schliesse einen Prometheus-Dungeon ab.',               'Carry the stolen fire.',      'Trage das gestohlene Feuer.', 'archetypePrometheus',      'common', FALSE, 207),
('deluge_navigator',  'dungeon', 'Flood Navigator',  'Flutwanderer',     'Complete a Deluge dungeon.',             'Schliesse einen Sintflut-Dungeon ab.',                 'Navigate the rising waters.', 'Navigiere die steigenden Wasser.', 'archetypeDeluge',    'common', FALSE, 208),
('awakening_seer',    'dungeon', 'Awakening Seer',   'Erwachungsseher',  'Complete an Awakening dungeon.',         'Schliesse einen Erwachungs-Dungeon ab.',               'Open your eyes.',             'Öffne deine Augen.',          'archetypeAwakening',       'common', FALSE, 209),
('overthrow_rebel',   'dungeon', 'The Insurgent',    'Der Aufständische','Complete an Overthrow dungeon.',         'Schliesse einen Umsturz-Dungeon ab.',                  'Seize the regime.',           'Ergreife das Regime.',         'archetypeOverthrow',       'common', FALSE, 210)

ON CONFLICT (id) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_de = EXCLUDED.name_de,
    description_en = EXCLUDED.description_en,
    description_de = EXCLUDED.description_de,
    hint_en = EXCLUDED.hint_en,
    hint_de = EXCLUDED.hint_de,
    icon_key = EXCLUDED.icon_key,
    rarity = EXCLUDED.rarity,
    is_secret = EXCLUDED.is_secret,
    sort_order = EXCLUDED.sort_order;

-- Fix icon_keys for existing 3 archetype badges (were 'shadow'/'tower'/'entropy',
-- now match actual icons.ts identifiers)
UPDATE achievement_definitions SET icon_key = 'archetypeShadow'  WHERE id = 'shadow_walker';
UPDATE achievement_definitions SET icon_key = 'archetypeTower'   WHERE id = 'tower_sentinel';
UPDATE achievement_definitions SET icon_key = 'archetypeEntropy' WHERE id = 'entropy_witness';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. REPLACE DUNGEON COMPLETION TRIGGER — FULL 8-ARCHETYPE MAPPING
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_ach_dungeon_complete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_archetype TEXT;
    v_archetype_slug TEXT;
    v_distinct_count INT;
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        v_user_id := NEW.started_by_id;
        IF v_user_id IS NULL THEN RETURN NEW; END IF;

        v_archetype := NEW.archetype;

        -- First dungeon ever
        PERFORM fn_award_achievement(v_user_id, 'first_dungeon',
            jsonb_build_object('archetype', v_archetype));

        -- Archetype-specific badges (all 8 archetypes)
        v_archetype_slug := CASE v_archetype
            WHEN 'The Shadow'           THEN 'shadow_walker'
            WHEN 'The Tower'            THEN 'tower_sentinel'
            WHEN 'The Entropy'          THEN 'entropy_witness'
            WHEN 'The Devouring Mother' THEN 'mother_bond'
            WHEN 'The Prometheus'       THEN 'prometheus_bearer'
            WHEN 'The Deluge'           THEN 'deluge_navigator'
            WHEN 'The Awakening'        THEN 'awakening_seer'
            WHEN 'The Overthrow'        THEN 'overthrow_rebel'
            ELSE NULL
        END;
        IF v_archetype_slug IS NOT NULL THEN
            PERFORM fn_award_achievement(v_user_id, v_archetype_slug,
                jsonb_build_object('archetype', v_archetype));
        END IF;

        -- Count distinct completed archetypes for explorer/all badges
        SELECT COUNT(DISTINCT archetype) INTO v_distinct_count
        FROM resonance_dungeon_runs
        WHERE started_by_id = v_user_id AND status = 'completed';

        -- 4+ archetypes → archetype_explorer
        IF v_distinct_count >= 4 THEN
            PERFORM fn_award_achievement(v_user_id, 'archetype_explorer', '{}');
        END IF;

        -- All 8 → all_archetypes
        IF v_distinct_count >= 8 THEN
            PERFORM fn_award_achievement(v_user_id, 'all_archetypes', '{}');
        END IF;

        -- Difficulty 5 → depth_master
        IF NEW.difficulty >= 5 THEN
            PERFORM fn_award_achievement(v_user_id, 'depth_master',
                jsonb_build_object('archetype', v_archetype, 'difficulty', NEW.difficulty));
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger already attached (migration 190), no re-CREATE needed.
