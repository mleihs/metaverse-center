-- Migration 268: DRIFT Fun-Kern — travel_sondierung (M2: push your luck, and bank it)
--
-- Plan: docs/plans/drift-fun-core-implementation-plan.md §4 (Welle 2, Schritt 2.3).
-- Concept: drift-gameplay-redesign-concept.md — M2 (Sondierung + Funkboje), R4 (the odds
--          are never numbered; the markers are COUNTABLE), F5 (a bust that feels good).
--
-- The survey economy in P0 pays once per node, on first arrival, and never again. There is
-- nothing to push and nothing to lose — a run is a route, not a gamble. Sondierung is the
-- overdrive: dig the node you are standing on, again and again, for a rising yield, and
-- watch the marker stack you are building. Three of a kind and the node tears open.
--
-- ── The two decisions this file adds ─────────────────────────────────────────
--   "One more dig?"      — the yield rises (2, 3, 5, 8 …); so does the stack.
--   "Bank it, or carry?" — the Funkboje transmits 70 % of the loose haul to safety.
--                          The other 30 % is what the gamble costs; carrying it all home
--                          pays 100 %, IF you get home.
--
-- Both are decisions the traveller makes with FULL information about the state and NO
-- information about the odds: the markers are open and countable (R4). Nobody is ever
-- shown a percentage.
--
-- ── Two premises of the plan that the database did not support ───────────────
--   (a) The plan banks the Funkboje at `relais` nodes ("the P0 graph already has one").
--       It does not: the active chart is 41 interstitial + 7 broadcast_rand, zero relais
--       (relais arrives with chart v3 in W3). So the node gate is a TUNING LIST
--       (funkboje_node_types = ["relais", "broadcast_rand"]) — it works today at the
--       worlds' broadcast edges, which is the better fiction anyway (you bank a haul by
--       TRANSMITTING it from a world that has a receiver), and `relais` joins the list
--       the moment W3 puts one on the map, with no code change.
--   (b) The plan adds a `haul_banked` column. Two problems: the haul itself is not a
--       column (it lives in checkpoint.haul, and every path — move, Havarie, bank — reads
--       it there), and `checkpoint.haul_banked` is ALREADY TAKEN: fn_travel_bank_run (265)
--       writes it as the CLOSING RECEIPT of a completed run. Reusing the name for the
--       in-flight safe half would have made the receipt and the reserve the same key with
--       two meanings. The in-flight reserve is therefore `checkpoint.haul_safe`, and the
--       carry whitelist (267) is corrected below — it had pre-registered the wrong name.
--
-- Gate off ⇒ nothing here can be reached (both RPCs are gate-checked; a run cannot hold
-- Sondierung state without the gate having been open).

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. Tuning
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO drift_tuning (setting_key, value, description) VALUES
('sondierung_yields',
 '[2, 3, 5, 8]'::jsonb,
 'Vermessung per dig at the SAME node, by how often it has already been dug. Rising, and the last entry repeats forever — the limiter is the bust, not the table. The first dig is worth less than a fresh node in the deep (survey_value_by_band); digging is not a substitute for travelling, it is what you do when travelling further would cost more than it pays.'),
('sondierung_marker_classes',
 '["resonanz", "statik", "echo"]'::jsonb,
 'The three marker classes a dig can turn up. Drawn deterministically from the salted seed and laid OPEN on the node — the traveller can always count the stack (R4: the odds are never numbered, the evidence always is).'),
('sondierung_bust_rule',
 '{"same_class_count": 3}'::jsonb,
 'Three markers of one class at a node and it tears (Resonanzriss). Note that a Störung signal can add a marker too (marker_add) — so the Drift can poison a dig site you were counting on, and a stack you did not build can still be the one that busts.'),
('sondierung_riss',
 '{"dz": 6}'::jsonb,
 'What a Resonanzriss costs: the loose yield dug at THIS node is gone (banked haul is not — that is what banking is FOR), the Dissonanz jumps, and the node is marked `rissig` for the rest of the run.'),
('sondierung_rissig_stoerung_bonus',
 '15'::jsonb,
 'Extra Störung weight in the signal draw while standing on a torn node. The Drift comes through a Riss — a bust does not just cost you the yield, it changes the place.'),
('funkboje_rate',
 '0.7'::jsonb,
 'The Funkboje''s exchange rate: transmit the loose haul from a dock and 70 % of it is safe from anything that happens afterwards (Havarie, Zerfaserung, a bad dig). The missing 30 % is the price of certainty. Carrying it home pays 100 % — if you get home.'),
('funkboje_node_types',
 '["relais", "broadcast_rand"]'::jsonb,
 'Where a haul can be transmitted. The plan said `relais`; the active chart has none (they arrive with chart v3 in W3), so the broadcast edges of the worlds carry the Funkboje today — and keep carrying it when the relays land, with no code change.')
ON CONFLICT (setting_key) DO NOTHING;


-- The checkpoint carry list (drift_checkpoint_carry, 267) already names `haul_safe` and
-- `sondierung` — the run-level keys this migration writes. It is NOT redefined here on
-- purpose: two migrations owning one function means re-applying the earlier one silently
-- reverts the later one (measured — three tests went red exactly that way).


-- ═══════════════════════════════════════════════════════════════════
-- 3. fn_sondieren — one more dig (PLAYER-class)
-- ═══════════════════════════════════════════════════════════════════
-- One Takt. A rising yield. An open marker. And, on the third of a kind, a Riss.
--
-- The bust is not a punishment screen: what it takes is the LOOSE yield of this node —
-- never the banked reserve, never the manifest, never the run. That asymmetry is what
-- makes the Funkboje a real decision instead of a formality (concept F5: a bust that
-- feels good is one you can see coming and chose to risk anyway).

CREATE OR REPLACE FUNCTION public.fn_sondieren(
    p_user        UUID,
    p_run         UUID,
    p_run_version INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run       travel_runs%ROWTYPE;
    v_node      TEXT;
    v_sond      JSONB;
    v_at_node   JSONB;
    v_digs      INT;
    v_yields    JSONB;
    v_yield     INT;
    v_classes   JSONB;
    v_marker    TEXT;
    v_markers   JSONB;
    v_stack     JSONB;
    v_same      INT;
    v_bust_at   INT;
    v_bust      BOOLEAN := FALSE;
    v_riss      JSONB;
    v_node_yld  INT;
    v_haul      INT;
    v_dz_cap    INT;
    v_salt      TEXT;
    v_anchor    UUID;
    v_home      UUID;
    v_cause     TEXT;
    v_overstay  BOOLEAN;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_sondieren: caller is not the run owner' USING ERRCODE = '42501';
    END IF;
    IF NOT drift_gate_enabled('drift_fun_core_enabled') THEN
        RAISE EXCEPTION 'GATE_CLOSED' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_sondieren: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status <> 'active' THEN
        RAISE EXCEPTION 'fn_sondieren: run is %, not active', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;
    -- A scene the traveller has not answered blocks the shovel too (same rule as the move:
    -- a Störung is a decision, and you do not get to dig your way past it).
    IF v_run.checkpoint ? 'pending_signal' THEN
        RAISE EXCEPTION 'SIGNAL_PENDING' USING ERRCODE = '22023';
    END IF;
    IF v_run.window_remaining < 1 THEN
        RAISE EXCEPTION 'WINDOW_EMPTY' USING ERRCODE = '22023';
    END IF;
    IF v_run.position_node_id IS NULL THEN
        RAISE EXCEPTION 'NOT_ON_A_NODE' USING ERRCODE = '22023';
    END IF;

    v_node    := v_run.position_node_id::text;
    v_sond    := COALESCE(v_run.checkpoint -> 'sondierung', '{}'::jsonb);
    v_at_node := COALESCE(v_sond -> v_node, '{}'::jsonb);
    v_digs    := COALESCE((v_at_node ->> 'digs')::int, 0);

    -- The yield of THIS dig: the table, with the last entry repeating (the limiter is the
    -- bust, not the table running out).
    v_yields := drift_tuning_value('sondierung_yields');
    v_yield  := COALESCE(
        (v_yields ->> LEAST(v_digs, jsonb_array_length(v_yields) - 1))::int, 2);

    -- The marker: salted, so the stack cannot be read ahead (264 — an unsalted draw would
    -- let the traveller dig exactly up to the bust and stop, which is not a gamble).
    v_salt    := drift_run_salt(p_run);
    v_classes := drift_tuning_value('sondierung_marker_classes');
    v_marker  := v_classes ->> drift_rand_int(
        v_salt || ':' || p_run::text || ':sond:' || v_node || ':' || v_digs::text,
        0, jsonb_array_length(v_classes) - 1);

    v_markers := COALESCE(v_run.checkpoint -> 'markers', '{}'::jsonb);
    v_stack   := COALESCE(v_markers -> v_node, '[]'::jsonb) || to_jsonb(v_marker);
    v_markers := v_markers || jsonb_build_object(v_node, v_stack);

    -- Three of a kind. The count is over the WHOLE stack at this node, so a marker a
    -- Störung left here (signal deltas: marker_add) counts too — the Drift can poison a
    -- dig site, and the stack that busts is not always the one you built.
    SELECT count(*) INTO v_same
      FROM jsonb_array_elements_text(v_stack) m WHERE m = v_marker;
    v_bust_at := COALESCE((drift_tuning_value('sondierung_bust_rule')
                           ->> 'same_class_count')::int, 3);
    v_bust    := v_same >= v_bust_at;

    v_haul    := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);
    v_node_yld := COALESCE((v_at_node ->> 'yield')::int, 0);
    v_dz_cap  := COALESCE((drift_tuning_value('dz_p0_cap'))::int, 20);

    IF v_bust THEN
        -- RESONANZRISS. The loose yield dug HERE is gone — not the banked reserve (that is
        -- what the Funkboje is for), not the manifest, not the run.
        v_riss := drift_tuning_value('sondierung_riss');
        v_haul := GREATEST(0, v_haul - v_node_yld);
        v_at_node := v_at_node || jsonb_build_object(
            'digs', v_digs + 1, 'yield', 0, 'rissig', TRUE);
        v_run.dissonanz := LEAST(v_dz_cap,
            v_run.dissonanz + COALESCE((v_riss ->> 'dz')::int, 6));
    ELSE
        v_haul := v_haul + v_yield;
        v_at_node := v_at_node || jsonb_build_object(
            'digs', v_digs + 1, 'yield', v_node_yld + v_yield);
    END IF;

    v_sond := v_sond || jsonb_build_object(v_node, v_at_node);

    UPDATE travel_runs SET
        window_remaining = GREATEST(0, window_remaining - 1),
        takt_count       = takt_count + 1,
        dissonanz        = v_run.dissonanz,
        event_seq        = event_seq + 1,
        run_version      = run_version + 1,
        checkpoint       = checkpoint || jsonb_build_object(
            'haul', v_haul,
            'markers', v_markers,
            'sondierung', v_sond,
            'last_sondierung', jsonb_build_object(
                'node_id', v_run.position_node_id,
                'dig',     v_digs + 1,
                'marker',  v_marker,
                'stack',   v_stack,
                'yield',   CASE WHEN v_bust THEN 0 ELSE v_yield END,
                'bust',    v_bust,
                'forfeited', CASE WHEN v_bust THEN v_node_yld ELSE 0 END))
     WHERE id = p_run
    RETURNING * INTO v_run;

    INSERT INTO travel_log_entries (user_id, run_id, takt, kind, node_id, payload)
    VALUES (p_user, p_run, v_run.takt_count, 'sondierung', v_run.position_node_id,
            jsonb_build_object('dig', v_digs + 1, 'marker', v_marker, 'bust', v_bust,
                               'yield', CASE WHEN v_bust THEN 0 ELSE v_yield END,
                               'forfeited', CASE WHEN v_bust THEN v_node_yld ELSE 0 END));
    INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
    VALUES (p_user, 'drift_sondierung', p_run,
            jsonb_build_object('dig', v_digs + 1, 'marker', v_marker, 'bust', v_bust,
                               'yield', CASE WHEN v_bust THEN 0 ELSE v_yield END));
    PERFORM travel_audit(p_user, 'travel_sondierung', 'travel_run', p_run, NULL,
        jsonb_build_object('node', v_node, 'dig', v_digs + 1, 'marker', v_marker,
                           'bust', v_bust, 'haul', v_haul));

    -- The Takt this dig cost was the last one, and it was not spent at home: the same
    -- floor a move would have hit. Digging is travelling — it spends the same window.
    v_overstay := COALESCE((v_run.checkpoint ->> 'overstay')::boolean, FALSE);
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;

    IF v_run.window_remaining <= 0
       AND NOT v_overstay
       AND v_run.position_node_id IS DISTINCT FROM v_home THEN
        v_cause := 'window';
        UPDATE travel_runs SET
            status      = 'havarie',
            event_seq   = event_seq + 1,
            run_version = run_version + 1,
            checkpoint  = checkpoint || jsonb_build_object(
                'havarie', drift_havarie_payload(p_run, v_cause, v_haul, 0))
         WHERE id = p_run
        RETURNING * INTO v_run;

        INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
        VALUES (p_user, 'drift_decision', p_run,
                jsonb_build_object('kind', 'havarie_opened', 'cause', v_cause,
                                   'from_sondierung', TRUE));
        PERFORM travel_audit(p_user, 'travel_havarie_open', 'travel_run', p_run, NULL,
            jsonb_build_object('cause', v_cause, 'haul_at_risk', v_haul,
                               'from_sondierung', TRUE));
    END IF;

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_sondieren(UUID, UUID, INT) IS
    'Dig the node you are standing on (M2). PLAYER-class (auth.uid() guard, run_version CAS, gate-checked). One Takt; the yield rises with every dig at the SAME node (sondierung_yields, last entry repeats); the marker is drawn from the salted seed (drift_run_salt — an unsalted stack could be read ahead, and a gamble you can read ahead is arithmetic) and laid OPEN on the node so the traveller can always count it (R4). Three markers of one class at that node and it tears: the LOOSE yield dug there is forfeit (never the banked reserve, never the manifest, never the run — that asymmetry is what makes the Funkboje a decision), Dissonanz jumps, and the node stays `rissig` (the signal draw sends more Störungen through the tear). A Störung''s own marker_add counts towards the stack, so the Drift can poison a dig site. Spending the last Takt away from home opens a Havarie, exactly as a move would — digging IS travelling.';

REVOKE ALL    ON FUNCTION public.fn_sondieren(UUID, UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_sondieren(UUID, UUID, INT) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 4. fn_funkboje_bank — 70 % of it, safe from everything (PLAYER-class)
-- ═══════════════════════════════════════════════════════════════════
-- The other half of the push-your-luck. Banking at HOME is refused: there the Entladung
-- pays 100 %, so a bank could only ever lose the traveller money — a dead option is worse
-- than no option (the W1 rule, third application).

CREATE OR REPLACE FUNCTION public.fn_funkboje_bank(
    p_user        UUID,
    p_run         UUID,
    p_run_version INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run      travel_runs%ROWTYPE;
    v_type     TEXT;
    v_sim      UUID;
    v_anchor   UUID;
    v_types    JSONB;
    v_rate     NUMERIC;
    v_loose    INT;
    v_safe     INT;
    v_total    INT;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_funkboje_bank: caller is not the run owner' USING ERRCODE = '42501';
    END IF;
    IF NOT drift_gate_enabled('drift_fun_core_enabled') THEN
        RAISE EXCEPTION 'GATE_CLOSED' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_funkboje_bank: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status <> 'active' THEN
        RAISE EXCEPTION 'fn_funkboje_bank: run is %, not active', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;
    IF v_run.checkpoint ? 'pending_signal' THEN
        RAISE EXCEPTION 'SIGNAL_PENDING' USING ERRCODE = '22023';
    END IF;

    SELECT node_type, simulation_id INTO v_type, v_sim
      FROM drift_chart_nodes WHERE id = v_run.position_node_id;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;

    v_types := drift_tuning_value('funkboje_node_types');
    IF v_type IS NULL OR NOT (v_types @> to_jsonb(v_type)) THEN
        RAISE EXCEPTION 'NO_TRANSMITTER' USING ERRCODE = '22023';
    END IF;
    -- At home the Entladung pays in full; banking here could only ever cost the traveller
    -- 30 % of their own haul. Refuse it rather than offer it.
    IF v_sim IS NOT DISTINCT FROM v_anchor THEN
        RAISE EXCEPTION 'AT_HOME' USING ERRCODE = '22023';
    END IF;

    v_loose := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);
    IF v_loose <= 0 THEN
        RAISE EXCEPTION 'NOTHING_TO_BANK' USING ERRCODE = '22023';
    END IF;

    v_rate  := COALESCE((drift_tuning_value('funkboje_rate'))::numeric, 0.7);
    v_safe  := floor(v_loose * v_rate)::int;   -- floor: the Bureau never rounds your way
    v_total := COALESCE((v_run.checkpoint ->> 'haul_safe')::int, 0) + v_safe;

    UPDATE travel_runs SET
        event_seq   = event_seq + 1,
        run_version = run_version + 1,
        checkpoint  = checkpoint || jsonb_build_object(
            'haul', 0,
            'haul_safe', v_total,
            'last_bank', jsonb_build_object('loose', v_loose, 'safe', v_safe,
                                            'rate', v_rate, 'haul_safe', v_total))
     WHERE id = p_run
    RETURNING * INTO v_run;

    INSERT INTO travel_log_entries (user_id, run_id, takt, kind, node_id, payload)
    VALUES (p_user, p_run, v_run.takt_count, 'bank', v_run.position_node_id,
            jsonb_build_object('loose', v_loose, 'safe', v_safe, 'haul_safe', v_total));
    INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
    VALUES (p_user, 'drift_bank', p_run,
            jsonb_build_object('loose', v_loose, 'safe', v_safe, 'haul_safe', v_total));
    PERFORM travel_audit(p_user, 'travel_bank', 'travel_run', p_run, NULL,
        jsonb_build_object('loose', v_loose, 'safe', v_safe, 'haul_safe', v_total));

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_funkboje_bank(UUID, UUID, INT) IS
    'Transmit the loose haul from a dock (M2). PLAYER-class (auth.uid() guard, CAS, gate-checked). floor(haul × funkboje_rate) moves into checkpoint.haul_safe, which nothing afterwards can take — not a Havarie, not a Resonanzriss, not even a Zerfaserung (fn_travel_zerfasern pays it). The missing 30 % is the price of certainty; carrying it home pays 100 %, IF you get home. Refused at the anchor world (AT_HOME): the Entladung pays in full there, so banking could only ever lose the traveller money, and a dead option is worse than no option. Node gate is drift_tuning.funkboje_node_types — broadcast edges today, `relais` the moment chart v3 puts one on the map.';

REVOKE ALL    ON FUNCTION public.fn_funkboje_bank(UUID, UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_funkboje_bank(UUID, UUID, INT) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 5. fn_travel_bank_run — the reserve pays, and the multiplier never touches it
-- ═══════════════════════════════════════════════════════════════════
-- 265's body, with the haul split folded in: the loose half takes the recall multiplier
-- (1.0 Entladung, 0.7 Rückruf), the transmitted half is already ashore and takes nothing.
-- That is the whole promise of the Funkboje, and it has to hold on EVERY closing path.

CREATE OR REPLACE FUNCTION public.fn_travel_bank_run(
    p_user      UUID,
    p_run       UUID,
    p_haul_mult NUMERIC,
    p_source    TEXT      -- 'entladung' | 'rueckruf'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run        travel_runs%ROWTYPE;
    v_anchor     UUID;
    v_haul_raw   INT;
    v_haul_safe  INT;
    v_haul       INT;
    v_visited    JSONB;
    v_keys       TEXT[];
    v_survey     JSONB;
    v_fun_core   BOOLEAN;
    v_honors     INT := 0;
    v_erstv      JSONB;
    v_siegel     INT := 0;
    v_vp         INT := 0;
    v_earnings   JSONB;
    v_checkpoint JSONB;
BEGIN
    SELECT * INTO v_run FROM travel_runs WHERE id = p_run;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;

    -- The loose haul takes the multiplier (floor — the Bureau never rounds in the
    -- traveller's favour). The transmitted reserve does not: it is already ashore.
    v_haul_raw  := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);
    v_haul_safe := COALESCE((v_run.checkpoint ->> 'haul_safe')::int, 0);
    v_haul      := floor(v_haul_raw * p_haul_mult)::int + v_haul_safe;

    -- Lodge into the lifetime survey stat (the P0 counter).
    UPDATE traveler_profiles
       SET qualities = jsonb_set(qualities, '{vermessung_lodged}',
             to_jsonb(COALESCE((qualities ->> 'vermessung_lodged')::int, 0) + v_haul))
     WHERE user_id = p_user;

    -- Deliver every FIRST-arrival node of this run to the shared chart + claim the
    -- Erstvermessung honors first-write-wins (253). Honors are NOT scaled by the
    -- multiplier: you either charted the node or you did not.
    v_visited := COALESCE(v_run.checkpoint -> 'visited', '[]'::jsonb);
    SELECT array_agg(n.stable_key)
      INTO v_keys
      FROM drift_chart_nodes n
     WHERE n.chart_version = v_run.chart_version
       AND n.id::text IN (SELECT jsonb_array_elements_text(v_visited))
       AND n.simulation_id IS DISTINCT FROM v_anchor;
    v_survey := fn_survey_deliver(p_user, COALESCE(v_keys, ARRAY[]::text[]), v_run.chart_version);

    -- Close out any Depesche still aboard (delivered cargo was consumed at delivery, so
    -- whatever is left is undelivered → its instance must not stay 'active' on a closed
    -- run, or the next fn_quest_accept hits QUEST_ACTIVE forever — the 256 lockout).
    UPDATE travel_quest_instances qi
       SET status = 'failed'
      FROM travel_cargo c
     WHERE c.run_id = p_run AND c.quest_instance_id = qi.id AND qi.status = 'active';
    DELETE FROM travel_cargo WHERE run_id = p_run;

    -- Fun-Kern: the haul and the honors pay (264).
    v_fun_core := drift_gate_enabled('drift_fun_core_enabled');
    IF v_fun_core THEN
        v_honors := COALESCE((v_survey ->> 'honors_won')::int, 0);
        v_erstv  := drift_tuning_value('reward_erstvermessung');
        v_vp     := v_haul * COALESCE((drift_tuning_value('reward_survey_vp_per_haul'))::int, 1)
                    + v_honors * COALESCE((v_erstv ->> 'vp')::int, 25);
        v_siegel := floor(v_haul * COALESCE((drift_tuning_value('reward_survey_siegel_ratio'))::numeric, 0.5))::int
                    + v_honors * COALESCE((v_erstv ->> 'siegel')::int, 40);
        v_earnings := fn_drift_award(p_user, p_source, v_siegel, v_vp, p_run);
    END IF;

    v_checkpoint := jsonb_build_object(
        'haul_banked', v_haul,               -- the CLOSING RECEIPT (not the in-flight reserve)
        'surveys_delivered', v_survey -> 'surveys_delivered',
        'honors_won', v_survey -> 'honors_won',
        'honor_keys', v_survey -> 'honor_keys');
    -- A recalled run says so, and says what the recall cost — the receipt must never
    -- present a 70 % haul as if it were the full one.
    IF p_source <> 'entladung' THEN
        v_checkpoint := v_checkpoint || jsonb_build_object(
            'close_reason', p_source, 'haul_before', v_haul_raw, 'haul_mult', p_haul_mult);
    END IF;
    -- `haul_transmitted` is a Fun-Kern fact and lives behind the gate with the rest of
    -- them. With the gate closed the closing checkpoint must be the exact migration-256
    -- key set — the rollback contract is byte parity, not "almost P0" (the W1 economy
    -- suite pins the key set precisely because a stray key is how parity rots).
    IF v_fun_core THEN
        v_checkpoint := v_checkpoint || jsonb_build_object(
            'earnings', v_earnings,
            'haul_transmitted', v_haul_safe);
    END IF;

    UPDATE travel_runs
       SET status = 'completed', closed_at = now(), run_version = run_version + 1,
           checkpoint = v_checkpoint
     WHERE id = p_run
     RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
    VALUES (p_user, 'drift_run_closed', p_run);
    PERFORM travel_audit(p_user, 'travel_complete', 'travel_run', p_run, NULL,
        jsonb_build_object('takt_count', v_run.takt_count, 'haul_banked', v_haul,
                           'haul_transmitted', v_haul_safe,
                           'source', p_source, 'honors_won', v_survey -> 'honors_won'));

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_travel_bank_run(UUID, UUID, NUMERIC, TEXT) IS
    'The single banking path for a DRIFT run (265, extended in 268). The LOOSE haul takes the multiplier (1.0 Entladung, 0.7 Havarie-Rückruf); the Funkboje reserve (checkpoint.haul_safe) does not — it is already ashore, and that promise has to hold on every closing path. Delivers the surveyed nodes + claims Erstvermessung honors (honors are never scaled: you charted the node or you did not), fails/forfeits any Depesche still aboard, pays via fn_drift_award when the gate is open, closes the run. NOTE the two similar keys: checkpoint.haul_safe is the IN-FLIGHT reserve; checkpoint.haul_banked is the CLOSING RECEIPT written here. INTERNAL-class.';

REVOKE ALL    ON FUNCTION public.fn_travel_bank_run(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_travel_bank_run(UUID, UUID, NUMERIC, TEXT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 6. fn_travel_zerfasern — what was transmitted, arrives
-- ═══════════════════════════════════════════════════════════════════
-- 265's body, plus the one line that gives the Funkboje its meaning: an unravelling
-- forfeits the LOOSE haul, and pays the reserve. If a Zerfaserung swallowed the banked
-- half too, banking would only ever have been a hedge against a recall multiplier — a
-- rounding decision, not a gamble. What you sent home, arrived. That is the whole point.

CREATE OR REPLACE FUNCTION public.fn_travel_zerfasern(
    p_user   UUID,
    p_run    UUID,
    p_reason TEXT      -- 'choice' | 'ttl_expired' | 'gate_closed'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run       travel_runs%ROWTYPE;
    v_anchor    UUID;
    v_home      UUID;
    v_haul      INT;
    v_safe      INT;
    v_scatter   JSONB;
    v_fun_core  BOOLEAN;
    v_earnings  JSONB := NULL;
    v_siegel    INT := 0;
    v_vp        INT := 0;
BEGIN
    -- FOR UPDATE + open-status guard = idempotency. Two concurrent callers CAN reach this
    -- (fn_travel_run_open's TTL sweep is reachable from a double-clicked Aufbruch), and an
    -- unravelling is not repeatable: it would scatter the manifest twice, audit twice, and
    -- — worst — add TWO scars to a record that can never be cleared.
    SELECT * INTO v_run FROM travel_runs WHERE id = p_run FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_travel_zerfasern: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status NOT IN ('active', 'frozen', 'distress', 'havarie') THEN
        RETURN to_jsonb(v_run);
    END IF;

    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;
    v_haul := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);
    v_safe := COALESCE((v_run.checkpoint ->> 'haul_safe')::int, 0);

    -- Scatter BEFORE the status flip: the 250 close-cleanup trigger deletes the cargo on
    -- the transition into 'abandoned', so the manifest must be read first.
    v_scatter := fn_drift_scatter_cargo(p_run, p_user, v_anchor);

    v_fun_core := drift_gate_enabled('drift_fun_core_enabled');

    -- The scar is recorded HERE, not when the Havarie opened: a Havarie survived is not a
    -- Zerfaserung. Gated, like every Fun-Kern write: with the gate off the build is P0
    -- again, and P0 never counted scars. Zero residue is the price of a one-line rollback.
    IF v_fun_core THEN
        UPDATE traveler_profiles
           SET zerfaserung_count = zerfaserung_count + 1
         WHERE user_id = p_user;

        -- What the Funkboje transmitted, arrives — even though the traveller did not.
        IF v_safe > 0 THEN
            v_vp     := v_safe * COALESCE((drift_tuning_value('reward_survey_vp_per_haul'))::int, 1);
            v_siegel := floor(v_safe * COALESCE(
                (drift_tuning_value('reward_survey_siegel_ratio'))::numeric, 0.5))::int;
            v_earnings := fn_drift_award(p_user, 'zerfaserung_transmitted', v_siegel, v_vp, p_run);

            UPDATE traveler_profiles
               SET qualities = jsonb_set(qualities, '{vermessung_lodged}',
                     to_jsonb(COALESCE((qualities ->> 'vermessung_lodged')::int, 0) + v_safe))
             WHERE user_id = p_user;
        END IF;
    END IF;

    UPDATE travel_runs SET
        position_node_id = COALESCE(v_home, position_node_id),
        status           = 'abandoned',
        closed_at        = now(),
        run_version      = run_version + 1,
        checkpoint       = v_run.checkpoint || jsonb_build_object(
            'position_node_id', COALESCE(v_home, v_run.position_node_id),
            'recall', COALESCE(v_run.checkpoint #>> '{havarie,cause}', 'kohaerenz'),
            'zerfaserung', jsonb_build_object('reason', p_reason),
            'haul', 0, 'haul_lost', v_haul,
            'scattered', v_scatter)
            -- Gate off ⇒ zero Fun-Kern residue in the wreck's checkpoint, same rule as
            -- the closing receipt above and the scar counter below.
            || CASE WHEN v_fun_core
                    THEN jsonb_build_object('haul_transmitted', v_safe) ELSE '{}'::jsonb END
            || CASE WHEN v_earnings IS NOT NULL
                    THEN jsonb_build_object('earnings', v_earnings) ELSE '{}'::jsonb END
    WHERE id = p_run
    RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
    VALUES (p_user, 'drift_zerfaserung', p_run,
            jsonb_build_object('reason', p_reason, 'haul_transmitted', v_safe));
    PERFORM travel_audit(p_user, 'travel_zerfaserung', 'travel_run', p_run, NULL,
        jsonb_build_object('reason', p_reason, 'haul_lost', v_haul,
                           'haul_transmitted', v_safe,
                           'scattered', COALESCE((v_scatter ->> 'scattered')::int, 0)));

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_travel_zerfasern(UUID, UUID, TEXT) IS
    'The DRIFT unravelling, in one place (265, extended in 268): scatters the manifest as echoes into the worlds it was headed for, counts the scar (gated — P0 never counted scars), forfeits the LOOSE haul and closes the run ''abandoned''. From 268 it PAYS the Funkboje reserve (checkpoint.haul_safe): what the traveller transmitted arrives, even though they did not. Without that, banking would only ever be a hedge against a recall multiplier — and the whole push-your-luck would collapse into arithmetic. INTERNAL-class.';

REVOKE ALL    ON FUNCTION public.fn_travel_zerfasern(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_travel_zerfasern(UUID, UUID, TEXT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 7. fn_drift_signal_draw — the Drift comes through a Riss
-- ═══════════════════════════════════════════════════════════════════
-- 267's body, plus: standing on a torn node bends the class mix towards Störung. A bust
-- does not merely cost the yield — it changes the place. The draw reads the run's own
-- checkpoint for the flag (no signature change, so fn_travel_move needs no rewrite).

CREATE OR REPLACE FUNCTION public.fn_drift_signal_draw(
    p_run     UUID,
    p_user    UUID,
    p_band    TEXT,
    p_takt    INT,
    p_bands   JSONB,
    p_kh      INT,
    p_bb      INT,
    p_window  INT,
    p_chart   INT,
    p_anchor  UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_salt      TEXT;
    v_seed      TEXT;
    v_weights   JSONB;
    v_total     INT := 0;
    v_roll      INT;
    v_acc       INT := 0;
    v_class     TEXT;
    v_cand      RECORD;
    v_tpl       RECORD;
    v_cp        JSONB;
    v_pos       TEXT;
    v_rissig    BOOLEAN;
BEGIN
    v_salt := drift_run_salt(p_run);
    v_seed := v_salt || ':' || p_run::text || ':signal:' || p_takt::text;

    -- (1) The class.
    v_weights := drift_tuning_value('signal_weights') -> COALESCE(p_band, 'near');
    IF v_weights IS NULL THEN
        RETURN NULL;
    END IF;

    -- A torn node leaks. The Störung weight rises while the run stands on it (268).
    SELECT checkpoint, position_node_id::text INTO v_cp, v_pos
      FROM travel_runs WHERE id = p_run;
    v_rissig := COALESCE((v_cp #>> ARRAY['sondierung', v_pos, 'rissig'])::boolean, FALSE);
    IF v_rissig THEN
        v_weights := v_weights || jsonb_build_object('stoerung',
            COALESCE((v_weights ->> 'stoerung')::int, 0)
            + COALESCE((drift_tuning_value('sondierung_rissig_stoerung_bonus'))::int, 15));
    END IF;

    SELECT COALESCE(sum((value #>> '{}')::int), 0) INTO v_total FROM jsonb_each(v_weights);
    IF v_total <= 0 THEN
        RETURN NULL;
    END IF;

    v_roll := drift_rand_int(v_seed || ':class', 1, v_total);
    FOR v_cand IN SELECT key AS cls, (value #>> '{}')::int AS w
                    FROM jsonb_each(v_weights) ORDER BY key LOOP
        v_acc := v_acc + v_cand.w;
        IF v_roll <= v_acc THEN
            v_class := v_cand.cls;
            EXIT;
        END IF;
    END LOOP;

    IF v_class IS NULL THEN
        RETURN NULL;
    END IF;

    -- (2) The template, weighted within the class. Eligibility = the run's bands AND
    -- (for the interactive classes) at least one option the traveller can pay.
    WITH eligible AS (
        SELECT t.template_key, t.signal_class, t.definition,
               COALESCE((t.band_weights ->> COALESCE(p_band, 'near'))::int, 0) AS w
          FROM travel_signal_templates t
         WHERE t.signal_class = v_class
           AND COALESCE((t.band_weights ->> COALESCE(p_band, 'near'))::int, 0) > 0
           AND drift_signal_eligible(t.requires, p_bands)
           AND (
                t.definition -> 'options' IS NULL
                OR EXISTS (
                    SELECT 1 FROM jsonb_array_elements(t.definition -> 'options') o
                     WHERE drift_signal_affordable(o, p_kh, p_bb, p_window)
                )
           )
    ), running AS (
        SELECT template_key, signal_class, definition, w,
               sum(w) OVER (ORDER BY template_key
                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::int AS acc,
               sum(w) OVER ()::int AS total
          FROM eligible
    )
    SELECT r.template_key, r.signal_class, r.definition INTO v_tpl
      FROM running r
     WHERE r.acc >= drift_rand_int(v_seed || ':tpl', 1,
                                   GREATEST(1, (SELECT max(total) FROM running)))
     ORDER BY r.acc
     LIMIT 1;

    IF v_tpl IS NULL THEN
        RETURN NULL;   -- the class came up empty for this run — the Drift stays quiet
    END IF;

    RETURN jsonb_build_object(
        'template_key', v_tpl.template_key,
        'signal_class', v_tpl.signal_class,
        'takt',         p_takt,
        'bands',        p_bands,
        'rissig',       v_rissig,
        'prose',        drift_signal_prose(v_tpl.definition, p_chart, p_anchor, v_seed),
        'options',      COALESCE((
            SELECT jsonb_agg(o ORDER BY ord)
              FROM jsonb_array_elements(v_tpl.definition -> 'options') WITH ORDINALITY AS t(o, ord)
             WHERE drift_signal_affordable(o, p_kh, p_bb, p_window)
        ), NULL),
        'auto',         v_tpl.definition -> 'auto'
    );
END;
$$;

COMMENT ON FUNCTION public.fn_drift_signal_draw(UUID, UUID, TEXT, INT, JSONB, INT, INT, INT, INT, UUID) IS
    'The per-move signal draw (M1, 267; extended in 268). Class from the tuned per-band mix — bent towards Störung while the run stands on a node its own Sondierung tore open (a bust does not merely cost the yield, it changes the place) — then template from its own band weight, filtered by the run''s state bands (R9) and by whether an option can actually be paid. Both picks are salted (drift_run_salt, 264). Returns NULL when nothing is drawn. INTERNAL-class.';

REVOKE ALL    ON FUNCTION public.fn_drift_signal_draw(UUID, UUID, TEXT, INT, JSONB, INT, INT, INT, INT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_drift_signal_draw(UUID, UUID, TEXT, INT, JSONB, INT, INT, INT, INT, UUID) TO service_role;

COMMIT;
