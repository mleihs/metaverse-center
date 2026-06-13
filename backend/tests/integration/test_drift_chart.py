"""Integration tests for migration 240 (DRIFT drift_chart).

Verifies the chart-layer invariants the survey economy and engine depend on:

- ``chart_honors`` UNIQUE(kind, node_stable_key) — the Erstvermessung /
  Erstkontakt first-write-wins arbitration (C4). A second claim of the same
  (kind, key) collides; a different kind on the same key is allowed.
- ``traveler_discoveries`` PK(user_id, node_stable_key) — FoW upserts are
  idempotent (scan → survey transitions never duplicate a node).
- The deferred FK travel_runs.position_node_id → drift_chart_nodes(id) (added
  in 240) is enforced.
- Public-first contract: an anonymous client (anon key) can read chart
  topology rows end-to-end (RLS policy + role grant).

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

from uuid import uuid4

import httpx
import pytest
from postgrest.exceptions import APIError

from backend.config import settings
from backend.tests.integration.conftest import requires_supabase

pytestmark = [requires_supabase, pytest.mark.gamedb]


class TestChartHonors:
    """UNIQUE(kind, node_stable_key) is the first-write-wins flag."""

    def test_first_write_wins(self, admin_client, test_user_ids):
        key = f"honor-test-{uuid4()}"
        try:
            admin_client.table("chart_honors").insert(
                {"kind": "erstvermessung", "node_stable_key": key, "user_id": str(test_user_ids[0])}
            ).execute()
            # Second claim of the same (kind, key) by another user → collides.
            with pytest.raises(APIError):
                admin_client.table("chart_honors").insert(
                    {"kind": "erstvermessung", "node_stable_key": key, "user_id": str(test_user_ids[1])}
                ).execute()
            # A different kind on the same node is a distinct honor → allowed.
            admin_client.table("chart_honors").insert(
                {"kind": "erstkontakt", "node_stable_key": key, "user_id": str(test_user_ids[1])}
            ).execute()
        finally:
            admin_client.table("chart_honors").delete().eq("node_stable_key", key).execute()


class TestTravelerDiscoveries:
    """FoW is keyed (user_id, node_stable_key) — upserts are idempotent."""

    def test_pk_upsert_idempotent(self, admin_client, test_user_ids):
        user_id = test_user_ids[2]
        key = f"disc-test-{uuid4()}"
        try:
            admin_client.table("traveler_discoveries").insert(
                {"user_id": str(user_id), "node_stable_key": key, "chart_version_first_seen": 1, "source": "scan"}
            ).execute()
            # Re-upsert the same PK flipping surveyed → exactly one row, updated.
            admin_client.table("traveler_discoveries").upsert(
                {
                    "user_id": str(user_id),
                    "node_stable_key": key,
                    "chart_version_first_seen": 1,
                    "source": "scan",
                    "surveyed": True,
                },
                on_conflict="user_id,node_stable_key",
            ).execute()
            resp = (
                admin_client.table("traveler_discoveries")
                .select("surveyed", count="exact")
                .eq("user_id", str(user_id))
                .eq("node_stable_key", key)
                .execute()
            )
            assert resp.count == 1, f"Expected 1 discovery row, got {resp.count}"
            assert resp.data[0]["surveyed"] is True
        finally:
            (
                admin_client.table("traveler_discoveries")
                .delete()
                .eq("user_id", str(user_id))
                .eq("node_stable_key", key)
                .execute()
            )


class TestDeferredForeignKeys:
    """travel_runs.position_node_id → drift_chart_nodes(id) is enforced (added in 240)."""

    def test_position_node_fk_enforced(self, admin_client, test_user_ids):
        user_id = test_user_ids[3]
        admin_client.table("travel_runs").delete().eq("user_id", str(user_id)).execute()
        try:
            with pytest.raises(APIError):
                admin_client.table("travel_runs").insert(
                    {
                        "user_id": str(user_id),
                        "status": "active",
                        "frequency": "memory",
                        "position_node_id": str(uuid4()),  # no such node
                    }
                ).execute()
            # NULL position is valid (a run begins before its first chart placement).
            admin_client.table("travel_runs").insert(
                {"user_id": str(user_id), "status": "active", "frequency": "memory"}
            ).execute()
        finally:
            admin_client.table("travel_runs").delete().eq("user_id", str(user_id)).execute()


class TestPublicChartRead:
    """Public-first: anon reads chart topology end-to-end (RLS policy + grant)."""

    def test_anon_can_read_chart_nodes(self, admin_client):
        version = 990001
        node_id = str(uuid4())
        admin_client.table("chart_versions").insert(
            {"version": version, "seed": 12345, "generator_version": "test-240"}
        ).execute()
        admin_client.table("drift_chart_nodes").insert(
            {
                "id": node_id,
                "chart_version": version,
                "stable_key": f"test-{node_id}",
                "node_kind": "seeded",
                "node_type": "interstitial",
                "x": 0,
                "y": 0,
                "region_cell": "test",
                "distance_band": "near",
            }
        ).execute()
        try:
            resp = httpx.get(
                f"{settings.supabase_url}/rest/v1/drift_chart_nodes",
                params={"id": f"eq.{node_id}", "select": "id"},
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {settings.supabase_anon_key}",
                },
                timeout=5.0,
            )
            assert resp.status_code == 200, resp.text
            assert any(r["id"] == node_id for r in resp.json()), (
                f"anon could not read public chart node: {resp.json()}"
            )
        finally:
            admin_client.table("drift_chart_nodes").delete().eq("id", node_id).execute()
            admin_client.table("chart_versions").delete().eq("version", version).execute()
