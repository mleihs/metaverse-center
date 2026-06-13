"""Integration tests for migration 245 (DRIFT zone_adjacencies).

Verifies the Begehung movement-graph substrate:

- fn_apply_zone_adjacencies normalizes undirected pairs (LEAST/GREATEST), drops
  self-pairs, de-dups the reverse duplicate, full-replaces a simulation's rows,
  and bumps map_geometry_version only when asked (p_bump_version).
- The ordered-pair CHECK (zone_a < zone_b) and the derivation CHECK reject bad
  direct inserts.
- zone_adjacencies is public-read map topology (anon can SELECT it).

Uses the seeded Velgarien template sim and its zones; cleans up the rows it
writes. Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

import httpx
import pytest
from postgrest.exceptions import APIError

from backend.config import settings
from backend.tests.integration.conftest import requires_supabase
from backend.tests.integration.game_constants import SIM_VELGARIEN

pytestmark = [requires_supabase, pytest.mark.gamedb]

# Three seeded Velgarien zones with geojson; a1 < a2 < a3 as uuids.
ZONE_A1 = "a0000001-0000-0000-0000-000000000001"
ZONE_A2 = "a0000002-0000-0000-0000-000000000001"
ZONE_A3 = "a0000003-0000-0000-0000-000000000001"


def _zones_present(admin_client) -> bool:
    resp = admin_client.table("zones").select("id").in_("id", [ZONE_A1, ZONE_A2, ZONE_A3]).execute()
    return len(resp.data or []) == 3


class TestApplyZoneAdjacencies:
    """fn_apply_zone_adjacencies normalizes, dedups, drops self-pairs, bumps version."""

    def test_normalize_dedup_and_version_bump(self, admin_client):
        if not _zones_present(admin_client):
            pytest.skip("Velgarien zones not seeded")
        sim = str(SIM_VELGARIEN)
        try:
            # Reversed pair + its duplicate + a self-pair + a distinct pair.
            pairs = [
                {"zone_a": ZONE_A2, "zone_b": ZONE_A1, "derivation": "geometry"},  # reversed
                {"zone_a": ZONE_A1, "zone_b": ZONE_A2, "derivation": "geometry"},  # dup of above
                {"zone_a": ZONE_A1, "zone_b": ZONE_A1, "derivation": "geometry"},  # self → dropped
                {"zone_a": ZONE_A2, "zone_b": ZONE_A3, "derivation": "transit"},   # distinct
            ]
            result = admin_client.rpc(
                "fn_apply_zone_adjacencies",
                {"p_simulation_id": sim, "p_pairs": pairs, "p_bump_version": True},
            ).execute()
            assert result.data["inserted"] == 2, f"expected 2 canonical rows, got {result.data}"

            rows = (
                admin_client.table("zone_adjacencies")
                .select("zone_a,zone_b,derivation")
                .eq("simulation_id", sim)
                .order("zone_a")
                .order("zone_b")
                .execute()
            ).data
            assert rows == [
                {"zone_a": ZONE_A1, "zone_b": ZONE_A2, "derivation": "geometry"},
                {"zone_a": ZONE_A2, "zone_b": ZONE_A3, "derivation": "transit"},
            ], f"rows not canonical/deduped: {rows}"

            # bump=False must NOT advance the version.
            before = (
                admin_client.table("simulations").select("map_geometry_version").eq("id", sim).execute()
            ).data[0]["map_geometry_version"]
            nobump = admin_client.rpc(
                "fn_apply_zone_adjacencies",
                {"p_simulation_id": sim, "p_pairs": [], "p_bump_version": False},
            ).execute()
            assert nobump.data["geometry_version"] == before, "bump=False advanced the version"
        finally:
            admin_client.table("zone_adjacencies").delete().eq("simulation_id", sim).execute()


class TestConstraints:
    """The ordered-pair and derivation CHECKs reject bad direct inserts."""

    def test_reversed_order_rejected(self, admin_client):
        if not _zones_present(admin_client):
            pytest.skip("Velgarien zones not seeded")
        # zone_a > zone_b violates the canonical-order CHECK.
        with pytest.raises(APIError):
            admin_client.table("zone_adjacencies").insert(
                {"simulation_id": str(SIM_VELGARIEN), "zone_a": ZONE_A2, "zone_b": ZONE_A1, "derivation": "geometry"}
            ).execute()

    def test_bad_derivation_rejected(self, admin_client):
        if not _zones_present(admin_client):
            pytest.skip("Velgarien zones not seeded")
        with pytest.raises(APIError):
            admin_client.table("zone_adjacencies").insert(
                {"simulation_id": str(SIM_VELGARIEN), "zone_a": ZONE_A1, "zone_b": ZONE_A2, "derivation": "streets"}
            ).execute()


class TestPublicRead:
    """zone_adjacencies is public-read map topology (anon can SELECT)."""

    def test_anon_can_read(self, admin_client):
        if not _zones_present(admin_client):
            pytest.skip("Velgarien zones not seeded")
        sim = str(SIM_VELGARIEN)
        admin_client.table("zone_adjacencies").insert(
            {"simulation_id": sim, "zone_a": ZONE_A1, "zone_b": ZONE_A2, "derivation": "geometry"}
        ).execute()
        try:
            resp = httpx.get(
                f"{settings.supabase_url}/rest/v1/zone_adjacencies",
                params={"simulation_id": f"eq.{sim}", "select": "zone_a,zone_b"},
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {settings.supabase_anon_key}",
                },
                timeout=5.0,
            )
            assert resp.status_code == 200, resp.text
            assert any(r["zone_a"] == ZONE_A1 and r["zone_b"] == ZONE_A2 for r in resp.json()), (
                f"anon could not read public zone adjacency: {resp.json()}"
            )
        finally:
            admin_client.table("zone_adjacencies").delete().eq("simulation_id", sim).execute()
