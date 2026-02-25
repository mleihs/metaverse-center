"""Integration tests for public (anonymous) read-only endpoints.

Runs against the real local Supabase instance with seed data.
All endpoints are GET-only and require no authentication.
"""

import pytest
from fastapi.testclient import TestClient

from backend.app import app

# Known seed data IDs (from supabase/seed/)
SIM_VELGARIEN = "10000000-0000-0000-0000-000000000001"
SIM_CAPYBARA = "20000000-0000-0000-0000-000000000001"
SIM_NONEXISTENT = "ffffffff-ffff-ffff-ffff-ffffffffffff"


@pytest.fixture()
def client():
    return TestClient(app)


# ── Simulations ──────────────────────────────────────────────────────────


class TestPublicSimulations:
    def test_list_simulations(self, client: TestClient):
        r = client.get("/api/v1/public/simulations")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)
        assert len(body["data"]) >= 2
        assert body["meta"]["total"] >= 2

    def test_list_simulations_pagination(self, client: TestClient):
        r = client.get("/api/v1/public/simulations?limit=1&offset=0")
        assert r.status_code == 200
        body = r.json()
        assert len(body["data"]) == 1
        assert body["meta"]["limit"] == 1
        assert body["meta"]["offset"] == 0

    def test_get_simulation(self, client: TestClient):
        r = client.get(f"/api/v1/public/simulations/{SIM_VELGARIEN}")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"]["id"] == SIM_VELGARIEN

    def test_get_simulation_not_found(self, client: TestClient):
        r = client.get(f"/api/v1/public/simulations/{SIM_NONEXISTENT}")
        assert r.status_code == 404


# ── Agents ───────────────────────────────────────────────────────────────


class TestPublicAgents:
    def test_list_agents(self, client: TestClient):
        r = client.get(f"/api/v1/public/simulations/{SIM_VELGARIEN}/agents")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)
        assert len(body["data"]) >= 1
        assert body["meta"]["total"] >= 1

    def test_list_agents_with_search(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/agents?search=nonexistent_xyz"
        )
        assert r.status_code == 200
        body = r.json()
        assert body["data"] == []

    def test_list_agents_pagination(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/agents?limit=2&offset=0"
        )
        assert r.status_code == 200
        assert len(r.json()["data"]) <= 2

    def test_get_agent(self, client: TestClient):
        # First, get an agent ID from the list
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/agents?limit=1"
        )
        agent_id = r.json()["data"][0]["id"]

        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/agents/{agent_id}"
        )
        assert r.status_code == 200
        assert r.json()["data"]["id"] == agent_id

    def test_get_agent_not_found(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/agents/{SIM_NONEXISTENT}"
        )
        assert r.status_code == 404


# ── Buildings ────────────────────────────────────────────────────────────


class TestPublicBuildings:
    def test_list_buildings(self, client: TestClient):
        r = client.get(f"/api/v1/public/simulations/{SIM_VELGARIEN}/buildings")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert len(body["data"]) >= 1

    def test_get_building(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/buildings?limit=1"
        )
        building_id = r.json()["data"][0]["id"]

        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/buildings/{building_id}"
        )
        assert r.status_code == 200
        assert r.json()["data"]["id"] == building_id

    def test_get_building_not_found(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/buildings/{SIM_NONEXISTENT}"
        )
        assert r.status_code == 404


# ── Events ───────────────────────────────────────────────────────────────


class TestPublicEvents:
    def test_list_events(self, client: TestClient):
        r = client.get(f"/api/v1/public/simulations/{SIM_VELGARIEN}/events")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert len(body["data"]) >= 1

    def test_get_event(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/events?limit=1"
        )
        event_id = r.json()["data"][0]["id"]

        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/events/{event_id}"
        )
        assert r.status_code == 200
        assert r.json()["data"]["id"] == event_id

    def test_get_event_not_found(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/events/{SIM_NONEXISTENT}"
        )
        assert r.status_code == 404


# ── Locations ────────────────────────────────────────────────────────────


class TestPublicLocations:
    def test_list_cities(self, client: TestClient):
        r = client.get(f"/api/v1/public/simulations/{SIM_VELGARIEN}/locations/cities")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)
        assert len(body["data"]) >= 1

    def test_get_city(self, client: TestClient):
        r = client.get(f"/api/v1/public/simulations/{SIM_VELGARIEN}/locations/cities")
        city_id = r.json()["data"][0]["id"]

        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/locations/cities/{city_id}"
        )
        assert r.status_code == 200
        assert r.json()["data"]["id"] == city_id

    def test_list_zones(self, client: TestClient):
        r = client.get(f"/api/v1/public/simulations/{SIM_VELGARIEN}/locations/zones")
        assert r.status_code == 200
        assert len(r.json()["data"]) >= 1

    def test_get_zone(self, client: TestClient):
        r = client.get(f"/api/v1/public/simulations/{SIM_VELGARIEN}/locations/zones")
        zone_id = r.json()["data"][0]["id"]

        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/locations/zones/{zone_id}"
        )
        assert r.status_code == 200
        assert r.json()["data"]["id"] == zone_id

    def test_list_streets(self, client: TestClient):
        r = client.get(f"/api/v1/public/simulations/{SIM_VELGARIEN}/locations/streets")
        assert r.status_code == 200
        assert isinstance(r.json()["data"], list)


# ── Chat ─────────────────────────────────────────────────────────────────


class TestPublicChat:
    def test_list_conversations(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/chat/conversations"
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)

    def test_list_messages(self, client: TestClient):
        # Get a conversation ID first
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/chat/conversations"
        )
        conversations = r.json()["data"]
        if not conversations:
            pytest.skip("No conversations in seed data")
        conv_id = conversations[0]["id"]

        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/chat/conversations/{conv_id}/messages"
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)
        assert "meta" in body


# ── Taxonomies ───────────────────────────────────────────────────────────


class TestPublicTaxonomies:
    def test_list_taxonomies(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/taxonomies"
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert len(body["data"]) >= 1

    def test_list_taxonomies_by_type(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/taxonomies?taxonomy_type=building_type"
        )
        assert r.status_code == 200
        for item in r.json()["data"]:
            assert item["taxonomy_type"] == "building_type"


# ── Settings ─────────────────────────────────────────────────────────────


class TestPublicSettings:
    def test_list_settings_returns_design_only(self, client: TestClient):
        """Public settings endpoint must only return 'design' category."""
        r = client.get(
            f"/api/v1/public/simulations/{SIM_CAPYBARA}/settings"
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        # Capybara Kingdom has design settings in seed data
        assert len(body["data"]) >= 1
        for setting in body["data"]:
            assert setting["category"] == "design", (
                f"Public settings returned non-design category: {setting['category']}"
            )

    def test_list_settings_no_ai_or_integration(self, client: TestClient):
        """Verify that AI and integration settings are NOT exposed publicly."""
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/settings"
        )
        assert r.status_code == 200
        body = r.json()
        # Velgarien has only ai/integration settings — should get empty result
        assert body["data"] == []


# ── Social ───────────────────────────────────────────────────────────────


class TestPublicSocial:
    def test_list_social_trends(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/social-trends"
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)

    def test_list_social_media(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/social-media"
        )
        assert r.status_code == 200
        assert isinstance(r.json()["data"], list)


# ── Campaigns ────────────────────────────────────────────────────────────


class TestPublicCampaigns:
    def test_list_campaigns(self, client: TestClient):
        r = client.get(
            f"/api/v1/public/simulations/{SIM_VELGARIEN}/campaigns"
        )
        assert r.status_code == 200
        assert isinstance(r.json()["data"], list)


# ── Security: No Write Access ────────────────────────────────────────────


class TestPublicNoWriteAccess:
    """Verify that POST/PUT/DELETE return 405 on public endpoints."""

    WRITE_ATTEMPTS = [
        ("POST", f"/api/v1/public/simulations/{SIM_VELGARIEN}/agents"),
        ("PUT", f"/api/v1/public/simulations/{SIM_VELGARIEN}/agents/{SIM_NONEXISTENT}"),
        ("DELETE", f"/api/v1/public/simulations/{SIM_VELGARIEN}/agents/{SIM_NONEXISTENT}"),
        ("POST", f"/api/v1/public/simulations/{SIM_VELGARIEN}/buildings"),
        ("POST", f"/api/v1/public/simulations/{SIM_VELGARIEN}/events"),
        ("POST", f"/api/v1/public/simulations/{SIM_VELGARIEN}/settings"),
        ("POST", f"/api/v1/public/simulations/{SIM_VELGARIEN}/chat/conversations"),
    ]

    @pytest.mark.parametrize("method,path", WRITE_ATTEMPTS)
    def test_write_rejected(self, client: TestClient, method: str, path: str):
        r = client.request(method, path, json={})
        assert r.status_code == 405, (
            f"{method} {path} returned {r.status_code}, expected 405 Method Not Allowed"
        )
