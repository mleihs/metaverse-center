"""Integration tests for migration 253 (DRIFT fn_survey_deliver).

The survey-delivery half of P0c. Covers the §16.1 **P0b race set** acceptance
gate — "double survey delivery on one node → exactly one honor" — plus the per-user
fog-of-war delivery flag and the zero-case:

- ``chart_honors`` first-write-wins (C4): two travellers delivering the SAME node
  produce exactly one Erstvermessung row, held by the first writer; the runner-up
  wins nothing (honors_won == 0) but still records its own delivery.
- A re-delivery by the same traveller wins no new honor and leaves the discovery
  flagged delivered (idempotent — exactly-once at the node, not at the call).
- An empty key list returns a clean zero result and writes no honor/discovery rows.

``chart_honors.node_stable_key`` / ``traveler_discoveries.node_stable_key`` are plain
TEXT (no FK to nodes — they reference the stable_key, which survives regeneration), so
these tests use synthetic keys; only ``user_id`` needs a real auth.users row.

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from backend.tests.integration.conftest import requires_supabase

pytestmark = [requires_supabase, pytest.mark.gamedb]


def _deliver(admin_client, user_id, keys, version=1):
    """Call fn_survey_deliver (service_role-only effect RPC) and return its jsonb."""
    return admin_client.rpc(
        "fn_survey_deliver",
        {"p_user": str(user_id), "p_node_keys": keys, "p_chart_version": version},
    ).execute()


def _cleanup(admin_client, key):
    admin_client.table("chart_honors").delete().eq("node_stable_key", key).execute()
    admin_client.table("traveler_discoveries").delete().eq("node_stable_key", key).execute()


class TestSurveyDeliverRace:
    """fn_survey_deliver arbitrates the Erstvermessung honor first-write-wins (C4)."""

    def test_double_survey_deliver_one_node_exactly_one_honor(self, admin_client, test_user_ids):
        """Two travellers delivering the same node → exactly one honor, held by the
        first writer; the runner-up wins nothing but still flags its own delivery.

        This is the plan §16.1 P0b acceptance assertion (gate B)."""
        user_a, user_b = test_user_ids[0], test_user_ids[1]
        key = f"test-erstv-{uuid4()}"
        try:
            r1 = _deliver(admin_client, user_a, [key])
            r2 = _deliver(admin_client, user_b, [key])

            assert r1.data["honors_won"] == 1, "first deliverer must win the honor"
            assert r2.data["honors_won"] == 0, "second deliverer must win nothing (C4)"

            honors = (
                admin_client.table("chart_honors")
                .select("user_id")
                .eq("kind", "erstvermessung")
                .eq("node_stable_key", key)
                .execute()
            )
            assert len(honors.data) == 1, "exactly one honor row survives the race"
            assert honors.data[0]["user_id"] == str(user_a), "the first writer holds it"

            # Both travellers independently recorded their own delivery (FoW is per-user).
            discs = (
                admin_client.table("traveler_discoveries")
                .select("user_id, survey_delivered")
                .eq("node_stable_key", key)
                .execute()
            )
            assert {d["user_id"] for d in discs.data} == {str(user_a), str(user_b)}
            assert all(d["survey_delivered"] for d in discs.data)
        finally:
            _cleanup(admin_client, key)

    def test_redeliver_wins_no_new_honor_keeps_discovery(self, admin_client, test_user_ids):
        """The same traveller delivering a node twice wins the honor once; the second
        call wins nothing and the discovery stays flagged delivered (idempotent)."""
        user_a = test_user_ids[0]
        key = f"test-erstv-{uuid4()}"
        try:
            r1 = _deliver(admin_client, user_a, [key])
            r2 = _deliver(admin_client, user_a, [key])
            assert r1.data["honors_won"] == 1
            assert r2.data["honors_won"] == 0, "you cannot re-win your own node"
            assert r2.data["surveys_delivered"] == 1, "the re-delivery still touches the FoW row"

            honors = admin_client.table("chart_honors").select("id").eq("node_stable_key", key).execute()
            assert len(honors.data) == 1
            disc = (
                admin_client.table("traveler_discoveries")
                .select("survey_delivered, surveyed")
                .eq("node_stable_key", key)
                .eq("user_id", str(user_a))
                .execute()
            )
            assert len(disc.data) == 1
            assert disc.data[0]["survey_delivered"] is True
            assert disc.data[0]["surveyed"] is True
        finally:
            _cleanup(admin_client, key)

    def test_empty_keys_returns_zero(self, admin_client, test_user_ids):
        """No surveyed nodes (a home-only run) → a clean zero result, no rows."""
        user_a = test_user_ids[0]
        r = _deliver(admin_client, user_a, [])
        assert r.data["surveys_delivered"] == 0
        assert r.data["honors_won"] == 0
        assert r.data["honor_keys"] == []
