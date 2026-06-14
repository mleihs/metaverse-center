-- Migration 255: DRIFT — travel_failure_scatter (§19.4 KH=0 failure floor: cargo → echoes)
--
-- Spec: docs/plans/drift-implementation-plan.md §19.4 (P0 failure floor), §10 (the single
--       hospitality gate + effect family), §4 (RPC catalog — finding 3/20: "Zerfaserung
--       scatter calls the SAME function family … no second channel exists"), §5 (ADR-006).
--
-- WHAT — when a run COLLAPSES (Kohärenz hits 0, or the Aufenthaltsfenster expires away from
-- home), the carried Depesche cargo no longer simply vanishes: each piece SCATTERS as a
-- faint echo into the world it was headed for, routed through the one hospitality gate. This
-- is the §19.4 P0 floor enrichment — migration 246 shipped the forced-return-home but
-- deferred the cargo→echo scatter "to P0c, it needs the effect family"; that family
-- (fn_apply_quest_effects, 249/252) now exists, so the floor finally gets its scatter.
--
-- WHY a refactor, not a new echo writer — finding 3/20 / CLAUDE.md "no code duplication":
-- the travel_echo INSERT + hospitality resolution lives ONCE, inside the quest gate. A second
-- echo path would duplicate it. So this migration EXTRACTS the gate's per-effect application
-- loop into a generic core fn_apply_drift_effects(owner, anchor, effects, source, ref) and
-- re-points BOTH fn_apply_quest_effects (delivery) AND the new fn_drift_scatter_cargo
-- (failure scatter) at it — the "same family, source discriminator" the plan mandates. The
-- delivery path is byte-identical in behaviour (the loop body moves verbatim; only the audit
-- object + a non-breaking additive metadata `source` key are parametrised).
--
-- WHERE the scatter fires — ONLY the involuntary collapse scatters. The failure floor lives
-- in fn_travel_move (KH≤0 OR window-expired-away-from-home). Voluntary Rückzug
-- (fn_travel_abandon) stays "unanchored cargo forfeited (deleted — no scatter, no scar)" by
-- spec (§4 RPC catalog) — it is deliberately the clean exit. fn_travel_abandon is NOT touched
-- here; the 250 forfeit trigger still plain-deletes the cargo it leaves behind.
--
-- ORDER — fn_travel_move's floor computes the scatter (reads cargo, emits echoes through the
-- gate) BEFORE the UPDATE that flips status→'abandoned'. That UPDATE fires the 250
-- close-cleanup trigger which DELETEs the (now-scattered) cargo + fails the bound quest. One
-- transaction: scatter → flip → forfeit, all-or-nothing. The scatter summary rides the run's
-- recall checkpoint (the FE already reads cp.recall / cp.haul_lost) — no new DTO.
--
-- GRANTS — fn_apply_drift_effects + fn_drift_scatter_cargo are EFFECT-class (REVOKE
-- anon+authenticated, GRANT service_role; reached DEFINER→DEFINER from the gate / the move
-- floor / the backend). fn_apply_quest_effects + fn_travel_move keep their existing posture.
--
-- All behind drift_p0_enabled=false — no runtime change until the gate is raised.


-- ═══════════════════════════════════════════════════════════════════
-- 1. fn_apply_drift_effects(owner, anchor, effects, source, ref) — the effect-family core
-- ═══════════════════════════════════════════════════════════════════
-- The per-effect hospitality application loop, extracted verbatim from fn_apply_quest_effects
-- (252). Resolves each effect's target-sim hospitality (home=anchor→full; else the per-sim
-- setting, fail-closed 'geschlossen') and writes the allowed P0 effects (emit_fragment self;
-- emit_echo ≥nur_echos; inject_agent_memory; spawn_event) with template-driven prose. The
-- source/ref pair colours the self-effect audit object + a `source` metadata key only — the
-- WRITES are identical whichever caller (delivery / failure scatter / P2 Zerfaserung / P4
-- traces). No exactly-once CAS here: that is a quest-instance concern owned by the
-- fn_apply_quest_effects wrapper; a scatter is already once-only (its move transition is
-- terminal — a re-call of fn_travel_move on the now-'abandoned' run raises immediately).

CREATE OR REPLACE FUNCTION public.fn_apply_drift_effects(
    p_owner    UUID,
    p_anchor   UUID,
    p_effects  JSONB,
    p_source   TEXT,
    p_ref_id   UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_effect      JSONB;
    v_kind        TEXT;
    v_target_sim  UUID;
    v_target_ag   UUID;
    v_hosp        TEXT;
    v_sim_name    TEXT;
    v_ag_name     TEXT;
    v_impact      INT;
    v_importance  INT;
    v_caps        JSONB;
    v_title       TEXT;
    v_text_de     TEXT;
    v_text_en     TEXT;
    v_audit_otype TEXT;
    v_meta_ref    JSONB;
    v_applied     JSONB := '[]'::jsonb;
    v_skipped     JSONB := '[]'::jsonb;
BEGIN
    v_caps := drift_tuning_value('hospitality_caps');  -- §10 per-effect ceilings (data, not literals)
    -- source/ref → the audit object for self-effects + the provenance key on every write.
    v_audit_otype := CASE WHEN p_source = 'quest' THEN 'travel_quest' ELSE 'travel_run' END;
    v_meta_ref    := jsonb_build_object('source', p_source)
                  || CASE WHEN p_source = 'quest'
                          THEN jsonb_build_object('quest_instance_id', p_ref_id)
                          ELSE jsonb_build_object('run_id', p_ref_id) END;

    FOR v_effect IN SELECT * FROM jsonb_array_elements(COALESCE(p_effects, '[]'::jsonb))
    LOOP
        v_kind       := v_effect ->> 'kind';
        v_target_sim := NULLIF(v_effect ->> 'target_sim', '')::uuid;
        v_target_ag  := NULLIF(v_effect ->> 'target_agent', '')::uuid;

        -- Self-effects are hospitality-exempt (they write the Träger's own journal). The
        -- fragment prose is the Träger's first-person account, carried on the effect spec
        -- (per-template) with a generic fallback.
        IF v_kind = 'emit_fragment' THEN
            v_text_de := COALESCE(v_effect ->> 'text_de',
                'Eine Depesche über den Drift abgeliefert. Etwas Fremdes hat die Schwelle überquert.');
            v_text_en := COALESCE(v_effect ->> 'text_en',
                'A dispatch delivered across the Drift. Something foreign has crossed the threshold.');
            INSERT INTO journal_fragments (user_id, simulation_id, fragment_type, source_type,
                                           content_de, content_en, thematic_tags, rarity)
            VALUES (p_owner, v_target_sim, 'journey', 'travel',
                    v_text_de, v_text_en, '["travel","depesche"]'::jsonb, 'common');
            v_applied := v_applied || jsonb_build_object('kind', v_kind, 'target', 'self');
            PERFORM travel_audit(p_owner, 'travel_effect_fragment', v_audit_otype, p_ref_id,
                v_target_sim, jsonb_build_object('kind', v_kind) || v_meta_ref);
            CONTINUE;
        END IF;

        -- Cross-sim effects: resolve hospitality (home = own anchor → full; else the
        -- per-sim setting, fail-closed to 'geschlossen' on an absent row).
        IF v_target_sim IS NULL THEN
            v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'no_target_sim');
            CONTINUE;
        END IF;
        IF v_target_sim = p_anchor THEN
            v_hosp := 'home';
        ELSE
            v_hosp := COALESCE(
                (SELECT setting_value #>> '{}' FROM simulation_settings
                  WHERE simulation_id = v_target_sim AND category = 'drift'
                    AND setting_key = 'drift_hospitality'),
                'geschlossen');
        END IF;

        SELECT name INTO v_sim_name FROM simulations WHERE id = v_target_sim;

        IF v_kind = 'emit_echo' THEN
            -- ≥ nur_echos, never at home (no self-echo). A faint travel_echo event.
            IF v_hosp IN ('nur_echos', 'standard', 'offen') THEN
                v_title := COALESCE(v_effect ->> 'title_de', 'Echo aus dem Drift');
                v_text_de := replace(COALESCE(v_effect ->> 'text_de',
                        'Ein verklingendes Echo streift {sim}, eine Depesche hat in der Nähe die Schwelle berührt.'),
                    '{sim}', COALESCE(v_sim_name, 'die Stadt'));
                INSERT INTO events (simulation_id, title, event_type, description, impact_level, metadata)
                VALUES (v_target_sim, v_title, 'travel_echo', v_text_de, 1,
                    jsonb_build_object('drift', TRUE, 'kind', 'emit_echo') || v_meta_ref);
                v_applied := v_applied || jsonb_build_object('kind', v_kind, 'target_sim', v_target_sim, 'hospitality', v_hosp);
                PERFORM travel_audit(p_owner, 'travel_effect_echo', 'simulation', v_target_sim,
                    v_target_sim, jsonb_build_object('kind', v_kind, 'hospitality', v_hosp) || v_meta_ref);
            ELSE
                v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'hospitality_' || v_hosp);
            END IF;

        ELSIF v_kind = 'inject_agent_memory' THEN
            -- Home (full) or standard/offen (importance ≤ 5).
            IF v_hosp = 'home' OR v_hosp IN ('standard', 'offen') THEN
                v_importance := COALESCE((v_effect ->> 'importance')::int, 4);
                IF v_hosp <> 'home' THEN
                    v_importance := LEAST(v_importance, COALESCE((v_caps ->> 'memory_importance')::int, 5));
                END IF;
                IF v_target_ag IS NOT NULL THEN
                    SELECT name INTO v_ag_name FROM agents WHERE id = v_target_ag;
                    v_text_de := replace(replace(COALESCE(v_effect ->> 'text_de',
                            'Ein Träger brachte {agent} eine Depesche über den Drift. {agent} wird sich an die Lieferung erinnern.'),
                        '{agent}', COALESCE(v_ag_name, 'Man')), '{sim}', COALESCE(v_sim_name, 'die Stadt'));
                    INSERT INTO agent_memories (agent_id, simulation_id, memory_type, content, importance, source_type)
                    VALUES (v_target_ag, v_target_sim, 'observation', v_text_de, v_importance, 'travel');
                    v_applied := v_applied || jsonb_build_object('kind', v_kind, 'target_agent', v_target_ag, 'hospitality', v_hosp, 'importance', v_importance);
                    PERFORM travel_audit(p_owner, 'travel_effect_memory', 'agent', v_target_ag,
                        v_target_sim, jsonb_build_object('kind', v_kind, 'hospitality', v_hosp, 'importance', v_importance) || v_meta_ref);
                ELSE
                    v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'no_target_agent');
                END IF;
            ELSE
                v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'hospitality_' || v_hosp);
            END IF;

        ELSIF v_kind = 'spawn_event' THEN
            -- Home (full 1–10) or standard/offen (impact ≤ 3).
            IF v_hosp = 'home' OR v_hosp IN ('standard', 'offen') THEN
                v_impact := COALESCE((v_effect ->> 'impact_level')::int, 3);
                IF v_hosp = 'home' THEN
                    v_impact := LEAST(GREATEST(v_impact, 1), COALESCE((v_caps ->> 'event_impact_home')::int, 10));
                ELSE
                    v_impact := LEAST(GREATEST(v_impact, 1), COALESCE((v_caps ->> 'event_impact_off_home')::int, 3));
                END IF;
                v_title := COALESCE(v_effect ->> 'title_de', 'Drift-Depesche eingetroffen');
                v_text_de := replace(COALESCE(v_effect ->> 'text_de',
                        'Ein Träger lieferte eine Depesche aus dem Drift in {sim} ab. Etwas Fremdes hat die Schwelle überquert.'),
                    '{sim}', COALESCE(v_sim_name, 'der Stadt'));
                INSERT INTO events (simulation_id, title, event_type, description, impact_level, metadata)
                VALUES (v_target_sim, v_title, 'travel_dispatch', v_text_de, v_impact,
                    jsonb_build_object('drift', TRUE, 'kind', 'spawn_event') || v_meta_ref);
                v_applied := v_applied || jsonb_build_object('kind', v_kind, 'target_sim', v_target_sim, 'hospitality', v_hosp, 'impact_level', v_impact);
                PERFORM travel_audit(p_owner, 'travel_effect_event', 'simulation', v_target_sim,
                    v_target_sim, jsonb_build_object('kind', v_kind, 'hospitality', v_hosp, 'impact_level', v_impact) || v_meta_ref);
            ELSE
                v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'hospitality_' || v_hosp);
            END IF;

        ELSE
            -- Deferred effect kinds (chronicle_mention/grant_agent_effect/zone_modifier/
            -- propose_embassy/bond_event) — recorded as skipped until P0d+.
            v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'unsupported_p0c');
        END IF;
    END LOOP;

    RETURN jsonb_build_object('applied', v_applied, 'skipped', v_skipped);
END;
$$;

REVOKE ALL    ON FUNCTION public.fn_apply_drift_effects(uuid, uuid, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_apply_drift_effects(uuid, uuid, jsonb, text, uuid) TO service_role;

COMMENT ON FUNCTION public.fn_apply_drift_effects(uuid, uuid, jsonb, text, uuid) IS
    'The DRIFT effect-family core (plan §10; finding 3/20 — the single cross-sim write path). Applies a list of effect specs through the hospitality matrix (home=anchor→full; else simulation_settings drift_hospitality, fail-closed geschlossen) and writes the allowed P0 effects (emit_fragment self→journal_fragments; emit_echo ≥nur_echos→travel_echo event; inject_agent_memory→agent_memories; spawn_event→events), prose template-driven off each spec ({sim}/{agent} tokens). p_source/p_ref_id colour the self-effect audit object + a `source` metadata key only — the writes are identical for every caller. NO exactly-once CAS (that is the quest wrapper''s concern). EFFECT-class: REVOKE anon+authenticated, GRANT service_role; reached DEFINER→DEFINER by fn_apply_quest_effects (delivery), fn_drift_scatter_cargo (§19.4 failure scatter), and the backend (P2/P4). Audits each applied effect.';


-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_apply_quest_effects(instance, effects) — the quest-delivery wrapper (slimmed)
-- ═══════════════════════════════════════════════════════════════════
-- Unchanged contract; the per-effect loop now lives in the family core. Keeps the
-- exactly-once claim (the guarded effects_applied CAS) + owner/anchor resolution, then
-- delegates. Byte-identical delivery behaviour — the loop moved verbatim into the core.

CREATE OR REPLACE FUNCTION public.fn_apply_quest_effects(
    p_instance  UUID,
    p_effects   JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inst    travel_quest_instances%ROWTYPE;
    v_anchor  UUID;
    v_result  JSONB;
BEGIN
    -- Exactly-once claim: this guarded UPDATE is the FIRST write. A second call finds
    -- effects_applied already true → no row → returns early. Claim + writes share the
    -- txn, so a later failure rolls the flag back (atomic).
    UPDATE travel_quest_instances
       SET effects_applied = TRUE
     WHERE id = p_instance AND effects_applied = FALSE
     RETURNING * INTO v_inst;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('already_applied', TRUE, 'applied', '[]'::jsonb, 'skipped', '[]'::jsonb);
    END IF;

    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = v_inst.owner_user_id;

    v_result := fn_apply_drift_effects(v_inst.owner_user_id, v_anchor, p_effects, 'quest', p_instance);
    RETURN jsonb_build_object('already_applied', FALSE,
                             'applied', v_result -> 'applied',
                             'skipped', v_result -> 'skipped');
END;
$$;

REVOKE ALL    ON FUNCTION public.fn_apply_quest_effects(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_apply_quest_effects(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.fn_apply_quest_effects(uuid, jsonb) IS
    'The DRIFT quest-delivery hospitality gate (plan §10). Claims the instance exactly-once (guarded effects_applied CAS), resolves owner/anchor, then delegates per-effect application to fn_apply_drift_effects(..., source=''quest'', ref=instance). P0 vocabulary (4 of 9): emit_fragment, emit_echo, inject_agent_memory, spawn_event; prose template-driven (migration 252). EFFECT-class: REVOKE anon+authenticated, GRANT service_role; reached internally by fn_quest_advance (DEFINER). Audits each applied effect (in the core).';


-- ═══════════════════════════════════════════════════════════════════
-- 3. fn_drift_scatter_cargo(run, owner, anchor) — §19.4 cargo → echoes
-- ═══════════════════════════════════════════════════════════════════
-- Composes one emit_echo per carried Depesche cargo, targeted at the world it was headed for
-- (the bound quest instance's target sim, travel_quest_instances.simulation_id), with
-- scatter-flavoured prose distinct from a delivery echo, and routes them through the family
-- core. The gate filters targets (≥ nur_echos; a home destination is dropped as a self-echo).
-- An empty manifest scatters nothing (parity with the §2.10 empty-Zerfaserung anti-farm
-- rule). Returns {scattered, applied, skipped} for the run's recall checkpoint.
--   INNER JOIN travel_quest_instances (documented INNER): only quest-bound cargo has a
--   destination world to scatter toward, and all P0 cargo is deliver-Depesche-bound. Non-quest
--   cargo families (fetch/Andenken, P1+) extend this when they ship.

CREATE OR REPLACE FUNCTION public.fn_drift_scatter_cargo(
    p_run    UUID,
    p_owner  UUID,
    p_anchor UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_effects JSONB;
    v_count   INT;
BEGIN
    SELECT jsonb_agg(jsonb_build_object(
               'kind', 'emit_echo',
               'target_sim', qi.simulation_id,
               'title_de', 'Verwehtes Echo',
               'text_de', 'Ein Träger zerfaserte im Drift. Eine verlorene Depesche verklingt als Echo über {sim} – die Sendung, die nie ankam.'
           )),
           COUNT(*)
      INTO v_effects, v_count
      FROM travel_cargo c
      JOIN travel_quest_instances qi ON qi.id = c.quest_instance_id
     WHERE c.run_id = p_run AND qi.simulation_id IS NOT NULL;

    IF v_effects IS NULL THEN
        RETURN jsonb_build_object('scattered', 0, 'applied', '[]'::jsonb, 'skipped', '[]'::jsonb);
    END IF;

    RETURN jsonb_build_object('scattered', v_count)
        || fn_apply_drift_effects(p_owner, p_anchor, v_effects, 'zerfaserung', p_run);
END;
$$;

REVOKE ALL    ON FUNCTION public.fn_drift_scatter_cargo(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_drift_scatter_cargo(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.fn_drift_scatter_cargo(uuid, uuid, uuid) IS
    'DRIFT §19.4 failure-floor scatter: on an involuntary run collapse, each carried Depesche cargo scatters as a faint emit_echo into the world it was headed for (the bound quest instance''s target sim), routed through fn_apply_drift_effects (source=''zerfaserung''). Hospitality-gated (≥ nur_echos; home self-echo dropped). Empty manifest = no scatter (anti-farm). Returns {scattered, applied, skipped}. EFFECT-class; called DEFINER→DEFINER by fn_travel_move''s failure floor BEFORE the status→abandoned flip deletes the cargo. Voluntary Rückzug (fn_travel_abandon) does NOT call this — it forfeits cargo with no scatter, by spec.';


-- ═══════════════════════════════════════════════════════════════════
-- 4. fn_travel_move — the failure floor now scatters the carried cargo
-- ═══════════════════════════════════════════════════════════════════
-- Identical to migration 246 except the recall floor: before the status→'abandoned' UPDATE
-- (which fires the 250 close-cleanup trigger that DELETEs the cargo), it calls
-- fn_drift_scatter_cargo and records the summary in the recall checkpoint. Player-class grants
-- preserved by CREATE OR REPLACE (re-asserted at the file foot for intent).

CREATE OR REPLACE FUNCTION public.fn_travel_move(
    p_user          UUID,
    p_run           UUID,
    p_run_version   INT,
    p_to_node       UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run        travel_runs%ROWTYPE;
    v_weight     INT;
    v_perm       JSONB;
    v_affinity   INT;
    v_mult       NUMERIC;
    v_bb_cost    INT;
    v_band       TEXT;
    v_dz_add     INT;
    v_dz_cap     INT;
    v_notfreq    BOOLEAN := FALSE;
    v_surge      BOOLEAN := FALSE;
    v_home       UUID;
    v_anchor     UUID;
    v_to_sim     UUID;
    v_to_type    TEXT;
    v_haul       INT;
    v_visited    JSONB;
    v_survey     INT := 0;
    v_dz_bleed   JSONB;
    v_surge_cfg  JSONB;
    v_scatter    JSONB;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_move: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    -- Lock + load the run; run_version CAS (concurrent move from a 2nd client loses).
    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_travel_move: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status <> 'active' THEN
        RAISE EXCEPTION 'fn_travel_move: run is %, not active', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;

    -- Adjacency: an edge between the current position and the target in this chart.
    SELECT weight, permeability INTO v_weight, v_perm FROM drift_chart_edges
     WHERE chart_version = v_run.chart_version
       AND ((from_node = v_run.position_node_id AND to_node = p_to_node)
         OR (to_node   = v_run.position_node_id AND from_node = p_to_node))
     LIMIT 1;
    IF v_weight IS NULL THEN
        RAISE EXCEPTION 'NOT_ADJACENT' USING ERRCODE = '22023';
    END IF;

    -- Frequency multiplier: on-vector if the edge is permeable on the current
    -- frequency (≥1); else the affinity-banded off-vector penalty (§2.2).
    -- (P0 simplification: the per-edge low-permeability ×3 case is not yet split out.)
    IF COALESCE((v_perm ->> v_run.frequency)::numeric, 0) >= 1 THEN
        v_mult := (drift_tuning_value('freq_offvector_mult') ->> 'on')::numeric;
    ELSE
        v_affinity := COALESCE((SELECT (affinities ->> v_run.frequency)::int
                                FROM traveler_profiles WHERE user_id = p_user), 0);
        v_mult := (drift_tuning_value('freq_offvector_mult') ->> (
            CASE WHEN v_affinity <= 1 THEN 'aff_0_1'
                 WHEN v_affinity <= 3 THEN 'aff_2_3'
                 ELSE 'aff_4_5' END))::numeric;
    END IF;
    v_bb_cost := ceil(v_weight * v_mult)::int;

    -- Pay: Bandbreite if affordable, else Notfrequenz (KH per edge, BB stays 0).
    -- (P0 simplification: Notfrequenz allowed on any adjacent edge; the known-edge
    --  restriction §2.3 needs the discovery layer, P0b.)
    IF v_run.bandbreite >= v_bb_cost THEN
        v_run.bandbreite := v_run.bandbreite - v_bb_cost;
    ELSE
        v_notfreq := TRUE;
        v_run.kohaerenz := GREATEST(0, v_run.kohaerenz
            - COALESCE((drift_tuning_value('notfreq_kh_per_edge'))::int, 2));
    END IF;

    -- Target node band + identity (Dissonanz scaling, survey value, foreign-dock bonus).
    SELECT distance_band, simulation_id, node_type INTO v_band, v_to_sim, v_to_type
      FROM drift_chart_nodes WHERE id = p_to_node AND chart_version = v_run.chart_version;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;

    -- One Takt of the Aufenthaltsfenster spent (§2.6) — the time pressure.
    v_run.window_remaining := v_run.window_remaining - 1;

    -- Dissonanz by the target band, capped. Above the bleed threshold, instability
    -- erodes Kohärenz (the Bleed eats you) — Dissonanz is a rising threat with teeth.
    v_dz_add := COALESCE((drift_tuning_value('dz_per_move_by_band') ->> COALESCE(v_band, 'near'))::int, 1);
    v_dz_cap := COALESCE((drift_tuning_value('dz_p0_cap'))::int, 74);
    v_run.dissonanz := LEAST(v_dz_cap, v_run.dissonanz + v_dz_add);
    v_dz_bleed := drift_tuning_value('dz_kh_bleed');
    IF v_dz_bleed IS NOT NULL AND v_run.dissonanz >= (v_dz_bleed ->> 'threshold')::int THEN
        v_run.kohaerenz := GREATEST(0, v_run.kohaerenz - (v_dz_bleed ->> 'amount')::int);
    END IF;

    -- Deep-Drift surge (variance / push-your-luck): a deep crossing may spike DZ + KH.
    IF v_band = 'deep' THEN
        v_surge_cfg := drift_tuning_value('deep_surge');
        IF v_surge_cfg IS NOT NULL AND random() < (v_surge_cfg ->> 'chance')::numeric THEN
            v_surge := TRUE;
            v_run.dissonanz := LEAST(v_dz_cap, v_run.dissonanz + (v_surge_cfg ->> 'dz')::int);
            v_run.kohaerenz := GREATEST(0, v_run.kohaerenz - (v_surge_cfg ->> 'kh')::int);
        END IF;
    END IF;

    -- Vermessung: first arrival at this node this run → survey value (band + foreign dock).
    v_haul    := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);
    v_visited := COALESCE(v_run.checkpoint -> 'visited', '[]'::jsonb);
    IF NOT (v_visited @> to_jsonb(p_to_node::text)) THEN
        v_survey := COALESCE((drift_tuning_value('survey_value_by_band') ->> COALESCE(v_band, 'near'))::int, 0);
        IF v_to_type = 'broadcast_rand' AND v_to_sim IS DISTINCT FROM v_anchor THEN
            v_survey := v_survey + COALESCE((drift_tuning_value('foreign_dock_bonus'))::int, 0);
        END IF;
        v_haul := v_haul + v_survey;
        v_visited := v_visited || to_jsonb(p_to_node::text);
    END IF;

    -- Recall floor: a depleted Kohärenz (§19.4) OR an expired Aufenthaltsfenster (§2.6)
    -- collapses the excursion — the Träger is snapped to the home broadcast edge and the
    -- un-lodged Vermessung is LOST (the push-your-luck stakes). The carried cargo SCATTERS
    -- as echoes (§19.4 cargo→echo via the hospitality gate; P2 replaces this floor with
    -- fn_zerfaserung — wreck/scar/distress). Home is single-row by uq_chart_home_node
    -- (section 2b). Records under the 'drift_zerfaserung' KPI bucket. Kohärenz=0 unravels you
    -- anywhere; an expired window only strands you if this move did NOT bring you home (an
    -- on-time arrival home is a clean return, not a loss).
    IF v_run.kohaerenz <= 0 OR (v_run.window_remaining <= 0 AND p_to_node IS DISTINCT FROM v_home) THEN
        -- Scatter BEFORE the status flip: the 250 close-cleanup trigger deletes the cargo on
        -- the transition into 'abandoned', so the scatter must read the manifest first. This
        -- path is the involuntary collapse only — voluntary Rückzug (fn_travel_abandon) never
        -- reaches here and forfeits cargo with no scatter, by spec.
        v_scatter := fn_drift_scatter_cargo(p_run, p_user, v_anchor);

        UPDATE travel_runs SET
            position_node_id = COALESCE(v_home, position_node_id),
            status           = 'abandoned',   -- the expedition collapsed (terminal; nothing lodged)
            closed_at        = now(),
            bandbreite       = v_run.bandbreite,
            kohaerenz        = v_run.kohaerenz,
            dissonanz        = v_run.dissonanz,
            window_remaining = GREATEST(0, v_run.window_remaining),
            takt_count       = takt_count + 1,
            event_seq        = event_seq + 1,
            run_version      = run_version + 1,
            checkpoint       = jsonb_build_object(
                'position_node_id', COALESCE(v_home, v_run.position_node_id),
                'recall', CASE WHEN v_run.kohaerenz <= 0 THEN 'kohaerenz' ELSE 'window' END,
                'haul', 0, 'haul_lost', v_haul, 'visited', v_visited,
                'scattered', v_scatter)
        WHERE id = p_run
        RETURNING * INTO v_run;

        INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
        VALUES (p_user, 'drift_zerfaserung', p_run);
        PERFORM travel_audit(p_user, 'travel_recall', 'travel_run', p_run, NULL,
            jsonb_build_object('reason', v_run.checkpoint ->> 'recall',
                               'haul_lost', v_haul, 'attempted_to', p_to_node,
                               'scattered', COALESCE((v_scatter ->> 'scattered')::int, 0)));
        RETURN to_jsonb(v_run);
    END IF;

    -- Advance: position + counters + the spent window; rewrite the checkpoint carrying
    -- the accrued Vermessung haul + the visited set.
    UPDATE travel_runs SET
        position_node_id = p_to_node,
        bandbreite       = v_run.bandbreite,
        kohaerenz        = v_run.kohaerenz,
        dissonanz        = v_run.dissonanz,
        window_remaining = v_run.window_remaining,
        takt_count       = takt_count + 1,
        event_seq        = event_seq + 1,
        run_version      = run_version + 1,
        checkpoint       = jsonb_build_object(
            'position_node_id', p_to_node, 'haul', v_haul, 'visited', v_visited,
            'last_move', jsonb_build_object('from', v_run.position_node_id, 'bb_cost', v_bb_cost,
                                            'notfrequenz', v_notfreq, 'dz_add', v_dz_add,
                                            'surge', v_surge, 'survey', v_survey)
        )
    WHERE id = p_run
    RETURNING * INTO v_run;

    PERFORM travel_audit(p_user, 'travel_move', 'travel_run', p_run, NULL,
        jsonb_build_object('to_node', p_to_node, 'bb_cost', v_bb_cost, 'notfrequenz', v_notfreq,
                           'surge', v_surge, 'haul', v_haul, 'takt', v_run.takt_count));

    RETURN to_jsonb(v_run);
END;
$$;

-- Player-class posture re-asserted (CREATE OR REPLACE preserves the ACL; explicit for intent).
REVOKE ALL    ON FUNCTION public.fn_travel_move(uuid, uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_travel_move(uuid, uuid, integer, uuid) TO authenticated, service_role;
