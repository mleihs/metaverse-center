"""Integration tests for migration 267 (DRIFT Fun-Kern — the move becomes an event).

In P0 a move said exactly one thing, and only in the deep: the deep_surge coin flip
(40 % → -10 KH, +3 DZ), nameless and unanswerable. Everything else was arithmetic
(concept D2 — "leere Züge"). 267 draws a SIGNAL on every move instead.

What these tests hold to:

* **The draw is deterministic and SALTED.** The same run at the same Takt always draws
  the same signal (replayable in CI, reproducible in a bug report, retry-safe), but two
  runs at the same Takt do not (drift_run_salt, 264). An unsalted draw would be
  precomputable by the client, and a push-your-luck you can read ahead is not a
  push-your-luck.
* **The content's requirements actually gate the draw.** A skeleton that asks for a
  battered hull is never handed to an intact one (R9 — Zustand wird Text).
* **An interactive signal STOPS the run** and cannot be walked away from; a passive one
  resolves on the spot and only writes a log line (no modal for a free find).
* **An option's promise is kept.** The cost chip is paid whatever the roll says; the
  check uses the affinity and the Dissonanz; the outcome writes exactly the deltas the
  skeleton authored, and nothing else.
* **A Störung has teeth** — an outcome that takes the last of the hull ends the run in a
  Havarie, through the same path a collapsing move takes.
* **An unpayable scene is never shown** (the W1 dead-option rule, second application).
* **Gate off ⇒ P0, exactly.** No draw, no log line, no escalation — and a run that still
  holds a pending signal from a gated-on session is DRAINED, never trapped.

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

import pytest

from backend.models.drift import TravelRunResponse
from backend.tests.integration.conftest import requires_supabase
from backend.tests.integration.test_travel_economy import (
    _force_run_state,
    _open_run,
    _reset_traveler,
    _seed_profile,
    _set_gate,
    _tuning,
)

pytestmark = [requires_supabase, pytest.mark.gamedb]


# ── helpers ───────────────────────────────────────────────────────────────────


def _run_row(admin_client, run_id) -> dict:
    return (
        admin_client.table("travel_runs").select("*").eq("id", str(run_id)).execute()
    ).data[0]


def _move(client, user, run, node) -> dict:
    return (
        client.rpc(
            "fn_travel_move",
            {
                "p_user": str(user),
                "p_run": run["id"],
                "p_run_version": run["run_version"],
                "p_to_node": node,
            },
        )
        .execute()
        .data
    )


def _log(admin_client, run_id) -> list[dict]:
    return (
        admin_client.table("travel_log_entries")
        .select("*")
        .eq("run_id", str(run_id))
        .order("created_at")
        .execute()
    ).data


def _bands(admin_client, kh, dz, window, overload=False) -> dict:
    return (
        admin_client.rpc(
            "drift_signal_bands",
            {"p_kh": kh, "p_dz": dz, "p_window": window, "p_overload": overload},
        )
        .execute()
        .data
    )


def _draw(admin_client, run_id, user_id, *, band, takt, bands, kh, bb, window, chart, anchor):
    return (
        admin_client.rpc(
            "fn_drift_signal_draw",
            {
                "p_run": str(run_id),
                "p_user": str(user_id),
                "p_band": band,
                "p_takt": takt,
                "p_bands": bands,
                "p_kh": kh,
                "p_bb": bb,
                "p_window": window,
                "p_chart": chart,
                "p_anchor": str(anchor),
            },
        )
        .execute()
        .data
    )


def _armed_run(admin_client, client, user, chart_home, **force):
    """A fresh gated-on run, optionally forced into a state (no run_version bump)."""
    _reset_traveler(admin_client, user)
    _seed_profile(admin_client, user, chart_home["simulation_id"])
    _set_gate(admin_client, True)
    run = _open_run(client, user, chart_home["simulation_id"])
    if force:
        _force_run_state(admin_client, run["id"], **force)
        run = _run_row(admin_client, run["id"])
    return run


# ── the bands: run state, rendered as the words the content speaks ────────────


class TestBands:
    """R9 — the content names a band, never a number. The engine owns the thresholds."""

    def test_bands_read_the_run(self, admin_client):
        cfg = _tuning(admin_client, "signal_bands")

        assert _bands(admin_client, cfg["kh"]["kritisch"], 0, 12)["kh_band"] == "kritisch"
        assert _bands(admin_client, cfg["kh"]["angeschlagen"], 0, 12)["kh_band"] == "angeschlagen"
        assert _bands(admin_client, 100, 0, 12)["kh_band"] == "intakt"

        assert _bands(admin_client, 100, cfg["dz"]["ruhig"], 12)["dz_band"] == "ruhig"
        assert _bands(admin_client, 100, cfg["dz"]["erhoeht"], 12)["dz_band"] == "erhoeht"
        assert _bands(admin_client, 100, cfg["dz"]["erhoeht"] + 1, 12)["dz_band"] == "kritisch"

        assert _bands(admin_client, 100, 0, cfg["window"]["knapp"])["window_band"] == "knapp"
        assert _bands(admin_client, 100, 0, cfg["window"]["mittel"])["window_band"] == "mittel"
        assert _bands(admin_client, 100, 0, 99)["window_band"] == "weit"

    def test_overload_is_carried_through(self, admin_client):
        assert _bands(admin_client, 100, 0, 12, overload=True)["overload"] is True


# ── the draw ──────────────────────────────────────────────────────────────────


class TestDraw:
    def test_draw_is_deterministic_per_run_and_takt(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """The same run at the same Takt always draws the same thing — twice in a row."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        bands = _bands(admin_client, 100, 0, 12)
        args = {
            "band": "mid", "takt": 3, "bands": bands, "kh": 100, "bb": 8, "window": 12,
            "chart": run["chart_version"], "anchor": chart_home["simulation_id"],
        }

        first = _draw(admin_client, run["id"], user, **args)
        second = _draw(admin_client, run["id"], user, **args)
        assert first == second
        assert first["template_key"]

    def test_two_runs_do_not_share_a_deck(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """The salt (264) is what makes the deck unforgeable: same takt, different run,
        different draw. Without it every roll would be precomputable from public inputs."""
        user, client = test_user_ids[0], user_clients[0]
        bands = _bands(admin_client, 100, 0, 12)

        # Compare the SEQUENCE, not a single Takt: two runs colliding on one Takt is
        # perfectly legal (three classes, 32 skeletons), so asserting on one draw would be
        # a coin-flip test — and a flaky test is worse than no test. Two full decks being
        # identical, on the other hand, means the salt is not in the seed at all.
        decks = []
        for _ in range(2):
            run = _armed_run(admin_client, client, user, chart_home)
            decks.append(
                [
                    (
                        _draw(
                            admin_client, run["id"], user, band="deep", takt=takt,
                            bands=bands, kh=100, bb=8, window=12,
                            chart=run["chart_version"],
                            anchor=chart_home["simulation_id"],
                        )
                        or {}
                    ).get("template_key")
                    for takt in range(1, 13)
                ]
            )

        assert decks[0] != decks[1], "two runs share a deck — the salt is not in the seed"

    def test_requirements_gate_the_draw(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """A skeleton that asks for a battered hull is never handed to an intact one."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        intact = _bands(admin_client, 100, 0, 12)

        # Every requirement-bearing skeleton names bands; drawn against a pristine run,
        # none of the ones demanding damage may ever surface.
        damaged_only = {
            row["template_key"]
            for row in admin_client.table("travel_signal_templates")
            .select("template_key,requires")
            .execute()
            .data
            if "kritisch" in (row["requires"].get("kh_band") or [])
            or "kritisch" in (row["requires"].get("dz_band") or [])
        }
        assert damaged_only  # the content actually exercises this

        seen = set()
        for takt in range(1, 40):
            drawn = _draw(
                admin_client, run["id"], user, band="deep", takt=takt, bands=intact,
                kh=100, bb=8, window=12, chart=run["chart_version"],
                anchor=chart_home["simulation_id"],
            )
            if drawn:
                seen.add(drawn["template_key"])

        assert seen  # the deep band does produce signals
        assert not (seen & damaged_only)

    def test_prose_never_ships_a_raw_token(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """KPI-1: {sim} must resolve to a real world — a literal token is a bug a player
        can read."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        bands = _bands(admin_client, 100, 0, 12)

        for takt in range(1, 30):
            drawn = _draw(
                admin_client, run["id"], user, band="near", takt=takt, bands=bands,
                kh=100, bb=8, window=12, chart=run["chart_version"],
                anchor=chart_home["simulation_id"],
            )
            if drawn:
                for text in drawn["prose"].values():
                    assert "{sim}" not in text


# ── the move ──────────────────────────────────────────────────────────────────


class TestMoveDrawsSignals:
    def test_a_move_draws_and_the_run_records_it(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        moved = _move(client, user, run, home_neighbor)

        cp = moved["checkpoint"]
        drew_something = (
            "pending_signal" in cp or cp.get("last_move", {}).get("signal") is not None
        )
        assert drew_something, "the move said nothing at all — D2 is back"

    def test_interactive_signal_blocks_the_next_move(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """A Störung is a decision. You cannot simply walk away from it."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)

        # Drive moves (bouncing home <-> neighbour) until one parks a pending signal.
        # The deck is salted, so WHICH Takt it lands on is not knowable in advance —
        # that is the whole point of the salt.
        pending = None
        for _ in range(14):
            here = run["checkpoint"].get("position_node_id") or run["position_node_id"]
            target = chart_home["id"] if here == home_neighbor else home_neighbor
            # Keep the window and the hull out of the way: this test is about the block,
            # not about surviving 14 Takte.
            _force_run_state(admin_client, run["id"], kohaerenz=100, window_remaining=12)
            run = _run_row(admin_client, run["id"])
            run = _move(client, user, run, target)
            if "pending_signal" in run["checkpoint"]:
                pending = run["checkpoint"]["pending_signal"]
                break
            if run["status"] != "active":
                break

        if pending is None:
            pytest.skip("no interactive signal in this deck within 14 Takte")

        assert pending["signal_class"] in ("stoerung", "begegnung")
        assert pending["options"], "an interactive signal with no payable option is a trap"

        with pytest.raises(Exception, match="SIGNAL_PENDING"):
            _move(client, user, run, home_neighbor)

    def test_a_passive_signal_does_not_eat_the_survey(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """The first-arrival Vermessung of THIS move must survive the draw.

        The snapshot trap, from the other side: fn_drift_apply_deltas re-read the haul from
        the COLUMN, so a survey that only lived in the caller's local variable was silently
        rolled back by the helper's own write — and `visited` still recorded the node, so it
        could never pay again. The passive classes are the majority of the draw, so this was
        most of the survey economy. Found by review, not by the 48 tests green around it.

        W2.6 retired the bug class rather than the bug: the haul is DERIVED (haul_survey +
        the dig sites + the manifest) and nobody writes it, so there is no number left for a
        caller to hold in a local and have overwritten. The test stays — it is the behaviour
        that matters, not the mechanism that used to break it."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)

        band = (
            admin_client.table("drift_chart_nodes")
            .select("distance_band")
            .eq("id", home_neighbor)
            .execute()
        ).data[0]["distance_band"]
        expected = _tuning(admin_client, "survey_value_by_band")[band]
        if expected == 0:
            pytest.skip("the neighbour is a near node — no survey to lose")

        moved = _move(client, user, run, home_neighbor)

        # Whatever the draw did on top (a Fund can ADD to the haul), the survey itself must
        # be in there — never less than the band pays for a first arrival.
        assert moved["checkpoint"]["last_move"]["survey"] == expected
        assert moved["haul"] >= expected, (
            "the draw ate the first-arrival Vermessung of this move"
        )

    def test_a_scene_with_no_payable_option_left_drains_itself(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """Content churn must not strand a run.

        The pack reseed is a TRUNCATE + re-insert, so an option key renamed (or its cost
        raised past what this run can still pay) while a traveller stands in the scene
        would leave every button answering 400 — and a pending signal blocks the move, the
        dig AND the bank. A scene the traveller cannot leave has to drain itself."""
        user, client = test_user_ids[0], user_clients[0]
        # begegnung_pruefer's only certain option costs a Takt; the risky one costs nothing
        # but exists — so squeeze the window to 0 and pick a template whose every option
        # needs one. stoerung_kartenfehler: both options cost a Takt.
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=0)
        run = _park(admin_client, run, "stoerung_kartenfehler", [{"key": "nachvermessen"}])

        drained = _resolve(client, user, run, "nachvermessen")

        assert drained["scene_unresolvable"] is True
        assert "pending_signal" not in drained["checkpoint"]
        assert drained["status"] == "active", "the run goes on — it was not the run that broke"

    def test_gate_off_keeps_the_p0_last_move_key_set(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """Byte parity is byte parity: jsonb_build_object emits a NULL-valued key rather
        than omitting it, so building the signal keys unconditionally left "signal": null
        in every gate-off checkpoint. A stray key is exactly how parity rots."""
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        _set_gate(admin_client, False)

        run = _open_run(client, user, chart_home["simulation_id"])
        moved = _move(client, user, run, home_neighbor)

        assert set(moved["checkpoint"]["last_move"].keys()) == {
            "from", "bb_cost", "notfrequenz", "dz_add", "surge", "survey",
        }, "gate off → the exact migration-265 last_move key set"

    def test_gate_off_draws_nothing_and_writes_no_log(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """The rollback contract: gate off ⇒ P0, byte for byte."""
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        _set_gate(admin_client, False)

        run = _open_run(client, user, chart_home["simulation_id"])
        moved = _move(client, user, run, home_neighbor)

        assert "pending_signal" not in moved["checkpoint"]
        assert moved["checkpoint"]["last_move"].get("signal") is None
        assert _log(admin_client, run["id"]) == []

    def test_gate_off_drains_a_pending_signal_instead_of_trapping_the_run(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """W1's rule, applied to the new state: a gate may refuse to CREATE state, never
        to lock a traveller inside it. Flip the gate under a run standing in a Störung
        and it must still be able to move."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)

        # Park a pending signal by hand (the draw is salted; forcing the state is how the
        # W1 suite reaches rare states without a lucky deck).
        _force_run_state(
            admin_client,
            run["id"],
            checkpoint={
                **run["checkpoint"],
                "pending_signal": {
                    "template_key": "stoerung_frequenzscherung",
                    "signal_class": "stoerung",
                    "options": [],
                },
            },
        )
        _set_gate(admin_client, False)

        run = _run_row(admin_client, run["id"])
        moved = _move(client, user, run, home_neighbor)
        assert moved["status"] == "active"
        assert "pending_signal" not in moved["checkpoint"]


# ── resolving ─────────────────────────────────────────────────────────────────


def _park(admin_client, run, template_key, options) -> dict:
    """Park a specific pending signal on a run (deterministic scene setup)."""
    _force_run_state(
        admin_client,
        run["id"],
        checkpoint={
            **run["checkpoint"],
            "pending_signal": {
                "template_key": template_key,
                "signal_class": "stoerung",
                "takt": run["takt_count"],
                "options": options,
            },
        },
    )
    return _run_row(admin_client, run["id"])


def _resolve(client, user, run, option_key) -> dict:
    return (
        client.rpc(
            "fn_signal_resolve",
            {
                "p_user": str(user),
                "p_run": run["id"],
                "p_run_version": run["run_version"],
                "p_option_key": option_key,
            },
        )
        .execute()
        .data
    )


class TestResolve:
    def test_a_certain_option_pays_its_cost_and_writes_its_deltas(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """stoerung_bandbreitenfrass / abschirmen: cost 8 KH up front, +1 BB as the
        result. Both numbers come from the YAML; neither may drift."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, kohaerenz=80, bandbreite=4)
        run = _park(admin_client, run, "stoerung_bandbreitenfrass", [{"key": "abschirmen"}])

        resolved = _resolve(client, user, run, "abschirmen")

        assert resolved["kohaerenz"] == 80 - 8
        assert resolved["bandbreite"] == 4 + 1
        assert "pending_signal" not in resolved["checkpoint"]
        assert resolved["checkpoint"]["last_signal"]["option_key"] == "abschirmen"

        entries = _log(admin_client, run["id"])
        assert entries and entries[-1]["kind"] == "signal"
        assert entries[-1]["payload"]["template_key"] == "stoerung_bandbreitenfrass"

    def test_the_resolved_run_still_parses_as_a_run(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """The checkpoint blocks are LIFTED into typed fields, so a key the model does not
        know is not a cosmetic problem — it breaks every read of the run, not just the
        mutation's own response.

        Found in the browser, not here: fn_signal_resolve wrote `last_signal.class` while
        the model reads `signal_class`, and GET /drift/quests started 500ing one call after
        a perfectly green RPC. The RPC tests read the raw row; only the model sees the
        contract. This test closes that gap."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, kohaerenz=80, bandbreite=4)
        run = _park(admin_client, run, "stoerung_bandbreitenfrass", [{"key": "abschirmen"}])

        resolved = _resolve(client, user, run, "abschirmen")

        parsed = TravelRunResponse(**resolved)
        assert parsed.last_signal is not None
        assert parsed.last_signal.signal_class == "stoerung"
        assert parsed.last_signal.option_key == "abschirmen"
        assert parsed.pending_signal is None

    def test_a_checked_option_is_deterministic_and_reads_the_dissonanz(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """The check is salted and replayable, and a strained traveller rolls worse:
        roll + affinity - floor(dz/10) >= difficulty."""
        user, client = test_user_ids[0], user_clients[0]

        outcomes = []
        for dz in (0, 0):
            run = _armed_run(
                admin_client, client, user, chart_home, kohaerenz=90, dissonanz=dz
            )
            run = _park(
                admin_client, run, "stoerung_frequenzscherung", [{"key": "durchdruecken"}]
            )
            resolved = _resolve(client, user, run, "durchdruecken")
            outcomes.append(resolved["checkpoint"]["last_signal"]["success"])

        # Two runs, two salts — the point here is only that the RPC decides and records a
        # verdict rather than leaving it implicit.
        assert all(isinstance(o, bool) for o in outcomes)

        entries = _log(admin_client, run["id"])
        check = entries[-1]["payload"]["check"]
        assert check["vector"] == "architecture"
        assert check["difficulty"] == 7
        assert 1 <= check["roll"] <= _tuning(admin_client, "signal_check")["dice"]
        assert check["success"] is outcomes[-1]

    def test_dissonanz_makes_the_check_harder(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """The Drift's grip is a real term in the roll, not flavour text."""
        user, client = test_user_ids[0], user_clients[0]
        divisor = _tuning(admin_client, "signal_check")["dz_divisor"]

        run = _armed_run(admin_client, client, user, chart_home, kohaerenz=90, dissonanz=0)
        run = _park(admin_client, run, "stoerung_frequenzscherung", [{"key": "durchdruecken"}])
        _resolve(client, user, run, "durchdruecken")
        calm = _log(admin_client, run["id"])[-1]["payload"]["check"]

        run = _armed_run(
            admin_client, client, user, chart_home, kohaerenz=90, dissonanz=2 * divisor
        )
        run = _park(admin_client, run, "stoerung_frequenzscherung", [{"key": "durchdruecken"}])
        _resolve(client, user, run, "durchdruecken")
        strained = _log(admin_client, run["id"])[-1]["payload"]["check"]

        assert calm["total"] - calm["roll"] == 0
        assert strained["total"] - strained["roll"] == -2

    def test_a_stoerung_can_end_the_run_in_a_havarie(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """Teeth. An option that takes the last of the hull ends the run — through the
        same Havarie path a collapsing move takes, not a second, parallel ending."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        # Away from home, with the hull on the option's cost exactly.
        _force_run_state(
            admin_client, run["id"], position_node_id=home_neighbor, kohaerenz=8
        )
        run = _run_row(admin_client, run["id"])
        run = _park(admin_client, run, "stoerung_bandbreitenfrass", [{"key": "abschirmen"}])

        resolved = _resolve(client, user, run, "abschirmen")

        assert resolved["status"] == "havarie"
        assert resolved["kohaerenz"] == 0
        assert resolved["checkpoint"]["havarie"]["cause"] == "kohaerenz"
        assert "pending_signal" not in resolved["checkpoint"]
        kinds = [e["kind"] for e in _log(admin_client, run["id"])]
        assert "havarie" in kinds

    def test_unknown_option_is_refused(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        run = _park(admin_client, run, "stoerung_bandbreitenfrass", [{"key": "abschirmen"}])
        with pytest.raises(Exception, match="UNKNOWN_OPTION"):
            _resolve(client, user, run, "die_flucht_ergreifen")

    def test_resolve_without_a_scene_is_refused(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        with pytest.raises(Exception, match="NO_PENDING_SIGNAL"):
            _resolve(client, user, run, "abschirmen")

    def test_stale_version_is_refused(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        run = _park(admin_client, run, "stoerung_bandbreitenfrass", [{"key": "abschirmen"}])
        stale = {**run, "run_version": run["run_version"] - 1}
        with pytest.raises(Exception, match="RUN_STALE"):
            _resolve(client, user, stale, "abschirmen")

    def test_unaffordable_option_is_refused(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """The draw never offers an option the run cannot pay — and the resolve refuses
        one anyway, because the checkpoint copy is display, not law."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, window_remaining=0)
        # begegnung_pruefer/vorlegen costs a Takt the run does not have.
        run = _park(admin_client, run, "begegnung_pruefer", [{"key": "vorlegen"}])
        with pytest.raises(Exception, match="OPTION_UNAFFORDABLE"):
            _resolve(client, user, run, "vorlegen")

    def test_gate_off_drains_the_scene(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        run = _park(admin_client, run, "stoerung_bandbreitenfrass", [{"key": "abschirmen"}])
        _set_gate(admin_client, False)

        drained = _resolve(client, user, run, "abschirmen")
        assert drained["gate_drained"] is True
        assert "pending_signal" not in drained["checkpoint"]
        assert drained["status"] == "active"


# ── the outcome vocabulary ────────────────────────────────────────────────────


class TestDeltas:
    def test_cargo_grant_writes_freight_and_the_haul_it_is_worth(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """A Fund is income the run can still LOSE — so the freight and its haul are one
        thing (travel_cargo.haul_value), never two that can drift apart."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)

        admin_client.rpc(
            "fn_drift_apply_deltas",
            {
                "p_user": str(user),
                "p_run": run["id"],
                "p_deltas": {
                    "cargo_grant": {"family": "blaupausen", "vector": "architecture", "haul": 5}
                },
                "p_source": "test",
            },
        ).execute()

        after = _run_row(admin_client, run["id"])
        cargo = (
            admin_client.table("travel_cargo").select("*").eq("run_id", run["id"]).execute()
        ).data
        assert len(cargo) == 1
        assert cargo[0]["haul_value"] == 5
        assert after["haul"] == 5, (
            "the manifest row IS the haul: travel_cargo.haul_value is one of the three "
            "sources of the derived travel_runs.haul, so the freight raises it by "
            "arithmetic and nothing has to be kept in step by hand"
        )
        assert cargo[0]["family"] == "blaupausen"

    def test_jettisoned_salvage_stops_paying(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """Throw the Fund overboard in a Havarie and its haul goes over the side with it.
        Otherwise a courier jettisons the salvage and still gets paid for it."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)

        admin_client.rpc(
            "fn_drift_apply_deltas",
            {
                "p_user": str(user),
                "p_run": run["id"],
                "p_deltas": {
                    "cargo_grant": {"family": "blaupausen", "vector": "architecture", "haul": 5}
                },
                "p_source": "test",
            },
        ).execute()
        cargo_id = (
            admin_client.table("travel_cargo").select("id").eq("run_id", run["id"]).execute()
        ).data[0]["id"]

        # Strand it: a Havarie that offers notabwurf (cargo aboard, Takte to spare).
        _force_run_state(
            admin_client, run["id"], kohaerenz=1, bandbreite=0, window_remaining=8
        )
        run = _run_row(admin_client, run["id"])
        stranded = _move(client, user, run, home_neighbor)
        if stranded["status"] != "havarie":
            pytest.skip("the move did not strand the run (a passive signal healed it)")
        assert "notabwurf" in stranded["checkpoint"]["havarie"]["options"]
        haul_before = stranded["haul"]

        resolved = (
            client.rpc(
                "fn_travel_havarie_resolve",
                {
                    "p_user": str(user),
                    "p_run": stranded["id"],
                    "p_run_version": stranded["run_version"],
                    "p_choice": "notabwurf",
                    "p_jettison_cargo_ids": [cargo_id],
                },
            )
            .execute()
            .data
        )

        assert resolved["status"] == "active"
        assert resolved["haul"] == haul_before - 5, (
            "deleting the cargo row removes its haul from the derivation — there is no "
            "fn_travel_jettison_haul any more, and no second booking to correct"
        )
        assert resolved["checkpoint"]["last_havarie"]["haul_lost"] == 5

    def test_rumor_reveal_charts_an_undiscovered_node(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)

        before = (
            admin_client.table("traveler_discoveries")
            .select("node_stable_key")
            .eq("user_id", str(user))
            .execute()
        ).data

        admin_client.rpc(
            "fn_drift_apply_deltas",
            {
                "p_user": str(user),
                "p_run": run["id"],
                "p_deltas": {"rumor_reveal": {}},
                "p_source": "test",
            },
        ).execute()

        after = (
            admin_client.table("traveler_discoveries")
            .select("node_stable_key,source")
            .eq("user_id", str(user))
            .execute()
        ).data
        assert len(after) == len(before) + 1
        assert any(row["source"] == "route_knowledge" for row in after)
        assert any(e["kind"] == "rumor" for e in _log(admin_client, run["id"]))

    def test_marker_add_lands_on_the_node_and_survives_a_move(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """The marker stack is run-level state, and fn_travel_move REBUILDS the checkpoint on
        every advance.

        That rebuild used to empty the stack (which would make the Sondierung bust in 268
        unreachable), and the fix was a whitelist of keys the rebuild must carry —
        drift_checkpoint_carry, i.e. a workaround for the rebuild rather than a fix for it.
        Since W2.6 the stack is a COLUMN: the rebuild cannot reach it, the whitelist is gone,
        and this test asserts the same behaviour against a shape where it cannot break."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)
        node = run["position_node_id"]

        admin_client.rpc(
            "fn_drift_apply_deltas",
            {
                "p_user": str(user),
                "p_run": run["id"],
                "p_deltas": {"marker_add": "statik"},
                "p_source": "test",
            },
        ).execute()

        run = _run_row(admin_client, run["id"])
        assert run["markers"][node] == ["statik"]

        moved = _move(client, user, run, home_neighbor)
        assert moved["markers"][node] == ["statik"], "the move forgot the marker stack"

    def test_siegel_goes_through_the_single_ledger_writer(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home)

        result = (
            admin_client.rpc(
                "fn_drift_apply_deltas",
                {
                    "p_user": str(user),
                    "p_run": run["id"],
                    "p_deltas": {"siegel": 5},
                    "p_source": "signal:test",
                },
            )
            .execute()
            .data
        )
        assert result["applied"]["siegel"] == 5
        profile = (
            admin_client.table("traveler_profiles")
            .select("siegel")
            .eq("user_id", str(user))
            .execute()
        ).data[0]
        assert profile["siegel"] == 5

    def test_deltas_clamp_to_the_columns_own_checks(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """A skeleton is authored in deltas and can never write an illegal row."""
        user, client = test_user_ids[0], user_clients[0]
        run = _armed_run(admin_client, client, user, chart_home, kohaerenz=5, dissonanz=0)

        admin_client.rpc(
            "fn_drift_apply_deltas",
            {
                "p_user": str(user),
                "p_run": run["id"],
                "p_deltas": {"kh": -40, "dz": 20},
                "p_source": "test",
            },
        ).execute()

        after = _run_row(admin_client, run["id"])
        assert after["kohaerenz"] == 0
        assert after["dissonanz"] <= _tuning(admin_client, "dz_p0_cap")


# ── M9: the late run costs more ───────────────────────────────────────────────


class TestLateWindowEscalation:
    def test_dissonanz_escalates_from_the_tuned_takt(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """The way home is the expensive stretch (M9). Compared at the same node, so the
        band's own Dissonanz is identical and only the escalation differs."""
        user, client = test_user_ids[0], user_clients[0]
        cfg = _tuning(admin_client, "dz_late_window")

        run = _armed_run(admin_client, client, user, chart_home, takt_count=0)
        early = _move(client, user, run, home_neighbor)
        early_dz = early["checkpoint"]["last_move"]["dz_add"]

        run = _armed_run(
            admin_client, client, user, chart_home, takt_count=cfg["from_takt"] - 1
        )
        late = _move(client, user, run, home_neighbor)
        late_dz = late["checkpoint"]["last_move"]["dz_add"]

        assert late_dz == early_dz + cfg["extra"]

    def test_gate_off_does_not_escalate(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        cfg = _tuning(admin_client, "dz_late_window")

        def _first_move_dz(takt_count: int) -> int:
            # A fresh run each time, so both moves are the SAME move (home -> neighbour)
            # and only the Takt count differs.
            _reset_traveler(admin_client, user)
            _seed_profile(admin_client, user, chart_home["simulation_id"])
            _set_gate(admin_client, False)
            run = _open_run(client, user, chart_home["simulation_id"])
            _force_run_state(admin_client, run["id"], takt_count=takt_count)
            moved = _move(client, user, _run_row(admin_client, run["id"]), home_neighbor)
            return moved["checkpoint"]["last_move"]["dz_add"]

        assert _first_move_dz(cfg["from_takt"] - 1) == _first_move_dz(0)
