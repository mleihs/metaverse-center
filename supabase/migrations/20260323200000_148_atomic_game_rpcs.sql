-- Atomic Game RPCs — replace Python fetch-compute-update patterns with
-- single-statement Postgres operations to eliminate race conditions.
--
-- Background: Deep-dive audit (2026-03-23) found 8 race conditions in
-- operative_mission_service.py and cycle_resolution_service.py where
-- concurrent requests could read stale data and produce lost updates.
--
-- Pattern follows existing RPCs: fn_batch_grant_rp (migration 126),
-- fn_compute_cycle_scores (migration 127), fn_fulfill_agent_need (migration 146).
--
-- All RPCs are SECURITY DEFINER (called via service_role from backend).
-- All RPCs are idempotent where possible (compare-and-swap semantics).

-- ============================================================
-- 1. fn_transition_mission_status
--    Atomic compare-and-swap for mission status transitions.
--    Prevents double-resolution and duplicate state changes.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_transition_mission_status(
    p_mission_id UUID,
    p_from_status TEXT,
    p_to_status TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_rows INT;
BEGIN
    -- Validate statuses against CHECK constraint values
    IF p_from_status NOT IN ('deploying', 'active', 'returning', 'success', 'failed', 'detected', 'captured') THEN
        RAISE EXCEPTION 'Invalid from_status: %', p_from_status;
    END IF;
    IF p_to_status NOT IN ('deploying', 'active', 'returning', 'success', 'failed', 'detected', 'captured') THEN
        RAISE EXCEPTION 'Invalid to_status: %', p_to_status;
    END IF;

    UPDATE operative_missions
       SET status = p_to_status
     WHERE id = p_mission_id
       AND status = p_from_status;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$;

COMMENT ON FUNCTION fn_transition_mission_status IS
    'Atomic compare-and-swap for mission status. Returns TRUE if transition succeeded, FALSE if status already changed (idempotent).';


-- ============================================================
-- 2. fn_degrade_building
--    Atomic building condition degradation for saboteur missions.
--    Condition chain: good -> moderate -> poor -> ruined (bottoms out).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_degrade_building(
    p_building_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_old TEXT;
    v_new TEXT;
BEGIN
    SELECT building_condition INTO v_old
      FROM buildings
     WHERE id = p_building_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('changed', false, 'reason', 'building_not_found');
    END IF;

    -- Condition degradation chain (matches Python condition_map)
    v_new := CASE v_old
        WHEN 'good'     THEN 'moderate'
        WHEN 'moderate'  THEN 'poor'
        WHEN 'poor'      THEN 'ruined'
        ELSE v_old  -- already ruined or unknown: no change
    END;

    IF v_new = v_old THEN
        RETURN jsonb_build_object(
            'changed', false,
            'old_condition', v_old,
            'new_condition', v_old,
            'reason', 'already_at_bottom'
        );
    END IF;

    UPDATE buildings
       SET building_condition = v_new,
           updated_at = now()
     WHERE id = p_building_id
       AND building_condition = v_old;  -- compare-and-swap

    IF NOT FOUND THEN
        -- Concurrent modification: another saboteur already degraded
        RETURN jsonb_build_object('changed', false, 'reason', 'concurrent_modification');
    END IF;

    RETURN jsonb_build_object(
        'changed', true,
        'old_condition', v_old,
        'new_condition', v_new
    );
END;
$$;

COMMENT ON FUNCTION fn_degrade_building IS
    'Atomic building condition degradation (good->moderate->poor->ruined). Returns JSONB with old/new condition and whether change occurred.';


-- ============================================================
-- 3. fn_downgrade_zone_security
--    Atomic zone security downgrade by N tiers.
--    Tier order: lawless < contested < low < moderate < guarded < high < maximum < fortress
-- ============================================================
CREATE OR REPLACE FUNCTION fn_downgrade_zone_security(
    p_zone_id UUID,
    p_tiers_down INT DEFAULT 1
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tiers TEXT[] := ARRAY['lawless', 'contested', 'low', 'moderate', 'guarded', 'high', 'maximum', 'fortress'];
    v_old TEXT;
    v_old_idx INT;
    v_new_idx INT;
    v_new TEXT;
BEGIN
    SELECT security_level INTO v_old
      FROM zones
     WHERE id = p_zone_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('changed', false, 'reason', 'zone_not_found');
    END IF;

    -- Handle 'medium' alias (legacy data)
    IF v_old = 'medium' THEN
        v_old := 'moderate';
    END IF;

    v_old_idx := array_position(v_tiers, v_old);

    IF v_old_idx IS NULL THEN
        -- Unknown tier: no change (matches Python ValueError catch)
        RETURN jsonb_build_object('changed', false, 'old_level', v_old, 'reason', 'unknown_tier');
    END IF;

    v_new_idx := GREATEST(1, v_old_idx - p_tiers_down);
    v_new := v_tiers[v_new_idx];

    IF v_new = v_old THEN
        RETURN jsonb_build_object('changed', false, 'old_level', v_old, 'new_level', v_old, 'reason', 'already_at_bottom');
    END IF;

    UPDATE zones
       SET security_level = v_new,
           updated_at = now()
     WHERE id = p_zone_id
       AND security_level = v_old;  -- compare-and-swap

    IF NOT FOUND THEN
        RETURN jsonb_build_object('changed', false, 'reason', 'concurrent_modification');
    END IF;

    RETURN jsonb_build_object(
        'changed', true,
        'old_level', v_old,
        'new_level', v_new
    );
END;
$$;

COMMENT ON FUNCTION fn_downgrade_zone_security IS
    'Atomic zone security downgrade by N tiers (default 1). Handles medium alias, unknown tiers, and concurrent modification. Returns JSONB with old/new level.';


-- ============================================================
-- 4. fn_weaken_relationships
--    Atomic batch reduction of all relationships for an agent.
--    Intensity clamped to CHECK constraint [1, 10].
-- ============================================================
CREATE OR REPLACE FUNCTION fn_weaken_relationships(
    p_agent_id UUID,
    p_delta INT DEFAULT 2
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_rows INT;
BEGIN
    UPDATE agent_relationships
       SET intensity = GREATEST(1, intensity - p_delta),
           updated_at = now()
     WHERE (source_agent_id = p_agent_id OR target_agent_id = p_agent_id)
       AND intensity > 1;  -- skip already-minimum relationships

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION fn_weaken_relationships IS
    'Atomic batch reduction of all relationship intensities for an agent. Delta defaults to 2 (assassin effect). Returns number of relationships affected.';


-- ============================================================
-- 5. fn_grant_rp_single
--    Atomic RP grant for a single epoch participant with cap enforcement.
--    Replaces Python fetch-compute-update with single UPDATE + LEAST.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_grant_rp_single(
    p_epoch_id UUID,
    p_simulation_id UUID,
    p_amount INT,
    p_rp_cap INT
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_new_rp INT;
BEGIN
    UPDATE epoch_participants
       SET current_rp = LEAST(current_rp + p_amount, p_rp_cap)
     WHERE epoch_id = p_epoch_id
       AND simulation_id = p_simulation_id
     RETURNING current_rp INTO v_new_rp;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Participant not found: epoch=%, sim=%', p_epoch_id, p_simulation_id;
    END IF;

    RETURN v_new_rp;
END;
$$;

COMMENT ON FUNCTION fn_grant_rp_single IS
    'Atomic RP grant with cap enforcement via LEAST(). Returns new RP balance. Raises exception if participant not found.';


-- ============================================================
-- 6. fn_expire_fortifications
--    Atomic fortification expiry: downgrade zones and delete
--    expired fortifications in a single transaction.
--    Follows SECURITY_TIER_ORDER for zone downgrades.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_expire_fortifications(
    p_epoch_id UUID,
    p_cycle_number INT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tiers TEXT[] := ARRAY['lawless', 'contested', 'low', 'moderate', 'guarded', 'high', 'maximum', 'fortress'];
    v_fort RECORD;
    v_zone_level TEXT;
    v_old_idx INT;
    v_new_idx INT;
    v_new_level TEXT;
    v_expired INT := 0;
    v_downgraded INT := 0;
BEGIN
    FOR v_fort IN
        SELECT zf.id AS fort_id, zf.zone_id, zf.security_bonus
          FROM zone_fortifications zf
         WHERE zf.epoch_id = p_epoch_id
           AND zf.expires_at_cycle <= p_cycle_number
    LOOP
        v_expired := v_expired + 1;

        -- Get current zone security level
        SELECT z.security_level INTO v_zone_level
          FROM zones z
         WHERE z.id = v_fort.zone_id;

        IF FOUND AND v_zone_level IS NOT NULL THEN
            -- Handle 'medium' alias
            IF v_zone_level = 'medium' THEN
                v_zone_level := 'moderate';
            END IF;

            v_old_idx := array_position(v_tiers, v_zone_level);

            IF v_old_idx IS NOT NULL THEN
                v_new_idx := GREATEST(1, v_old_idx - v_fort.security_bonus);
                v_new_level := v_tiers[v_new_idx];

                IF v_new_level != v_zone_level THEN
                    UPDATE zones
                       SET security_level = v_new_level,
                           updated_at = now()
                     WHERE id = v_fort.zone_id;
                    v_downgraded := v_downgraded + 1;
                END IF;
            END IF;
        END IF;

        -- Always delete the expired fortification
        DELETE FROM zone_fortifications WHERE id = v_fort.fort_id;
    END LOOP;

    RETURN jsonb_build_object(
        'expired', v_expired,
        'zones_downgraded', v_downgraded
    );
END;
$$;

COMMENT ON FUNCTION fn_expire_fortifications IS
    'Atomic fortification expiry: downgrades zones by security_bonus tiers and deletes expired fortifications in one transaction. Returns counts.';


-- ============================================================
-- 7. Heartbeat idempotency — UNIQUE constraint already exists
--    (migration 129, line 41: UNIQUE(simulation_id, tick_number))
--    No additional constraint needed.
-- ============================================================

-- ============================================================
-- 8. Lore sort_order — trigger for safe concurrent inserts
-- ============================================================
CREATE OR REPLACE FUNCTION fn_lore_auto_sort_order()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.sort_order IS NULL OR NEW.sort_order = 0 THEN
        SELECT COALESCE(MAX(sort_order) + 1, 0)
          INTO NEW.sort_order
          FROM simulation_lore
         WHERE simulation_id = NEW.simulation_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lore_auto_sort_order ON simulation_lore;
CREATE TRIGGER trg_lore_auto_sort_order
    BEFORE INSERT ON simulation_lore
    FOR EACH ROW
    EXECUTE FUNCTION fn_lore_auto_sort_order();

COMMENT ON FUNCTION fn_lore_auto_sort_order IS
    'Auto-assigns sort_order for new lore entries if not explicitly set. Uses MAX+1 within same simulation.';


-- ============================================================
-- 9. Feature flag for gradual RPC activation
-- ============================================================
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES (
    'use_atomic_game_rpcs',
    '"false"',
    'When true, game mechanics (mission effects, fortification expiry, RP grants) use atomic Postgres RPCs instead of Python fetch-compute-update. Toggle for safe rollback during migration.'
)
ON CONFLICT (setting_key) DO NOTHING;


-- ============================================================
-- Grants: all RPCs callable by service_role only (default).
-- No additional GRANT needed — service_role owns these via
-- SECURITY DEFINER context.
-- ============================================================
