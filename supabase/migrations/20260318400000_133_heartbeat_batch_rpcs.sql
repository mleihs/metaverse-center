-- Migration 133: Batch RPCs for heartbeat phases
--
-- Replaces O(N) individual UPDATE calls from Python with single RPC calls.
-- Each returns JSONB array of changes for chronicle entry generation.


-- ============================================================================
-- 1. fn_age_events_batch — Phase 2: Increment ticks_in_status, auto-transition
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_age_events_batch(
  p_sim_id uuid,
  p_active_to_escalating int DEFAULT 4,
  p_escalating_to_resolving int DEFAULT 6,
  p_resolving_to_resolved int DEFAULT 3,
  p_resolved_to_archived int DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_event record;
  v_new_ticks int;
  v_new_status text;
  v_threshold int;
  v_pressure_mult numeric;
BEGIN
  FOR v_event IN
    SELECT id, title, title_de, event_status, ticks_in_status, impact_level, heartbeat_pressure
    FROM events
    WHERE simulation_id = p_sim_id
      AND deleted_at IS NULL
      AND event_status != 'archived'
  LOOP
    v_new_ticks := COALESCE(v_event.ticks_in_status, 0) + 1;
    v_new_status := v_event.event_status;
    v_pressure_mult := 1.0;

    -- Check transition thresholds
    CASE v_event.event_status
      WHEN 'active' THEN
        v_threshold := p_active_to_escalating;
        IF v_new_ticks >= v_threshold THEN
          v_new_status := 'escalating';
          v_pressure_mult := 1.3;
          v_new_ticks := 0;
        END IF;
      WHEN 'escalating' THEN
        v_threshold := p_escalating_to_resolving;
        IF v_new_ticks >= v_threshold THEN
          v_new_status := 'resolving';
          v_pressure_mult := 0.9;
          v_new_ticks := 0;
        END IF;
      WHEN 'resolving' THEN
        v_threshold := p_resolving_to_resolved;
        IF v_new_ticks >= v_threshold THEN
          v_new_status := 'resolved';
          v_new_ticks := 0;
        END IF;
      WHEN 'resolved' THEN
        v_threshold := p_resolved_to_archived;
        IF v_new_ticks >= v_threshold THEN
          v_new_status := 'archived';
          v_new_ticks := 0;
        END IF;
      ELSE
        v_threshold := 999;
    END CASE;

    -- Apply update
    UPDATE events SET
      ticks_in_status = v_new_ticks,
      event_status = v_new_status,
      heartbeat_pressure = CASE
        WHEN v_new_status != v_event.event_status
        THEN ROUND((COALESCE(v_event.heartbeat_pressure, 0) * v_pressure_mult)::numeric, 4)
        ELSE heartbeat_pressure
      END
    WHERE id = v_event.id;

    -- Add to result if status changed or approaching threshold
    IF v_new_status != v_event.event_status
       OR (v_event.event_status IN ('active', 'escalating') AND v_threshold - v_new_ticks <= 2)
    THEN
      v_result := v_result || jsonb_build_object(
        'event_id', v_event.id,
        'title', v_event.title,
        'title_de', v_event.title_de,
        'old_status', v_event.event_status,
        'new_status', v_new_status,
        'ticks_in_status', v_new_ticks,
        'transitioned', v_new_status != v_event.event_status,
        'remaining', GREATEST(0, v_threshold - v_new_ticks)
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;


-- ============================================================================
-- 2. fn_compute_event_pressure_batch — Phase 3: Compute and update pressures
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_compute_event_pressure_batch(
  p_sim_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_pressure numeric := 0;
  v_event_count int := 0;
  v_event record;
  v_pressure numeric;
BEGIN
  FOR v_event IN
    SELECT id, event_status, impact_level
    FROM events
    WHERE simulation_id = p_sim_id
      AND deleted_at IS NULL
      AND event_status IN ('active', 'escalating')
  LOOP
    v_pressure := ROUND(
      (COALESCE(v_event.impact_level, 5)::numeric / 10.0)
      * CASE WHEN v_event.event_status = 'escalating' THEN 1.3 ELSE 1.0 END,
      4
    );

    UPDATE events SET heartbeat_pressure = v_pressure WHERE id = v_event.id;

    v_total_pressure := v_total_pressure + v_pressure;
    v_event_count := v_event_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'total_pressure', v_total_pressure,
    'event_count', v_event_count
  );
END;
$$;


-- ============================================================================
-- 3. fn_deepen_attunements_batch — Phase 6: Deepen all sim attunements
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_deepen_attunements_batch(
  p_sim_id uuid,
  p_growth_rate numeric DEFAULT 0.05,
  p_passive_rate numeric DEFAULT 0.01
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_att record;
  v_has_events boolean;
  v_effective_rate numeric;
  v_new_depth numeric;
  v_new_ticks int;
BEGIN
  FOR v_att IN
    SELECT id, resonance_signature, depth, ticks_exposed, positive_threshold,
           switching_cooldown_ticks
    FROM substrate_attunements
    WHERE simulation_id = p_sim_id
  LOOP
    -- Reduce switching cooldown
    IF COALESCE(v_att.switching_cooldown_ticks, 0) > 0 THEN
      UPDATE substrate_attunements
        SET switching_cooldown_ticks = v_att.switching_cooldown_ticks - 1
        WHERE id = v_att.id;
    END IF;

    -- Check for active matching events
    SELECT EXISTS(
      SELECT 1 FROM events
      WHERE simulation_id = p_sim_id
        AND deleted_at IS NULL
        AND event_status IN ('active', 'escalating')
        AND tags @> ARRAY[v_att.resonance_signature]
      LIMIT 1
    ) INTO v_has_events;

    -- Determine growth rate
    v_effective_rate := CASE WHEN v_has_events THEN p_growth_rate ELSE p_passive_rate END;
    v_new_depth := LEAST(1.0, COALESCE(v_att.depth, 0) + v_effective_rate);
    v_new_ticks := COALESCE(v_att.ticks_exposed, 0) + CASE WHEN v_has_events THEN 1 ELSE 0 END;

    -- Update
    UPDATE substrate_attunements SET
      depth = ROUND(v_new_depth::numeric, 4),
      ticks_exposed = v_new_ticks,
      updated_at = now()
    WHERE id = v_att.id;

    v_result := v_result || jsonb_build_object(
      'attunement_id', v_att.id,
      'signature', v_att.resonance_signature,
      'old_depth', COALESCE(v_att.depth, 0),
      'new_depth', ROUND(v_new_depth::numeric, 4),
      'threshold', COALESCE(v_att.positive_threshold, 0.5),
      'has_events', v_has_events,
      'harmonized', v_new_depth >= COALESCE(v_att.positive_threshold, 0.5),
      'just_harmonized',
        v_new_depth >= COALESCE(v_att.positive_threshold, 0.5)
        AND COALESCE(v_att.depth, 0) < COALESCE(v_att.positive_threshold, 0.5)
    );
  END LOOP;

  RETURN v_result;
END;
$$;


-- ============================================================================
-- 4. fn_strengthen_anchors_batch — Phase 7: Strengthen all anchors for a sim
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_strengthen_anchors_batch(
  p_sim_id uuid,
  p_growth_per_sim numeric DEFAULT 0.03,
  p_protection_cap numeric DEFAULT 0.70
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_anchor record;
  v_new_strength numeric;
  v_new_ticks int;
  v_new_status text;
  v_participants int;
  v_protection numeric;
BEGIN
  FOR v_anchor IN
    SELECT id, name, strength, ticks_active, status, anchor_simulation_ids
    FROM collaborative_anchors
    WHERE status IN ('forming', 'active', 'reinforcing')
      AND anchor_simulation_ids @> ARRAY[p_sim_id]
  LOOP
    v_participants := COALESCE(array_length(v_anchor.anchor_simulation_ids, 1), 0);
    v_new_ticks := COALESCE(v_anchor.ticks_active, 0) + 1;

    -- Flat growth per tick (no participant amplification)
    v_new_strength := LEAST(1.0, COALESCE(v_anchor.strength, 0) + p_growth_per_sim);
    v_new_status := v_anchor.status;

    -- Status transitions
    IF v_new_status = 'forming' AND v_new_ticks >= 2 THEN
      v_new_status := 'active';
    ELSIF v_new_status = 'active' AND v_new_strength > 0.5 THEN
      v_new_status := 'reinforcing';
    END IF;

    -- Protection factor
    v_protection := LEAST(p_protection_cap, v_new_strength * (v_participants::numeric / 5.0));

    UPDATE collaborative_anchors SET
      strength = ROUND(v_new_strength::numeric, 4),
      ticks_active = v_new_ticks,
      status = v_new_status,
      updated_at = now()
    WHERE id = v_anchor.id;

    v_result := v_result || jsonb_build_object(
      'anchor_id', v_anchor.id,
      'anchor_name', v_anchor.name,
      'old_strength', COALESCE(v_anchor.strength, 0),
      'new_strength', ROUND(v_new_strength::numeric, 4),
      'protection', ROUND(v_protection::numeric, 4),
      'participant_count', v_participants,
      'status', v_new_status
    );
  END LOOP;

  RETURN v_result;
END;
$$;


-- ============================================================================
-- 5. fn_drift_scar_tissue_batch — Phase 8: Grow/decay scar tissue on arcs
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_drift_scar_tissue_batch(
  p_sim_id uuid,
  p_growth_rate numeric DEFAULT 0.05,
  p_decay_rate numeric DEFAULT 0.02
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scar_delta numeric := 0;
  v_arc record;
  v_growth numeric;
  v_decay numeric;
  v_new_scar numeric;
BEGIN
  FOR v_arc IN
    SELECT id, status, pressure, scar_tissue_deposited
    FROM narrative_arcs
    WHERE simulation_id = p_sim_id
      AND status IN ('active', 'climax', 'resolving', 'resolved')
  LOOP
    IF v_arc.status IN ('active', 'climax') THEN
      v_growth := COALESCE(v_arc.pressure, 0) * p_growth_rate;
      v_new_scar := ROUND((COALESCE(v_arc.scar_tissue_deposited, 0) + v_growth)::numeric, 4);
      v_scar_delta := v_scar_delta + v_growth;
    ELSIF v_arc.status IN ('resolving', 'resolved') THEN
      v_decay := ROUND((COALESCE(v_arc.scar_tissue_deposited, 0) * p_decay_rate)::numeric, 4);
      v_new_scar := GREATEST(0, ROUND((COALESCE(v_arc.scar_tissue_deposited, 0) - v_decay)::numeric, 4));
      v_scar_delta := v_scar_delta - v_decay;
    ELSE
      CONTINUE;
    END IF;

    UPDATE narrative_arcs SET scar_tissue_deposited = v_new_scar WHERE id = v_arc.id;
  END LOOP;

  RETURN jsonb_build_object('scar_delta', ROUND(v_scar_delta::numeric, 4));
END;
$$;


-- ============================================================================
-- 6. Security: restrict batch RPCs to service_role only
-- ============================================================================

REVOKE EXECUTE ON FUNCTION fn_age_events_batch FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_compute_event_pressure_batch FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_deepen_attunements_batch FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_strengthen_anchors_batch FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_drift_scar_tissue_batch FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION fn_age_events_batch TO service_role;
GRANT EXECUTE ON FUNCTION fn_compute_event_pressure_batch TO service_role;
GRANT EXECUTE ON FUNCTION fn_deepen_attunements_batch TO service_role;
GRANT EXECUTE ON FUNCTION fn_strengthen_anchors_batch TO service_role;
GRANT EXECUTE ON FUNCTION fn_drift_scar_tissue_batch TO service_role;
