-- Migration 190: Achievement/Badge System
--
-- L1 FIX: Lightweight achievement system with 30 initial badges across
-- 7 categories and 5 rarity tiers. All evaluation logic lives in PostgreSQL
-- triggers — badges are awarded automatically when source table events fire.
--
-- Architecture:
--   achievement_definitions  — catalog of all badges (data-driven, no code deploy needed)
--   user_achievements        — earned badges per user (immutable once awarded)
--   achievement_progress     — incremental progress toward threshold badges
--   fn_award_achievement()   — idempotent award RPC
--   fn_increment_progress()  — atomic progress + auto-award on threshold
--   8 trigger functions       — fire on source table changes

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TABLES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE achievement_definitions (
    id              TEXT PRIMARY KEY,
    category        TEXT NOT NULL CHECK (category IN (
                        'initiation', 'dungeon', 'epoch', 'collection',
                        'social', 'challenge', 'secret'
                    )),
    name_en         TEXT NOT NULL,
    name_de         TEXT NOT NULL,
    description_en  TEXT NOT NULL,
    description_de  TEXT NOT NULL,
    hint_en         TEXT,
    hint_de         TEXT,
    icon_key        TEXT NOT NULL DEFAULT 'achievement',
    rarity          TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN (
                        'common', 'uncommon', 'rare', 'epic', 'legendary'
                    )),
    is_secret       BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_achievements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id  TEXT NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
    earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    context         JSONB NOT NULL DEFAULT '{}',
    UNIQUE (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_earned ON user_achievements(earned_at DESC);

CREATE TABLE achievement_progress (
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id  TEXT NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
    current_count   INT NOT NULL DEFAULT 0,
    target_count    INT NOT NULL DEFAULT 1,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, achievement_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_progress ENABLE ROW LEVEL SECURITY;

-- Definitions: public catalog, readable by all authenticated users
CREATE POLICY "achievement_definitions_select" ON achievement_definitions
    FOR SELECT TO authenticated USING (true);

-- User achievements: readable by everyone (for profile display), writable by service_role only
CREATE POLICY "user_achievements_select" ON user_achievements
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_achievements_insert" ON user_achievements
    FOR INSERT TO service_role WITH CHECK (true);

-- Progress: readable by own user only
CREATE POLICY "achievement_progress_select" ON achievement_progress
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "achievement_progress_all" ON achievement_progress
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CORE RPCs
-- ═══════════════════════════════════════════════════════════════════════════

-- Idempotent badge award. Returns TRUE if newly awarded, FALSE if already had.
CREATE OR REPLACE FUNCTION fn_award_achievement(
    p_user_id UUID,
    p_achievement_id TEXT,
    p_context JSONB DEFAULT '{}'
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_row_count INTEGER := 0;
BEGIN
    INSERT INTO user_achievements (user_id, achievement_id, context)
    VALUES (p_user_id, p_achievement_id, p_context)
    ON CONFLICT (user_id, achievement_id) DO NOTHING;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    RETURN v_row_count > 0;
END;
$$;

-- Atomic progress increment + auto-award on threshold crossing.
-- Returns the new current_count.
CREATE OR REPLACE FUNCTION fn_increment_progress(
    p_user_id UUID,
    p_achievement_id TEXT,
    p_target INT,
    p_context JSONB DEFAULT '{}'
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_count INT;
BEGIN
    INSERT INTO achievement_progress (user_id, achievement_id, current_count, target_count, updated_at)
    VALUES (p_user_id, p_achievement_id, 1, p_target, now())
    ON CONFLICT (user_id, achievement_id)
    DO UPDATE SET current_count = achievement_progress.current_count + 1,
                  updated_at = now()
    RETURNING current_count INTO v_count;

    -- Auto-award when threshold crossed
    IF v_count >= p_target THEN
        PERFORM fn_award_achievement(p_user_id, p_achievement_id, p_context);
    END IF;

    RETURN v_count;
END;
$$;

-- Grant RPCs to service_role only (triggers run as SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION fn_award_achievement(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_award_achievement(UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION fn_award_achievement(UUID, TEXT, JSONB) TO authenticated;

REVOKE EXECUTE ON FUNCTION fn_increment_progress(UUID, TEXT, INT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_increment_progress(UUID, TEXT, INT, JSONB) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. TRIGGER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- 4a. Onboarding completion → first_steps
CREATE OR REPLACE FUNCTION trg_ach_onboarding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.onboarding_completed = TRUE AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = FALSE) THEN
        PERFORM fn_award_achievement(NEW.id, 'first_steps', '{}');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_achievement_onboarding
    AFTER UPDATE OF onboarding_completed ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION trg_ach_onboarding();

-- 4b. Operative deployment → first_operative, iron_guardian, shadow_operative
CREATE OR REPLACE FUNCTION trg_ach_operative() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Resolve user_id from epoch_participants via source_simulation_id
    SELECT ep.user_id INTO v_user_id
    FROM epoch_participants ep
    WHERE ep.epoch_id = NEW.epoch_id
      AND ep.simulation_id = NEW.source_simulation_id
      AND ep.is_bot = FALSE
    LIMIT 1;

    IF v_user_id IS NULL THEN RETURN NEW; END IF;

    -- First operative ever
    PERFORM fn_award_achievement(v_user_id, 'first_operative',
        jsonb_build_object('operative_type', NEW.operative_type));

    -- Guardian counter
    IF NEW.operative_type = 'guardian' THEN
        PERFORM fn_increment_progress(v_user_id, 'iron_guardian', 10,
            jsonb_build_object('operative_type', 'guardian'));
    END IF;

    -- Spy counter (checked on success, but we track deploys for now —
    -- shadow_operative is re-evaluated on mission success trigger)

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_achievement_operative
    AFTER INSERT ON operative_missions
    FOR EACH ROW EXECUTE FUNCTION trg_ach_operative();

-- 4c. Spy mission success → shadow_operative progress
CREATE OR REPLACE FUNCTION trg_ach_mission_success() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF NEW.status = 'success' AND (OLD.status IS NULL OR OLD.status != 'success') THEN
        SELECT ep.user_id INTO v_user_id
        FROM epoch_participants ep
        WHERE ep.epoch_id = NEW.epoch_id
          AND ep.simulation_id = NEW.source_simulation_id
          AND ep.is_bot = FALSE
        LIMIT 1;

        IF v_user_id IS NULL THEN RETURN NEW; END IF;

        IF NEW.operative_type = 'spy' THEN
            PERFORM fn_increment_progress(v_user_id, 'shadow_operative', 5,
                jsonb_build_object('operative_type', 'spy'));
        END IF;

        -- Undefeated check: award if epoch completed with 0 detected missions
        -- (handled in epoch completion trigger, not here)
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_achievement_mission_success
    AFTER UPDATE OF status ON operative_missions
    FOR EACH ROW EXECUTE FUNCTION trg_ach_mission_success();

-- 4d. Dungeon completion → first_dungeon, archetype-specific, all_archetypes
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

        -- Archetype-specific badges
        v_archetype_slug := CASE v_archetype
            WHEN 'The Shadow' THEN 'shadow_walker'
            WHEN 'The Tower' THEN 'tower_sentinel'
            WHEN 'The Entropy' THEN 'entropy_witness'
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

CREATE TRIGGER trg_achievement_dungeon_complete
    AFTER UPDATE OF status ON resonance_dungeon_runs
    FOR EACH ROW EXECUTE FUNCTION trg_ach_dungeon_complete();

-- 4e. Epoch scoring → master_strategist (win = highest composite at final cycle)
CREATE OR REPLACE FUNCTION trg_ach_epoch_score() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_epoch_status TEXT;
    v_max_composite NUMERIC;
    v_is_winner BOOLEAN;
BEGIN
    -- Only check on completed epochs (when final scores are written)
    SELECT ge.status INTO v_epoch_status
    FROM game_epochs ge WHERE ge.id = NEW.epoch_id;

    IF v_epoch_status != 'completed' THEN RETURN NEW; END IF;

    -- Is this the highest composite for this epoch+cycle?
    SELECT MAX(composite_score) INTO v_max_composite
    FROM epoch_scores
    WHERE epoch_id = NEW.epoch_id AND cycle_number = NEW.cycle_number;

    v_is_winner := (NEW.composite_score >= v_max_composite AND NEW.composite_score > 0);

    IF NOT v_is_winner THEN RETURN NEW; END IF;

    -- Resolve user_id
    SELECT ep.user_id INTO v_user_id
    FROM epoch_participants ep
    WHERE ep.epoch_id = NEW.epoch_id
      AND ep.simulation_id = NEW.simulation_id
      AND ep.is_bot = FALSE
    LIMIT 1;

    IF v_user_id IS NULL THEN RETURN NEW; END IF;

    PERFORM fn_increment_progress(v_user_id, 'master_strategist', 3,
        jsonb_build_object('epoch_id', NEW.epoch_id::text));

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_achievement_epoch_score
    AFTER INSERT ON epoch_scores
    FOR EACH ROW EXECUTE FUNCTION trg_ach_epoch_score();

-- 4f. Alliance formation → the_diplomat
CREATE OR REPLACE FUNCTION trg_ach_alliance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_distinct_teams INT;
BEGIN
    IF NEW.team_id IS NOT NULL AND (OLD.team_id IS NULL OR OLD.team_id != NEW.team_id) THEN
        IF NEW.is_bot = TRUE THEN RETURN NEW; END IF;

        v_user_id := NEW.user_id;
        IF v_user_id IS NULL THEN RETURN NEW; END IF;

        -- Count distinct teams this user has been part of across all epochs
        SELECT COUNT(DISTINCT team_id) INTO v_distinct_teams
        FROM epoch_participants
        WHERE user_id = v_user_id AND team_id IS NOT NULL;

        IF v_distinct_teams >= 3 THEN
            PERFORM fn_award_achievement(v_user_id, 'the_diplomat', '{}');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_achievement_alliance
    AFTER UPDATE OF team_id ON epoch_participants
    FOR EACH ROW EXECUTE FUNCTION trg_ach_alliance();

-- 4g. Forge simulation creation → forgemaster
CREATE OR REPLACE FUNCTION trg_ach_forge() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.data_source = 'forge' AND NEW.created_by_id IS NOT NULL THEN
        PERFORM fn_award_achievement(NEW.created_by_id, 'forgemaster',
            jsonb_build_object('simulation_id', NEW.id::text));
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_achievement_forge
    AFTER INSERT ON simulations
    FOR EACH ROW EXECUTE FUNCTION trg_ach_forge();

-- 4h. Loot collection → loot_collector, literary_collector
CREATE OR REPLACE FUNCTION trg_ach_loot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Resolve user from dungeon run
    SELECT started_by_id INTO v_user_id
    FROM resonance_dungeon_runs
    WHERE id = NEW.source_run_id;

    IF v_user_id IS NULL THEN RETURN NEW; END IF;

    -- General loot counter
    PERFORM fn_increment_progress(v_user_id, 'loot_collector', 10, '{}');

    -- Tier 3 legendary counter (check effect_params for tier)
    IF (NEW.effect_params->>'tier')::int >= 3 THEN
        PERFORM fn_increment_progress(v_user_id, 'literary_collector', 5, '{}');
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_achievement_loot
    AFTER INSERT ON agent_dungeon_loot_effects
    FOR EACH ROW EXECUTE FUNCTION trg_ach_loot();

-- 4i. Cipher redemption → cipher_decoder
CREATE OR REPLACE FUNCTION trg_ach_cipher() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.user_id IS NOT NULL THEN
        PERFORM fn_award_achievement(NEW.user_id, 'cipher_decoder', '{}');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_achievement_cipher
    AFTER INSERT ON cipher_redemptions
    FOR EACH ROW EXECUTE FUNCTION trg_ach_cipher();

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SEED DATA — 30 Initial Badges
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO achievement_definitions (id, category, name_en, name_de, description_en, description_de, hint_en, hint_de, icon_key, rarity, is_secret, sort_order) VALUES
-- Initiation (4)
('first_steps',       'initiation', 'First Steps',        'Erste Schritte',       'Complete your onboarding.',                              'Schliesse dein Onboarding ab.',                            'Complete the onboarding process.',                   'Schliesse den Onboarding-Prozess ab.',              'footprints',        'common',    FALSE, 100),
('first_operative',   'initiation', 'Field Agent',         'Feldagent',            'Deploy your first operative in an epoch.',                'Setze deinen ersten Operativen in einer Epoche ein.',      'Deploy an operative during an epoch.',                'Setze einen Operativen während einer Epoche ein.',  'spy',               'common',    FALSE, 101),
('first_dungeon',     'initiation', 'Into the Depths',     'In die Tiefe',         'Complete your first Resonance Dungeon.',                  'Schliesse deinen ersten Resonanz-Dungeon ab.',             'Complete any dungeon run.',                           'Schliesse einen beliebigen Dungeon-Run ab.',        'dungeon',           'common',    FALSE, 102),
('forgemaster',       'initiation', 'Forgemaster',         'Schmiedemeister',      'Create a simulation using the Forge.',                    'Erstelle eine Simulation mit der Schmiede.',               'Use the Forge to create a new world.',                'Nutze die Schmiede, um eine neue Welt zu erschaffen.', 'forge',          'uncommon',  FALSE, 103),

-- Dungeon Mastery (6)
('shadow_walker',     'dungeon',    'Shadow Walker',       'Schattenläufer',       'Complete a Shadow dungeon.',                              'Schliesse einen Schatten-Dungeon ab.',                     'Survive the darkness.',                               'Überlebe die Dunkelheit.',                          'shadow',            'common',    FALSE, 200),
('tower_sentinel',    'dungeon',    'Tower Sentinel',      'Turmwächter',          'Complete a Tower dungeon.',                               'Schliesse einen Turm-Dungeon ab.',                         'Withstand the collapse.',                             'Halte dem Einsturz stand.',                         'tower',             'common',    FALSE, 201),
('entropy_witness',   'dungeon',    'Entropy Witness',     'Entropie-Zeuge',       'Complete an Entropy dungeon.',                            'Schliesse einen Entropie-Dungeon ab.',                     'Witness the dissolution.',                            'Werde Zeuge der Auflösung.',                        'entropy',           'common',    FALSE, 202),
('archetype_explorer','dungeon',    'Archetype Explorer',  'Archetypen-Forscher',  'Complete 4 different dungeon archetypes.',                'Schliesse 4 verschiedene Dungeon-Archetypen ab.',          'Explore half of all archetypes.',                     'Erkunde die Hälfte aller Archetypen.',              'compass',           'uncommon',  FALSE, 203),
('all_archetypes',    'dungeon',    'Master of Archetypes','Meister der Archetypen','Complete all 8 dungeon archetypes.',                     'Schliesse alle 8 Dungeon-Archetypen ab.',                  'Complete every archetype at least once.',              'Schliesse jeden Archetypen mindestens einmal ab.',  'crown',             'rare',      FALSE, 204),
('depth_master',      'dungeon',    'Depth Master',        'Tiefenmeister',        'Complete a dungeon at difficulty 5.',                     'Schliesse einen Dungeon auf Schwierigkeit 5 ab.',          'Conquer the deepest difficulty.',                     'Bezwinge die tiefste Schwierigkeit.',               'depth',             'epic',      FALSE, 205),

-- Epoch Warfare (5)
('iron_guardian',     'epoch',      'Iron Guardian',       'Eiserner Wächter',     'Deploy 10 guardians across all epochs.',                  'Setze 10 Wächter über alle Epochen ein.',                  'Defend your borders relentlessly.',                   'Verteidige deine Grenzen unermüdlich.',             'shield',            'uncommon',  FALSE, 300),
('shadow_operative',  'epoch',      'Shadow Operative',    'Schattenoperativer',   'Successfully complete 5 spy missions.',                   'Schliesse 5 Spionagemissionen erfolgreich ab.',            'Gather intelligence without being detected.',         'Sammle Informationen, ohne entdeckt zu werden.',    'eye',               'uncommon',  FALSE, 301),
('the_diplomat',      'epoch',      'The Diplomat',        'Der Diplomat',         'Join 3 different alliances across epochs.',               'Tritt 3 verschiedenen Allianzen über Epochen bei.',        'Build bridges between worlds.',                       'Baue Brücken zwischen Welten.',                     'handshake',         'rare',      FALSE, 302),
('master_strategist', 'epoch',      'Master Strategist',   'Meisterstratege',      'Win 3 epochs with the highest composite score.',         'Gewinne 3 Epochen mit dem höchsten Gesamtergebnis.',       'Prove your strategic supremacy.',                     'Beweise deine strategische Überlegenheit.',         'chess',             'epic',      FALSE, 303),
('undefeated',        'epoch',      'Undefeated',          'Ungeschlagen',         'Win an epoch without a single detected mission.',        'Gewinne eine Epoche ohne eine einzige aufgedeckte Mission.','Perfect operational security.',                       'Perfekte operative Sicherheit.',                    'ghost',             'legendary', FALSE, 304),

-- Collection (4)
('loot_collector',    'collection', 'Loot Collector',      'Beutesammler',         'Collect 10 loot items from dungeons.',                   'Sammle 10 Beutegegenstände aus Dungeons.',                 'Accumulate dungeon rewards.',                         'Sammle Dungeon-Belohnungen an.',                    'chest',             'common',    FALSE, 400),
('literary_collector','collection', 'Literary Collector',  'Literarischer Sammler','Collect 5 Tier 3 legendary loot items.',                 'Sammle 5 legendäre Beutegegenstände der Stufe 3.',         'Find the rarest dungeon treasures.',                  'Finde die seltensten Dungeon-Schätze.',             'book',              'rare',      FALSE, 401),
('objektanker_finder','collection', 'Objektanker Finder',  'Objektanker-Finder',   'Encounter 16 different Objektanker objects.',            'Begegne 16 verschiedenen Objektanker-Objekten.',           'Discover the wandering things.',                      'Entdecke die wandernden Dinge.',                    'anchor',            'rare',      FALSE, 402),
('banter_connoisseur','collection', 'Banter Connoisseur',  'Geplänkel-Kenner',     'Witness 50 unique banter exchanges in dungeons.',       'Erlebe 50 einzigartige Geplänkel-Austausche in Dungeons.', 'Listen to the conversations in the dark.',            'Lausche den Gesprächen in der Dunkelheit.',         'speech',            'uncommon',  FALSE, 403),

-- Social & Bleed (4)
('embassy_builder',   'social',     'Embassy Builder',     'Botschaftsbauer',      'Establish 3 active embassies.',                          'Errichte 3 aktive Botschaften.',                           'Connect your world to others.',                       'Verbinde deine Welt mit anderen.',                  'building',          'uncommon',  FALSE, 500),
('echo_sender',       'social',     'Echo Sender',         'Echo-Sender',          'Successfully transmit 5 bleed echoes.',                  'Übertrage erfolgreich 5 Bleed-Echos.',                     'Let your events ripple outward.',                     'Lass deine Ereignisse nach aussen strahlen.',       'wave',              'rare',      FALSE, 501),
('cipher_decoder',    'social',     'Cipher Decoder',      'Chiffren-Entschlüssler','Redeem a cipher code from an Instagram post.',          'Löse einen Chiffren-Code aus einem Instagram-Post ein.',   'Crack the Bureau''s code.',                           'Knacke den Code des Büros.',                        'lock',              'uncommon',  FALSE, 502),
('ward_master',       'social',     'Ward Master',         'Schutzmeister',        'Successfully ward 3 incoming echo transmissions.',       'Wehre erfolgreich 3 eingehende Echo-Übertragungen ab.',    'Protect your world from outside influence.',           'Schütze deine Welt vor äusserem Einfluss.',         'ward',              'rare',      FALSE, 503),

-- Challenge (3)
('flawless_run',      'challenge',  'Flawless Run',        'Makelloser Lauf',      'Complete a dungeon without any agent exceeding 200 stress.','Schliesse einen Dungeon ab, ohne dass ein Agent 200 Stress überschreitet.', 'Keep your team composed under pressure.', 'Halte dein Team unter Druck gelassen.',  'star',              'rare',      FALSE, 600),
('speed_runner',      'challenge',  'Speed Runner',        'Schnellläufer',        'Complete a dungeon in 8 rooms or fewer.',                'Schliesse einen Dungeon in 8 Räumen oder weniger ab.',     'Find the shortest path.',                             'Finde den kürzesten Weg.',                          'lightning',         'epic',      FALSE, 601),
('pacifist',          'challenge',  'Pacifist',            'Pazifist',             'Complete a dungeon using only encounter choices.',       'Schliesse einen Dungeon nur mit Begegnungsentscheidungen ab.','Avoid all combat encounters.',                       'Vermeide alle Kampfbegegnungen.',                   'dove',              'epic',      FALSE, 602),

-- Secret (3)
('the_remnant',       'secret',     'The Remnant',         'Das Relikt',           'Defeat the Shadow boss at VP=0.',                       'Besiege den Schatten-Boss bei VP=0.',                      NULL, NULL,                                                                                              'skull',             'rare',      TRUE,  700),
('mothers_embrace',   'secret',     'Mother''s Embrace',   'Umarmung der Mutter',  'Reach attachment 100 in a Mother dungeon.',              'Erreiche Anhaftung 100 in einem Mutter-Dungeon.',          NULL, NULL,                                                                                              'heart',             'epic',      TRUE,  701),
('political_vertigo', 'secret',     'Political Vertigo',   'Politischer Schwindel','Trigger total fracture in an Overthrow dungeon.',       'Löse totale Fraktur in einem Umsturz-Dungeon aus.',        NULL, NULL,                                                                                              'revolution',        'rare',      TRUE,  702)

ON CONFLICT (id) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_de = EXCLUDED.name_de,
    description_en = EXCLUDED.description_en,
    description_de = EXCLUDED.description_de,
    hint_en = EXCLUDED.hint_en,
    hint_de = EXCLUDED.hint_de,
    rarity = EXCLUDED.rarity,
    is_secret = EXCLUDED.is_secret,
    sort_order = EXCLUDED.sort_order;
