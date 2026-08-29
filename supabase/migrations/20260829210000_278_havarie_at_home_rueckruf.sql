-- ═══════════════════════════════════════════════════════════════════════════════
-- 278 — Havarie am eigenen Dock: der Rückruf steht offen
-- ═══════════════════════════════════════════════════════════════════════════════
-- Im Durchspielen gemessen: ein Träger schleppt sich mit 11 Punkten Vermessung nach
-- Hause, erreicht `home-velgarien` — und die Kohärenz fällt im selben Zug auf 0. Die
-- Havarie öffnet und bietet zwei Auswege: NOTRUF (halber Haul + 10 Siegel Schuld) oder
-- ZERFASERUNG (alles verloren, eine Narbe mehr). Der Reisende steht dabei auf seinem
-- EIGENEN Broadcast-Rand. Die Entladung, die dort volle 100 % zahlt, ist unerreichbar,
-- weil `fn_travel_complete` den Status `active` verlangt.
--
-- Der Fehler ist eine ASYMMETRIE, keine Design-Entscheidung — sie steht in `fn_travel_move`
-- in EINEM Ausdruck:
--
--     v_collapsing := v_run.kohaerenz <= 0
--         OR (v_run.window_remaining <= 0
--             AND NOT (v_fun_core AND v_overstay)
--             AND p_to_node IS DISTINCT FROM v_home);   ← das Fenster kennt „zu Hause"
--
-- Der Fenster-Zweig weiß, dass Ankommen Sicherheit bedeutet: ein abgelaufenes Fenster am
-- Heimatknoten lässt den Run gar nicht erst kollabieren. Der Kohärenz-Zweig hat diese Regel
-- nie bekommen. Dieselbe Fahrt endet also je nach Ursache einmal in der Entladung und einmal
-- in einem Bergungsvermerk — am selben Knoten, mit demselben Haul.
--
-- Behoben wird es NICHT, indem der Kollaps zu Hause unterdrückt wird. Konzept-Kriterium F4
-- lautet „Havarie endet nie ohne Wahl und nie ohne Text"; ein stiller Ausnahmefall nähme dem
-- Moment genau das, wofür das Havarie-Redesign existiert. Stattdessen bekommt der Katalog am
-- Heimatknoten die Option, die dort die WAHRE ist und seit 265 implementiert war — nur nie
-- angeboten wurde:
--
--     RÜCKRUF — ein geordneter Rückruf, der Haul überlebt zu 70 %.
--
-- Die Staffelung stimmt damit über alle drei Wege: Entladung 100 % (heil angekommen) >
-- Rückruf 70 % (angekommen, aber als Wrack) > Notruf 50 % + Schuld (aus dem Nirgendwo
-- geborgen). Der Preis fürs Heimkommen mit totem Träger ist spürbar und nicht ruinös —
-- „failing but not failed" (R7) statt „so nah dran und trotzdem alles weg".
--
-- ── Warum `fn_travel_move` hier mitkommt ──────────────────────────────────────
-- Ein erster Versuch dieser Migration hat NUR `drift_havarie_payload` geändert und den
-- Heimatknoten aus der Run-Zeile nachgeschlagen. Das war falsch, und die Testsuite hat es
-- sofort gezeigt: die Funktion wird INNERHALB derselben UPDATE-Anweisung ausgewertet, die
-- `position_node_id` setzt, sieht die Zeile also im Zustand VOR dem Zug — der Katalog wurde
-- für den Knoten gebaut, den der Träger gerade VERLÄSST. In den Tests hieß das: ein Run, der
-- vom Heimatknoten wegzieht und unterwegs strandet, bekam den Rückruf angeboten, obwohl er
-- nirgendwo in der Nähe von zu Hause liegt. Es ist dieselbe Snapshot-Falle wie in W2.6/E,
-- nur in die andere Richtung.
--
-- Deshalb schreibt `fn_travel_move` die Position jetzt fest, BEVOR der Katalog gebaut wird —
-- eine einzelne UPDATE-Zeile, direkt vor dem bestehenden Havarie-UPDATE, das dieselbe
-- Position ohnehin gleich noch einmal setzt. Der Endzustand der Zeile ist unverändert; nur
-- der Payload-Bauer sieht endlich, wo der Träger tatsächlich strandet.
--
-- Die beiden anderen Aufrufer bleiben unangetastet und sind bereits korrekt:
-- `fn_sondieren` und `fn_signal_resolve` BEWEGEN den Run nicht, ihre gespeicherte Position
-- ist zum Zeitpunkt des Aufrufs schon die richtige.
--
-- `fn_travel_havarie_resolve` braucht ebenfalls keine Änderung: der rueckruf-Zweig existiert
-- seit 265 („an orderly recall"), er validiert nur gegen die Liste, die hier gebaut wird.
-- Reine Erweiterung des Katalogs — kein Weg wird genommen, einer kommt hinzu.
--
-- `fn_travel_move` wird vollständig neu ausgegeben (wie schon 267 gegenüber 246 — das ist
-- das Muster dieses Repos für Funktionsänderungen). Der Körper ist byte-identisch mit 267
-- bis auf die eine oben beschriebene UPDATE-Zeile.
--
-- Rollback: Migrationen 265 (§ drift_havarie_payload) und 267 (§ fn_travel_move) erneut
-- anwenden — beide sind idempotent re-applybar.

-- ═══════════════════════════════════════════════════════════════════
-- 1. drift_havarie_payload — der Katalog kennt jetzt den Ort
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.drift_havarie_payload(
    p_run UUID, p_cause TEXT, p_haul INT, p_window INT
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_opts    JSONB := drift_tuning_value('havarie_options');
    v_cargo_n INT;
    v_options JSONB;
    v_at_home BOOLEAN := FALSE;
BEGIN
    SELECT count(*) INTO v_cargo_n FROM travel_cargo WHERE run_id = p_run;

    -- Steht das Wrack auf dem Heimat-Broadcast des Trägers? Dieselbe Frage, die
    -- fn_travel_move für den Fenster-Kollaps stellt (Knoten == Broadcast-Rand der Ankerwelt,
    -- auf der Chart-Version des Runs). Der Aufrufer muss die Position vorher festgeschrieben
    -- haben — fn_travel_move tut das seit dieser Migration ausdrücklich, die beiden anderen
    -- Aufrufer bewegen den Run nicht.
    SELECT EXISTS (
        SELECT 1
          FROM travel_runs r
          JOIN traveler_profiles tp ON tp.user_id = r.user_id
          JOIN drift_chart_nodes n  ON n.id = r.position_node_id
                                   AND n.chart_version = r.chart_version
         WHERE r.id = p_run
           AND n.node_type     = 'broadcast_rand'
           AND n.simulation_id = tp.anchor_simulation_id
    ) INTO v_at_home;

    -- Notabwurf is offered only when there is cargo to throw AND at least one Takt survives
    -- its price — otherwise the run returns to 'active' with 0 Takte and drops straight back
    -- into the same Havarie: cargo gone, Depeschen failed, nothing bought. (W1/1.5 P1.
    -- A dead option is worse than no option — it promises an out the traveller cannot take.)
    v_options := CASE
        WHEN p_cause = 'kohaerenz' AND v_cargo_n > 0
             AND p_window > COALESCE((v_opts #>> '{notabwurf,window_cost}')::int, 2)
            THEN '["notabwurf","notruf","zerfaserung"]'::jsonb
        WHEN p_cause = 'kohaerenz'
            THEN '["notruf","zerfaserung"]'::jsonb
        ELSE '["ueberziehen","rueckruf"]'::jsonb
    END;

    -- Am eigenen Dock kommt der Rückruf dazu. Vorangestellt, weil das HUD den Katalog in
    -- Reihenfolge rendert und die beste Wahl oben stehen soll; `zerfaserung` bleibt letzte.
    IF p_cause = 'kohaerenz' AND v_at_home AND NOT (v_options @> '["rueckruf"]'::jsonb) THEN
        v_options := '["rueckruf"]'::jsonb || v_options;
    END IF;

    RETURN jsonb_build_object(
        'cause', p_cause,
        'options', v_options,
        'at_home', v_at_home,
        'cargo_aboard', v_cargo_n,
        'haul_at_risk', p_haul,
        'catalogue', v_opts,     -- the numbers, so the panel can state them
        'expires_at', (now() + make_interval(
            hours => COALESCE((drift_tuning_value('havarie_ttl_hours'))::int, 48)))
    );
END;
$$;

COMMENT ON FUNCTION public.drift_havarie_payload(UUID, TEXT, INT, INT) IS
    'Builds the Havarie checkpoint block (cause, option catalogue, cargo aboard, haul at risk, the tuning numbers so the panel can STATE them, and the 48 h TTL). One builder, because three different functions can now strand a run — a move, a resolved Störung, a dig that spends the last Takt — and three hand-built catalogues is how the notabwurf rules diverge. Since 278 it also answers WHERE the wreck lies: a Kohärenz-Havarie on the traveller''s own home broadcast additionally offers `rueckruf` (70 %), because fn_travel_move already treats arriving home as safety for the window cause and the two causes must not grade the same arrival differently. Reads the run''s CURRENT position — a caller that moves the run must persist it before calling (fn_travel_move does; fn_sondieren and fn_signal_resolve do not move). INTERNAL-class.';

REVOKE ALL    ON FUNCTION public.drift_havarie_payload(UUID, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_havarie_payload(UUID, TEXT, INT, INT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_travel_move — die Position steht fest, bevor der Katalog sie liest
-- ═══════════════════════════════════════════════════════════════════
-- Unverändert gegenüber 267 bis auf das eine UPDATE vor dem Havarie-Zweig.

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
    v_survey     INT := 0;
    v_dz_bleed   JSONB;
    v_surge_cfg  JSONB;
    v_scatter    JSONB;
    v_fun_core   BOOLEAN;
    v_overstay   BOOLEAN;
    v_cause      TEXT;
    v_late       JSONB;
    v_bands      JSONB;
    v_overload   BOOLEAN := FALSE;
    v_cargo_n    INT;
    v_slots      INT;
    v_class      INT;
    v_signal     JSONB;
    v_pending    JSONB := NULL;
    v_delta_res  JSONB;
    v_applied    JSONB := NULL;
    v_earnings   JSONB := NULL;
    v_haul       INT;
    v_haul_lost  INT;
    v_collapsing BOOLEAN;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_move: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

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

    v_fun_core := drift_gate_enabled('drift_fun_core_enabled');
    v_overstay := v_run.overstay;

    -- (a) A scene the traveller has not answered blocks the next move. Gate-off runs ignore a
    -- leftover pending_signal entirely (and the rebuilt checkpoint drops it).
    IF v_fun_core AND v_run.checkpoint ? 'pending_signal' THEN
        RAISE EXCEPTION 'SIGNAL_PENDING' USING ERRCODE = '22023';
    END IF;

    -- Adjacency.
    SELECT weight, permeability INTO v_weight, v_perm FROM drift_chart_edges
     WHERE chart_version = v_run.chart_version
       AND ((from_node = v_run.position_node_id AND to_node = p_to_node)
         OR (to_node   = v_run.position_node_id AND from_node = p_to_node))
     LIMIT 1;
    IF v_weight IS NULL THEN
        RAISE EXCEPTION 'NOT_ADJACENT' USING ERRCODE = '22023';
    END IF;

    -- Frequency multiplier (on-vector vs the affinity-banded off-vector penalty).
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

    -- Pay: Bandbreite if affordable, else Notfrequenz (Kohärenz per edge).
    IF v_run.bandbreite >= v_bb_cost THEN
        v_run.bandbreite := v_run.bandbreite - v_bb_cost;
    ELSE
        v_notfreq := TRUE;
        v_run.kohaerenz := GREATEST(0, v_run.kohaerenz
            - COALESCE((drift_tuning_value('notfreq_kh_per_edge'))::int, 2));
    END IF;

    SELECT distance_band, simulation_id, node_type INTO v_band, v_to_sim, v_to_type
      FROM drift_chart_nodes WHERE id = p_to_node AND chart_version = v_run.chart_version;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;

    -- One Takt of the Aufenthaltsfenster (an overstaying run has none left to spend).
    v_run.window_remaining := GREATEST(0, v_run.window_remaining - 1);

    -- Dissonanz by band, capped; above the bleed threshold it erodes Kohärenz.
    v_dz_add := COALESCE((drift_tuning_value('dz_per_move_by_band') ->> COALESCE(v_band, 'near'))::int, 1);
    v_dz_cap := COALESCE((drift_tuning_value('dz_p0_cap'))::int, 74);

    -- (b) M9: the late run costs more. The Drift tightens its grip the longer you stay.
    IF v_fun_core THEN
        v_late := drift_tuning_value('dz_late_window');
        IF v_late IS NOT NULL
           AND (v_run.takt_count + 1) >= COALESCE((v_late ->> 'from_takt')::int, 8) THEN
            v_dz_add := v_dz_add + COALESCE((v_late ->> 'extra')::int, 1);
        END IF;
    END IF;

    -- Overstay tax (M3): staying past the permit is not free — the Bleed notices. This is what
    -- eventually ends an overstay, and it ends it through Kohärenz, not a clock.
    IF v_fun_core AND v_overstay THEN
        v_dz_add := v_dz_add
            + COALESCE((drift_tuning_value('havarie_options') #>> '{ueberziehen,dz_per_takt}')::int, 5);
    END IF;

    v_run.dissonanz := LEAST(v_dz_cap, v_run.dissonanz + v_dz_add);
    v_dz_bleed := drift_tuning_value('dz_kh_bleed');
    IF v_dz_bleed IS NOT NULL AND v_run.dissonanz >= (v_dz_bleed ->> 'threshold')::int THEN
        v_run.kohaerenz := GREATEST(0, v_run.kohaerenz - (v_dz_bleed ->> 'amount')::int);
    END IF;

    -- (e) Deep-Drift surge — the gate-OFF path only. With the Fun-Kern on, the same damage
    -- arrives as `stoerung_frequenzscherung`: named, written, answerable.
    IF NOT v_fun_core AND v_band = 'deep' THEN
        v_surge_cfg := drift_tuning_value('deep_surge');
        IF v_surge_cfg IS NOT NULL AND random() < (v_surge_cfg ->> 'chance')::numeric THEN
            v_surge := TRUE;
            v_run.dissonanz := LEAST(v_dz_cap, v_run.dissonanz + (v_surge_cfg ->> 'dz')::int);
            v_run.kohaerenz := GREATEST(0, v_run.kohaerenz - (v_surge_cfg ->> 'kh')::int);
        END IF;
    END IF;

    -- Vermessung on first arrival (band value + the foreign-dock prize). It lands in
    -- `haul_survey` — the one source of the loose haul that has no other ledger behind it.
    IF NOT (v_run.visited @> to_jsonb(p_to_node::text)) THEN
        v_survey := COALESCE((drift_tuning_value('survey_value_by_band') ->> COALESCE(v_band, 'near'))::int, 0);
        IF v_to_type = 'broadcast_rand' AND v_to_sim IS DISTINCT FROM v_anchor THEN
            v_survey := v_survey + COALESCE((drift_tuning_value('foreign_dock_bonus'))::int, 0);
        END IF;
        v_run.haul_survey := v_run.haul_survey + v_survey;
        v_run.visited     := v_run.visited || to_jsonb(p_to_node::text);
    END IF;

    -- Would this move END the run on its own? (Kohärenz 0 anywhere; an expired window away from
    -- home, unless an overstay permit says otherwise.)
    v_collapsing := v_run.kohaerenz <= 0
        OR (v_run.window_remaining <= 0
            AND NOT (v_fun_core AND v_overstay)
            AND p_to_node IS DISTINCT FROM v_home);

    -- ── (c) THE DRAW ─────────────────────────────────────────────────────────────
    IF v_fun_core AND NOT v_collapsing THEN
        -- Persist the move's state first: the draw's helpers READ AND WRITE the run row (the
        -- rissig flag, the deltas, the markers, the rumour log), and they must see the
        -- post-move numbers.
        --
        -- Before W2.6 this was the site of a P0: `haul` lived in the checkpoint, the caller
        -- held it in a local variable, and fn_drift_apply_deltas re-read it from the COLUMN,
        -- added its grant and wrote it back — silently rolling back the first-arrival
        -- Vermessung of THIS move, while `visited` still recorded the node so it could never
        -- pay again. The haul is DERIVED now (264/§3.2) and nobody holds it in a local, so the
        -- class of bug is gone; the row still has to be persisted, but only because the helpers
        -- read it.
        UPDATE travel_runs SET
            kohaerenz        = v_run.kohaerenz,
            bandbreite       = v_run.bandbreite,
            dissonanz        = v_run.dissonanz,
            window_remaining = v_run.window_remaining,
            position_node_id = p_to_node,
            haul_survey      = v_run.haul_survey,
            visited          = v_run.visited
         WHERE id = p_run;

        SELECT count(*) INTO v_cargo_n FROM travel_cargo WHERE run_id = p_run;
        SELECT bandwidth_class INTO v_class FROM traveler_profiles WHERE user_id = p_user;
        v_slots := COALESCE((drift_tuning_value('manifest_free_slots')
                             ->> COALESCE(v_class, 1)::text)::int, 2);
        v_overload := v_cargo_n > v_slots;

        v_bands := drift_signal_bands(v_run.kohaerenz, v_run.dissonanz,
                                      v_run.window_remaining, v_overload);

        v_signal := fn_drift_signal_draw(
            p_run, p_user, v_band, v_run.takt_count + 1, v_bands,
            v_run.kohaerenz, v_run.bandbreite, v_run.window_remaining,
            v_run.chart_version, v_anchor);

        IF v_signal IS NOT NULL THEN
            IF v_signal ->> 'signal_class' IN ('stoerung', 'begegnung') THEN
                -- The run WAITS. Nothing is applied yet — the decision is the content.
                v_pending := v_signal;
                INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
                VALUES (p_user, 'drift_signal_shown', p_run,
                        jsonb_build_object('template_key', v_signal ->> 'template_key',
                                           'class', v_signal ->> 'signal_class',
                                           'band', v_band));
            ELSE
                -- Passive: applied on the spot, one log line, no modal.
                v_delta_res := fn_drift_apply_deltas(
                    p_user, p_run,
                    COALESCE(v_signal #> '{auto,deltas}', '{}'::jsonb),
                    'signal:' || (v_signal ->> 'template_key'));
                v_applied  := v_delta_res -> 'applied';
                -- Only THIS act's receipt, never the checkpoint's (which still holds the
                -- previous move's, until the rebuild below drops it).
                v_earnings := v_delta_res -> 'earnings';

                -- Re-read: the deltas may have moved KH/BB/DZ/window, the markers and the haul.
                SELECT * INTO v_run FROM travel_runs WHERE id = p_run;

                INSERT INTO travel_log_entries (user_id, run_id, takt, kind, node_id, payload)
                VALUES (p_user, p_run, v_run.takt_count + 1, 'signal', p_to_node,
                        jsonb_build_object(
                            'template_key', v_signal ->> 'template_key',
                            'class',        v_signal ->> 'signal_class',
                            'prose',        v_signal -> 'prose',
                            'outcome',      v_signal -> 'auto',
                            'applied',      v_applied));

                INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
                VALUES (p_user, 'drift_signal_shown', p_run,
                        jsonb_build_object('template_key', v_signal ->> 'template_key',
                                           'class', v_signal ->> 'signal_class',
                                           'band', v_band, 'passive', TRUE));

                -- (d) A find heavy enough to crack the hull is allowed to crack it.
                v_collapsing := v_run.kohaerenz <= 0
                    OR (v_run.window_remaining <= 0
                        AND NOT v_overstay
                        AND p_to_node IS DISTINCT FROM v_home);
            END IF;
        END IF;
    END IF;

    -- The loose haul as it stands NOW. Computed from the local row + the manifest rather than
    -- read off v_run.haul: in the branches that never re-read the row (an interactive signal,
    -- or a move that was collapsing before the draw) v_run.haul is the value from BEFORE this
    -- move's first-arrival Vermessung, and a Havarie panel that under-states what is at risk is
    -- a lie at the worst possible moment. drift_haul_of() is the same arithmetic the column's
    -- trigger uses — there is only ever one definition of the haul.
    v_haul := drift_haul_of(v_run.haul_survey, v_run.sondierung, p_run);

    -- ── The floor ────────────────────────────────────────────────────────────────
    IF v_collapsing THEN
        v_cause := CASE WHEN v_run.kohaerenz <= 0 THEN 'kohaerenz' ELSE 'window' END;

        IF v_fun_core THEN
            -- HAVARIE: the run stops where it is. Nothing is lost yet — the cargo is still
            -- aboard, the haul is still on the books, and the traveller decides.
            -- Die Position ZUERST festschreiben. drift_havarie_payload() liest die
            -- Run-Zeile, und die UPDATE-Anweisung darunter sieht sie im Zustand VOR
            -- dem Zug — der Katalog wuerde also fuer den Knoten gebaut, den der
            -- Traeger gerade VERLAESST, nicht fuer den, auf dem er strandet. Genau
            -- die Snapshot-Falle aus W2.6/E, nur in die andere Richtung.
            UPDATE travel_runs SET position_node_id = p_to_node WHERE id = p_run;

            UPDATE travel_runs SET
                position_node_id = p_to_node,          -- you are stranded WHERE YOU ARE
                status           = 'havarie',
                bandbreite       = v_run.bandbreite,
                kohaerenz        = v_run.kohaerenz,
                dissonanz        = v_run.dissonanz,
                window_remaining = GREATEST(0, v_run.window_remaining),
                haul_survey      = v_run.haul_survey,
                visited          = v_run.visited,
                takt_count       = takt_count + 1,
                event_seq        = event_seq + 1,
                run_version      = run_version + 1,
                checkpoint       = jsonb_build_object(
                    'havarie', drift_havarie_payload(
                        p_run, v_cause, v_haul, GREATEST(0, v_run.window_remaining)))
            WHERE id = p_run
            RETURNING * INTO v_run;

            INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
            VALUES (p_user, 'drift_decision', p_run,
                jsonb_build_object('kind', 'havarie_opened', 'cause', v_cause));
            INSERT INTO travel_log_entries (user_id, run_id, takt, kind, node_id, payload)
            VALUES (p_user, p_run, v_run.takt_count, 'havarie', p_to_node,
                    jsonb_build_object('cause', v_cause, 'haul_at_risk', v_haul));
            PERFORM travel_audit(p_user, 'travel_havarie_open', 'travel_run', p_run, NULL,
                jsonb_build_object('cause', v_cause, 'haul_at_risk', v_haul,
                                   'signal', v_signal ->> 'template_key'));
            RETURN to_jsonb(v_run);
        END IF;

        -- Gate closed → the P0 snap: home, abandoned, haul forfeit, cargo scattered.
        -- The forfeit goes through the ONE consumer (264/§3.4), which both hands back the
        -- number the receipt needs and empties all three sub-ledgers — so the cargo DELETE the
        -- close-cleanup trigger fires below carries no haul with it.
        UPDATE travel_runs SET
            haul_survey = v_run.haul_survey,
            visited     = v_run.visited
         WHERE id = p_run;
        v_haul_lost := drift_haul_settle(p_run, 0);
        v_scatter   := fn_drift_scatter_cargo(p_run, p_user, v_anchor);

        UPDATE travel_runs SET
            position_node_id = COALESCE(v_home, position_node_id),
            status           = 'abandoned',
            closed_at        = now(),
            bandbreite       = v_run.bandbreite,
            kohaerenz        = v_run.kohaerenz,
            dissonanz        = v_run.dissonanz,
            window_remaining = GREATEST(0, v_run.window_remaining),
            takt_count       = takt_count + 1,
            event_seq        = event_seq + 1,
            run_version      = run_version + 1,
            checkpoint       = jsonb_build_object('closing', drift_closing_payload(
                'kollaps', v_cause, NULL,
                0, v_haul_lost, 0,
                NULL, NULL, NULL, v_scatter, FALSE))
        WHERE id = p_run
        RETURNING * INTO v_run;

        INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
        VALUES (p_user, 'drift_zerfaserung', p_run);
        PERFORM travel_audit(p_user, 'travel_recall', 'travel_run', p_run, NULL,
            jsonb_build_object('reason', v_cause, 'haul_lost', v_haul_lost,
                               'attempted_to', p_to_node,
                               'scattered', COALESCE((v_scatter ->> 'scattered')::int, 0)));
        RETURN to_jsonb(v_run);
    END IF;

    -- ── Advance ──────────────────────────────────────────────────────────────────
    -- The checkpoint is REBUILT — and that is safe now, because everything run-level is a
    -- column. What is rebuilt away is exactly what should be: last_move (of the PREVIOUS
    -- move), a stale earnings receipt, a drained pending_signal, last_signal, last_sondierung,
    -- last_bank, last_havarie. What just happened, not what is true.
    --
    -- `markers` is deliberately NOT in the SET list: fn_drift_apply_deltas may have just added
    -- a Störung's marker to the column, and re-writing v_run's copy would undo it. Columns are
    -- what make that a one-line concern instead of a whitelist.
    UPDATE travel_runs SET
        position_node_id = p_to_node,
        bandbreite       = v_run.bandbreite,
        kohaerenz        = v_run.kohaerenz,
        dissonanz        = v_run.dissonanz,
        window_remaining = v_run.window_remaining,
        haul_survey      = v_run.haul_survey,
        visited          = v_run.visited,
        takt_count       = takt_count + 1,
        event_seq        = event_seq + 1,
        run_version      = run_version + 1,
        checkpoint       = jsonb_build_object(
                'last_move', jsonb_build_object('from', v_run.position_node_id, 'bb_cost', v_bb_cost,
                                                'notfrequenz', v_notfreq, 'dz_add', v_dz_add,
                                                'surge', v_surge, 'survey', v_survey)
                    -- jsonb_build_object emits a NULL-valued key rather than omitting it, so
                    -- building the two signal keys unconditionally would leave "signal": null
                    -- in every gate-off checkpoint. A stray key is exactly how parity rots.
                    || CASE WHEN v_fun_core
                            THEN jsonb_build_object('signal', v_signal -> 'template_key',
                                                    'signal_applied', v_applied)
                            ELSE '{}'::jsonb END)
            || CASE WHEN v_pending IS NOT NULL
                    THEN jsonb_build_object('pending_signal', v_pending)
                    ELSE '{}'::jsonb END
            -- The passive signal's payout receipt survives its own move — and ONLY its own:
            -- v_earnings is what fn_drift_apply_deltas just paid (it hands the award back
            -- explicitly), not what the checkpoint happens to still hold from the last one. A
            -- Fund that pays Siegel and opens no panel is the silent money W2 exists to end; a
            -- ceremony replayed for money that did not move is the opposite mistake.
            || CASE WHEN v_earnings IS NOT NULL
                    THEN jsonb_build_object('earnings', v_earnings)
                    ELSE '{}'::jsonb END
    WHERE id = p_run
    RETURNING * INTO v_run;

    PERFORM travel_audit(p_user, 'travel_move', 'travel_run', p_run, NULL,
        jsonb_build_object('to_node', p_to_node, 'bb_cost', v_bb_cost, 'notfrequenz', v_notfreq,
                           'surge', v_surge, 'haul', v_run.haul, 'takt', v_run.takt_count,
                           'overstay', v_overstay,
                           'signal', v_signal ->> 'template_key'));

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_travel_move(UUID, UUID, INT, UUID) IS
    'One Takt of travel. PLAYER-class (auth.uid() guard, run_version CAS). With drift_fun_core_enabled: draws a SIGNAL every move (M1) — passive classes apply and log on the spot, interactive ones park in checkpoint.pending_signal and BLOCK the next move until fn_signal_resolve answers; adds the M9 late-window Dissonanz escalation; retires the anonymous deep_surge into the Störung class; opens a Havarie instead of snapping the run shut. Gate off: the 265 behaviour (deep_surge, snap-to-abandoned), and a leftover pending_signal is DRAINED rather than trapping the run. It REBUILDS the checkpoint on every advance — which is safe since W2.6 because every run-level fact (haul_survey, haul_safe, visited, markers, sondierung, overstay) is a COLUMN; the checkpoint holds only what SHOULD be forgotten next move. Since 278 it persists position_node_id BEFORE building the Havarie payload, so drift_havarie_payload sees the node the run strands ON rather than the one it left.';

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.fn_travel_move(uuid, uuid, integer, uuid) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fn_travel_move(uuid, uuid, integer, uuid) TO authenticated, service_role';
END $$;
