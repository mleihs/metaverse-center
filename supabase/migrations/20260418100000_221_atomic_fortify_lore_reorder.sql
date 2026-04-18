-- Migration 221: W3.1 — Atomic fortify_zone + lore reorder/delete RPCs
--
-- Closes the ADR-007 follow-through (W3.1) by replacing the two remaining
-- Python fetch-compute-update patterns identified by the W2 audit:
--
--   1. OperativeMissionService.fortify_zone() had two TOCTOU windows:
--      (a) duplicate-check → insert, (b) read security_level → upgrade → write.
--   2. LoreService.reorder_sections() and .delete_section() re-sorted via
--      serial N-UPDATE loops with no transaction boundary.
--
-- RPCs created:
--   1. fn_fortify_zone_atomic          — whole fortify workflow in one tx
--   2. fn_reorder_lore_sections_atomic — bulk sort_order set via UNNEST/ORDINALITY
--   3. fn_delete_lore_section_atomic   — delete + re-sort remaining in one tx
--
-- Pattern follows migration 148 (canonical) + 214 (recent style). Every function
-- carries a COMMENT ON FUNCTION separator per codebase convention.


-- ═══════════════════════════════════════════════════════════════════
-- 1. fn_fortify_zone_atomic
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: operative_mission_service.py fortify_zone() — check, spend, upgrade, insert.
-- Race closed: two concurrent fortifications of the same zone now resolve to
-- exactly one success; the loser sees 'already_fortified' without spending RP
-- or double-upgrading the zone.
--
-- Security tier chain: lawless < contested < low < moderate < guarded < high < maximum < fortress.
-- Handles legacy 'medium' alias (mapped to 'moderate') the same way migration 148 does.

CREATE OR REPLACE FUNCTION public.fn_fortify_zone_atomic(
    p_epoch_id          UUID,
    p_simulation_id     UUID,
    p_zone_id           UUID,
    p_rp_cost           INT,
    p_expires_at_cycle  INT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tiers           TEXT[] := ARRAY['lawless', 'contested', 'low', 'moderate', 'guarded', 'high', 'maximum', 'fortress'];
    v_zone_sim_id     UUID;
    v_old_level       TEXT;
    v_old_idx         INT;
    v_new_idx         INT;
    v_new_level       TEXT;
    v_new_rp          INT;
    v_fortification_id UUID;
BEGIN
    -- Lock the zone row; also resolves zone existence + simulation ownership
    SELECT simulation_id, security_level
      INTO v_zone_sim_id, v_old_level
      FROM public.zones
     WHERE id = p_zone_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'zone_not_found');
    END IF;

    IF v_zone_sim_id IS DISTINCT FROM p_simulation_id THEN
        RETURN jsonb_build_object('error', 'zone_wrong_simulation');
    END IF;

    -- Duplicate check (inside the zone lock so the check-then-insert race closes)
    IF EXISTS (
        SELECT 1 FROM public.zone_fortifications
         WHERE epoch_id = p_epoch_id
           AND zone_id  = p_zone_id
    ) THEN
        RETURN jsonb_build_object('error', 'already_fortified');
    END IF;

    -- Atomic RP deduction (compare-and-swap)
    UPDATE public.epoch_participants
       SET current_rp = current_rp - p_rp_cost
     WHERE epoch_id = p_epoch_id
       AND simulation_id = p_simulation_id
       AND current_rp >= p_rp_cost
     RETURNING current_rp INTO v_new_rp;

    IF v_new_rp IS NULL THEN
        -- Disambiguate missing participant row from RP-starved so the caller
        -- can surface "not a participant" (403) vs "not enough RP" (400)
        -- rather than collapsing both into the misleading insufficient_rp
        -- error the prior Python code produced.
        IF NOT EXISTS (
            SELECT 1 FROM public.epoch_participants
             WHERE epoch_id = p_epoch_id
               AND simulation_id = p_simulation_id
        ) THEN
            RETURN jsonb_build_object('error', 'participant_not_found');
        END IF;
        RETURN jsonb_build_object('error', 'insufficient_rp');
    END IF;

    -- Upgrade security level one tier; preserve legacy 'medium' as 'moderate'
    IF v_old_level = 'medium' THEN
        v_old_level := 'moderate';
    END IF;
    v_old_idx := array_position(v_tiers, v_old_level);
    IF v_old_idx IS NULL THEN
        -- Unknown tier (defensive; mirrors Python _upgrade_security ValueError path)
        v_new_level := v_old_level;
    ELSIF v_old_idx < array_length(v_tiers, 1) THEN
        v_new_idx   := v_old_idx + 1;
        v_new_level := v_tiers[v_new_idx];
    ELSE
        v_new_level := v_old_level;  -- already at top tier
    END IF;

    IF v_new_level IS DISTINCT FROM v_old_level THEN
        UPDATE public.zones
           SET security_level = v_new_level,
               updated_at = now()
         WHERE id = p_zone_id;
    END IF;

    -- Insert fortification record
    INSERT INTO public.zone_fortifications (
        epoch_id, zone_id, source_simulation_id,
        security_bonus, expires_at_cycle
    ) VALUES (
        p_epoch_id, p_zone_id, p_simulation_id,
        1, p_expires_at_cycle
    )
    RETURNING id INTO v_fortification_id;

    RETURN jsonb_build_object(
        'fortification_id', v_fortification_id,
        'zone_id', p_zone_id,
        'new_rp', v_new_rp,
        'old_security_level', v_old_level,
        'new_security_level', v_new_level,
        'expires_at_cycle', p_expires_at_cycle
    );
END;
$$;

COMMENT ON FUNCTION public.fn_fortify_zone_atomic(UUID, UUID, UUID, INT, INT) IS
    'Atomic zone-fortification workflow — replaces check-then-act sequence in operative_mission_service.py. Locks zone, validates ownership, checks no existing fortification, deducts RP via CAS, upgrades security_level one tier, inserts zone_fortifications row — all in one transaction. Returns JSONB with {fortification_id, zone_id, new_rp, old_security_level, new_security_level, expires_at_cycle} on success, or {error: "zone_not_found"|"zone_wrong_simulation"|"already_fortified"|"participant_not_found"|"insufficient_rp"} on failure. See ADR-007.';


-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_reorder_lore_sections_atomic
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: lore_service.py reorder_sections() serial N-UPDATE loop.
-- Race closed: two concurrent reorders touching overlapping section sets
-- now serialize via FOR UPDATE on the provided rows; the final write of
-- each provided row reflects exactly one caller's array position rather
-- than an interleaved per-row hybrid.
--
-- Semantics (lenient, intentional — matches pre-refactor Python): updates
-- sort_order to 0..N-1 for the provided IDs only; non-mentioned rows
-- remain untouched. Empty input is a no-op (returns current state). Each
-- provided ID must belong to p_simulation_id, otherwise 22023 is raised.
--
-- Why lenient over strict full-coverage: the pre-refactor Python performed
-- partial writes silently, and the public lore PUT endpoint forwards
-- whatever section_ids the caller sends. Tightening to full-coverage here
-- would be a breaking API contract change with unverified frontend impact.
-- If strict validation is wanted later, add a paired *_strict variant
-- coordinated with a frontend update — do NOT tighten this contract.
--
-- Note: partial reorders that omit some rows can produce sort_order
-- collisions across the omitted set (e.g., reorder [A,B] to 0,1 while
-- another row C is already at 1). This matches old Python behavior and
-- is accepted as the cost of permissive semantics.

CREATE OR REPLACE FUNCTION public.fn_reorder_lore_sections_atomic(
    p_simulation_id UUID,
    p_section_ids   UUID[]
) RETURNS SETOF public.simulation_lore
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_input_count INT;
    v_match_count INT;
BEGIN
    v_input_count := COALESCE(array_length(p_section_ids, 1), 0);

    -- Empty input: no-op (matches `for i, sid in enumerate([])` semantics)
    IF v_input_count = 0 THEN
        RETURN QUERY
            SELECT *
              FROM public.simulation_lore
             WHERE simulation_id = p_simulation_id
             ORDER BY sort_order;
        RETURN;
    END IF;

    -- Lock only the rows being reordered. Locking non-mentioned rows would
    -- be gratuitous (we never touch them) and would widen the serialization
    -- window for unrelated concurrent ops.
    PERFORM 1 FROM public.simulation_lore
     WHERE simulation_id = p_simulation_id
       AND id = ANY(p_section_ids)
     FOR UPDATE;

    -- Validate every input ID exists and belongs to this simulation. This
    -- also catches duplicates implicitly: COUNT(*) for `id = ANY(arr)` is
    -- DISTINCT-on-id, so [A,A,B] counts as 2 even if A and B both exist,
    -- triggering a mismatch against v_input_count = 3.
    SELECT COUNT(*) INTO v_match_count
      FROM public.simulation_lore
     WHERE simulation_id = p_simulation_id
       AND id = ANY(p_section_ids);

    IF v_match_count <> v_input_count THEN
        RAISE EXCEPTION 'reorder_sections: % of % section_id(s) do not belong to simulation % (or are duplicates)',
                        (v_input_count - v_match_count), v_input_count, p_simulation_id
            USING ERRCODE = '22023';
    END IF;

    -- Bulk update sort_order by array position (0-indexed per existing
    -- convention). Non-mentioned rows are intentionally not touched.
    UPDATE public.simulation_lore sl
       SET sort_order = ord.pos - 1,
           updated_at = now()
      FROM unnest(p_section_ids) WITH ORDINALITY AS ord(section_id, pos)
     WHERE sl.id = ord.section_id
       AND sl.simulation_id = p_simulation_id;

    RETURN QUERY
        SELECT *
          FROM public.simulation_lore
         WHERE simulation_id = p_simulation_id
         ORDER BY sort_order;
END;
$$;

COMMENT ON FUNCTION public.fn_reorder_lore_sections_atomic(UUID, UUID[]) IS
    'Atomic bulk reorder for simulation_lore — replaces serial N-UPDATE loop in lore_service.py reorder_sections(). Lenient semantics (matches pre-refactor Python): updates sort_order to 0..N-1 for the provided IDs only; non-mentioned rows are left untouched. Locks the provided rows via FOR UPDATE on (simulation_id, id = ANY(ids)), validates each belongs to p_simulation_id (and rejects duplicates implicitly via DISTINCT count), then bulk-writes via UNNEST WITH ORDINALITY. Returns SETOF simulation_lore ordered by sort_order. Empty input is a no-op returning current state. Raises 22023 when any provided ID does not belong to the simulation or appears as a duplicate. See ADR-007.';


-- ═══════════════════════════════════════════════════════════════════
-- 3. fn_delete_lore_section_atomic
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: lore_service.py delete_section() — DELETE followed by a serial
-- N-UPDATE re-sort loop. Concurrent deletes/reorders could produce gaps.
--
-- Strategy: delete the target row, then rewrite sort_order for the remaining
-- rows via ROW_NUMBER() — all in one transaction. Locks are acquired by the
-- DELETE itself and the subsequent UPDATE on remaining rows.

CREATE OR REPLACE FUNCTION public.fn_delete_lore_section_atomic(
    p_simulation_id UUID,
    p_section_id    UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_deleted public.simulation_lore%ROWTYPE;
    v_remaining_count INT;
BEGIN
    -- Lock the whole simulation's lore rows so re-sort sees a stable set
    PERFORM 1 FROM public.simulation_lore
     WHERE simulation_id = p_simulation_id
     FOR UPDATE;

    -- Delete the target (captures old row for caller)
    DELETE FROM public.simulation_lore
     WHERE simulation_id = p_simulation_id
       AND id = p_section_id
     RETURNING * INTO v_deleted;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'section_not_found');
    END IF;

    -- Re-sort remaining rows by current sort_order, rewriting to 0..N-1
    WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (ORDER BY sort_order, id) - 1 AS new_order
          FROM public.simulation_lore
         WHERE simulation_id = p_simulation_id
    )
    UPDATE public.simulation_lore sl
       SET sort_order = ranked.new_order,
           updated_at = now()
      FROM ranked
     WHERE sl.id = ranked.id
       AND sl.sort_order <> ranked.new_order;  -- skip no-op writes

    SELECT COUNT(*) INTO v_remaining_count
      FROM public.simulation_lore
     WHERE simulation_id = p_simulation_id;

    RETURN jsonb_build_object(
        'deleted_section', row_to_json(v_deleted),
        'remaining_count', v_remaining_count
    );
END;
$$;

COMMENT ON FUNCTION public.fn_delete_lore_section_atomic(UUID, UUID) IS
    'Atomic delete-and-resort for simulation_lore — replaces delete-then-loop pattern in lore_service.py delete_section(). Locks the simulation''s lore rows, deletes the target, rewrites remaining sort_order to 0..N-1 via ROW_NUMBER, all in one transaction. Returns JSONB {deleted_section, remaining_count} on success, or {error: "section_not_found"}. See ADR-007.';
