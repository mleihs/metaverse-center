"""The DRIFT run CONTRACT: every mutation's result must parse as a TravelRunResponse.

Why this file exists, and why it is separate from the per-migration suites.

Every run RPC returns the run row. The Pydantic model does not merely wrap that row — it
LIFTS blocks out of it into typed fields (`earnings`, `pending_signal`, `last_signal`, …).
So a key name inside the row is not an internal detail: **it is the API contract**, and the
model validates the WHOLE row, not just the mutation's own answer.

The RPC suites read the RAW row straight out of PostgREST. They are blind to this contract
by construction — and they were: `fn_signal_resolve` wrote `last_signal.class` where the
model reads `signal_class`, every RPC test stayed green, and *every GET on the run* started
answering 500. The bug was found in a browser, one call after a perfectly green RPC.

Exactly one test in the whole suite pushed a mutation result through the model
(`test_travel_signals.py::test_the_resolved_run_still_parses_as_a_run`) — the one the
regression forced into existence. This file generalises it: **every** mutation that returns
a run goes through the model, so the next rename is caught by the suite that already runs on
every commit instead of by a traveller.

The assertion is deliberately thin. It is not "the run is correct" (that is what the other
suites are for) — it is "the run is still SPEAKABLE": the model can read it, and the fields
it lifted actually arrived.

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

import pytest

from backend.models.drift import QuestDeliverResponse, TravelRunResponse
from backend.tests.integration.conftest import requires_supabase
from backend.tests.integration.test_travel_economy import (
    _force_run_state,
    _open_run,
    _reset_traveler,
    _seed_profile,
    _set_gate,
)

pytestmark = [requires_supabase, pytest.mark.gamedb]


# ── the harness ───────────────────────────────────────────────────────────────


class _Ctx:
    """Everything a mutation needs to be reached, in one bag.

    The mutations below differ wildly in what it takes to REACH them (a Havarie needs a
    depleted hull, a bank needs a foreign dock with a haul aboard, a delivery needs a
    Depesche). Passing the fixtures around as one object keeps each mutation a single
    readable function instead of an eight-argument signature.
    """

    def __init__(self, admin_client, client, user, chart_home, chart_foreign, home_neighbor):
        self.admin = admin_client
        self.client = client
        self.user = user
        self.home = chart_home
        self.foreign = chart_foreign
        self.neighbor = home_neighbor

    # -- state --------------------------------------------------------------

    def row(self, run_id) -> dict:
        return (
            self.admin.table("travel_runs").select("*").eq("id", str(run_id)).execute()
        ).data[0]

    def armed(self, *, haul: int = 0, **force) -> dict:
        """A fresh traveller, an open gate, an open run — forced into `force` state.

        `haul` is the run's LOOSE haul. It is passed separately because it is the one piece
        of run state that is not simply a column: reaching a given haul legally would take a
        lucky chart and a dozen moves, so the suite forces it, and this is the single place
        that has to know WHERE it lives.
        """
        _reset_traveler(self.admin, self.user)
        _seed_profile(self.admin, self.user, self.home["simulation_id"])
        _set_gate(self.admin, True)
        run = _open_run(self.client, self.user, self.home["simulation_id"])
        if haul:
            force["checkpoint"] = {**run["checkpoint"], "haul": haul}
        if force:
            _force_run_state(self.admin, run["id"], **force)
            run = self.row(run["id"])
        return run

    # -- calls --------------------------------------------------------------

    def rpc(self, name: str, **params) -> dict:
        return self.client.rpc(name, params).execute().data


def _park_signal(ctx: _Ctx, run: dict, template_key: str, options: list[dict]) -> dict:
    """Park a specific pending scene (the draw is salted — forcing it is how the suite
    reaches a named scene without a lucky deck)."""
    _force_run_state(
        ctx.admin,
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
    return ctx.row(run["id"])


# ── one function per mutation: reach it, fire it, hand back the RAW run ───────
#
# Each returns exactly what the RPC returned (or, for the two quest RPCs, the `run` the
# wrapper carries) — untouched. The test does the parsing; these only do the reaching.


def _m_run_open(ctx: _Ctx) -> dict:
    _reset_traveler(ctx.admin, ctx.user)
    _seed_profile(ctx.admin, ctx.user, ctx.home["simulation_id"])
    _set_gate(ctx.admin, True)
    return _open_run(ctx.client, ctx.user, ctx.home["simulation_id"])


def _m_move(ctx: _Ctx) -> dict:
    run = ctx.armed(window_remaining=20)
    return ctx.rpc(
        "fn_travel_move",
        p_user=str(ctx.user), p_run=run["id"],
        p_run_version=run["run_version"], p_to_node=ctx.neighbor,
    )


def _m_signal_resolve(ctx: _Ctx) -> dict:
    run = ctx.armed(kohaerenz=80, bandbreite=4, window_remaining=20)
    run = _park_signal(ctx, run, "stoerung_bandbreitenfrass", [{"key": "abschirmen"}])
    return ctx.rpc(
        "fn_signal_resolve",
        p_user=str(ctx.user), p_run=run["id"],
        p_run_version=run["run_version"], p_option_key="abschirmen",
    )


def _m_signal_resolve_gate_drained(ctx: _Ctx) -> dict:
    """The drain path answers with a run too — and it is the path a ROLLBACK takes, i.e.
    the one nobody will be watching when it breaks."""
    run = ctx.armed(kohaerenz=80, bandbreite=4)
    run = _park_signal(ctx, run, "stoerung_bandbreitenfrass", [{"key": "abschirmen"}])
    _set_gate(ctx.admin, False)
    run = ctx.row(run["id"])
    out = ctx.rpc(
        "fn_signal_resolve",
        p_user=str(ctx.user), p_run=run["id"],
        p_run_version=run["run_version"], p_option_key="abschirmen",
    )
    _set_gate(ctx.admin, True)
    return out


def _m_sondieren(ctx: _Ctx) -> dict:
    run = ctx.armed(window_remaining=20)
    return ctx.rpc(
        "fn_sondieren",
        p_user=str(ctx.user), p_run=run["id"], p_run_version=run["run_version"],
    )


def _m_bank(ctx: _Ctx) -> dict:
    """The Funkboje: a foreign dock, a loose haul, and a transmitter."""
    run = ctx.armed(
        position_node_id=ctx.foreign["id"], window_remaining=20, haul=12,
    )
    return ctx.rpc(
        "fn_funkboje_bank",
        p_user=str(ctx.user), p_run=run["id"], p_run_version=run["run_version"],
    )


def _wreck(ctx: _Ctx, cause: str, **force) -> dict:
    """A run parked in `havarie`, reached the way a real run reaches it — one legal move.

    kohaerenz: 1 KH / 0 BB → the move pays Notfrequenz and the floor gives way.
    window:    the last Takt of the permit, spent away from home.
    """
    if cause == "kohaerenz":
        force.update(kohaerenz=1, bandbreite=0)
    else:
        force.update(window_remaining=1)
    run = ctx.armed(**force)
    ctx.rpc(
        "fn_travel_move",
        p_user=str(ctx.user), p_run=run["id"],
        p_run_version=run["run_version"], p_to_node=ctx.neighbor,
    )
    run = ctx.row(run["id"])
    assert run["status"] == "havarie", f"the {cause} floor did not open a Havarie"
    return run


def _m_havarie_ueberziehen(ctx: _Ctx) -> dict:
    run = _wreck(ctx, "window")
    return ctx.rpc(
        "fn_travel_havarie_resolve",
        p_user=str(ctx.user), p_run=run["id"], p_run_version=run["run_version"],
        p_choice="ueberziehen", p_jettison_cargo_ids=None,
    )


def _m_havarie_rueckruf(ctx: _Ctx) -> dict:
    """A recall BANKS the run — the closing checkpoint, the receipt, the earnings."""
    run = _wreck(ctx, "window", haul=10)
    return ctx.rpc(
        "fn_travel_havarie_resolve",
        p_user=str(ctx.user), p_run=run["id"], p_run_version=run["run_version"],
        p_choice="rueckruf", p_jettison_cargo_ids=None,
    )


def _m_havarie_notruf(ctx: _Ctx) -> dict:
    run = _wreck(ctx, "kohaerenz", haul=10)
    return ctx.rpc(
        "fn_travel_havarie_resolve",
        p_user=str(ctx.user), p_run=run["id"], p_run_version=run["run_version"],
        p_choice="notruf", p_jettison_cargo_ids=None,
    )


def _m_havarie_zerfaserung(ctx: _Ctx) -> dict:
    run = _wreck(ctx, "kohaerenz", haul=10)
    return ctx.rpc(
        "fn_travel_havarie_resolve",
        p_user=str(ctx.user), p_run=run["id"], p_run_version=run["run_version"],
        p_choice="zerfaserung", p_jettison_cargo_ids=None,
    )


def _m_havarie_gate_drained(ctx: _Ctx) -> dict:
    """A wreck under a CLOSED gate unravels rather than being jailed for 48 h. It answers
    with a run, and that run is read by a HUD that is mid-rollback — the worst possible
    moment for a 500."""
    run = _wreck(ctx, "kohaerenz")
    _set_gate(ctx.admin, False)
    out = ctx.rpc(
        "fn_travel_havarie_resolve",
        p_user=str(ctx.user), p_run=run["id"], p_run_version=run["run_version"],
        p_choice="zerfaserung", p_jettison_cargo_ids=None,
    )
    _set_gate(ctx.admin, True)
    return out


def _m_complete(ctx: _Ctx) -> dict:
    run = ctx.armed(haul=6)
    return ctx.rpc(
        "fn_travel_complete",
        p_user=str(ctx.user), p_run=run["id"], p_run_version=run["run_version"],
    )


def _m_abandon(ctx: _Ctx) -> dict:
    run = ctx.armed(haul=4)
    return ctx.rpc(
        "fn_travel_abandon",
        p_user=str(ctx.user), p_run=run["id"], p_run_version=run["run_version"],
    )


def _m_quest_accept(ctx: _Ctx) -> dict:
    run = ctx.armed()
    out = ctx.rpc(
        "fn_quest_accept",
        p_user=str(ctx.user), p_run=run["id"], p_run_version=run["run_version"],
        p_template_key="deliver_memory_parcel",
        p_target_sim=str(ctx.foreign["simulation_id"]),
    )
    return out["run"]


def _m_quest_advance(ctx: _Ctx) -> dict:
    """The delivery — and the only mutation whose run travels inside a WRAPPER, which is
    exactly why it is easy to forget when the run's shape changes."""
    run = ctx.armed()
    accepted = ctx.rpc(
        "fn_quest_accept",
        p_user=str(ctx.user), p_run=run["id"], p_run_version=run["run_version"],
        p_template_key="deliver_memory_parcel",
        p_target_sim=str(ctx.foreign["simulation_id"]),
    )
    # Stand on the target edge (a legal route there is a chart-dependent detour; the state
    # is what is under test, not the pathfinding).
    _force_run_state(ctx.admin, run["id"], position_node_id=ctx.foreign["id"])
    run = ctx.row(run["id"])
    out = ctx.rpc(
        "fn_quest_advance",
        p_user=str(ctx.user), p_run=run["id"], p_run_version=run["run_version"],
        p_instance=accepted["instance"]["id"],
    )
    # The whole wrapper is a typed response too — validate it as the router would.
    QuestDeliverResponse(
        run=TravelRunResponse(**out["run"]),
        instance=out["instance"],
        effects=out["effects"],
    )
    return out["run"]


MUTATIONS = {
    "run_open": _m_run_open,
    "move": _m_move,
    "signal_resolve": _m_signal_resolve,
    "signal_resolve_gate_drained": _m_signal_resolve_gate_drained,
    "sondieren": _m_sondieren,
    "bank": _m_bank,
    "havarie_ueberziehen": _m_havarie_ueberziehen,
    "havarie_rueckruf": _m_havarie_rueckruf,
    "havarie_notruf": _m_havarie_notruf,
    "havarie_zerfaserung": _m_havarie_zerfaserung,
    "havarie_gate_drained": _m_havarie_gate_drained,
    "complete": _m_complete,
    "abandon": _m_abandon,
    "quest_accept": _m_quest_accept,
    "quest_advance": _m_quest_advance,
}


# ── the contract ──────────────────────────────────────────────────────────────


class TestEveryMutationSpeaksTheRunContract:
    @pytest.mark.parametrize("mutation", sorted(MUTATIONS))
    def test_the_result_parses_as_a_run(
        self, mutation, admin_client, user_clients, test_user_ids,
        chart_home, chart_foreign, home_neighbor,
    ):
        """The model validates the WHOLE row. A key this model cannot read does not break
        the mutation — it breaks every subsequent GET on the run, which is a far worse and
        far quieter failure. Whatever a mutation writes, it has to be able to say."""
        ctx = _Ctx(
            admin_client, user_clients[0], test_user_ids[0],
            chart_home, chart_foreign, home_neighbor,
        )
        try:
            raw = MUTATIONS[mutation](ctx)
            assert isinstance(raw, dict), f"{mutation} returned no run"

            parsed = TravelRunResponse(**raw)

            assert str(parsed.id) == str(raw["id"])
            assert str(parsed.user_id) == str(ctx.user)
            assert parsed.status in {
                "active", "frozen", "distress", "havarie", "completed", "abandoned",
            }
        finally:
            _set_gate(admin_client, True)
            _reset_traveler(admin_client, test_user_ids[0])

    def test_the_lifted_blocks_actually_arrive(
        self, admin_client, user_clients, test_user_ids,
        chart_home, chart_foreign, home_neighbor,
    ):
        """Parsing is necessary but not sufficient: every lifted field is OPTIONAL, so a
        renamed key parses perfectly and simply lifts NOTHING. The scene would vanish from
        the HUD with a 200 and a green suite. So each lift is asserted where it must occur."""
        ctx = _Ctx(
            admin_client, user_clients[0], test_user_ids[0],
            chart_home, chart_foreign, home_neighbor,
        )
        try:
            resolved = TravelRunResponse(**_m_signal_resolve(ctx))
            assert resolved.last_signal is not None, "the answered scene must be readable"
            assert resolved.last_signal.signal_class == "stoerung"
            assert resolved.pending_signal is None, "an answered scene is not still pending"

            closed = TravelRunResponse(**_m_complete(ctx))
            assert closed.earnings is not None, "the Entladung's receipt must be readable"
            assert closed.earnings.source == "entladung"
        finally:
            _set_gate(admin_client, True)
            _reset_traveler(admin_client, test_user_ids[0])
