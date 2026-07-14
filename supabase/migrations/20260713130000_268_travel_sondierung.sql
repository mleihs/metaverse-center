-- Migration 268: DRIFT Fun-Kern — travel_sondierung (M2: push your luck, and bank it)
--
-- Plan:    docs/plans/drift-fun-core-implementation-plan.md §4 (Welle 2, Schritt 2.3)
--          docs/plans/drift-w25-architecture-consolidation-plan.md (C, D, E)
-- Concept: drift-gameplay-redesign-concept.md — M2 (Sondierung + Funkboje), R4 (the odds are
--          never numbered; the markers are COUNTABLE), F5 (a bust that feels good).
--
-- The survey economy in P0 pays once per node, on first arrival, and never again. There is
-- nothing to push and nothing to lose — a run is a route, not a gamble. Sondierung is the
-- overdrive: dig the node you are standing on, again and again, for a rising yield, and watch
-- the marker stack you are building. Three of a kind and the node tears open.
--
-- ── The two decisions this file adds ─────────────────────────────────────────
--   "One more dig?"      — the yield rises (2, 3, 5, 8 …); so does the stack.
--   "Bank it, or carry?" — the Funkboje transmits 70 % of the loose haul to safety. The other
--                          30 % is what the gamble costs; carrying it all home pays 100 %,
--                          IF you get home.
--
-- Both are decisions the traveller makes with FULL information about the state and NO
-- information about the odds: the markers are open and countable (R4). Nobody is ever shown a
-- percentage.
--
-- ── A premise of the plan that the database did not support ──────────────────
-- The plan banks the Funkboje at `relais` nodes ("the P0 graph already has one"). It does not:
-- the active chart is 41 interstitial + 7 broadcast_rand, zero relais (they arrive with chart
-- v3 in W3). So the node gate is a TUNING LIST (funkboje_node_types) — it works today at the
-- worlds' broadcast edges, which is the better fiction anyway (you bank a haul by TRANSMITTING
-- it from a world that has a receiver), and `relais` joins the list the moment W3 puts one on
-- the map, with no code change.
--
-- ── Neither function books the haul any more (W2.6/E) ────────────────────────
-- The plan's second premise was a `haul_banked` column, and the W2 implementation answered it
-- with a third, independent booking of the same money in the checkpoint. That is precisely
-- what shipped the wave's worst bug: the Funkboje emptied `checkpoint.haul` and left
-- `sondierung[node].yield` and `travel_cargo.haul_value` standing, which cut BOTH ways —
-- a later bust at an already-banked node confiscated haul dug somewhere else entirely, AND the
-- same staleness made the bust cost exactly nothing whenever the loose haul was back at 0, so
-- dig → bank → dig → bank (the Funkboje costs no Takt) turned the gamble into a risk-free 70 %
-- and the push-your-luck of the whole wave evaporated.
--
-- Since 264/§3 there is no independent booking left to go stale:
--   * fn_sondieren writes `sondierung[node].yield` — which IS a source of `haul` (drift_haul_of),
--     so the haul rises by arithmetic. A Riss zeroes that one node's yield, and the haul falls
--     by exactly what was dug THERE. Nothing else is touched: not the reserve, not the
--     manifest, not the run. That asymmetry is what makes the Funkboje a real decision instead
--     of a formality (F5: a bust that feels good is one you saw coming and chose to risk).
--   * fn_funkboje_bank consumes the loose haul through drift_haul_settle() — the ONE function
--     that collapses all three sub-ledgers at once. There is no way to settle half of them.
--
-- Gate off ⇒ nothing here can be reached (both RPCs are gate-checked; a run cannot hold
-- Sondierung state without the gate having been open). The gate is enforced in SQL and nowhere
-- else (W2.6/A) — the router used to duplicate it as a 404, which is a trap the day either of
-- these functions grows a drain.

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
 'The Funkboje''s exchange rate: transmit the loose haul from a dock and 70 % of it is safe from anything that happens afterwards (Havarie, Zerfaserung, a bad dig, a Rückzug). The missing 30 % is the price of certainty. Carrying it home pays 100 % — if you get home.'),
('funkboje_node_types',
 '["relais", "broadcast_rand"]'::jsonb,
 'Where a haul can be transmitted. The plan said `relais`; the active chart has none (they arrive with chart v3 in W3), so the broadcast edges of the worlds carry the Funkboje today — and keep carrying it when the relays land, with no code change.')
ON CONFLICT (setting_key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_sondieren — noch ein Zug mit der Schaufel (PLAYER-class)
-- ═══════════════════════════════════════════════════════════════════
-- One Takt. A rising yield. An open marker. And, on the third of a kind, a Riss.
--
-- The bust is not a punishment screen: what it takes is the LOOSE yield of THIS node — never
-- the banked reserve, never the manifest, never the run.

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
    v_at_node   JSONB;
    v_digs      INT;
    v_yields    JSONB;
    v_yield     INT;
    v_classes   JSONB;
    v_marker    TEXT;
    v_stack     JSONB;
    v_same      INT;
    v_bust_at   INT;
    v_bust      BOOLEAN := FALSE;
    v_riss      JSONB;
    v_node_yld  INT;
    v_dz_cap    INT;
    v_salt      TEXT;
    v_anchor    UUID;
    v_home      UUID;
    v_cause     TEXT;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_sondieren: caller is not the run owner' USING ERRCODE = '42501';
    END IF;
    -- The gate refuses to CREATE state, and a dig is nothing but new state. There is nothing
    -- here to drain, so this is the plain refusal — enforced HERE and only here (W2.6/A).
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
    -- A scene the traveller has not answered blocks the shovel too (same rule as the move: a
    -- Störung is a decision, and you do not get to dig your way past it).
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
    v_at_node := COALESCE(v_run.sondierung -> v_node, '{}'::jsonb);
    v_digs    := COALESCE((v_at_node ->> 'digs')::int, 0);

    -- The yield of THIS dig: the table, with the last entry repeating (the limiter is the bust,
    -- not the table running out).
    v_yields := drift_tuning_value('sondierung_yields');
    v_yield  := COALESCE(
        (v_yields ->> LEAST(v_digs, jsonb_array_length(v_yields) - 1))::int, 2);

    -- The marker: salted, so the stack cannot be read ahead (264 — an unsalted draw would let
    -- the traveller dig exactly up to the bust and stop, which is not a gamble).
    v_salt    := drift_run_salt(p_run);
    v_classes := drift_tuning_value('sondierung_marker_classes');
    v_marker  := v_classes ->> drift_rand_int(
        v_salt || ':' || p_run::text || ':sond:' || v_node || ':' || v_digs::text,
        0, jsonb_array_length(v_classes) - 1);

    v_stack := COALESCE(v_run.markers -> v_node, '[]'::jsonb) || to_jsonb(v_marker);
    v_run.markers := v_run.markers || jsonb_build_object(v_node, v_stack);

    -- Three of a kind. The count is over the WHOLE stack at this node, so a marker a Störung
    -- left here (signal deltas: marker_add) counts too — the Drift can poison a dig site, and
    -- the stack that busts is not always the one you built.
    SELECT count(*) INTO v_same
      FROM jsonb_array_elements_text(v_stack) m WHERE m = v_marker;
    v_bust_at := COALESCE((drift_tuning_value('sondierung_bust_rule')
                           ->> 'same_class_count')::int, 3);
    v_bust    := v_same >= v_bust_at;

    v_node_yld := COALESCE((v_at_node ->> 'yield')::int, 0);
    v_dz_cap   := COALESCE((drift_tuning_value('dz_p0_cap'))::int, 20);

    -- The yield is written into the node's own ledger and NOWHERE ELSE. `sondierung[node].yield`
    -- IS a source of travel_runs.haul (drift_haul_of, 264/§3.2), so the loose haul rises with
    -- this dig — and on a Riss it falls by exactly what was dug HERE, because the number that
    -- goes to zero is the only place that dig was ever recorded. Before W2.6 this function had
    -- to keep a second copy in step by hand; the copy is what went stale.
    IF v_bust THEN
        v_riss    := drift_tuning_value('sondierung_riss');
        v_at_node := v_at_node || jsonb_build_object(
            'digs', v_digs + 1, 'yield', 0, 'rissig', TRUE);
        v_run.dissonanz := LEAST(v_dz_cap,
            v_run.dissonanz + COALESCE((v_riss ->> 'dz')::int, 6));
    ELSE
        v_at_node := v_at_node || jsonb_build_object(
            'digs', v_digs + 1, 'yield', v_node_yld + v_yield);
    END IF;

    UPDATE travel_runs SET
        window_remaining = GREATEST(0, window_remaining - 1),
        takt_count       = takt_count + 1,
        dissonanz        = v_run.dissonanz,
        markers          = v_run.markers,
        sondierung       = v_run.sondierung || jsonb_build_object(v_node, v_at_node),
        event_seq        = event_seq + 1,
        run_version      = run_version + 1,
        checkpoint       = checkpoint || jsonb_build_object(
            'last_sondierung', jsonb_build_object(
                'node_id',   v_run.position_node_id,
                'dig',       v_digs + 1,
                'marker',    v_marker,
                'stack',     v_stack,
                'yield',     CASE WHEN v_bust THEN 0 ELSE v_yield END,
                'bust',      v_bust,
                'forfeited', CASE WHEN v_bust THEN v_node_yld ELSE 0 END))
     WHERE id = p_run
    RETURNING * INTO v_run;   -- v_run.haul is now the derivation, recomputed by the trigger

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
                           'bust', v_bust, 'haul', v_run.haul));

    -- The Takt this dig cost was the last one, and it was not spent at home: the same floor a
    -- move would have hit. Digging IS travelling — it spends the same window.
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;

    IF v_run.window_remaining <= 0
       AND NOT v_run.overstay
       AND v_run.position_node_id IS DISTINCT FROM v_home THEN
        v_cause := 'window';
        UPDATE travel_runs SET
            status      = 'havarie',
            event_seq   = event_seq + 1,
            run_version = run_version + 1,
            checkpoint  = checkpoint || jsonb_build_object(
                'havarie', drift_havarie_payload(p_run, v_cause, v_run.haul, 0))
         WHERE id = p_run
        RETURNING * INTO v_run;

        INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
        VALUES (p_user, 'drift_decision', p_run,
                jsonb_build_object('kind', 'havarie_opened', 'cause', v_cause,
                                   'from_sondierung', TRUE));
        INSERT INTO travel_log_entries (user_id, run_id, takt, kind, node_id, payload)
        VALUES (p_user, p_run, v_run.takt_count, 'havarie', v_run.position_node_id,
                jsonb_build_object('cause', v_cause, 'haul_at_risk', v_run.haul,
                                   'from_sondierung', TRUE));
        PERFORM travel_audit(p_user, 'travel_havarie_open', 'travel_run', p_run, NULL,
            jsonb_build_object('cause', v_cause, 'haul_at_risk', v_run.haul,
                               'from_sondierung', TRUE));
    END IF;

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_sondieren(UUID, UUID, INT) IS
    'Dig the node you are standing on (M2). PLAYER-class (auth.uid() guard, run_version CAS, gate-checked in SQL). One Takt; the yield rises with every dig at the SAME node (sondierung_yields, last entry repeats); the marker is drawn from the salted seed (an unsalted stack could be read ahead, and a gamble you can read ahead is arithmetic) and laid OPEN on the node so the traveller can always count it (R4). Three markers of one class at that node and it tears: the LOOSE yield dug there is forfeit — never the banked reserve, never the manifest, never the run — the Dissonanz jumps, and the node stays `rissig` (the signal draw sends more Störungen through the tear). A Störung''s own marker_add counts towards the stack, so the Drift can poison a dig site. Spending the last Takt away from home opens a Havarie, exactly as a move would: digging IS travelling. Since W2.6 the yield is booked ONLY in sondierung[node].yield, which is a source of the derived travel_runs.haul — there is no second copy left to go stale, and the Riss debits by arithmetic.';

REVOKE ALL    ON FUNCTION public.fn_sondieren(UUID, UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_sondieren(UUID, UUID, INT) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 3. fn_funkboje_bank — 70 % davon, sicher vor allem (PLAYER-class)
-- ═══════════════════════════════════════════════════════════════════
-- The other half of the push-your-luck. Banking at HOME is refused: there the Entladung pays
-- 100 %, so a bank could only ever lose the traveller money — a dead option is worse than no
-- option (the W1 rule, third application).

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
    -- At home the Entladung pays in full; banking here could only ever cost the traveller 30 %
    -- of their own haul. Refuse it rather than offer it.
    IF v_sim IS NOT DISTINCT FROM v_anchor THEN
        RAISE EXCEPTION 'AT_HOME' USING ERRCODE = '22023';
    END IF;

    v_loose := v_run.haul;
    IF v_loose <= 0 THEN
        RAISE EXCEPTION 'NOTHING_TO_BANK' USING ERRCODE = '22023';
    END IF;

    v_rate  := COALESCE((drift_tuning_value('funkboje_rate'))::numeric, 0.7);
    v_safe  := floor(v_loose * v_rate)::int;   -- floor: the Bureau never rounds your way
    v_total := v_run.haul_safe + v_safe;

    -- CONSUME the loose haul — all three sub-ledgers at once, through the one function that
    -- may (264/§3.4). What is ashore can neither be lost nor deducted again, so the sondierung
    -- yields and the cargo's haul_value go to zero with it. `digs` and `rissig` survive: they
    -- describe the NODE, not the haul, and banking does not un-dig a hole.
    --
    -- This ONE call is the whole of the W2.6 fix. Emptying only `haul` and leaving the other
    -- two standing (what shipped) cut both ways: a later bust at an already-banked node
    -- confiscated haul dug elsewhere, AND the bust cost nothing whenever the loose haul was
    -- back at 0 — dig → bank → dig → bank, and the gamble becomes a risk-free 70 %.
    PERFORM drift_haul_settle(p_run, 0);

    UPDATE travel_runs SET
        haul_safe   = v_total,
        event_seq   = event_seq + 1,
        run_version = run_version + 1,
        checkpoint  = checkpoint || jsonb_build_object(
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
    'Transmit the loose haul from a dock (M2). PLAYER-class (auth.uid() guard, CAS, gate-checked in SQL). floor(haul × funkboje_rate) moves into travel_runs.haul_safe, which nothing afterwards can take — not a Havarie, not a Resonanzriss, not a Zerfaserung, not a Rückzug (all four pay it out). The missing 30 % is the price of certainty; carrying it home pays 100 %, IF you get home. Refused at the anchor world (AT_HOME): the Entladung pays in full there, so banking could only ever lose the traveller money, and a dead option is worse than no option. The loose haul is consumed through drift_haul_settle — the ONE function that empties all three sub-ledgers at once, which is what stops an already-banked dig site from being confiscated twice AND stops the bust from becoming free. Node gate is drift_tuning.funkboje_node_types — broadcast edges today, `relais` the moment chart v3 puts one on the map.';

REVOKE ALL    ON FUNCTION public.fn_funkboje_bank(UUID, UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_funkboje_bank(UUID, UUID, INT) TO authenticated, service_role;

COMMIT;
