"""Integration tests for ``fn_apply_map_geometry`` (migrations 236/245).

P1-8 of the 2026-07-12 deep audit: the sole write path for per-simulation map
geometry — the atomic SQL function every geometry persistence MUST go through
per CLAUDE.md — had zero tests. Its entire reason to exist is the
all-or-nothing contract (ADR-007): city centers, zone geojson, full street
replacement, building snap, deterministic lives_at assignment, version bump
and forge-draft status transition happen in ONE transaction.

Asserted here against a live Supabase:

- Happy path: every write lands, the returned counter object is accurate,
  ``map_geometry_version`` bumps by exactly 1, ``map_seed`` is persisted, the
  pre-existing street is fully replaced, the agent gets a lives_at relation,
  and the in-flight forge draft flips to ``map_status='succeeded'``.
- Poisoned payload: an invalid street row makes the WHOLE call roll back —
  including the street DELETE that executed before the failing INSERT and the
  zone update that succeeded before it. No partial state, no version bump.

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from postgrest.exceptions import APIError

from backend.tests.integration.conftest import requires_supabase

pytestmark = [requires_supabase]


_POINT = {"type": "Point", "coordinates": [15.44, 47.07]}
_POLYGON = {
    "type": "Polygon",
    "coordinates": [[[15.4, 47.0], [15.5, 47.0], [15.5, 47.1], [15.4, 47.1], [15.4, 47.0]]],
}


@pytest.fixture()
def _draft_owner_id(request, admin_client) -> str:
    """Any auth user id usable as forge_drafts.user_id (FK → auth.users).

    Prefers an existing user_profiles row (mirrors auth.users 1:1) so the
    suite runs on local dev DBs where the GoTrue admin API is unreachable
    (name-resolution 503 — the known local limitation of ``test_user_ids``);
    falls back to creating the shared test users on a pristine CI database.
    """
    rows = admin_client.table("user_profiles").select("id").limit(1).execute().data
    if rows:
        return rows[0]["id"]
    return str(request.getfixturevalue("test_user_ids")[0])


@pytest.fixture()
def map_world(admin_client, _draft_owner_id):
    """A minimal world: sim, city, zone, residential building, agent, one street, draft."""
    ids = {
        "sim": str(uuid4()),
        "city": str(uuid4()),
        "zone": str(uuid4()),
        "building": str(uuid4()),
        "agent": str(uuid4()),
        "old_street": str(uuid4()),
        "draft": str(uuid4()),
    }
    marker = ids["sim"][:8]
    admin_client.table("simulations").insert(
        {"id": ids["sim"], "name": f"Geometry {marker}", "slug": f"geom-{marker}"}
    ).execute()
    admin_client.table("cities").insert(
        {"id": ids["city"], "simulation_id": ids["sim"], "name": f"City {marker}"}
    ).execute()
    admin_client.table("zones").insert(
        {
            "id": ids["zone"],
            "simulation_id": ids["sim"],
            "city_id": ids["city"],
            "name": f"Zone {marker}",
        }
    ).execute()
    admin_client.table("buildings").insert(
        {
            "id": ids["building"],
            "simulation_id": ids["sim"],
            "name": f"Building {marker}",
            "slug": f"building-{marker}",
            "building_type": "residential",
        }
    ).execute()
    admin_client.table("agents").insert(
        {
            "id": ids["agent"],
            "simulation_id": ids["sim"],
            "name": f"Agent {marker}",
            "slug": f"agent-{marker}",
        }
    ).execute()
    admin_client.table("city_streets").insert(
        {
            "id": ids["old_street"],
            "simulation_id": ids["sim"],
            "city_id": ids["city"],
            "name": "Alte Gasse",
        }
    ).execute()
    admin_client.table("forge_drafts").insert(
        {"id": ids["draft"], "user_id": _draft_owner_id, "map_status": "generating"}
    ).execute()

    yield ids

    admin_client.table("building_agent_relations").delete().eq("simulation_id", ids["sim"]).execute()
    admin_client.table("city_streets").delete().eq("simulation_id", ids["sim"]).execute()
    admin_client.table("forge_drafts").delete().eq("id", ids["draft"]).execute()
    admin_client.table("agents").delete().eq("id", ids["agent"]).execute()
    admin_client.table("buildings").delete().eq("id", ids["building"]).execute()
    admin_client.table("zones").delete().eq("id", ids["zone"]).execute()
    admin_client.table("cities").delete().eq("id", ids["city"]).execute()
    admin_client.table("simulations").delete().eq("id", ids["sim"]).execute()


def _sim_state(admin_client, sim_id: str) -> dict:
    return admin_client.table("simulations").select("map_geometry_version, map_seed").eq("id", sim_id).execute().data[0]


def _geometry(ids: dict, street_id: str) -> dict:
    return {
        "cities": [{"id": ids["city"], "map_center_lat": 47.07, "map_center_lng": 15.44}],
        "zones": [{"id": ids["zone"], "geojson": _POLYGON}],
        "streets": [
            {
                "id": street_id,
                "city_id": ids["city"],
                "zone_id": ids["zone"],
                "name": "Neue Achse",
                "street_type": "avenue",
                "length_km": 1.25,
                "geojson": _POINT,
            }
        ],
        "buildings": [{"id": ids["building"], "geojson": _POINT, "street_id": street_id}],
    }


class TestApplyMapGeometryHappyPath:
    def test_full_apply_writes_everything_atomically(self, admin_client, map_world):
        before = _sim_state(admin_client, map_world["sim"])
        new_street = str(uuid4())

        result = (
            admin_client.rpc(
                "fn_apply_map_geometry",
                {
                    "p_simulation_id": map_world["sim"],
                    "p_seed": "test-seed-271",
                    "p_geometry": _geometry(map_world, new_street),
                    "p_forge_draft_id": map_world["draft"],
                },
            ).execute()
        ).data

        assert result == {
            "cities_updated": 1,
            "zones_updated": 1,
            "streets_inserted": 1,
            "buildings_updated": 1,
            "lives_at_inserted": 1,
            "geometry_version": before["map_geometry_version"] + 1,
        }

        after = _sim_state(admin_client, map_world["sim"])
        assert after["map_geometry_version"] == before["map_geometry_version"] + 1
        assert after["map_seed"] == "test-seed-271"

        streets = admin_client.table("city_streets").select("id").eq("simulation_id", map_world["sim"]).execute().data
        assert [s["id"] for s in streets] == [new_street], (
            "street set must be fully replaced (old street gone, new street present)"
        )

        building = (
            admin_client.table("buildings")
            .select("geojson, street_id")
            .eq("id", map_world["building"])
            .execute()
            .data[0]
        )
        assert building["street_id"] == new_street
        assert building["geojson"] == _POINT

        lives_at = (
            admin_client.table("building_agent_relations")
            .select("agent_id, building_id, relation_type")
            .eq("simulation_id", map_world["sim"])
            .execute()
            .data
        )
        assert lives_at == [
            {
                "agent_id": map_world["agent"],
                "building_id": map_world["building"],
                "relation_type": "lives_at",
            }
        ]

        draft = admin_client.table("forge_drafts").select("map_status").eq("id", map_world["draft"]).execute().data[0]
        assert draft["map_status"] == "succeeded"

    def test_unknown_simulation_raises(self, admin_client):
        with pytest.raises(APIError):
            admin_client.rpc(
                "fn_apply_map_geometry",
                {"p_simulation_id": str(uuid4()), "p_seed": "x", "p_geometry": {}},
            ).execute()


class TestApplyMapGeometryRollback:
    def test_poisoned_street_rolls_back_every_write(self, admin_client, map_world):
        """The zone UPDATE and the street DELETE run BEFORE the failing street
        INSERT inside the function — a non-atomic implementation would leave a
        mutated zone and an empty street set behind."""
        before = _sim_state(admin_client, map_world["sim"])
        poisoned = _geometry(map_world, "not-a-uuid")  # street id cast raises

        with pytest.raises(APIError):
            admin_client.rpc(
                "fn_apply_map_geometry",
                {
                    "p_simulation_id": map_world["sim"],
                    "p_seed": "poison-seed",
                    "p_geometry": poisoned,
                    "p_forge_draft_id": map_world["draft"],
                },
            ).execute()

        after = _sim_state(admin_client, map_world["sim"])
        assert after == before, "version/seed must be untouched after rollback"

        zone = admin_client.table("zones").select("geojson").eq("id", map_world["zone"]).execute().data[0]
        assert zone["geojson"] is None, "zone geojson update must be rolled back"

        streets = admin_client.table("city_streets").select("id").eq("simulation_id", map_world["sim"]).execute().data
        assert [s["id"] for s in streets] == [map_world["old_street"]], (
            "the street DELETE preceding the failed INSERT must be rolled back"
        )

        lives_at = (
            admin_client.table("building_agent_relations")
            .select("id")
            .eq("simulation_id", map_world["sim"])
            .execute()
            .data
        )
        assert not lives_at, "no lives_at relation may survive the rollback"

        draft = admin_client.table("forge_drafts").select("map_status").eq("id", map_world["draft"]).execute().data[0]
        assert draft["map_status"] == "generating", "draft must not flip to succeeded on a failed apply"
