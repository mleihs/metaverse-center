"""Integration tests for migration 268 (DRIFT Fun-Kern — Sondierung + Funkboje).

P0's survey economy pays once per node, on first arrival, and never again: there is
nothing to push and nothing to lose. Sondierung is the overdrive — dig the node you are
standing on for a rising yield, and watch the marker stack you are building. Three of a
kind and the node tears open.

What these tests hold to:

* **The yield rises, and the table is the tuning's, not the code's.**
* **The bust is exactly the third marker of one class** — and a Störung's own marker
  counts towards the stack (the Drift can poison a dig site you were counting on).
* **The Riss takes the LOOSE yield of that node and nothing else.** Not the banked
  reserve, not the manifest, not the run. That asymmetry is what makes the Funkboje a
  decision instead of a formality.
* **What the Funkboje transmitted, arrives** — on an Entladung, on a Rückruf, and even on
  a Zerfaserung. If an unravelling swallowed the banked half too, banking would be a
  hedge against a rounding multiplier and the push-your-luck would collapse into
  arithmetic.
* **The recall multiplier never touches the reserve.**
* **Banking at home is refused** — there the Entladung pays in full, so a bank could only
  ever cost the traveller 30 % of their own haul (the W1 dead-option rule, third
  application).
* **Digging IS travelling** — it spends the same window, and the last Takt spent away from
  home strands you exactly as a move would.

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

import pytest

from backend.tests.integration.conftest import requires_supabase
from backend.tests.integration.test_travel_economy import (
    _force_run_state,
    _open_run,
    _profile,
    _reset_traveler,
    _seed_profile,
    _set_gate,
    _tuning,
)

pytestmark = [requires_supabase, pytest.mark.gamedb]


def _run_row(admin_client, run_id) -> dict:
    return (
        admin_client.table("travel_runs").select("*").eq("id", str(run_id)).execute()
    ).data[0]


def _armed_run(admin_client, client, user, chart_home, **force):
    _reset_traveler(admin_client, user)
    _seed_profile(admin_client, user, chart_home["simulation_id"])
    _set_gate(admin_client, True)
    run = _open_run(client, user, chart_home["simulation_id"])
    if force:
        _force_run_state(admin_client, run["id"], **force)
        run = _run_row(admin_client, run["id"])
    return run


def _dig(client, user, run) -> dict:
    return (
        client.rpc(
            "fn_sondieren",
            {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"]},
        )
        .execute()
        .data
    )


def _bank(client, user, run) -> dict:
    return (
        client.rpc(
            "fn_funkboje_bank",
            {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"]},
        )
        .execute()
        .data
    )


def _complete(client, user, run) -> dict:
    return (
        client.rpc(
            "fn_travel_complete",
            {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"]},
        )
        .execute()
        .data
    )


def _log(admin_client, run_id, kind=None) -> list[dict]:
    q = admin_client.table("travel_log_entries").select("*").eq("run_id", str(run_id))
    if kind:
        q = q.eq("kind", kind)
    return q.order("created_at").execute().data


class TestDigging:
    def test_the_yield_rises_with_every_dig(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """The table is drift_tuning.sondierung_yields — never a constant in the code."""
        user, client = test_user_ids[0], user_clients[0]
        yields = _tuning(admin_client, "sondierung_yields")
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=20)

        for expected in yields:
            run = _dig(client, user, run)
            last = run["checkpoint"]["last_sondierung"]
            if last["bust"]:
                # A bust before the table runs out is legitimate (the markers are salted);
                # what the run said about it must still be true.
                assert last["yield"] == 0
                break
            assert last["yield"] == expected

    def test_a_dig_spends_a_takt_and_writes_the_logbook(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=20)
        before = run["window_remaining"]

        after = _dig(client, user, run)

        assert after["window_remaining"] == before - 1
        assert after["takt_count"] == run["takt_count"] + 1
        entries = _log(admin_client, run["id"], "sondierung")
        assert len(entries) == 1
        assert entries[0]["payload"]["dig"] == 1

    def test_the_marker_stack_is_open_and_countable(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """R4: the odds are never numbered, the evidence always is."""
        user, client = test_user_ids[0], user_clients[0]
        classes = _tuning(admin_client, "sondierung_marker_classes")
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=20)
        node = run["position_node_id"]

        run = _dig(client, user, run)
        stack = run["markers"][node]

        assert len(stack) == 1
        assert stack[0] in classes
        assert run["checkpoint"]["last_sondierung"]["marker"] == stack[0]

    def test_digging_is_deterministic(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """Salted, replayable, retry-safe: a repeated call recomputes the same marker
        rather than re-rolling it."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=20)
        first = _dig(client, user, run)["checkpoint"]["last_sondierung"]["marker"]

        # Rewind the run to exactly the pre-dig state (same salt, same node, same dig
        # index) — the same marker must come up. Since W2.6 the dig site and the marker
        # stack are COLUMNS, so the rewind names them instead of a jsonb blob.
        _force_run_state(
            admin_client,
            run["id"],
            markers={},
            sondierung={},
            window_remaining=run["window_remaining"],
            takt_count=run["takt_count"],
        )
        again = _dig(client, user, _run_row(admin_client, run["id"]))
        assert again["checkpoint"]["last_sondierung"]["marker"] == first


class TestBust:
    def _poison(self, admin_client, run, classes) -> dict:
        """Two markers of EVERY class at this node — so the next dig is the third of
        whatever it draws, and the bust is certain regardless of the salt."""
        node = run["position_node_id"]
        # 12 loose: 5 of them dug HERE (the node's own ledger), 7 from elsewhere
        # (haul_survey). The split is the whole point of the next test — a Riss may take
        # only what is loose AT THIS NODE.
        _force_run_state(
            admin_client,
            run["id"],
            haul_survey=7,
            sondierung={node: {"digs": 2, "yield": 5}},
            markers={node: [c for c in classes for _ in range(2)]},
        )
        return _run_row(admin_client, run["id"])

    def test_the_third_of_a_kind_tears_the_node(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        classes = _tuning(admin_client, "sondierung_marker_classes")
        riss = _tuning(admin_client, "sondierung_riss")
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=20, dissonanz=0)
        node = run["position_node_id"]
        run = self._poison(admin_client, run, classes)

        after = _dig(client, user, run)
        last = after["checkpoint"]["last_sondierung"]

        assert last["bust"] is True
        assert last["yield"] == 0
        assert last["forfeited"] == 5
        # The LOOSE yield of this node is gone — and only that.
        assert after["haul"] == 12 - 5
        assert after["dissonanz"] == riss["dz"]
        assert after["sondierung"][node]["rissig"] is True
        assert after["sondierung"][node]["yield"] == 0

    def test_the_bust_never_touches_the_reserve_or_the_manifest(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """The asymmetry that makes banking mean something."""
        user, client = test_user_ids[0], user_clients[0]
        classes = _tuning(admin_client, "sondierung_marker_classes")
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=20)
        node = run["position_node_id"]

        admin_client.rpc(
            "fn_drift_apply_deltas",
            {
                "p_user": str(user),
                "p_run": run["id"],
                "p_deltas": {
                    "cargo_grant": {"family": "blaupausen", "vector": "architecture", "haul": 4}
                },
                "p_source": "test",
            },
        ).execute()
        run = _run_row(admin_client, run["id"])
        # 10 loose = 4 dug here + 4 in the manifest (the Fund above) + 2 from elsewhere.
        _force_run_state(
            admin_client,
            run["id"],
            haul_survey=2,
            haul_safe=9,
            sondierung={node: {"digs": 2, "yield": 4}},
            markers={node: [c for c in classes for _ in range(2)]},
        )
        run = _run_row(admin_client, run["id"])
        assert run["haul"] == 10

        after = _dig(client, user, run)

        assert after["checkpoint"]["last_sondierung"]["bust"] is True
        assert after["haul_safe"] == 9, "the reserve is safe from the Riss"
        assert after["status"] == "active", "a Riss does not end the run"
        cargo = (
            admin_client.table("travel_cargo").select("id").eq("run_id", run["id"]).execute()
        ).data
        assert len(cargo) == 1, "a Riss does not touch the manifest"

    def test_a_stoerungs_marker_counts_towards_the_stack(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """marker_add (a Störung outcome, 267) poisons the dig site: the stack that busts
        is not always the one the traveller built."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=20)
        node = run["position_node_id"]

        for _ in range(2):
            admin_client.rpc(
                "fn_drift_apply_deltas",
                {
                    "p_user": str(user),
                    "p_run": run["id"],
                    "p_deltas": {"marker_add": "statik"},
                    "p_source": "signal:test",
                },
            ).execute()

        run = _run_row(admin_client, run["id"])
        assert run["markers"][node] == ["statik", "statik"]

        # Dig until the salt hands us a statik — the third one must tear the node.
        for _ in range(6):
            run = _dig(client, user, run)
            last = run["checkpoint"]["last_sondierung"]
            if last["marker"] == "statik":
                assert last["bust"] is True, (
                    "two Störungs-markers plus one dug marker of the same class is three"
                )
                return
            assert last["bust"] is False
        pytest.skip("the salt never handed us a statik in six digs")


class TestFunkboje:
    def _at_foreign_dock(self, admin_client, run, chart_foreign, haul):
        _force_run_state(
            admin_client,
            run["id"],
            position_node_id=chart_foreign["id"],
            haul_survey=haul,
        )
        return _run_row(admin_client, run["id"])

    def test_banking_transmits_the_tuned_share(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign
    ):
        user, client = test_user_ids[0], user_clients[0]
        rate = _tuning(admin_client, "funkboje_rate")
        run = _armed_run(admin_client, client, user, chart_home)
        run = self._at_foreign_dock(admin_client, run, chart_foreign, 10)

        after = _bank(client, user, run)

        assert after["haul_safe"] == int(10 * rate)
        assert after["haul"] == 0, "what is transmitted is no longer loose"
        assert _log(admin_client, run["id"], "bank")

    def test_banking_at_home_is_refused(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """At home the Entladung pays 100 % — a bank could only ever cost the traveller
        30 % of their own haul. A dead option is worse than no option."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        _force_run_state(admin_client, run["id"], haul_survey=10)
        run = _run_row(admin_client, run["id"])

        with pytest.raises(Exception, match="AT_HOME"):
            _bank(client, user, run)

    def test_banking_nothing_is_refused(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        run = self._at_foreign_dock(admin_client, run, chart_foreign, 0)

        with pytest.raises(Exception, match="NOTHING_TO_BANK"):
            _bank(client, user, run)

    def test_banking_away_from_a_transmitter_is_refused(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        _force_run_state(
            admin_client,
            run["id"],
            position_node_id=home_neighbor,
            haul_survey=10,
        )
        run = _run_row(admin_client, run["id"])

        with pytest.raises(Exception, match="NO_TRANSMITTER"):
            _bank(client, user, run)


class TestTheReserveArrives:
    """What the Funkboje transmitted, arrives — on every closing path."""

    def _home_with(self, admin_client, run, chart_home, *, haul, safe):
        _force_run_state(
            admin_client,
            run["id"],
            position_node_id=chart_home["id"],
            haul_survey=haul,
            haul_safe=safe,
        )
        return _run_row(admin_client, run["id"])

    def test_entladung_pays_loose_and_reserve(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        run = self._home_with(admin_client, run, chart_home, haul=10, safe=7)

        closed = _complete(client, user, run)

        assert closed["checkpoint"]["closing"]["haul_banked"] == 17
        assert closed["checkpoint"]["closing"]["haul_transmitted"] == 7
        assert closed["checkpoint"]["earnings"]["vp_earned"] >= 17

    def test_the_rueckruf_multiplier_never_touches_the_reserve(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """0.7 is the price of a botched run, not a tax on what you already sent home."""
        user, client = test_user_ids[0], user_clients[0]
        mult = _tuning(admin_client, "havarie_options")["rueckruf"]["haul_mult"]
        run = _armed_run(admin_client, client, user, chart_home)

        # A window Havarie away from home (offers ueberziehen / rueckruf).
        _force_run_state(
            admin_client,
            run["id"],
            window_remaining=1,
            haul_safe=7,
        )
        run = _run_row(admin_client, run["id"])
        stranded = (
            client.rpc(
                "fn_travel_move",
                {"p_user": str(user), "p_run": run["id"],
                 "p_run_version": run["run_version"], "p_to_node": home_neighbor},
            )
            .execute()
            .data
        )
        if stranded["status"] != "havarie":
            pytest.skip("the move did not strand the run")

        loose = stranded["haul"]
        closed = (
            client.rpc(
                "fn_travel_havarie_resolve",
                {"p_user": str(user), "p_run": stranded["id"],
                 "p_run_version": stranded["run_version"], "p_choice": "rueckruf"},
            )
            .execute()
            .data
        )

        assert closed["checkpoint"]["closing"]["haul_banked"] == int(loose * mult) + 7
        assert closed["checkpoint"]["closing"]["haul_transmitted"] == 7

    def test_even_a_rueckzug_pays_the_reserve(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """The Funkboje's promise is unconditional — and a Rückzug is the one closing path
        that is neither a failure nor a success, just a traveller walking away. Which is
        exactly why it was missed: bank 20, withdraw, and 14 already-transmitted points
        evaporated. The reserve is not the run's; it is ashore."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        _force_run_state(admin_client, run["id"], haul_safe=9)
        run = _run_row(admin_client, run["id"])
        vp_before = _profile(admin_client, user)["vp"]

        closed = (
            client.rpc(
                "fn_travel_abandon",
                {"p_user": str(user), "p_run": run["id"],
                 "p_run_version": run["run_version"]},
            )
            .execute()
            .data
        )

        assert closed["status"] == "abandoned"
        assert closed["checkpoint"]["closing"]["reason"] == "rueckzug"
        assert closed["checkpoint"]["closing"]["haul_transmitted"] == 9
        assert _profile(admin_client, user)["vp"] == vp_before + 9

    def test_the_reserve_survives_a_gate_rollback(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """The parity rule says a closed gate leaves no residue; the drain rule says it may
        never EMPTY state it created. Here they pull against each other — and a reserve is
        not residue, it is money the player already banked. Confiscating it on a rollback is
        the worse failure by a wide margin."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        _force_run_state(
            admin_client,
            run["id"],
            kohaerenz=1,
            bandbreite=0,
            haul_safe=6,
        )
        run = _run_row(admin_client, run["id"])
        stranded = (
            client.rpc(
                "fn_travel_move",
                {"p_user": str(user), "p_run": run["id"],
                 "p_run_version": run["run_version"], "p_to_node": home_neighbor},
            )
            .execute()
            .data
        )
        if stranded["status"] != "havarie":
            pytest.skip("the move did not strand the run")

        # The gate flips under the stranded traveller → forced drain (zerfaserung).
        _set_gate(admin_client, False)
        vp_before = _profile(admin_client, user)["vp"]

        drained = (
            client.rpc(
                "fn_travel_havarie_resolve",
                {"p_user": str(user), "p_run": stranded["id"],
                 "p_run_version": stranded["run_version"], "p_choice": "zerfaserung"},
            )
            .execute()
            .data
        )

        assert drained["status"] == "abandoned"
        assert _profile(admin_client, user)["vp"] == vp_before + 6, (
            "a rollback confiscated a haul the traveller had already sent home"
        )

    def test_even_an_unravelling_pays_the_reserve(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """The line that gives banking its meaning. If a Zerfaserung swallowed the banked
        half too, the Funkboje would be a hedge against a rounding multiplier — and the
        whole push-your-luck would collapse into arithmetic."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        _force_run_state(
            admin_client,
            run["id"],
            kohaerenz=1,
            bandbreite=0,
            haul_safe=8,
        )
        run = _run_row(admin_client, run["id"])
        stranded = (
            client.rpc(
                "fn_travel_move",
                {"p_user": str(user), "p_run": run["id"],
                 "p_run_version": run["run_version"], "p_to_node": home_neighbor},
            )
            .execute()
            .data
        )
        if stranded["status"] != "havarie":
            pytest.skip("the move did not strand the run")

        vp_before = _profile(admin_client, user)["vp"]
        closed = (
            client.rpc(
                "fn_travel_havarie_resolve",
                {"p_user": str(user), "p_run": stranded["id"],
                 "p_run_version": stranded["run_version"], "p_choice": "zerfaserung"},
            )
            .execute()
            .data
        )

        assert closed["status"] == "abandoned"
        assert closed["haul"] == 0, "the loose half is gone"
        assert closed["checkpoint"]["closing"]["haul_transmitted"] == 8
        assert _profile(admin_client, user)["vp"] == vp_before + 8, (
            "what the traveller transmitted arrived, even though they did not"
        )


class TestGuards:
    def test_the_reserve_survives_a_move(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """fn_travel_move REBUILDS the checkpoint on every advance, and the reserve must not
        evaporate on the next Takt.

        It used to be a checkpoint key kept alive by a whitelist (drift_checkpoint_carry) —
        and it nearly shipped under the name `haul_banked`, which was ALREADY the closing
        receipt of a finished run: one key, two meanings, and every banked haul would have
        vanished silently. Since W2.6 it is a COLUMN and the rebuild cannot reach it."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        _force_run_state(admin_client, run["id"], haul_safe=6)
        run = _run_row(admin_client, run["id"])

        moved = (
            client.rpc(
                "fn_travel_move",
                {"p_user": str(user), "p_run": run["id"],
                 "p_run_version": run["run_version"], "p_to_node": home_neighbor},
            )
            .execute()
            .data
        )
        assert moved["haul_safe"] == 6

    def test_a_pending_scene_blocks_the_shovel(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=10)
        _force_run_state(
            admin_client,
            run["id"],
            checkpoint={
                **run["checkpoint"],
                "pending_signal": {"template_key": "x", "signal_class": "stoerung"},
            },
        )
        run = _run_row(admin_client, run["id"])

        with pytest.raises(Exception, match="SIGNAL_PENDING"):
            _dig(client, user, run)

    def test_an_empty_window_cannot_be_dug(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=0)
        with pytest.raises(Exception, match="WINDOW_EMPTY"):
            _dig(client, user, run)

    def test_the_last_takt_spent_away_from_home_strands_the_run(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """Digging IS travelling: it spends the same window, and the floor is the same."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        _force_run_state(
            admin_client, run["id"], position_node_id=home_neighbor, window_remaining=1
        )
        run = _run_row(admin_client, run["id"])

        after = _dig(client, user, run)

        assert after["status"] == "havarie"
        assert after["checkpoint"]["havarie"]["cause"] == "window"

    def test_gate_off_refuses_the_shovel_and_the_boje(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=10)
        _set_gate(admin_client, False)

        with pytest.raises(Exception, match="GATE_CLOSED"):
            _dig(client, user, run)
        with pytest.raises(Exception, match="GATE_CLOSED"):
            _bank(client, user, run)

    def test_stale_version_is_refused(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=10)
        with pytest.raises(Exception, match="RUN_STALE"):
            _dig(client, user, {**run, "run_version": run["run_version"] - 1})


class TestTheFunkbojeSettlesItsLedgers:
    """`haul` is not a lone number — two sub-ledgers record where the LOOSE haul came from,
    and both are read as a debit later. Transmitting the haul must settle them in the same
    breath, or they keep pointing at money that is no longer loose.

    The Gesamtabnahme review found both directions of the same staleness, and 173 green
    tests had seen neither: a bust after a bank confiscated haul dug somewhere else
    entirely, AND — because the Funkboje costs no Takt — dig → bank → dig → bank turned the
    Riss into a free ride, which is the push-your-luck of the whole wave evaporating.
    """

    def _dug_and_banked(self, admin_client, client, user, run, chart_foreign):
        """One dig at a foreign dock, then transmit it. Returns (run, first_yield)."""
        _force_run_state(admin_client, run["id"], position_node_id=chart_foreign["id"])
        run = _run_row(admin_client, run["id"])
        run = _dig(client, user, run)
        dug = run["checkpoint"]["last_sondierung"]["yield"]
        assert dug > 0, "the first dig at a fresh node cannot bust (it takes three markers)"
        return _bank(client, user, run), dug

    def test_banking_zeroes_the_node_yield_but_not_the_node(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=20)
        banked, _ = self._dug_and_banked(admin_client, client, user, run, chart_foreign)

        at_node = banked["sondierung"][str(chart_foreign["id"])]
        assert at_node["yield"] == 0, "what is ashore can no longer be confiscated"
        assert at_node["digs"] == 1, "banking does not un-dig the hole — the table moves on"

    def test_a_bust_after_a_bank_cannot_confiscate_what_it_never_paid_for(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign
    ):
        """The regression, stated as the player would feel it: dig a node, transmit it, earn
        fresh haul elsewhere, come back and tear the node open — and lose only what is
        actually still loose AT THAT NODE, which is nothing. Before the fix the stale node
        ledger ate the 7 points the traveller had dug somewhere else.
        """
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=20)
        banked, dug = self._dug_and_banked(admin_client, client, user, run, chart_foreign)
        safe_before = banked["haul_safe"]

        # Fresh loose haul from elsewhere, and a marker stack that busts on ANY draw:
        # two of every class means the next marker — whatever the salt hands us — is a third.
        classes = _tuning(admin_client, "sondierung_marker_classes")
        _force_run_state(
            admin_client,
            banked["id"],
            haul_survey=7,
            markers={str(chart_foreign["id"]): [c for c in classes for _ in range(2)]},
        )
        armed = _run_row(admin_client, banked["id"])
        assert armed["haul"] == 7, "the banked dig is ashore — only the fresh 7 are loose"

        torn = _dig(client, user, armed)

        assert torn["checkpoint"]["last_sondierung"]["bust"] is True, "two of each = a bust"
        assert torn["haul"] == 7, (
            f"the Riss took haul dug elsewhere: expected 7, got {torn['haul']} "
            f"(the stale node ledger still claimed the {dug} that were banked)"
        )
        assert torn["haul_safe"] == safe_before, "the reserve is never touched"

    def test_banking_settles_the_freight_ledger_too(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign
    ):
        """travel_cargo.haul_value is what a Notabwurf deducts from the loose haul. Once the
        Fund's haul is ashore, throwing the crate overboard must not deduct it a second time.
        """
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        admin_client.table("travel_cargo").insert(
            {
                "owner_user_id": str(user),
                "run_id": run["id"],
                "family": "kontrakte",   # one of the 7 cargo families (241) — as a Fund grants
                "vector": "commerce",
                "manifest_slot": 0,
                "haul_value": 6,
            }
        ).execute()
        run = self._at_foreign_dock_for(admin_client, run, chart_foreign, haul=6)

        _bank(client, user, run)

        rows = (
            admin_client.table("travel_cargo").select("haul_value").eq("run_id", run["id"])
        ).execute().data
        assert rows[0]["haul_value"] == 0, "transmitted freight stops paying a second time"

    @staticmethod
    def _at_foreign_dock_for(admin_client, run, chart_foreign, *, haul):
        # No haul_survey here: the loose haul comes ENTIRELY from the manifest row the caller
        # inserted (travel_cargo.haul_value), which is exactly the ledger under test.
        _force_run_state(
            admin_client, run["id"], position_node_id=chart_foreign["id"]
        )
        run = _run_row(admin_client, run["id"])
        assert run["haul"] == haul, "the freight IS the loose haul"
        return run


class TestTheReserveOutlivesTheGate:
    """A closed gate leaves no residue — but a transmitted reserve is not residue, it is
    money the traveller already brought ashore under an OPEN gate. Zerfaserung and Rückzug
    were told this (W2/2.5). The Entladung — the third and likeliest closing path, the one
    where the traveller simply walks home — was not.
    """

    def test_the_entladung_pays_the_reserve_with_the_gate_shut(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        ratio = _tuning(admin_client, "reward_survey_siegel_ratio")
        per_haul = _tuning(admin_client, "reward_survey_vp_per_haul")
        run = _armed_run(admin_client, client, user, chart_home)
        _force_run_state(
            admin_client,
            run["id"],
            position_node_id=chart_home["id"],
            haul_survey=10,
            haul_safe=8,
        )
        run = _run_row(admin_client, run["id"])
        before = _profile(admin_client, user)

        # The rollback lands mid-run: the traveller banked under an open gate and walks home
        # into a closed one.
        _set_gate(admin_client, False)
        closed = _complete(client, user, run)

        after = _profile(admin_client, user)
        assert after["siegel"] == before["siegel"] + int(8 * ratio), (
            "the reserve pays, even with the gate shut — it was banked under an open one"
        )
        assert after["vp"] == before["vp"] + 8 * per_haul
        closing = closed["checkpoint"]["closing"]
        assert closing["haul_banked"] == 10 + 8

        # THE RECEIPT FOLLOWS THE MONEY (W2.6). This assertion used to be its opposite:
        # `"earnings" not in checkpoint`, on the grounds that a shut gate must leave the exact
        # migration-256 key set. But money DID move here — real Siegel, into a real account —
        # and a receipt for a payment that actually happened is not rollback residue. Hiding it
        # only made the HUD lie: the ledger strip kept showing the old balance while the
        # traveller had already been paid. (fn_travel_zerfasern always wrote it; fn_travel_bank_run
        # hid it. That inconsistency is what the consolidation surfaced.)
        assert closed["checkpoint"]["earnings"]["source"] == "entladung_transmitted"
        assert closed["checkpoint"]["earnings"]["siegel_earned"] == int(8 * ratio)

        # What a shut gate still must NOT do: state a Fun-Kern fact in the receipt.
        assert "haul_transmitted" not in closing, "no Fun-Kern key behind a shut gate"
        # And the LOOSE haul does not pay: it is the wave's own mechanic, and the gate is shut.
        assert after["siegel"] - before["siegel"] < int((10 + 8) * ratio)
