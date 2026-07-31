"""Integration tests for migration 264 (DRIFT Fun-Kern — travel_economy_activation).

The P0 loop produced nothing the player kept: `traveler_profiles.vp` / `.siegel` /
`.clearance_rank` / `.zerfaserung_count` were columns no RPC ever wrote (concept D1).
264 turns the loop into an economy, entirely behind `drift_fun_core_enabled`.

What is asserted here:

* **The dice are deterministic** (plan §2.7) — the same seed always yields the same roll,
  a different seed a different one, and the range is respected at both ends. A payout that
  cannot be replayed cannot be debugged or tested.
* **fn_drift_award is the ledger's single writer** — credits increment atomically, a zero
  award is a silent no-op, a negative delta is rejected (debits have their own path).
* **The Depesche pays** (fn_quest_advance) — Siegel is exactly the seeded roll, VP is flat,
  and both land on the profile.
* **The Entladung pays** (fn_travel_complete) — haul → VP 1:1 + Siegel at the ratio (floored),
  plus the per-honor Erstvermessung bonus, counted from what fn_survey_deliver actually
  awarded (so a re-survey of a known node cannot re-claim it).
* **The clearance exam** (fn_clearance_exam) — the VP threshold and the Siegel fee both bite,
  the promotion is charged exactly once, and a second sitting is refused.
* **The scar counts** — zerfaserung_count increments on an involuntary collapse.
* **The gate-off regression net** (plan §7) — with `drift_fun_core_enabled=false` every one
  of the above is byte-for-byte the P0 behavior: no ledger write, no extra response key.
  This is the contract that protects the LIVE P0 system (prod runs drift_p0_enabled=true)
  until the flip.

These drive the real PLAYER-class RPCs through `user_clients` (JWT → auth.uid()), the
fixture added with this migration — the P0-era "player RPCs are browser-verified only"
limitation is closed. Where a state is unreachable in a handful of legal moves (a chart
position, a depleted Kohärenz), it is forced through admin SQL *without* bumping
run_version, exactly as the live playtests do; the RPC under test is always the real one.

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from backend.tests.integration.conftest import requires_supabase

pytestmark = [requires_supabase, pytest.mark.gamedb]

GATE_KEY = "drift_fun_core_enabled"


# ── helpers ───────────────────────────────────────────────────────────────────


def _set_gate(admin_client, on: bool) -> None:
    """Flip drift_fun_core_enabled (canonical jsonb bool, as the migration seeds it)."""
    admin_client.table("platform_settings").upsert(
        {"setting_key": GATE_KEY, "setting_value": on}, on_conflict="setting_key"
    ).execute()


def _tuning(admin_client, key: str):
    rows = admin_client.table("drift_tuning").select("value").eq("setting_key", key).execute()
    return rows.data[0]["value"]


def _profile(admin_client, user_id):
    rows = (
        admin_client.table("traveler_profiles")
        .select("*")
        .eq("user_id", str(user_id))
        .execute()
    )
    return rows.data[0] if rows.data else None


def _chart(admin_client) -> tuple[int, dict[str, str]]:
    """(active chart_version, {stable_key: node_id}) for the broadcast homes."""
    versions = (
        admin_client.table("chart_versions")
        .select("version")
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    version = versions.data[0]["version"]
    nodes = (
        admin_client.table("drift_chart_nodes")
        .select("id, stable_key, simulation_id")
        .eq("chart_version", version)
        .eq("node_type", "broadcast_rand")
        .execute()
    )
    return version, {n["stable_key"]: n for n in nodes.data}


def _reset_traveler(admin_client, user_id) -> None:
    """Wipe every trace of previous runs for this traveller (order: children first)."""
    uid = str(user_id)
    admin_client.table("travel_cargo").delete().eq("owner_user_id", uid).execute()
    admin_client.table("travel_quest_instances").delete().eq("owner_user_id", uid).execute()
    admin_client.table("travel_runs").delete().eq("user_id", uid).execute()
    admin_client.table("traveler_discoveries").delete().eq("user_id", uid).execute()
    admin_client.table("chart_honors").delete().eq("user_id", uid).execute()
    admin_client.table("traveler_profiles").delete().eq("user_id", uid).execute()


def _seed_profile(admin_client, user_id, anchor_sim, **overrides) -> None:
    """A traveller profile in a known ledger state (the RPCs read it, never seed it)."""
    row = {
        "user_id": str(user_id),
        "anchor_simulation_id": str(anchor_sim),
        "vp": 0,
        "siegel": 0,
        "clearance_rank": "aspirant",
        "zerfaserung_count": 0,
        **overrides,
    }
    admin_client.table("traveler_profiles").upsert(row, on_conflict="user_id").execute()


def _open_run(user_client, user_id, anchor_sim) -> dict:
    return user_client.rpc(
        "fn_travel_run_open",
        {"p_user": str(user_id), "p_anchor_sim": str(anchor_sim)},
    ).execute().data


def _force_run_state(admin_client, run_id, **fields) -> None:
    """Force run state WITHOUT bumping run_version — the client's CAS token stays valid.

    The playtest technique from the P0 sessions: reach a state (standing at a foreign dock,
    Kohärenz on the floor) that would otherwise take a dozen legal moves and a lucky chart.
    """
    admin_client.table("travel_runs").update(fields).eq("id", str(run_id)).execute()


# ── the dice ──────────────────────────────────────────────────────────────────


class TestDeterministicDice:
    """drift_rand/drift_rand_int: the same (run, entity, takt) must always pay the same."""

    def test_same_seed_same_roll_different_seed_differs(self, admin_client):
        seed = f"run-{uuid4()}:inst:3"
        a = admin_client.rpc("drift_rand_int", {"p_seed": seed, "p_lo": 8, "p_hi": 12}).execute().data
        b = admin_client.rpc("drift_rand_int", {"p_seed": seed, "p_lo": 8, "p_hi": 12}).execute().data
        assert a == b, "a replayed roll must reproduce — payouts are not re-rollable"

        # Over a spread of takts the roll must actually move (a constant would be a bug that
        # a same-seed assertion alone would happily accept).
        rolls = {
            admin_client.rpc(
                "drift_rand_int", {"p_seed": f"{seed}-{i}", "p_lo": 8, "p_hi": 12}
            ).execute().data
            for i in range(12)
        }
        assert len(rolls) > 1, "the dice must vary across seeds"

    def test_roll_stays_inside_the_inclusive_range(self, admin_client):
        values = {
            admin_client.rpc(
                "drift_rand_int", {"p_seed": f"range-{i}", "p_lo": 8, "p_hi": 12}
            ).execute().data
            for i in range(60)
        }
        assert values, "sanity"
        assert min(values) >= 8 and max(values) <= 12, f"roll escaped [8,12]: {sorted(values)}"


class TestSeedSecrecy:
    """The dice are deterministic for the server and opaque to the player.

    Every other seed term (run id, instance id, takt) is a value the client already holds and
    hashtext is open source, so WITHOUT a server-only term a traveller could precompute each
    roll and simply wait for the takt that pays best. In W1 that is worth ~4 Siegel; in W2 the
    same dice draw the signals and the Sondierungs-Bust, where a readable next card would
    delete the push-your-luck outright. The salt is what keeps the roll a roll.
    """

    def test_the_salt_is_stable_per_run_and_differs_between_runs(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run_a = _open_run(client, user, chart_home["simulation_id"])
            salt_a1 = admin_client.rpc("drift_run_salt", {"p_run": run_a["id"]}).execute().data
            salt_a2 = admin_client.rpc("drift_run_salt", {"p_run": run_a["id"]}).execute().data
            assert salt_a1 and salt_a1 == salt_a2, (
                "the salt is created once and then read — a re-rolled salt would re-roll "
                "every payout of the run with it"
            )

            admin_client.table("travel_runs").update({"status": "abandoned"}).eq(
                "id", run_a["id"]
            ).execute()
            run_b = _open_run(client, user, chart_home["simulation_id"])
            salt_b = admin_client.rpc("drift_run_salt", {"p_run": run_b["id"]}).execute().data
            assert salt_b != salt_a1, "a fresh run draws a fresh secret"
        finally:
            _reset_traveler(admin_client, user)

    def test_the_traveller_cannot_read_their_own_salt(
        self, admin_client, user_clients, test_user_ids, chart_home
    ):
        """The owner is the adversary — which is why the salt is NOT a travel_runs column.

        travel_runs_owner_select (RLS, 246) lets a traveller read their own run row straight
        through PostgREST with the public anon key. A salt stored there would be handed to
        exactly the party it is kept from. It lives in travel_run_seeds: no anon/authenticated
        grant, no policy for them, reachable only through the SECURITY DEFINER dice.
        """
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _open_run(client, user, chart_home["simulation_id"])
            admin_client.rpc("drift_run_salt", {"p_run": run["id"]}).execute()  # ensure it exists

            with pytest.raises(Exception, match=r"(?i)permission denied|does not exist|42501"):
                client.table("travel_run_seeds").select("*").execute()

            with pytest.raises(Exception, match=r"(?i)permission denied|not find|42883|404"):
                client.rpc("drift_run_salt", {"p_run": run["id"]}).execute()
        finally:
            _reset_traveler(admin_client, user)


# ── the ledger writer ─────────────────────────────────────────────────────────


class TestDriftAward:
    """fn_drift_award — the single writer of the Siegel/VP ledger."""

    def test_award_credits_and_returns_balances(self, admin_client, test_user_ids, chart_home):
        user = test_user_ids[0]
        _reset_traveler(admin_client, user)
        _seed_profile(admin_client, user, chart_home["simulation_id"], vp=5, siegel=7)
        try:
            out = admin_client.rpc(
                "fn_drift_award",
                {"p_user": str(user), "p_source": "dispatch", "p_siegel": 10, "p_vp": 3,
                 "p_run": None},
            ).execute().data
            assert out["siegel_earned"] == 10
            assert out["vp_earned"] == 3
            assert out["siegel_balance"] == 17, "siegel is an atomic increment on the existing balance"
            assert out["vp_total"] == 8

            row = _profile(admin_client, user)
            assert row["siegel"] == 17
            assert row["vp"] == 8

            audit = (
                admin_client.table("audit_log")
                .select("action, details")
                .eq("action", "travel_award")
                .eq("user_id", str(user))
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            assert audit.data, "every ledger movement is audited"
            assert audit.data[0]["details"]["source"] == "dispatch"
        finally:
            _reset_traveler(admin_client, user)

    def test_zero_award_is_a_silent_noop(self, admin_client, test_user_ids, chart_home):
        """A run that banked nothing must not write an audit row it has nothing to say in."""
        user = test_user_ids[0]
        _reset_traveler(admin_client, user)
        _seed_profile(admin_client, user, chart_home["simulation_id"], vp=4, siegel=4)
        try:
            before = (
                admin_client.table("audit_log")
                .select("id", count="exact")
                .eq("action", "travel_award")
                .eq("user_id", str(user))
                .execute()
            ).count
            out = admin_client.rpc(
                "fn_drift_award",
                {"p_user": str(user), "p_source": "entladung", "p_siegel": 0, "p_vp": 0,
                 "p_run": None},
            ).execute().data
            assert out["siegel_balance"] == 4 and out["vp_total"] == 4
            after = (
                admin_client.table("audit_log")
                .select("id", count="exact")
                .eq("action", "travel_award")
                .eq("user_id", str(user))
                .execute()
            ).count
            assert after == before, "a zero award writes no audit noise"
        finally:
            _reset_traveler(admin_client, user)

    def test_negative_delta_is_rejected(self, admin_client, test_user_ids, chart_home):
        """Debits have different failure semantics (they must fail, not clamp) — the award
        function refuses them outright rather than growing a second contract."""
        user = test_user_ids[0]
        _reset_traveler(admin_client, user)
        _seed_profile(admin_client, user, chart_home["simulation_id"], siegel=50)
        try:
            with pytest.raises(Exception) as exc:
                admin_client.rpc(
                    "fn_drift_award",
                    {"p_user": str(user), "p_source": "x", "p_siegel": -5, "p_vp": 0,
                     "p_run": None},
                ).execute()
            assert "credits only" in str(exc.value)
            assert _profile(admin_client, user)["siegel"] == 50, "the balance is untouched"
        finally:
            _reset_traveler(admin_client, user)


# ── the Depesche pays ─────────────────────────────────────────────────────────


class TestDispatchPayout:
    """fn_quest_advance: a delivered Depesche credits Siegel (seeded roll) + VP (flat)."""

    def test_delivery_pays_the_seeded_roll(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _open_run(client, user, chart_home["simulation_id"])
            accepted = client.rpc(
                "fn_quest_accept",
                {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
                 "p_template_key": "deliver_memory_parcel",
                 "p_target_sim": chart_foreign["simulation_id"]},
            ).execute().data
            run, instance = accepted["run"], accepted["instance"]

            # Stand on the target dock (no run_version bump — the CAS token stays valid).
            _force_run_state(admin_client, run["id"], position_node_id=chart_foreign["id"])

            out = client.rpc(
                "fn_quest_advance",
                {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
                 "p_instance": instance["id"]},
            ).execute().data

            reward = _tuning(admin_client, "reward_dispatch_tier1")
            # The seed carries a server-only salt (migration 264 §4b), so recomputing the
            # roll takes service_role. Reproducing it here is exactly the point: the roll is
            # deterministic for the SERVER (replay, CI, bug reports) and unforgeable for the
            # client — the two properties the dice must hold at the same time.
            salt = admin_client.rpc("drift_run_salt", {"p_run": run["id"]}).execute().data
            expected_siegel = admin_client.rpc(
                "drift_rand_int",
                {"p_seed": f"{salt}:{run['id']}:{instance['id']}:{run['takt_count']}",
                 "p_lo": reward["siegel_min"], "p_hi": reward["siegel_max"]},
            ).execute().data

            assert "earnings" in out, "a delivered Depesche must report what it paid"
            assert out["earnings"]["siegel_earned"] == expected_siegel, (
                "the Siegel roll is the deterministic one, not a fresh random()"
            )
            assert out["earnings"]["vp_earned"] == reward["vp"]

            row = _profile(admin_client, user)
            assert row["siegel"] == expected_siegel, "the roll landed on the profile"
            assert row["vp"] == reward["vp"]
            # The receipt rides the checkpoint at the TOP level — that is where
            # TravelRunResponse._lift_earnings looks, so a plain refetch of the run (second
            # device, reload mid-ceremony) can still stage the Zeremonie.
            assert out["run"]["checkpoint"]["earnings"]["vp_earned"] == reward["vp"]
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_gate_off_delivery_pays_nothing_and_keeps_the_p0_shape(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign
    ):
        """The regression net: with the gate closed the RPC is the P0 one, exactly."""
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, False)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = _open_run(client, user, chart_home["simulation_id"])
            accepted = client.rpc(
                "fn_quest_accept",
                {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
                 "p_template_key": "deliver_memory_parcel",
                 "p_target_sim": chart_foreign["simulation_id"]},
            ).execute().data
            run, instance = accepted["run"], accepted["instance"]
            _force_run_state(admin_client, run["id"], position_node_id=chart_foreign["id"])

            out = client.rpc(
                "fn_quest_advance",
                {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
                 "p_instance": instance["id"]},
            ).execute().data

            assert set(out.keys()) == {"run", "instance", "effects"}, (
                "gate off → the exact migration-249 response shape, no additive key"
            )
            assert "earnings" not in out["run"]["checkpoint"].get("last_delivery", {})
            row = _profile(admin_client, user)
            assert row["siegel"] == 0 and row["vp"] == 0, "gate off → no ledger write"
        finally:
            _reset_traveler(admin_client, user)


# ── the Entladung pays ────────────────────────────────────────────────────────


class TestEntladungPayout:
    """fn_travel_complete: haul → VP 1:1 + Siegel at ratio, plus the Erstvermessung bonus."""

    def _complete_with_haul(
        self, admin_client, client, user, chart_home, haul: int, visited: list[str]
    ) -> dict:
        run = _open_run(client, user, chart_home["simulation_id"])
        # Since W2.6 the run's live state is COLUMNS, not keys in an untyped checkpoint.
        # `haul_survey` is the source of the loose haul that has no other ledger behind it
        # (the other two are the dig sites and the manifest), so forcing it here is exactly
        # "this run walked in with N points of un-lodged Vermessung".
        _force_run_state(
            admin_client, run["id"],
            haul_survey=haul, visited=visited,
        )
        return client.rpc(
            "fn_travel_complete",
            {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"]},
        ).execute().data

    def test_haul_pays_vp_and_siegel_plus_erstvermessung_bonus(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        # The foreign home is an un-honored node for this traveller → the bank claims it.
        admin_client.table("chart_honors").delete().eq(
            "node_stable_key", chart_foreign["stable_key"]
        ).execute()
        try:
            haul = 7
            run = self._complete_with_haul(
                admin_client, client, user, chart_home, haul, [chart_foreign["id"]]
            )

            erstv = _tuning(admin_client, "reward_erstvermessung")
            ratio = float(_tuning(admin_client, "reward_survey_siegel_ratio"))
            per_haul = int(_tuning(admin_client, "reward_survey_vp_per_haul"))

            assert run["haul"] == 0, "a closed run has no loose haul left — it was banked"
            closing = run["checkpoint"]["closing"]
            assert closing["reason"] == "entladung"
            assert closing["honors_won"] == 1, "first-ever survey of that node"
            assert closing["haul_banked"] == haul
            earnings = run["checkpoint"]["earnings"]
            assert earnings["vp_earned"] == haul * per_haul + erstv["vp"]
            assert earnings["siegel_earned"] == int(haul * ratio) + erstv["siegel"], (
                "Siegel from haul is floor-rounded, then the flat per-honor bonus"
            )

            row = _profile(admin_client, user)
            assert row["vp"] == earnings["vp_earned"]
            assert row["siegel"] == earnings["siegel_earned"]
        finally:
            _set_gate(admin_client, False)
            admin_client.table("chart_honors").delete().eq(
                "node_stable_key", chart_foreign["stable_key"]
            ).execute()
            _reset_traveler(admin_client, user)

    def test_second_bank_of_a_known_node_wins_no_second_bonus(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign
    ):
        """The bonus is counted from what fn_survey_deliver AWARDED (honors_won), not from
        the visited set — so re-surveying a node you already own pays the haul only."""
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        admin_client.table("chart_honors").delete().eq(
            "node_stable_key", chart_foreign["stable_key"]
        ).execute()
        try:
            self._complete_with_haul(
                admin_client, client, user, chart_home, 4, [chart_foreign["id"]]
            )
            first = _profile(admin_client, user)

            run2 = self._complete_with_haul(
                admin_client, client, user, chart_home, 4, [chart_foreign["id"]]
            )
            assert run2["checkpoint"]["closing"]["honors_won"] == 0, "the honor is already held"

            erstv = _tuning(admin_client, "reward_erstvermessung")
            second = _profile(admin_client, user)
            gained_vp = second["vp"] - first["vp"]
            assert gained_vp == 4, "haul only — no repeat Erstvermessung bonus"
            assert second["siegel"] - first["siegel"] < erstv["siegel"]
        finally:
            _set_gate(admin_client, False)
            admin_client.table("chart_honors").delete().eq(
                "node_stable_key", chart_foreign["stable_key"]
            ).execute()
            _reset_traveler(admin_client, user)

    def test_gate_off_bank_pays_nothing_and_leaves_no_fun_kern_residue(
        self, admin_client, user_clients, test_user_ids, chart_home, chart_foreign
    ):
        """The rollback contract, as it stands after W2.6.

        It was once phrased as byte parity with migration 256's four checkpoint keys. That
        phrasing died with the checkpoint's old SHAPE (the closing receipt is one typed block
        now, and it is written by all five endings through drift_closing_payload). What the
        contract actually protects is BEHAVIOUR, and that is what is pinned here: with the gate
        shut the P0 survey stat still lodges, no Siegel and no VP move, and the receipt carries
        NO Fun-Kern fact — no earnings block, no transmitted reserve.
        """
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, False)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = self._complete_with_haul(
                admin_client, client, user, chart_home, 6, [chart_foreign["id"]]
            )
            assert set(run["checkpoint"].keys()) == {"closing"}, (
                "gate off → the closing receipt and nothing else (no earnings ceremony)"
            )
            closing = run["checkpoint"]["closing"]
            assert set(closing.keys()) == {
                "reason", "haul_banked", "haul_lost", "surveys_delivered",
                "honors_won", "honor_keys",
            }, "no `haul_transmitted` — a Fun-Kern fact must not appear behind a shut gate"
            assert closing["haul_banked"] == 6
            row = _profile(admin_client, user)
            assert row["vp"] == 0 and row["siegel"] == 0
            assert row["qualities"]["vermessung_lodged"] == 6, "the P0 stat still lodges"
        finally:
            admin_client.table("chart_honors").delete().eq(
                "node_stable_key", chart_foreign["stable_key"]
            ).execute()
            _reset_traveler(admin_client, user)


# ── the rank ladder ───────────────────────────────────────────────────────────


class TestClearanceExam:
    """fn_clearance_exam — VP threshold + Siegel fee, charged exactly once."""

    def test_vp_too_low_is_refused(self, admin_client, user_clients, test_user_ids, chart_home):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        threshold = _tuning(admin_client, "clearance_thresholds")["feldkartograph"]
        _seed_profile(admin_client, user, chart_home["simulation_id"], vp=threshold - 1, siegel=999)
        try:
            with pytest.raises(Exception) as exc:
                client.rpc(
                    "fn_clearance_exam", {"p_user": str(user), "p_rank": "feldkartograph"}
                ).execute()
            assert "VP_TOO_LOW" in str(exc.value)
            row = _profile(admin_client, user)
            assert row["clearance_rank"] == "aspirant"
            assert row["siegel"] == 999, "a refused exam charges nothing"
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_siegel_too_low_is_refused(self, admin_client, user_clients, test_user_ids, chart_home):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        threshold = _tuning(admin_client, "clearance_thresholds")["feldkartograph"]
        fee = _tuning(admin_client, "clearance_exam_fee")["feldkartograph"]
        _seed_profile(admin_client, user, chart_home["simulation_id"], vp=threshold, siegel=fee - 1)
        try:
            with pytest.raises(Exception) as exc:
                client.rpc(
                    "fn_clearance_exam", {"p_user": str(user), "p_rank": "feldkartograph"}
                ).execute()
            assert "SIEGEL_TOO_LOW" in str(exc.value)
            assert _profile(admin_client, user)["clearance_rank"] == "aspirant"
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_promotion_charges_the_fee_once(self, admin_client, user_clients, test_user_ids, chart_home):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        threshold = _tuning(admin_client, "clearance_thresholds")["feldkartograph"]
        fee = _tuning(admin_client, "clearance_exam_fee")["feldkartograph"]
        _seed_profile(admin_client, user, chart_home["simulation_id"], vp=threshold, siegel=fee + 5)
        try:
            out = client.rpc(
                "fn_clearance_exam", {"p_user": str(user), "p_rank": "feldkartograph"}
            ).execute().data
            assert out["clearance_rank"] == "feldkartograph"
            assert out["fee_paid"] == fee
            assert out["siegel_balance"] == 5
            assert out["vp_total"] == threshold, "VP is a rank score — the exam never spends it"

            row = _profile(admin_client, user)
            assert row["clearance_rank"] == "feldkartograph"
            assert row["siegel"] == 5

            # A second sitting must not charge again.
            with pytest.raises(Exception) as exc:
                client.rpc(
                    "fn_clearance_exam", {"p_user": str(user), "p_rank": "feldkartograph"}
                ).execute()
            assert "RANK_ALREADY_HELD" in str(exc.value)
            assert _profile(admin_client, user)["siegel"] == 5, "no double charge"
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_gate_off_refuses_the_exam(self, admin_client, user_clients, test_user_ids, chart_home):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, False)
        _seed_profile(admin_client, user, chart_home["simulation_id"], vp=999, siegel=999)
        try:
            with pytest.raises(Exception) as exc:
                client.rpc(
                    "fn_clearance_exam", {"p_user": str(user), "p_rank": "feldkartograph"}
                ).execute()
            assert "GATE_CLOSED" in str(exc.value)
            assert _profile(admin_client, user)["clearance_rank"] == "aspirant"
        finally:
            _reset_traveler(admin_client, user)

    def test_unknown_rank_is_refused(self, admin_client, user_clients, test_user_ids, chart_home):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"], vp=999, siegel=999)
        try:
            with pytest.raises(Exception) as exc:
                client.rpc("fn_clearance_exam", {"p_user": str(user), "p_rank": "vermesser"}).execute()
            assert "no exam is offered" in str(exc.value)
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)


# ── the scar counts ───────────────────────────────────────────────────────────


class TestZerfaserungCounter:
    """The collapse floor and traveler_profiles.zerfaserung_count (dead since migration 239).

    Migration 264 armed the counter in the collapse floor itself. Migration 265 then turned
    that floor into the Havarie CHOICE, so the counter moved to where the run ACTUALLY
    unravels (fn_travel_zerfasern — the chosen zerfaserung or the TTL sweep); a Havarie
    survived is not a Zerfaserung. What remains asserted here is the gate-OFF half — the P0
    snap, with the column untouched — and the Havarie paths are covered in
    test_travel_havarie.py.
    """

    def _collapse(self, admin_client, client, user, chart_home, neighbor_id) -> dict:
        """Force a Kohärenz-floor collapse: 1 KH, 0 BB → the move pays Notfrequenz and unravels."""
        run = _open_run(client, user, chart_home["simulation_id"])
        _force_run_state(admin_client, run["id"], kohaerenz=1, bandbreite=0)
        return client.rpc(
            "fn_travel_move",
            {"p_user": str(user), "p_run": run["id"], "p_run_version": run["run_version"],
             "p_to_node": neighbor_id},
        ).execute().data

    def test_gate_on_the_floor_is_a_havarie_not_a_scar(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, True)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = self._collapse(admin_client, client, user, chart_home, home_neighbor)
            assert run["status"] == "havarie", "the run stops for a decision (265)"
            assert _profile(admin_client, user)["zerfaserung_count"] == 0, (
                "nothing has unravelled yet — the scar is not written on the stumble"
            )
        finally:
            _set_gate(admin_client, False)
            _reset_traveler(admin_client, user)

    def test_gate_off_snaps_and_leaves_the_counter_dead(
        self, admin_client, user_clients, test_user_ids, chart_home, home_neighbor
    ):
        user, client = test_user_ids[0], user_clients[0]
        _reset_traveler(admin_client, user)
        _set_gate(admin_client, False)
        _seed_profile(admin_client, user, chart_home["simulation_id"])
        try:
            run = self._collapse(admin_client, client, user, chart_home, home_neighbor)
            assert run["status"] == "abandoned", "the P0 snap still happens"
            assert _profile(admin_client, user)["zerfaserung_count"] == 0, (
                "gate off → exactly P0: the column stays untouched"
            )
        finally:
            _reset_traveler(admin_client, user)
