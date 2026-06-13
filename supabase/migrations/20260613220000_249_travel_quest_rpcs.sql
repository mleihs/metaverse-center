-- Migration 249: DRIFT — travel_quest_rpcs (P0c deliver slice + the hospitality gate)
--
-- Spec: docs/plans/drift-implementation-plan.md §4 (RPC catalog: fn_quest_accept/
--       advance, fn_apply_quest_effects), §10 (effects & hospitality matrix — the
--       closed 9-effect vocabulary, P0 ships 4), §5 (two grant classes / ADR-006),
--       §19 P0c (acceptance gate C: accept → travel → deliver → effects applied).
-- Design contract: docs/concepts/drift-zwischenraum-travel-game-concept.md v0.4
--       §9.1 (Depeschen families), §11 (the closed effect vocabulary).
--
-- The first QUEST migration: the playable "deliver" Depesche loop end-to-end.
--   accept a Depesche at home  → fn_quest_accept  (instance + bound cargo)
--   drift to the target world  → (existing fn_travel_move)
--   deliver at its broadcast    → fn_quest_advance → fn_apply_quest_effects (gate)
-- Behind drift_p0_enabled=false (read by the backend before calling) — the RPCs
-- themselves stay callable so tests/smoke can exercise them.
--
-- ── The single hospitality gate (§10) ─────────────────────────────────────────
-- EVERY cross-sim world write funnels through fn_apply_quest_effects. It reads the
-- target sim's drift_hospitality (simulation_settings, fail-closed to 'geschlossen'
-- on an absent row), and per effect checks the matrix + caps before writing. This is
-- the authorization layer for cross-sim writes (a visitor is NOT a member of the
-- target sim, so user-JWT RLS cannot express the write — ADR finding 55). P0 ships
-- 4 of the 9 effects (§19 scope anchor):
--   * emit_fragment  (self) — the Träger's own journal_fragments. Hospitality-EXEMPT
--                             (always fires, every world incl. geschlossen) = KPI-2 floor.
--   * emit_echo             — a faint travel_echo event in the target sim. ≥ nur_echos
--                             (and never at home — no self-echo). The §19.4 floor channel.
--   * inject_agent_memory   — an agent_memories row on a target agent. Home (full) or
--                             standard/offen (importance ≤ 5).
--   * spawn_event           — an events row in the target sim. Home (full 1–10) or
--                             standard/offen (impact ≤ 3).
-- The default seeded hospitality is 'nur_echos' (migration 239), so out of the box a
-- delivery to a foreign world fires echo + fragment and CORRECTLY BLOCKS event +
-- memory — the gate visibly filtering. Raising the target to 'standard' opens all four.
-- chronicle_mention / grant_agent_effect / zone_modifier / propose_embassy / bond_event
-- are the deferred 5 (P0d+); the dispatch loop is generic over the effects array, so
-- each is one added CASE branch.
--
-- ── Exactly-once (§4) ─────────────────────────────────────────────────────────
-- fn_apply_quest_effects claims the instance with a guarded UPDATE
-- (SET effects_applied=true WHERE effects_applied=false) as its FIRST write; a second
-- call finds nothing and returns {already_applied:true}. Because the claim and the
-- effect writes share one transaction, any failure rolls the flag back — atomic
-- exactly-once with no orphaned "applied" flag.
--
-- ── Grant model (§4/§5 two classes; ADR-006 explicit revokes — 245 lesson) ──────
--   * PLAYER-class (fn_quest_accept, fn_quest_advance): GRANT authenticated; first
--     statement validates (SELECT auth.uid()) = p_user — called with the user's JWT,
--     never trusted from the param. The backend calls these via the user-JWT client
--     (the documented get_supabase exception — DriftService player RPCs).
--   * EFFECT-class (fn_apply_quest_effects): REVOKE anon + authenticated, GRANT
--     service_role only. Reached two ways: (a) INTERNALLY by fn_quest_advance — a
--     SECURITY DEFINER fn runs as its owner (postgres), which holds EXECUTE, so the
--     internal call succeeds though `authenticated` cannot call it directly; (b)
--     standalone by service_role for the P2 Zerfaserung scatter / P4 Spuren (same gate,
--     no second channel — findings 3/20).
-- Every mutating RPC: run_version CAS → RUN_STALE as ERRCODE P0001 (NOT 40001 — the
-- 246 PostgREST-retry trap), travel_audit(...) in-txn (travel_ namespace), telemetry
-- via the closed event_key set (239: drift_quest_completed).
--
-- ── P0c simplifications (documented; wired fuller later) ───────────────────────
-- One active quest per traveler (clean HUD; the convoy/multi-quest model is P4).
-- Entity selection is the first active agent per sim (the §9 selector DSL is P0c-later
-- content work — finding 6/11); KPI-1's ≥2-refs holds for the seeded worlds. Effect
-- prose is template text (drift_ai_enabled=false → no LLM; the dressing cache / façade
-- methods are P0c-later §9.4). Standalone fn_cargo_acquire/redeem (fetch/survey loot)
-- are deferred — deliver cargo is created/consumed inside accept/advance.
--
-- FK targets + landing tables exist: travel_quest_templates/instances/cargo (241),
-- agent_travel_effects/zone_modifiers (242, unused by the P0 four), events (003),
-- agent_memories (067, source_type 'travel' from 243), journal_fragments (232,
-- fragment_type 'journey' + source_type 'travel' from 243). Active-view refresh: none
-- (no agents/buildings/simulations/events COLUMN changes).


-- ═══════════════════════════════════════════════════════════════════
-- 1. Seed — the P0c "deliver" Depesche template(s)
-- ═══════════════════════════════════════════════════════════════════
-- Hand-seeded (the content/drift pack pipeline, plan §9.1, is not built). This
-- migration is the single source of truth for these rows until it lands. The
-- definition carries the cargo shape + the effect vocabulary the instance fires on
-- delivery; the LLM dresses only surface prose later. pack_slug groups the P0c seed.

INSERT INTO travel_quest_templates (template_key, family, tier, pack_slug, definition) VALUES
    ('deliver_memory_parcel', 'deliver', 1, 'drift_p0c_seed',
     jsonb_build_object(
        'cargo', jsonb_build_object('family', 'erinnerungsstuecke', 'vector', 'memory'),
        'effects', jsonb_build_array(
            jsonb_build_object('kind', 'emit_fragment'),
            jsonb_build_object('kind', 'emit_echo'),
            jsonb_build_object('kind', 'inject_agent_memory', 'importance', 4),
            jsonb_build_object('kind', 'spawn_event', 'impact_level', 3)
        ),
        'prose', jsonb_build_object(
            'title_de', 'Depesche · Erinnerungsstück',
            'title_en', 'Dispatch · Memory-Relic',
            'brief_de', 'Ein Erinnerungsstück will über den Drift getragen werden.',
            'brief_en', 'A memory-relic wants to be carried across the Drift.')
     ))
ON CONFLICT (template_key) DO UPDATE
    SET family = EXCLUDED.family, tier = EXCLUDED.tier,
        pack_slug = EXCLUDED.pack_slug, definition = EXCLUDED.definition;


-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_apply_quest_effects(instance, effects[]) — the single hospitality gate
-- ═══════════════════════════════════════════════════════════════════
-- EFFECT-class (service_role / internal). Claims the instance exactly-once, then for
-- each effect spec {kind, target_sim, target_agent?, impact_level?, importance?}
-- resolves the target sim's hospitality and writes the allowed ones to their landing
-- tables. Returns {applied:[…], skipped:[…]}.

CREATE OR REPLACE FUNCTION public.fn_apply_quest_effects(
    p_instance  UUID,
    p_effects   JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inst        travel_quest_instances%ROWTYPE;
    v_owner       UUID;
    v_anchor      UUID;
    v_effect      JSONB;
    v_kind        TEXT;
    v_target_sim  UUID;
    v_target_ag   UUID;
    v_hosp        TEXT;
    v_sim_name    TEXT;
    v_ag_name     TEXT;
    v_impact      INT;
    v_importance  INT;
    v_applied     JSONB := '[]'::jsonb;
    v_skipped     JSONB := '[]'::jsonb;
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

    v_owner := v_inst.owner_user_id;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = v_owner;

    FOR v_effect IN SELECT * FROM jsonb_array_elements(COALESCE(p_effects, '[]'::jsonb))
    LOOP
        v_kind       := v_effect ->> 'kind';
        v_target_sim := NULLIF(v_effect ->> 'target_sim', '')::uuid;
        v_target_ag  := NULLIF(v_effect ->> 'target_agent', '')::uuid;

        -- Self-effects are hospitality-exempt (they write the Träger's own journal).
        IF v_kind = 'emit_fragment' THEN
            INSERT INTO journal_fragments (user_id, simulation_id, fragment_type, source_type,
                                           content_de, content_en, thematic_tags, rarity)
            VALUES (v_owner, v_target_sim, 'journey', 'travel',
                    'Eine Depesche über den Drift abgeliefert. Das Erinnerungsstück hat die Schwelle überquert.',
                    'A dispatch delivered across the Drift. The memory-relic has crossed the threshold.',
                    '["travel","depesche"]'::jsonb, 'common');
            v_applied := v_applied || jsonb_build_object('kind', v_kind, 'target', 'self');
            PERFORM travel_audit(v_owner, 'travel_effect_fragment', 'travel_quest', p_instance,
                v_target_sim, jsonb_build_object('kind', v_kind));
            CONTINUE;
        END IF;

        -- Cross-sim effects: resolve hospitality (home = own anchor → full; else the
        -- per-sim setting, fail-closed to 'geschlossen' on an absent row).
        IF v_target_sim IS NULL THEN
            v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'no_target_sim');
            CONTINUE;
        END IF;
        IF v_target_sim = v_anchor THEN
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
                INSERT INTO events (simulation_id, title, event_type, description, impact_level, metadata)
                VALUES (v_target_sim,
                    'Echo aus dem Drift',
                    'travel_echo',
                    'Ein verklingendes Echo streift ' || COALESCE(v_sim_name, 'die Stadt') ||
                        ' — eine Depesche hat in der Nähe die Schwelle berührt.',
                    1,
                    jsonb_build_object('drift', TRUE, 'kind', 'emit_echo', 'quest_instance_id', p_instance));
                v_applied := v_applied || jsonb_build_object('kind', v_kind, 'target_sim', v_target_sim, 'hospitality', v_hosp);
                PERFORM travel_audit(v_owner, 'travel_effect_echo', 'simulation', v_target_sim,
                    v_target_sim, jsonb_build_object('kind', v_kind, 'hospitality', v_hosp, 'quest_instance_id', p_instance));
            ELSE
                v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'hospitality_' || v_hosp);
            END IF;

        ELSIF v_kind = 'inject_agent_memory' THEN
            -- Home (full) or standard/offen (importance ≤ 5).
            IF v_hosp = 'home' OR v_hosp IN ('standard', 'offen') THEN
                v_importance := COALESCE((v_effect ->> 'importance')::int, 4);
                IF v_hosp <> 'home' THEN v_importance := LEAST(v_importance, 5); END IF;
                IF v_target_ag IS NOT NULL THEN
                    SELECT name INTO v_ag_name FROM agents WHERE id = v_target_ag;
                    INSERT INTO agent_memories (agent_id, simulation_id, memory_type, content, importance, source_type)
                    VALUES (v_target_ag, v_target_sim, 'observation',
                        'Ein Träger brachte ein Erinnerungsstück über den Drift. ' ||
                            COALESCE(v_ag_name, 'Man') || ' wird sich an die Lieferung erinnern.',
                        v_importance, 'travel');
                    v_applied := v_applied || jsonb_build_object('kind', v_kind, 'target_agent', v_target_ag, 'hospitality', v_hosp, 'importance', v_importance);
                    PERFORM travel_audit(v_owner, 'travel_effect_memory', 'agent', v_target_ag,
                        v_target_sim, jsonb_build_object('kind', v_kind, 'hospitality', v_hosp, 'importance', v_importance, 'quest_instance_id', p_instance));
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
                    v_impact := LEAST(GREATEST(v_impact, 1), 10);
                ELSE
                    v_impact := LEAST(GREATEST(v_impact, 1), 3);
                END IF;
                INSERT INTO events (simulation_id, title, event_type, description, impact_level, metadata)
                VALUES (v_target_sim,
                    'Drift-Depesche eingetroffen',
                    'travel_dispatch',
                    'Ein Träger lieferte ein Erinnerungsstück aus dem Drift in ' ||
                        COALESCE(v_sim_name, 'der Stadt') || ' ab. Etwas Fremdes hat die Schwelle überquert.',
                    v_impact,
                    jsonb_build_object('drift', TRUE, 'kind', 'spawn_event', 'quest_instance_id', p_instance));
                v_applied := v_applied || jsonb_build_object('kind', v_kind, 'target_sim', v_target_sim, 'hospitality', v_hosp, 'impact_level', v_impact);
                PERFORM travel_audit(v_owner, 'travel_effect_event', 'simulation', v_target_sim,
                    v_target_sim, jsonb_build_object('kind', v_kind, 'hospitality', v_hosp, 'impact_level', v_impact, 'quest_instance_id', p_instance));
            ELSE
                v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'hospitality_' || v_hosp);
            END IF;

        ELSE
            -- Deferred effect kinds (chronicle_mention/grant_agent_effect/zone_modifier/
            -- propose_embassy/bond_event) — recorded as skipped until P0d+.
            v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'unsupported_p0c');
        END IF;
    END LOOP;

    RETURN jsonb_build_object('already_applied', FALSE, 'applied', v_applied, 'skipped', v_skipped);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 3. fn_quest_accept(user, run, run_version, template_key, target_sim) — take a Depesche
-- ═══════════════════════════════════════════════════════════════════
-- PLAYER-class. Instantiates a deliver Depesche against live rows and creates the bound
-- cargo on the run. The origin is the run's current sim (you accept where you stand);
-- the target is p_target_sim (must have a dockable broadcast edge on this chart). One
-- active quest per traveler in P0.

CREATE OR REPLACE FUNCTION public.fn_quest_accept(
    p_user          UUID,
    p_run           UUID,
    p_run_version   INT,
    p_template_key  TEXT,
    p_target_sim    UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run         travel_runs%ROWTYPE;
    v_tmpl        travel_quest_templates%ROWTYPE;
    v_origin_sim  UUID;
    v_target_node UUID;
    v_origin_ag   UUID;
    v_target_ag   UUID;
    v_cargo_fam   TEXT;
    v_cargo_vec   TEXT;
    v_refs        JSONB := '[]'::jsonb;
    v_inst        travel_quest_instances%ROWTYPE;
    v_cargo       travel_cargo%ROWTYPE;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_quest_accept: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_quest_accept: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status <> 'active' THEN
        RAISE EXCEPTION 'fn_quest_accept: run is %, not active', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;

    -- One active quest per traveler in P0 (clean HUD; multi-quest is P4).
    IF EXISTS (SELECT 1 FROM travel_quest_instances WHERE owner_user_id = p_user AND status = 'active') THEN
        RAISE EXCEPTION 'QUEST_ACTIVE' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_tmpl FROM travel_quest_templates WHERE template_key = p_template_key;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_quest_accept: unknown template %', p_template_key USING ERRCODE = 'P0002';
    END IF;
    IF v_tmpl.family <> 'deliver' THEN
        RAISE EXCEPTION 'fn_quest_accept: template % is %, only deliver is wired in P0c', p_template_key, v_tmpl.family
            USING ERRCODE = '22023';
    END IF;

    -- Origin = the sim of the node you stand on (accept at home: the home broadcast).
    SELECT simulation_id INTO v_origin_sim FROM drift_chart_nodes
     WHERE id = v_run.position_node_id AND chart_version = v_run.chart_version;
    IF v_origin_sim IS NULL THEN
        RAISE EXCEPTION 'fn_quest_accept: must accept a Depesche at a world edge (current node has no sim)'
            USING ERRCODE = '22023';
    END IF;
    IF p_target_sim = v_origin_sim THEN
        RAISE EXCEPTION 'fn_quest_accept: target sim must differ from the origin' USING ERRCODE = '22023';
    END IF;

    -- Target must have a dockable broadcast edge on this chart (so it can be delivered to).
    SELECT id INTO v_target_node FROM drift_chart_nodes
     WHERE chart_version = v_run.chart_version AND node_type = 'broadcast_rand' AND simulation_id = p_target_sim;
    IF v_target_node IS NULL THEN
        RAISE EXCEPTION 'fn_quest_accept: target sim % has no broadcast edge on the chart', p_target_sim
            USING ERRCODE = '22023';
    END IF;

    -- Resolve provenance agents (P0: first active agent per sim — the selector DSL is later).
    SELECT id INTO v_origin_ag FROM active_agents WHERE simulation_id = v_origin_sim LIMIT 1;
    SELECT id INTO v_target_ag FROM active_agents WHERE simulation_id = p_target_sim LIMIT 1;
    IF v_origin_ag IS NOT NULL THEN
        v_refs := v_refs || jsonb_build_object('kind', 'agent', 'id', v_origin_ag, 'sim', v_origin_sim);
    END IF;
    IF v_target_ag IS NOT NULL THEN
        v_refs := v_refs || jsonb_build_object('kind', 'agent', 'id', v_target_ag, 'sim', p_target_sim);
    END IF;

    v_cargo_fam := COALESCE(v_tmpl.definition #>> '{cargo,family}', 'erinnerungsstuecke');
    v_cargo_vec := COALESCE(v_tmpl.definition #>> '{cargo,vector}', 'memory');

    -- The instance belongs to the target sim (where effects land); slots carry the
    -- resolved deliver binds the gate + the advance check read.
    INSERT INTO travel_quest_instances (template_key, owner_user_id, simulation_id, status, entity_refs, slots)
    VALUES (p_template_key, p_user, p_target_sim, 'active', v_refs,
        jsonb_build_object('origin_sim', v_origin_sim, 'origin_agent', v_origin_ag,
                           'target_sim', p_target_sim, 'target_agent', v_target_ag,
                           'target_node', v_target_node))
    RETURNING * INTO v_inst;

    -- The bound cargo rides the run (run_id) so Rückzug forfeits it; quest_instance_id
    -- ties it to the Depesche; origin_agent_id keeps its papers (KPI-1 provenance).
    INSERT INTO travel_cargo (owner_user_id, run_id, family, vector, origin_agent_id, quest_instance_id, manifest_slot)
    VALUES (p_user, p_run, v_cargo_fam, v_cargo_vec, v_origin_ag, v_inst.id, 0)
    RETURNING * INTO v_cargo;

    -- Accepting a Depesche is a run event (cargo changed) — bump version so a second
    -- client refetches, and advance the event stream.
    UPDATE travel_runs
       SET run_version = run_version + 1, event_seq = event_seq + 1
     WHERE id = p_run
     RETURNING * INTO v_run;

    PERFORM travel_audit(p_user, 'travel_quest_accept', 'travel_quest', v_inst.id, p_target_sim,
        jsonb_build_object('template_key', p_template_key, 'cargo_id', v_cargo.id,
                           'origin_sim', v_origin_sim, 'target_sim', p_target_sim));

    RETURN jsonb_build_object('run', to_jsonb(v_run), 'instance', to_jsonb(v_inst), 'cargo', to_jsonb(v_cargo));
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 4. fn_quest_advance(user, run, run_version, instance) — deliver at the target
-- ═══════════════════════════════════════════════════════════════════
-- PLAYER-class. Completes a deliver Depesche: validates you stand on the target sim's
-- broadcast edge with the bound cargo, fires the effects through the gate (internal
-- DEFINER call), consumes the cargo, closes the instance.

CREATE OR REPLACE FUNCTION public.fn_quest_advance(
    p_user          UUID,
    p_run           UUID,
    p_run_version   INT,
    p_instance      UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run         travel_runs%ROWTYPE;
    v_inst        travel_quest_instances%ROWTYPE;
    v_tmpl        travel_quest_templates%ROWTYPE;
    v_target_node UUID;
    v_target_sim  UUID;
    v_target_ag   UUID;
    v_cargo_id    UUID;
    v_effects_in  JSONB := '[]'::jsonb;
    v_effect      JSONB;
    v_resolved    JSONB;
    v_result      JSONB;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_quest_advance: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_quest_advance: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status <> 'active' THEN
        RAISE EXCEPTION 'fn_quest_advance: run is %, not active', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_inst FROM travel_quest_instances WHERE id = p_instance AND owner_user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_quest_advance: quest instance not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_inst.status <> 'active' THEN
        RAISE EXCEPTION 'fn_quest_advance: quest is %, not active', v_inst.status USING ERRCODE = '22023';
    END IF;

    v_target_node := NULLIF(v_inst.slots #>> '{target_node}', '')::uuid;
    v_target_sim  := NULLIF(v_inst.slots #>> '{target_sim}', '')::uuid;
    v_target_ag   := NULLIF(v_inst.slots #>> '{target_agent}', '')::uuid;

    -- Must stand on the target world's broadcast edge to deliver.
    IF v_run.position_node_id IS DISTINCT FROM v_target_node THEN
        RAISE EXCEPTION 'NOT_AT_TARGET' USING ERRCODE = '22023';
    END IF;

    -- The bound cargo must still be aboard.
    SELECT id INTO v_cargo_id FROM travel_cargo
     WHERE quest_instance_id = p_instance AND owner_user_id = p_user AND run_id = p_run
     LIMIT 1;
    IF v_cargo_id IS NULL THEN
        RAISE EXCEPTION 'CARGO_MISSING' USING ERRCODE = '22023';
    END IF;

    -- Build the effect specs from the template vocabulary, binding each cross-sim effect
    -- to the resolved target sim/agent. emit_fragment (self) carries the target sim only
    -- (for the journal's simulation_id), no agent.
    SELECT * INTO v_tmpl FROM travel_quest_templates WHERE template_key = v_inst.template_key;
    FOR v_effect IN SELECT * FROM jsonb_array_elements(COALESCE(v_tmpl.definition -> 'effects', '[]'::jsonb))
    LOOP
        v_resolved := v_effect || jsonb_build_object('target_sim', v_target_sim);
        IF (v_effect ->> 'kind') = 'inject_agent_memory' THEN
            v_resolved := v_resolved || jsonb_build_object('target_agent', v_target_ag);
        END IF;
        v_effects_in := v_effects_in || v_resolved;
    END LOOP;

    -- Fire through the single gate (internal DEFINER call — runs as owner/postgres,
    -- which holds EXECUTE though `authenticated` does not). Exactly-once inside.
    v_result := fn_apply_quest_effects(p_instance, v_effects_in);

    -- Consume the delivered cargo + close the instance.
    DELETE FROM travel_cargo WHERE id = v_cargo_id;
    UPDATE travel_quest_instances SET status = 'completed' WHERE id = p_instance RETURNING * INTO v_inst;

    UPDATE travel_runs
       SET run_version = run_version + 1, event_seq = event_seq + 1,
           checkpoint = v_run.checkpoint || jsonb_build_object('last_delivery',
               jsonb_build_object('instance', p_instance, 'target_sim', v_target_sim))
     WHERE id = p_run
     RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
    VALUES (p_user, 'drift_quest_completed', p_run,
        jsonb_build_object('instance', p_instance, 'template_key', v_inst.template_key, 'family', 'deliver'));
    PERFORM travel_audit(p_user, 'travel_quest_advance', 'travel_quest', p_instance, v_target_sim,
        jsonb_build_object('delivered', TRUE, 'effects', v_result));

    RETURN jsonb_build_object('run', to_jsonb(v_run), 'instance', to_jsonb(v_inst), 'effects', v_result);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 5. Grants (§4/§5 two classes; ADR-006 explicit revokes — 245 lesson)
-- ═══════════════════════════════════════════════════════════════════

-- Player-class: callable by authenticated (the in-function auth.uid() guard authorizes);
-- not anon.
DO $$
DECLARE sig TEXT;
BEGIN
    FOREACH sig IN ARRAY ARRAY[
        'fn_quest_accept(uuid, uuid, integer, text, uuid)',
        'fn_quest_advance(uuid, uuid, integer, uuid)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', sig);
    END LOOP;
END $$;

-- Effect-class: service_role only (explicit anon + authenticated revoke). Reached
-- internally by fn_quest_advance (DEFINER, runs as owner) and standalone by the backend
-- for P2 scatter / P4 traces.
REVOKE ALL    ON FUNCTION public.fn_apply_quest_effects(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_apply_quest_effects(uuid, jsonb) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 6. Function comments
-- ═══════════════════════════════════════════════════════════════════

COMMENT ON FUNCTION public.fn_apply_quest_effects(uuid, jsonb) IS
    'The single DRIFT hospitality gate (plan §10). Claims the instance exactly-once (guarded effects_applied CAS), then per effect spec resolves the target sim hospitality (home=own anchor=full; else simulation_settings drift_hospitality, fail-closed geschlossen) and writes the allowed ones to their landing tables. P0 vocabulary (4 of 9): emit_fragment (self, always → journal_fragments), emit_echo (≥nur_echos → faint travel_echo event), inject_agent_memory (home/standard/offen, importance≤5 off-home → agent_memories), spawn_event (home full / standard/offen ≤3 → events). EFFECT-class: REVOKE anon+authenticated, GRANT service_role; reached internally by fn_quest_advance (DEFINER) and standalone by the backend (P2 scatter / P4 traces — same gate). Audits each applied effect.';

COMMENT ON FUNCTION public.fn_quest_accept(uuid, uuid, integer, text, uuid) IS
    'Take a deliver Depesche (plan §4). PLAYER-class (auth.uid()=p_user guard; run_version CAS). Instantiates the template against live rows (origin = the run''s current sim, target = p_target_sim which must have a broadcast edge on the chart), resolves provenance agents (P0: first active agent per sim), creates the quest instance + the bound cargo (run_id set so Rückzug forfeits it). One active quest per traveler in P0. Bumps run_version (cargo changed). Audited.';

COMMENT ON FUNCTION public.fn_quest_advance(uuid, uuid, integer, uuid) IS
    'Deliver a Depesche at the target (plan §4). PLAYER-class (auth.uid()=p_user guard; run_version CAS). Validates the run stands on the target sim''s broadcast edge with the bound cargo, builds the effect specs from the template vocabulary + resolved slots, fires them through fn_apply_quest_effects (internal DEFINER call, exactly-once), consumes the cargo, closes the instance. Telemetry drift_quest_completed; audited.';
