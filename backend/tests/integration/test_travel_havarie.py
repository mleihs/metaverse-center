"""Integration tests for migration 265 (DRIFT Fun-Kern — travel_havarie).

In P0 the failure floor was a SNAP: Kohärenz hits zero and fn_travel_move teleports you
home, forfeits the haul, scatters the cargo and closes the run — inside the move you just
made, with no decision to take. The most dramatic moment of a run was the one moment the
player did not get to play (concept D5).

265 makes it a scene. The run stops in the new `havarie` status with NOTHING lost yet, and
the traveller chooses. What these tests hold to:

* **The Havarie opens instead of the snap** (gate on) — and the P0 snap still happens
  verbatim with the gate closed. That parity is the rollback contract.
* **Every option does what it promises, and only that.** notabwurf restores Kohärenz and
  jettisons only the cargo the player picked (a forged id cannot fail someone else's
  Depesche); notruf halves the haul and marks the debt WITHOUT ever driving the purse
  negative; ueberziehen buys Takte at a Dissonanz price the next move actually pays;
  rueckruf banks 70 % through the same path a clean Entladung uses; zerfaserung is the P0
  ending, now chosen.
* **The scar is honest** — zerfaserung_count increments when the run actually unravels, not
  when the Havarie merely opened. A Havarie survived is not a Zerfaserung.
* **A jettisoned Depesche does not lock the traveller out** — its instance is failed, so
  the next fn_quest_accept does not hit QUEST_ACTIVE forever (the 250/256 bug class).
* **A wreck cannot hold the slot hostage** — an expired Havarie unravels lazily on the next
  access, and while it stands it OCCUPIES the single-active-run slot (a stranded traveller
  must not be able to just open a second run and walk away).

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from backend.tests.integration.conftest import requires_supabase
from backend.tests.integration.test_travel_economy import (
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


def _strand(admin_client, client, user, chart_home, neighbor, *, cause: str = "kohaerenz") -> dict:
    """Drive a run into a Havarie the way a real run gets there — one legal move.

    kohaerenz: 1 KH / 0 BB → the move pays Notfrequenz and the floor gives way.
    window:    the last Takt spent away from home.
    """
    run = _open_run(client, user, chart_home["simulation_id"])
    if cause == "kohaerenz":
        admin_client.table("travel_runs").update({"kohaerenz": 1, "bandbreite": 0}).eq(
            "id", run["id"]
        ).execute()
    else:
        admin_client.table("travel_runs").update({"window_remaining": 1}).eq(
            "id", run["id"]
        ).execute()
    return client.rpc(
        "fn_travel_move",
        {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
         "p_to_node": neighbor},
    ).execute().data


def _accept_depesche(client, user, run, target_sim) -> dict:
    return client.rpc(
        "fn_quest_accept",
        {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
         "p_template_key": "deliver_memory_parcel", "p_target_sim": target_sim},
    ).execute().data


class TestHavarieOpens:
    """The floor stops the run instead of ending it."""

    def test_kohaerenz_floor_opens_a_havarie_with_options(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _strand(admin_client, client, user, chart_home, home_neighbor)

            assert run["status"] == "havarie", "the run stops — it does not end"
            hav = run["checkpoint"]["havarie"]
            assert hav["cause"] == "kohaerenz"
            assert hav["options"] == ["notruf", "zerfaserung"], (
                "no cargo aboard → notabwurf must not be offered (a dead option is worse "
                "than none: it promises an out the traveller cannot take)"
            )
            assert hav["expires_at"], "a wreck must carry its own deadline"
            assert run["position_node_id"] == home_neighbor, "stranded WHERE YOU ARE"
            assert _profile(admin_client, user)["zerfaserung_count"] == 0, (
                "a Havarie is not (yet) a Zerfaserung"
            )
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_notabwurf_is_offered_only_with_cargo_aboard(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _open_run(client, user, chart_home["simulation_id"])
            accepted = _accept_depesche(client, user, run, chart_foreign["simulation_id"])
            run = accepted["run"]
            admin_client.table("travel_runs").update({"kohaerenz": 1, "bandbreite": 0}).eq(
                "id", run["id"]
            ).execute()
            run = client.rpc(
                "fn_travel_move",
                {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
                 "p_to_node": home_neighbor},
            ).execute().data

            hav = run["checkpoint"]["havarie"]
            assert hav["options"] == ["notabwurf", "notruf", "zerfaserung"]
            assert hav["cargo_aboard"] == 1
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_gate_off_still_snaps_exactly_as_p0(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """The rollback contract: with the gate closed there is no Havarie at all."""
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, False)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _strand(admin_client, client, user, chart_home, home_neighbor)
            assert run["status"] == "abandoned"
            closing = run["checkpoint"]["closing"]
            assert closing["reason"] == "kollaps", "the P0 snap, not a Havarie"
            assert closing["cause"] == "kohaerenz"
            assert "haul_transmitted" not in closing, "no Fun-Kern fact behind a shut gate"
            assert run["haul"] == 0, "the loose haul is forfeit"
            assert "havarie" not in run["checkpoint"]
            assert _profile(admin_client, user)["zerfaserung_count"] == 0, (
                "gate off → the counter stays dead (exactly P0)"
            )
        finally:
            _reset_traveler(admin_client, user)

    def test_a_wreck_holds_the_single_active_slot(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """A stranded traveller cannot simply open a second run and walk away."""
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            wreck = _strand(admin_client, client, user, chart_home, home_neighbor)
            again = _open_run(client, user, chart_home["simulation_id"])
            assert again["id"] == wreck["id"], "run_open returns the wreck, not a fresh run"
            assert again["status"] == "havarie"
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)


class TestHavarieChoices:
    """Every option is a real trade — and only the trade it advertises."""

    def _resolve(self, client, user, run, choice, jettison=None):
        return client.rpc(
            "fn_travel_havarie_resolve",
            {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
             "p_choice": choice, "p_jettison_cargo_ids": jettison},
        ).execute().data

    def test_notabwurf_restores_kohaerenz_costs_window_and_fails_the_depesche(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _open_run(client, user, chart_home["simulation_id"])
            accepted = _accept_depesche(client, user, run, chart_foreign["simulation_id"])
            cargo_id, instance_id = accepted["cargo"]["id"], accepted["instance"]["id"]
            run = accepted["run"]
            admin_client.table("travel_runs").update({"kohaerenz": 1, "bandbreite": 0}).eq(
                "id", run["id"]
            ).execute()
            run = client.rpc(
                "fn_travel_move",
                {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
                 "p_to_node": home_neighbor},
            ).execute().data
            window_before = run["window_remaining"]

            out = self._resolve(client, user, run, "notabwurf", [cargo_id])
            cfg = _tuning(admin_client, "havarie_options")["notabwurf"]

            assert out["status"] == "active", "the run goes on"
            assert out["kohaerenz"] == min(100, 0 + cfg["kh_restore"]), "ballast bought integrity"
            assert out["window_remaining"] == max(0, window_before - cfg["window_cost"])
            assert "havarie" not in out["checkpoint"], "the wreck block is cleared"
            assert out["checkpoint"]["last_havarie"]["jettisoned"] == 1

            cargo = (
                admin_client.table("travel_cargo").select("id").eq("id", cargo_id).execute()
            ).data
            assert cargo == [], "the freight is gone"
            inst = (
                admin_client.table("travel_quest_instances")
                .select("status").eq("id", instance_id).execute()
            ).data[0]
            assert inst["status"] == "failed", (
                "a jettisoned Depesche must fail its instance — an 'active' instance on a "
                "cargo-less run locks fn_quest_accept out with QUEST_ACTIVE forever"
            )
            # And the lockout really is gone: no active instance is left standing, so the
            # next fn_quest_accept (at the next world edge) passes its QUEST_ACTIVE guard.
            open_instances = (
                admin_client.table("travel_quest_instances")
                .select("id").eq("owner_user_id", str(user)).eq("status", "active").execute()
            ).data
            assert open_instances == []
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_notabwurf_cannot_jettison_foreign_cargo(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign, home_neighbor
    ):
        """A forged cargo id must not be able to sink someone else's Depesche."""
        user, client = test_user_ids[0], user_clients[0]
        other = test_user_ids[1]
        _reset_traveler(admin_client, user)
        _reset_traveler(admin_client, other)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        _seed_profile(admin_client, other, chart_home["simulation_id"])
        try:
            # The other traveller's cargo (created directly — the ownership guard is what
            # is under test, not their run).
            foreign_cargo = (
                admin_client.table("travel_cargo")
                .insert({"owner_user_id": str(other), "family": "erinnerungsstuecke",
                         "vector": "memory", "manifest_slot": 0})
                .execute()
            ).data[0]

            run = _open_run(client, user, chart_home["simulation_id"])
            accepted = _accept_depesche(client, user, run, chart_foreign["simulation_id"])
            run = accepted["run"]
            admin_client.table("travel_runs").update({"kohaerenz": 1, "bandbreite": 0}).eq(
                "id", run["id"]
            ).execute()
            run = client.rpc(
                "fn_travel_move",
                {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
                 "p_to_node": home_neighbor},
            ).execute().data

            with pytest.raises(Exception) as exc:
                self._resolve(client, user, run, "notabwurf", [foreign_cargo["id"]])
            assert "CARGO_NOT_ABOARD" in str(exc.value)

            still_there = (
                admin_client.table("travel_cargo").select("id")
                .eq("id", foreign_cargo["id"]).execute()
            ).data
            assert still_there, "the other traveller's freight is untouched"
            assert _run_row(admin_client, run["id"])["status"] == "havarie", "and nothing resolved"
        finally:
            admin_client.table("travel_cargo").delete().eq("owner_user_id", str(other)).execute()
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)
            _reset_traveler(admin_client, other)

    def test_notabwurf_without_a_selection_is_refused(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _open_run(client, user, chart_home["simulation_id"])
            run = _accept_depesche(client, user, run, chart_foreign["simulation_id"])["run"]
            admin_client.table("travel_runs").update({"kohaerenz": 1, "bandbreite": 0}).eq(
                "id", run["id"]
            ).execute()
            run = client.rpc(
                "fn_travel_move",
                {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
                 "p_to_node": home_neighbor},
            ).execute().data
            with pytest.raises(Exception) as exc:
                self._resolve(client, user, run, "notabwurf", None)
            assert "NOTHING_SELECTED" in str(exc.value)
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_notruf_tows_you_home_halves_the_haul_and_marks_the_debt(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"], siegel=3)
        try:
            run = _strand(admin_client, client, user, chart_home, home_neighbor)
            # Give the wreck a haul worth halving (the one-move strand banks nothing).
            admin_client.table("travel_runs").update({"haul_survey": 9}).eq(
                "id", run["id"]
            ).execute()
            run = _run_row(admin_client, run["id"])

            out = self._resolve(client, user, run, "notruf")
            cfg = _tuning(admin_client, "havarie_options")["notruf"]

            assert out["status"] == "active"
            assert out["position_node_id"] == chart_home["id"], "the Bureau tows you home"
            assert out["haul"] == int(9 * cfg["haul_mult"]), (
                "the haul is halved through the ONE consumer (drift_haul_settle), so all "
                "three sub-ledgers are halved together — no half-settled leftovers"
            )
            assert out["kohaerenz"] >= cfg["kh_restore"]

            prof = _profile(admin_client, user)
            assert prof["qualities"]["siegel_debt"] == cfg["siegel_debt"]
            assert prof["siegel"] == 3, (
                "the debt is a MARK on the record, not a deduction — a rescue must never "
                "drive the purse negative (siegel CHECK >= 0) nor silently clamp it"
            )
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_ueberziehen_buys_takte_at_a_dissonanz_price_the_next_move_pays(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _strand(admin_client, client, user, chart_home, home_neighbor, cause="window")
            assert run["status"] == "havarie"
            assert run["checkpoint"]["havarie"]["options"] == ["ueberziehen", "rueckruf"]

            out = self._resolve(client, user, run, "ueberziehen")
            assert out["status"] == "active"
            assert out["overstay"] is True, "the permit is a COLUMN, not a checkpoint key"
            assert out["window_remaining"] == 0

            # The next move must NOT collapse on the expired window — and must pay the tax.
            admin_client.table("travel_runs").update({"kohaerenz": 100, "bandbreite": 50}).eq(
                "id", out["id"]
            ).execute()
            out = _run_row(admin_client, out["id"])
            dz_before = out["dissonanz"]
            moved = client.rpc(
                "fn_travel_move",
                {"p_user": str(user), "p_run": out["id"], "p_run_version": out["run_version"],
                 "p_to_node": chart_home["id"]},
            ).execute().data

            assert moved["status"] == "active", "an overstay permit survives the expired window"
            assert moved["overstay"] is True, (
                "and survives the move that used it — trivially, now that it is a column: "
                "the checkpoint rebuild cannot reach it any more"
            )
            tax = _tuning(admin_client, "havarie_options")["ueberziehen"]["dz_per_takt"]
            assert moved["dissonanz"] >= min(
                int(_tuning(admin_client, "dz_p0_cap")), dz_before + tax
            ), "every further Takt costs Dissonanz — the Bleed notices an overstay"
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_rueckruf_banks_seventy_percent_through_the_one_banking_path(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _strand(admin_client, client, user, chart_home, home_neighbor, cause="window")
            admin_client.table("travel_runs").update({"haul_survey": 10}).eq(
                "id", run["id"]
            ).execute()
            run = _run_row(admin_client, run["id"])

            out = self._resolve(client, user, run, "rueckruf")
            mult = _tuning(admin_client, "havarie_options")["rueckruf"]["haul_mult"]
            expected_haul = int(10 * mult)

            assert out["status"] == "completed", "an orderly recall CLOSES the run"
            closing = out["checkpoint"]["closing"]
            assert closing["haul_banked"] == expected_haul
            assert closing["reason"] == "rueckruf", (
                "the receipt must never present a recalled haul as a full one"
            )
            assert closing["haul_before"] == 10
            assert closing["haul_lost"] == 10 - expected_haul

            # It went through the SAME banking path as an Entladung: the haul pays, and the
            # nodes this run first charted still win their Erstvermessung honors (those are
            # NOT scaled by the recall multiplier — you charted the node or you did not).
            earnings = out["checkpoint"]["earnings"]
            honors = closing["honors_won"]
            assert earnings["source"] == "rueckruf"
            assert earnings["vp_earned"] == (
                expected_haul * int(_tuning(admin_client, "reward_survey_vp_per_haul"))
                + honors * _tuning(admin_client, "reward_erstvermessung")["vp"]
            )
            prof = _profile(admin_client, user)
            assert prof["vp"] == earnings["vp_earned"]
            assert prof["qualities"]["vermessung_lodged"] == expected_haul
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_zerfaserung_scatters_counts_the_scar_and_ends_the_run(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _open_run(client, user, chart_home["simulation_id"])
            run = _accept_depesche(client, user, run, chart_foreign["simulation_id"])["run"]
            admin_client.table("travel_runs").update({"kohaerenz": 1, "bandbreite": 0}).eq(
                "id", run["id"]
            ).execute()
            run = client.rpc(
                "fn_travel_move",
                {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
                 "p_to_node": home_neighbor},
            ).execute().data

            out = self._resolve(client, user, run, "zerfaserung")

            assert out["status"] == "abandoned"
            assert out["checkpoint"]["closing"]["reason"] == "zerfaserung"
            assert out["checkpoint"]["closing"]["detail"] == "choice"
            assert out["checkpoint"]["closing"]["haul_lost"] >= 0
            assert out["checkpoint"]["closing"]["scattered"]["scattered"] == 1, (
                "the carried Depesche scatters as an echo into the world it was headed for"
            )
            assert _profile(admin_client, user)["zerfaserung_count"] == 1, (
                "the scar is counted where the run ACTUALLY unravels"
            )
            assert (
                admin_client.table("travel_cargo").select("id")
                .eq("run_id", out["id"]).execute()
            ).data == [], "the 250 close-cleanup trigger forfeited the manifest"
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_an_option_the_havarie_did_not_offer_is_refused(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """A window Havarie has no notruf. The catalogue in the checkpoint IS the contract."""
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _strand(admin_client, client, user, chart_home, home_neighbor, cause="window")
            with pytest.raises(Exception) as exc:
                self._resolve(client, user, run, "notruf")
            assert "INVALID_CHOICE" in str(exc.value)
            assert _run_row(admin_client, run["id"])["status"] == "havarie"
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_stale_run_version_loses_the_cas(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _strand(admin_client, client, user, chart_home, home_neighbor)
            stale = {**run, "run_version": run["run_version"] - 1}
            with pytest.raises(Exception) as exc:
                self._resolve(client, user, stale, "zerfaserung")
            assert "RUN_STALE" in str(exc.value)
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_gate_off_drains_an_open_wreck_instead_of_trapping_it(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """The rollback invariant, in the one place it nearly broke.

        A closed gate must refuse to CREATE Fun-Kern state, never to DRAIN it. If the resolver
        simply raised GATE_CLOSED (it did), a traveller caught in `havarie` at the moment of a
        rollback had NO legal action left: move/complete demand 'active', abandon (246) does
        not take 'havarie', run_open hands the wreck straight back and the admin kill-switch
        did not even see the status. They were frozen out for the full 48 h TTL — by the very
        flip that is supposed to hand them a working P0 build back.
        """
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _strand(admin_client, client, user, chart_home, home_neighbor)
            _set_gate(admin_client, False)

            # Even the choice the panel offered before the flip resolves — into the P0 ending.
            out = self._resolve(client, user, run, "notruf")
            assert out["gate_drained"] is True
            assert out["status"] == "abandoned", "the wreck unravels — the P0 ending"
            assert out["checkpoint"]["closing"]["detail"] == "gate_closed"
            assert _profile(admin_client, user)["zerfaserung_count"] == 0, (
                "gate off = zero Fun-Kern residue: P0 never counted scars"
            )

            # And the slot is free again: the traveller can play the P0 build.
            fresh = _open_run(client, user, chart_home["simulation_id"])
            assert fresh["status"] == "active" and fresh["id"] != run["id"]
        finally:
            _reset_traveler(admin_client, user)

    def test_gate_off_still_refuses_a_run_that_is_not_in_havarie(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """Draining is the exception, not an open door: no wreck, no Fun-Kern RPC."""
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, False)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _open_run(client, user, chart_home["simulation_id"])
            with pytest.raises(Exception) as exc:
                self._resolve(client, user, run, "zerfaserung")
            assert "GATE_CLOSED" in str(exc.value)
        finally:
            _reset_traveler(admin_client, user)


class TestHavarieTTL:
    """A wreck decides itself if the traveller never comes back."""

    def _expire(self, admin_client, run_id) -> dict:
        run = _run_row(admin_client, run_id)
        cp = run["checkpoint"]
        cp["havarie"]["expires_at"] = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
        admin_client.table("travel_runs").update({"checkpoint": cp}).eq("id", run_id).execute()
        return _run_row(admin_client, run_id)

    def test_expired_havarie_unravels_whatever_the_player_picked(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _strand(admin_client, client, user, chart_home, home_neighbor)
            run = self._expire(admin_client, run["id"])

            out = client.rpc(
                "fn_travel_havarie_resolve",
                {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
                 "p_choice": "notruf", "p_jettison_cargo_ids": None},
            ).execute().data

            assert out["expired"] is True
            assert out["status"] == "abandoned", "the Drift decided for you"
            assert out["checkpoint"]["closing"]["detail"] == "ttl_expired"
            assert _profile(admin_client, user)["zerfaserung_count"] == 1
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_run_open_sweeps_an_expired_wreck_and_frees_the_slot(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """The lazy finalisation that lets P0.5 skip a scheduler entirely."""
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            wreck = _strand(admin_client, client, user, chart_home, home_neighbor)
            self._expire(admin_client, wreck["id"])

            fresh = _open_run(client, user, chart_home["simulation_id"])
            assert fresh["id"] != wreck["id"], "the slot is freed and a new run opens"
            assert fresh["status"] == "active"
            assert _run_row(admin_client, wreck["id"])["status"] == "abandoned"
            assert _profile(admin_client, user)["zerfaserung_count"] == 1
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_unravelling_the_same_wreck_twice_scars_it_once(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """The sweep is reachable twice (a double-clicked Aufbruch races itself into it).

        An unravelling is not repeatable: it scatters the manifest, writes audit + telemetry
        and — the part that cannot be taken back — adds a permanent scar. fn_travel_zerfasern
        now takes the row FOR UPDATE and refuses a run that is already closed, so the second
        caller finds the wreck gone instead of unravelling it a second time.
        """
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            wreck = _strand(admin_client, client, user, chart_home, home_neighbor)
            first = admin_client.rpc(
                "fn_travel_zerfasern",
                {"p_user": str(user), "p_run": wreck["id"], "p_reason": "ttl_expired"},
            ).execute().data
            assert first["status"] == "abandoned"
            assert _profile(admin_client, user)["zerfaserung_count"] == 1

            second = admin_client.rpc(
                "fn_travel_zerfasern",
                {"p_user": str(user), "p_run": wreck["id"], "p_reason": "ttl_expired"},
            ).execute().data
            assert second["status"] == "abandoned", "the closed run comes back untouched"
            assert _profile(admin_client, user)["zerfaserung_count"] == 1, (
                "one wreck, one scar — a record that says otherwise cannot be corrected"
            )
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)


class TestHavarieRescueHatches:
    """The two ways out that must never be closed: the option list, and the operator."""

    def test_notabwurf_is_not_offered_when_the_window_cannot_pay_for_it(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign, home_neighbor
    ):
        """Notabwurf buys Kohärenz with cargo AND with Takte. Offered at window == cost, it is
        a trap: the run returns to 'active' with 0 Takte, so the next move that is not home
        drops it straight back into Havarie — cargo gone, Depeschen failed, nothing bought."""
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        cost = _tuning(admin_client, "havarie_options")["notabwurf"]["window_cost"]
        try:
            run = _open_run(client, user, chart_home["simulation_id"])
            run = _accept_depesche(client, user, run, chart_foreign["simulation_id"])["run"]
            # The move spends one Takt, so the wreck opens with exactly `cost` left over.
            admin_client.table("travel_runs").update(
                {"kohaerenz": 1, "bandbreite": 0, "window_remaining": cost + 1}
            ).eq("id", run["id"]).execute()

            wrecked = client.rpc(
                "fn_travel_move",
                {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
                 "p_to_node": home_neighbor},
            ).execute().data

            hav = wrecked["checkpoint"]["havarie"]
            assert wrecked["window_remaining"] == cost
            assert hav["cargo_aboard"] == 1, "there IS cargo — it is the window that is short"
            assert "notabwurf" not in hav["options"], (
                "an option that buys nothing must not be offered, cargo or not"
            )
            assert hav["options"] == ["notruf", "zerfaserung"]
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_the_kill_switch_can_repatriate_a_wreck(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        """fn_drift_emergency_return (246) only knew 'active' and 'distress' — so the one
        status an operator most needs to rescue someone out of was invisible to the rescue."""
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            wreck = _strand(admin_client, client, user, chart_home, home_neighbor)
            assert wreck["status"] == "havarie"

            admin_client.rpc("fn_drift_emergency_return", {}).execute()

            row = _run_row(admin_client, wreck["id"])
            assert row["status"] == "active", "the operator can reach a wrecked traveller"
            assert row["position_node_id"] == chart_home["id"], "repatriated to home"
            assert row["checkpoint"].get("emergency_return") is True
            assert "havarie" not in row["checkpoint"], (
                "the checkpoint is reset, so no stale wreck panel greets the rescued traveller"
            )
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)
