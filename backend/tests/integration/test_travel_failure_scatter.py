"""Integration tests for migration 255 (DRIFT §19.4 failure-floor cargo scatter).

When a run COLLAPSES (Kohärenz 0, or window-expired away from home), the carried
Depesche cargo scatters as faint echoes into the worlds it was headed for, routed
through the one hospitality gate — instead of just vanishing. This migration extracts
the gate's per-effect loop into ``fn_apply_drift_effects`` (the effect-family core) and
adds ``fn_drift_scatter_cargo`` on top.

Both new functions are EFFECT-class (service_role), so they are driveable directly via
``admin_client`` — no authed-user session needed. These tests cover:

- ``fn_apply_drift_effects`` emit_echo honours the hospitality matrix: a foreign world
  ≥ ``nur_echos`` receives the echo; the traveller's own anchor (home) is dropped as a
  self-echo; an unknown/uns settable target fails closed to ``geschlossen`` and is
  skipped (no events write). The ``source='zerfaserung'`` / ``run_id`` provenance lands
  on the event metadata (the discriminator from a delivery echo).
- ``fn_drift_scatter_cargo`` composes one echo per carried cargo, targeted at each
  cargo's destination world (the bound quest instance's ``simulation_id``), and reports
  ``scattered`` = the manifest size; an empty manifest scatters nothing (anti-farm).

NOT covered here (deliberately, same blocker as the 253 home-exclusion test): the
``fn_travel_move`` WIRING — that a real KH=0 move fires the scatter, and that voluntary
Rückzug (``fn_travel_abandon``) does NOT scatter (spec §4: "no scatter, no scar"). Both
are player-class (``auth.uid()`` guard), undriveable by ``admin_client``, and the
conftest has no authed-user fixture yet. They are browser-verified e2e through a real
session. ``fn_travel_abandon`` is untouched by migration 255 by design.

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from backend.tests.integration.conftest import requires_supabase

pytestmark = [requires_supabase, pytest.mark.gamedb]


def _sim_id(admin_client, name):
    r = admin_client.table("simulations").select("id").eq("name", name).limit(1).execute()
    return r.data[0]["id"] if r.data else None


def _apply_effects(admin_client, owner, anchor, effects, source="zerfaserung", ref=None):
    """Call fn_apply_drift_effects (service_role-only family core); return its jsonb."""
    return admin_client.rpc(
        "fn_apply_drift_effects",
        {
            "p_owner": str(owner),
            "p_anchor": str(anchor),
            "p_effects": effects,
            "p_source": source,
            "p_ref_id": str(ref or uuid4()),
        },
    ).execute()


def _scatter(admin_client, run, owner, anchor):
    return admin_client.rpc(
        "fn_drift_scatter_cargo",
        {"p_run": str(run), "p_owner": str(owner), "p_anchor": str(anchor)},
    ).execute()


def _echoes_for_ref(admin_client, ref):
    """travel_echo events tagged with this scatter's run_id (targeted, cleanup-safe)."""
    return (
        admin_client.table("events")
        .select("id, simulation_id, event_type, metadata")
        .eq("event_type", "travel_echo")
        .filter("metadata->>run_id", "eq", str(ref))
        .execute()
    )


def _delete_echoes(admin_client, ref):
    admin_client.table("events").delete().filter("metadata->>run_id", "eq", str(ref)).execute()


class TestApplyDriftEffectsCore:
    """fn_apply_drift_effects — the hospitality gate, reachable for the scatter source."""

    def test_emit_echo_applies_to_foreign_skips_home(self, admin_client, test_user_ids):
        """A scatter-source emit_echo lands in a foreign world (≥ nur_echos) and is dropped
        at the traveller's own anchor (no self-echo, §19.4 home exclusion). The event
        carries the source='zerfaserung' + run_id provenance that marks a scatter echo."""
        owner = test_user_ids[0]
        anchor = _sim_id(admin_client, "Velgarien")  # nur_echos, the home anchor here
        foreign = _sim_id(admin_client, "The Gaslit Reach")  # standard, ≥ nur_echos
        assert anchor and foreign, "P0 corridor sims (Velgarien / The Gaslit Reach) must be seeded"
        ref = uuid4()
        effects = [
            {"kind": "emit_echo", "target_sim": foreign, "text_de": "Echo über {sim}."},
            {"kind": "emit_echo", "target_sim": anchor, "text_de": "Echo über {sim}."},
        ]
        try:
            r = _apply_effects(admin_client, owner, anchor, effects, ref=ref)
            applied = r.data["applied"]
            skipped = r.data["skipped"]

            assert [a["kind"] for a in applied] == ["emit_echo"], "exactly the foreign echo applies"
            assert applied[0]["target_sim"] == foreign
            assert any(s.get("reason") == "hospitality_home" for s in skipped), (
                "the anchor echo must be skipped as a self-echo"
            )

            echoes = _echoes_for_ref(admin_client, ref)
            assert len(echoes.data) == 1, "one travel_echo event written, for the foreign world"
            ev = echoes.data[0]
            assert ev["simulation_id"] == foreign
            assert ev["metadata"]["source"] == "zerfaserung", "scatter provenance, not a delivery"
            assert ev["metadata"]["run_id"] == str(ref)
        finally:
            _delete_echoes(admin_client, ref)

    def test_emit_echo_fail_closed_geschlossen_skips(self, admin_client, test_user_ids):
        """An unknown target sim has no drift_hospitality row → fail-closed 'geschlossen'
        → the echo is skipped before any events write (so no FK violation, no leak)."""
        owner = test_user_ids[0]
        anchor = _sim_id(admin_client, "Velgarien")
        ref = uuid4()
        unknown_sim = uuid4()  # no simulations/settings row → geschlossen
        effects = [{"kind": "emit_echo", "target_sim": str(unknown_sim)}]
        try:
            r = _apply_effects(admin_client, owner, anchor, effects, ref=ref)
            assert r.data["applied"] == []
            assert r.data["skipped"][0]["reason"] == "hospitality_geschlossen"
            assert len(_echoes_for_ref(admin_client, ref).data) == 0
        finally:
            _delete_echoes(admin_client, ref)


class TestScatterCargo:
    """fn_drift_scatter_cargo — one echo per carried cargo, at its destination world."""

    def test_scatter_emits_one_echo_per_cargo_home_excluded(self, admin_client, test_user_ids):
        """Two cargo (one bound for a foreign world, one for home) → scattered=2, one echo
        lands in the foreign world, the home-bound one is dropped by the gate."""
        owner = test_user_ids[0]
        anchor = _sim_id(admin_client, "Velgarien")
        foreign = _sim_id(admin_client, "The Gaslit Reach")
        assert anchor and foreign

        # status='abandoned' avoids the single-active-run unique index; the scatter reads
        # cargo regardless of status.
        run = (
            admin_client.table("travel_runs")
            .insert({"user_id": str(owner), "status": "abandoned"})
            .execute()
            .data[0]["id"]
        )
        inst_foreign = (
            admin_client.table("travel_quest_instances")
            .insert({"template_key": "test_scatter", "owner_user_id": str(owner), "simulation_id": foreign})
            .execute()
            .data[0]["id"]
        )
        inst_home = (
            admin_client.table("travel_quest_instances")
            .insert({"template_key": "test_scatter", "owner_user_id": str(owner), "simulation_id": anchor})
            .execute()
            .data[0]["id"]
        )
        for inst in (inst_foreign, inst_home):
            admin_client.table("travel_cargo").insert(
                {
                    "owner_user_id": str(owner),
                    "run_id": run,
                    "quest_instance_id": inst,
                    "family": "erinnerungsstuecke",
                    "vector": "memory",
                }
            ).execute()
        try:
            r = _scatter(admin_client, run, owner, anchor)
            assert r.data["scattered"] == 2, "the manifest size, regardless of gate outcome"
            assert [a["target_sim"] for a in r.data["applied"]] == [foreign]
            assert any(s.get("reason") == "hospitality_home" for s in r.data["skipped"])

            echoes = _echoes_for_ref(admin_client, run)
            assert len(echoes.data) == 1
            assert echoes.data[0]["simulation_id"] == foreign
            assert echoes.data[0]["metadata"]["source"] == "zerfaserung"
        finally:
            _delete_echoes(admin_client, run)
            admin_client.table("travel_cargo").delete().eq("run_id", run).execute()
            admin_client.table("travel_quest_instances").delete().in_("id", [inst_foreign, inst_home]).execute()
            admin_client.table("travel_runs").delete().eq("id", run).execute()

    def test_empty_manifest_scatters_nothing(self, admin_client, test_user_ids):
        """A run carrying no cargo → scattered=0, no echoes (the empty-Zerfaserung floor)."""
        owner = test_user_ids[0]
        anchor = _sim_id(admin_client, "Velgarien")
        run = (
            admin_client.table("travel_runs")
            .insert({"user_id": str(owner), "status": "abandoned"})
            .execute()
            .data[0]["id"]
        )
        try:
            r = _scatter(admin_client, run, owner, anchor)
            assert r.data["scattered"] == 0
            assert r.data["applied"] == []
            assert r.data["skipped"] == []
            assert len(_echoes_for_ref(admin_client, run).data) == 0
        finally:
            admin_client.table("travel_runs").delete().eq("id", run).execute()
