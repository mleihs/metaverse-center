-- Migration 253: DRIFT — survey delivery + Erstvermessung honors (the P0c "survey" half)
--
-- Plan refs: §4 (fn_survey_deliver), §12.2 (survey integrity), C4 (first-write-wins).
--
-- The deliver Depesche half of P0c shipped in 249/250. This is its twin: when a run is
-- banked at home (Entladung, fn_travel_complete), every node it FIRST surveyed this run
-- is delivered to the shared chart. Each node's first-ever delivery, across ALL players,
-- wins its Erstvermessung honor — the permanent "first to chart this" record on the
-- public Driftkarte. The arbitration is a single INSERT against the UNIQUE(kind,
-- node_stable_key) index on chart_honors (migration 240): the winner's INSERT lands,
-- every later one conflicts and no-ops (C4, the §16.1 P0b race). The honor is claimed
-- ONLY on a successful bank — a recall or Rückzug closes the run 'abandoned' (246 §4,
-- 250), so the haul AND the honor claim are both forfeit. That coupling is the whole
-- push-your-luck stake: you must survive and reach home to leave your name on the map.
--
-- Scope (P0): fn_survey_deliver writes the per-user FoW delivery flag + the honor row.
-- The "Vermessung pays" economy is the existing qualities.vermessung_lodged haul that
-- fn_travel_complete already banks; a VP/Siegel ledger + the runner-up partial credit
-- (plan §4) + public callsign surfacing are P1b (deliberately not invented here).
-- erstkontakt (the other honor kind) is the P1a forge-publish flow (§8.4), not this one.
--
-- Grant posture: fn_survey_deliver is EFFECT-class — it writes a SHARED, competitive row,
-- so like fn_apply_quest_effects (249) it is REVOKEd from anon + authenticated and
-- GRANTed to service_role only. It is reached one way in P0: INTERNALLY by
-- fn_travel_complete (itself SECURITY DEFINER, running as the owner, which can call it
-- regardless of the player's grants — the 249 fn_quest_advance → fn_apply_quest_effects
-- precedent). A direct player RPC can never forge an honor (ADR-006, incident 096→147).

-- ═══════════════════════════════════════════════════════════════════
-- 1. fn_survey_deliver(user, node_keys[], chart_version) — the honor arbiter
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_survey_deliver(
    p_user          UUID,
    p_node_keys     TEXT[],
    p_chart_version INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key        TEXT;
    v_delivered  INT := 0;
    v_honors_won INT := 0;
    v_honor_keys TEXT[] := ARRAY[]::TEXT[];
    v_rc         INT;
BEGIN
    -- Nothing surveyed (e.g. a home-only run) → a clean zero result, no audit noise.
    IF p_node_keys IS NULL OR array_length(p_node_keys, 1) IS NULL THEN
        RETURN jsonb_build_object('surveys_delivered', 0, 'honors_won', 0,
                                  'honor_keys', '[]'::jsonb);
    END IF;

    FOREACH v_key IN ARRAY p_node_keys LOOP
        -- 1a. Per-user fog-of-war: mark this node surveyed AND delivered. Keyed by
        --     stable_key so the discovery survives chart regeneration (240 §4). First
        --     sighting stamps chart_version_first_seen; later deliveries leave it.
        INSERT INTO traveler_discoveries
            (user_id, node_stable_key, chart_version_first_seen, surveyed, survey_delivered, source)
        VALUES (p_user, v_key, p_chart_version, TRUE, TRUE, 'visit')
        ON CONFLICT (user_id, node_stable_key) DO UPDATE
            SET surveyed = TRUE, survey_delivered = TRUE;
        v_delivered := v_delivered + 1;

        -- 1b. Erstvermessung arbitration (C4): the first delivery of this node, across
        --     all travellers, wins the honor. UNIQUE(kind, node_stable_key) makes the
        --     race a single guarded INSERT — winner lands, everyone after conflicts.
        INSERT INTO chart_honors (kind, node_stable_key, user_id)
        VALUES ('erstvermessung', v_key, p_user)
        ON CONFLICT (kind, node_stable_key) DO NOTHING;
        GET DIAGNOSTICS v_rc = ROW_COUNT;
        IF v_rc > 0 THEN
            v_honors_won := v_honors_won + 1;
            v_honor_keys := v_honor_keys || v_key;
        END IF;
    END LOOP;

    PERFORM travel_audit(p_user, 'travel_survey_deliver', 'chart_honor', NULL, NULL,
        jsonb_build_object('surveys_delivered', v_delivered, 'honors_won', v_honors_won,
                           'honor_keys', to_jsonb(v_honor_keys),
                           'chart_version', p_chart_version));

    RETURN jsonb_build_object(
        'surveys_delivered', v_delivered,
        'honors_won', v_honors_won,
        'honor_keys', to_jsonb(v_honor_keys)
    );
END;
$$;

COMMENT ON FUNCTION public.fn_survey_deliver(UUID, TEXT[], INT) IS
    'Deliver a run''s surveyed nodes to the shared chart (plan §4, §12.2). Per node: upsert the per-user traveler_discoveries FoW row (surveyed + survey_delivered), then attempt the Erstvermessung honor — INSERT … ON CONFLICT (kind, node_stable_key) DO NOTHING against the first-write-wins UNIQUE index (C4); ROW_COUNT distinguishes a win from a conflict. Returns {surveys_delivered, honors_won, honor_keys}. EFFECT-class: writes a shared/competitive row, so REVOKE anon+authenticated, GRANT service_role; reached internally by fn_travel_complete (DEFINER) on a successful Entladung only — a recall/Rückzug (246/250) closes the run abandoned and never delivers. Audits travel_survey_deliver.';

REVOKE ALL    ON FUNCTION public.fn_survey_deliver(UUID, TEXT[], INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_survey_deliver(UUID, TEXT[], INT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_travel_complete — wire survey delivery into the Entladung
-- ═══════════════════════════════════════════════════════════════════
-- CREATE OR REPLACE preserves the existing grants (246 player-class). The only changes
-- vs. 246: resolve the anchor once into a var, deliver the run's foreign-surveyed nodes
-- through fn_survey_deliver, and carry the survey summary in the completion checkpoint
-- (the receipt the FE already reads — run.checkpoint.haul_banked, DriftView). The RPC
-- still RETURNS to_jsonb(run); the run row's checkpoint now also holds honors_won so the
-- HUD can fire the Erstvermessung ceremony without a second round-trip.

CREATE OR REPLACE FUNCTION public.fn_travel_complete(
    p_user UUID, p_run UUID, p_run_version INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run       travel_runs%ROWTYPE;
    v_is_home   BOOLEAN;
    v_haul      INT;
    v_anchor    UUID;
    v_visited   JSONB;
    v_keys      TEXT[];
    v_survey    JSONB;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_complete: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_travel_complete: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status <> 'active' THEN
        RAISE EXCEPTION 'fn_travel_complete: run is %, not active', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;

    -- Must be standing on the anchor's home broadcast node.
    SELECT p.anchor_simulation_id INTO v_anchor FROM traveler_profiles p WHERE p.user_id = p_user;
    SELECT EXISTS (
        SELECT 1 FROM drift_chart_nodes n
        WHERE n.id = v_run.position_node_id
          AND n.node_type = 'broadcast_rand'
          AND n.simulation_id = v_anchor
    ) INTO v_is_home;
    IF NOT v_is_home THEN
        RAISE EXCEPTION 'NOT_AT_HOME' USING ERRCODE = '22023';
    END IF;

    -- Entladung: lodge the run's accrued Vermessung into the traveler's lifetime total
    -- (qualities.vermessung_lodged). (P0c: cargo redemption lands here too.)
    v_haul := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);
    UPDATE traveler_profiles
       SET qualities = jsonb_set(qualities, '{vermessung_lodged}',
             to_jsonb(COALESCE((qualities ->> 'vermessung_lodged')::int, 0) + v_haul))
     WHERE user_id = p_user;

    -- Survey delivery: resolve every FIRST-arrival node this run (checkpoint.visited),
    -- minus the traveller's own home (trivially theirs — it lands in visited on the
    -- return move), to its stable_key, then claim Erstvermessung honors first-write-wins.
    -- This only ever runs on a clean bank; a recall/Rückzug closed the run abandoned.
    v_visited := COALESCE(v_run.checkpoint -> 'visited', '[]'::jsonb);
    SELECT array_agg(n.stable_key)
      INTO v_keys
      FROM drift_chart_nodes n
     WHERE n.chart_version = v_run.chart_version
       AND n.id::text IN (SELECT jsonb_array_elements_text(v_visited))
       AND n.simulation_id IS DISTINCT FROM v_anchor;
    v_survey := fn_survey_deliver(p_user, COALESCE(v_keys, ARRAY[]::text[]), v_run.chart_version);

    UPDATE travel_runs
       SET status = 'completed', closed_at = now(), run_version = run_version + 1,
           checkpoint = jsonb_build_object(
               'haul_banked', v_haul,
               'surveys_delivered', v_survey -> 'surveys_delivered',
               'honors_won', v_survey -> 'honors_won',
               'honor_keys', v_survey -> 'honor_keys')
     WHERE id = p_run
     RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
    VALUES (p_user, 'drift_run_closed', p_run);
    PERFORM travel_audit(p_user, 'travel_complete', 'travel_run', p_run, NULL,
        jsonb_build_object('takt_count', v_run.takt_count, 'haul_banked', v_haul,
                           'honors_won', v_survey -> 'honors_won'));

    RETURN to_jsonb(v_run);
END;
$$;
