"""Integration tests for migration 244 (DRIFT embassy_canon_repair).

244 is a DATA migration: it repairs the Gaslit Reach ambassador canon (Archivist
Mossback → Madam Lacewing) and back-fills an agent_id into each embassy_metadata
ambassador object by resolving its name against an agent in the PAIRED simulation.
These tests assert the migrated-state invariants (they read seeded canon, so they
skip when the canonical embassies/agents are absent):

- CORRECTNESS (the strongest guarantee): every ambassador slot that carries an
  agent_id resolves to an agent that actually lives in that slot's paired
  simulation — the back-fill never mislinks across worlds.
- CANON: no slot whose paired sim has a Madam Lacewing agent still names
  "Archivist Mossback"; the Gaslit Reach ambassador now resolves to the real
  Madam Lacewing agent (KPI-1 — a quest selector can key off her as an entity).

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

import pytest

from backend.tests.integration.conftest import requires_supabase

pytestmark = [requires_supabase, pytest.mark.gamedb]


def _embassies_with_ambassadors(admin_client) -> list[dict]:
    resp = (
        admin_client.table("embassies")
        .select("id,simulation_a_id,simulation_b_id,embassy_metadata")
        .execute()
    )
    rows = [
        e
        for e in (resp.data or [])
        if (e.get("embassy_metadata") or {}).get("ambassador_a")
        or (e.get("embassy_metadata") or {}).get("ambassador_b")
    ]
    if not rows:
        pytest.skip("no embassies with ambassador metadata seeded")
    return rows


def _slot_refs(embassies: list[dict]) -> list[tuple[str, str]]:
    """(agent_id, expected_simulation_id) for every slot that carries an agent_id."""
    refs: list[tuple[str, str]] = []
    for e in embassies:
        meta = e.get("embassy_metadata") or {}
        for slot, sim_key in (("ambassador_a", "simulation_a_id"), ("ambassador_b", "simulation_b_id")):
            amb = meta.get(slot) or {}
            agent_id = amb.get("agent_id")
            if agent_id:
                refs.append((agent_id, e[sim_key]))
    return refs


class TestBackfillCorrectness:
    """Every back-filled agent_id resolves to an agent in the paired simulation."""

    def test_no_agent_id_points_to_wrong_sim(self, admin_client):
        embassies = _embassies_with_ambassadors(admin_client)
        refs = _slot_refs(embassies)
        if not refs:
            pytest.skip("no ambassador slots carry an agent_id (migration 244 not applied?)")

        agent_ids = list({aid for aid, _ in refs})
        agents_resp = (
            admin_client.table("agents").select("id,simulation_id,name").in_("id", agent_ids).execute()
        )
        sim_by_agent = {a["id"]: a["simulation_id"] for a in (agents_resp.data or [])}

        for agent_id, expected_sim in refs:
            assert agent_id in sim_by_agent, f"ambassador agent_id {agent_id} resolves to no agent"
            assert sim_by_agent[agent_id] == expected_sim, (
                f"ambassador agent_id {agent_id} lives in {sim_by_agent[agent_id]}, "
                f"but is referenced as the ambassador for {expected_sim}"
            )

    def test_most_slots_resolved(self, admin_client):
        # Sanity: the back-fill resolved a real majority of slots (not a no-op).
        embassies = _embassies_with_ambassadors(admin_client)
        total_slots = sum(
            bool((e["embassy_metadata"] or {}).get(s))
            for e in embassies
            for s in ("ambassador_a", "ambassador_b")
        )
        resolved = len(_slot_refs(embassies))
        assert resolved >= total_slots // 2, f"only {resolved}/{total_slots} ambassador slots resolved"


class TestLacewingCanon:
    """Mossback → Madam Lacewing, scoped to the Gaslit Reach ambassador."""

    def test_no_stale_mossback_where_lacewing_lives(self, admin_client):
        embassies = _embassies_with_ambassadors(admin_client)
        # Which sims have a Madam Lacewing agent?
        lacewing = (
            admin_client.table("agents").select("simulation_id").eq("name", "Madam Lacewing").execute()
        )
        lacewing_sims = {a["simulation_id"] for a in (lacewing.data or [])}
        if not lacewing_sims:
            pytest.skip("no Madam Lacewing agent seeded")

        for e in embassies:
            meta = e["embassy_metadata"] or {}
            for slot, sim_key in (("ambassador_a", "simulation_a_id"), ("ambassador_b", "simulation_b_id")):
                amb = meta.get(slot) or {}
                if e[sim_key] in lacewing_sims:
                    assert amb.get("name") != "Archivist Mossback", (
                        f"embassy {e['id']} {slot} still names the stale 'Archivist Mossback' "
                        f"in a Lacewing-bearing simulation"
                    )

    def test_lacewing_resolves_to_real_agent(self, admin_client):
        embassies = _embassies_with_ambassadors(admin_client)
        lacewing_agent_ids = {
            a["id"]
            for a in (
                admin_client.table("agents").select("id").eq("name", "Madam Lacewing").execute().data or []
            )
        }
        if not lacewing_agent_ids:
            pytest.skip("no Madam Lacewing agent seeded")

        found = False
        for e in embassies:
            meta = e["embassy_metadata"] or {}
            for slot in ("ambassador_a", "ambassador_b"):
                amb = meta.get(slot) or {}
                if amb.get("name") == "Madam Lacewing" and amb.get("agent_id"):
                    assert amb["agent_id"] in lacewing_agent_ids, (
                        f"Madam Lacewing slot in embassy {e['id']} carries a non-Lacewing agent_id"
                    )
                    found = True
        assert found, "no embassy slot resolved to Madam Lacewing (canon repair did not land)"
