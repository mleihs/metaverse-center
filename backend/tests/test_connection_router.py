"""Tests for connection API endpoints (routers/connections.py) + public endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import (
    get_admin_supabase,
    get_anon_supabase,
    get_current_user,
    get_supabase,
)
from backend.models.common import CurrentUser
from backend.tests.conftest import MOCK_USER_EMAIL, MOCK_USER_ID

SIM_A = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
SIM_B = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
AGENT_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
EVENT_ID = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
CONN_ID = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")

MOCK_CONN = {
    "id": str(CONN_ID),
    "simulation_a_id": str(SIM_A),
    "simulation_b_id": str(SIM_B),
    "connection_type": "bleed",
    "bleed_vectors": ["resonance", "commerce"],
    "strength": 0.7,
    "description": "Test connection",
    "is_active": True,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
    "simulation_a": None,
    "simulation_b": None,
}


@pytest.fixture()
def client():
    """TestClient with auth + admin supabase overridden."""
    user = CurrentUser(id=MOCK_USER_ID, email=MOCK_USER_EMAIL, access_token="mock-token")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: MagicMock()
    app.dependency_overrides[get_admin_supabase] = lambda: MagicMock()

    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def anon_client():
    """TestClient with anon supabase for public endpoints."""
    app.dependency_overrides[get_anon_supabase] = lambda: MagicMock()

    yield TestClient(app)
    app.dependency_overrides.clear()


# ═══════════════════════════════════════════════════════════════════════
# Authenticated connection endpoints (/api/v1/connections)
# ═══════════════════════════════════════════════════════════════════════


class TestListConnections:
    @patch("backend.routers.connections.ConnectionService.list_all", new_callable=AsyncMock)
    def test_returns_connections(self, mock_list, client):
        mock_list.return_value = [MOCK_CONN]

        resp = client.get("/api/v1/connections")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["data"][0]["connection_type"] == "bleed"

    @patch("backend.routers.connections.ConnectionService.list_all", new_callable=AsyncMock)
    def test_lists_all_including_inactive(self, mock_list, client):
        """Authenticated endpoint includes inactive connections."""
        mock_list.return_value = []

        client.get("/api/v1/connections")
        mock_list.assert_called_once()
        # active_only=False for authenticated endpoint
        call_kwargs = mock_list.call_args
        assert call_kwargs.kwargs.get("active_only") is False

    def test_requires_authentication(self):
        app.dependency_overrides.clear()
        raw_client = TestClient(app)
        resp = raw_client.get("/api/v1/connections")
        assert resp.status_code in (401, 422)


class TestCreateConnection:
    @patch("backend.routers.connections.ConnectionService.create_connection", new_callable=AsyncMock)
    def test_creates_successfully(self, mock_create, client):
        mock_create.return_value = MOCK_CONN

        resp = client.post(
            "/api/v1/connections",
            json={
                "simulation_a_id": str(SIM_A),
                "simulation_b_id": str(SIM_B),
                "connection_type": "bleed",
                "bleed_vectors": ["resonance"],
                "strength": 0.7,
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        mock_create.assert_called_once()

    def test_validation_error_missing_sims(self, client):
        resp = client.post("/api/v1/connections", json={})
        assert resp.status_code == 422

    def test_validation_error_strength_out_of_range(self, client):
        resp = client.post(
            "/api/v1/connections",
            json={
                "simulation_a_id": str(SIM_A),
                "simulation_b_id": str(SIM_B),
                "strength": 1.5,
            },
        )
        assert resp.status_code == 422


class TestUpdateConnection:
    @patch("backend.routers.connections.ConnectionService.update_connection", new_callable=AsyncMock)
    def test_updates_successfully(self, mock_update, client):
        updated = {**MOCK_CONN, "strength": 0.9}
        mock_update.return_value = updated

        resp = client.patch(
            f"/api/v1/connections/{CONN_ID}",
            json={"strength": 0.9},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["strength"] == 0.9


class TestDeleteConnection:
    @patch("backend.routers.connections.ConnectionService.delete_connection", new_callable=AsyncMock)
    def test_deletes_successfully(self, mock_delete, client):
        mock_delete.return_value = {"id": str(CONN_ID)}

        resp = client.delete(f"/api/v1/connections/{CONN_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["message"] == "Connection deleted."


# ═══════════════════════════════════════════════════════════════════════
# Public endpoints (no auth required)
# ═══════════════════════════════════════════════════════════════════════


class TestPublicConnections:
    @patch("backend.routers.public.ConnectionService.list_all", new_callable=AsyncMock)
    def test_public_connections_active_only(self, mock_list, anon_client):
        mock_list.return_value = [MOCK_CONN]

        resp = anon_client.get("/api/v1/public/connections")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        # Public endpoint should only list active connections
        call_kwargs = mock_list.call_args
        assert call_kwargs.kwargs.get("active_only") is True


class TestPublicMapData:
    @patch("backend.routers.public.ConnectionService.get_map_data", new_callable=AsyncMock)
    def test_returns_map_data(self, mock_map, anon_client):
        mock_map.return_value = {
            "simulations": [{"id": str(SIM_A), "name": "Test"}],
            "connections": [MOCK_CONN],
            "echo_counts": {str(SIM_A): 3},
        }

        resp = anon_client.get("/api/v1/public/map-data")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert "simulations" in data
        assert "connections" in data
        assert "echo_counts" in data
        assert data["echo_counts"][str(SIM_A)] == 3


class TestPublicRelationships:
    @patch("backend.routers.public.RelationshipService.list_for_agent", new_callable=AsyncMock)
    def test_public_agent_relationships(self, mock_list, anon_client):
        mock_list.return_value = [
            {"id": "rel1", "relationship_type": "ally"},
        ]

        resp = anon_client.get(f"/api/v1/public/simulations/{SIM_A}/agents/{AGENT_ID}/relationships")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1

    @patch("backend.routers.public.RelationshipService.list_for_simulation", new_callable=AsyncMock)
    def test_public_simulation_relationships(self, mock_list, anon_client):
        mock_list.return_value = ([], 0)

        resp = anon_client.get(f"/api/v1/public/simulations/{SIM_A}/relationships")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["meta"]["total"] == 0


class TestPublicEchoes:
    @patch("backend.routers.public.EchoService.list_for_simulation", new_callable=AsyncMock)
    def test_public_simulation_echoes(self, mock_list, anon_client):
        echo = {"id": "echo1", "status": "completed"}
        mock_list.return_value = ([echo], 1)

        resp = anon_client.get(f"/api/v1/public/simulations/{SIM_A}/echoes")
        assert resp.status_code == 200
        body = resp.json()
        assert body["meta"]["total"] == 1
        # Public echoes should be incoming only
        call_kwargs = mock_list.call_args.kwargs
        assert call_kwargs["direction"] == "incoming"

    @patch("backend.routers.public.EchoService.list_for_event", new_callable=AsyncMock)
    def test_public_event_echoes(self, mock_list, anon_client):
        mock_list.return_value = []

        resp = anon_client.get(f"/api/v1/public/simulations/{SIM_A}/events/{EVENT_ID}/echoes")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"] == []
