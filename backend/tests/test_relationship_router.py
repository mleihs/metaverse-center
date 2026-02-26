"""Tests for relationship API endpoints (routers/relationships.py)."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import get_current_user, get_supabase
from backend.models.common import CurrentUser
from backend.tests.conftest import MOCK_USER_EMAIL, MOCK_USER_ID

SIM_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
AGENT_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
AGENT_B = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
REL_ID = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")

BASE_URL = f"/api/v1/simulations/{SIM_ID}"

MOCK_REL = {
    "id": str(REL_ID),
    "simulation_id": str(SIM_ID),
    "source_agent_id": str(AGENT_ID),
    "target_agent_id": str(AGENT_B),
    "relationship_type": "ally",
    "is_bidirectional": True,
    "intensity": 7,
    "description": None,
    "metadata": None,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
    "source_agent": None,
    "target_agent": None,
}


def _mock_supabase_with_role(role: str = "editor") -> MagicMock:
    """Create a mock Supabase client that passes role checks.

    require_role queries simulation_members — the mock must return a member row.
    """
    mock = MagicMock()
    builder = MagicMock()
    builder.select.return_value = builder
    builder.eq.return_value = builder
    builder.limit.return_value = builder

    response = MagicMock()
    response.data = [{"member_role": role}]
    builder.execute.return_value = response

    mock.table.return_value = builder
    return mock


@pytest.fixture()
def client():
    """TestClient with auth and role-passing supabase override."""
    user = CurrentUser(id=MOCK_USER_ID, email=MOCK_USER_EMAIL, access_token="mock-token")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: _mock_supabase_with_role("editor")

    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def viewer_client():
    """TestClient with viewer role (read-only)."""
    user = CurrentUser(id=MOCK_USER_ID, email=MOCK_USER_EMAIL, access_token="mock-token")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: _mock_supabase_with_role("viewer")

    yield TestClient(app)
    app.dependency_overrides.clear()


# ── GET /agents/{agent_id}/relationships ───────────────────────────────


class TestListAgentRelationships:
    @patch("backend.routers.relationships.RelationshipService.list_for_agent", new_callable=AsyncMock)
    def test_returns_relationships(self, mock_list, client):
        mock_list.return_value = [MOCK_REL]

        resp = client.get(f"{BASE_URL}/agents/{AGENT_ID}/relationships")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["data"][0]["id"] == str(REL_ID)

    def test_requires_authentication(self):
        """Unauthenticated request should fail."""
        app.dependency_overrides.clear()
        raw_client = TestClient(app)
        resp = raw_client.get(f"{BASE_URL}/agents/{AGENT_ID}/relationships")
        # Should get 422 (missing header) or 401
        assert resp.status_code in (401, 422)


# ── GET /relationships ─────────────────────────────────────────────────


class TestListSimulationRelationships:
    @patch("backend.routers.relationships.RelationshipService.list_for_simulation", new_callable=AsyncMock)
    def test_returns_paginated(self, mock_list, client):
        mock_list.return_value = ([MOCK_REL], 1)

        resp = client.get(f"{BASE_URL}/relationships?limit=50&offset=0")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["meta"]["total"] == 1

    @patch("backend.routers.relationships.RelationshipService.list_for_simulation", new_callable=AsyncMock)
    def test_default_pagination(self, mock_list, client):
        mock_list.return_value = ([], 0)

        resp = client.get(f"{BASE_URL}/relationships")
        assert resp.status_code == 200
        mock_list.assert_called_once()
        call_kwargs = mock_list.call_args
        assert call_kwargs.kwargs["limit"] == 100
        assert call_kwargs.kwargs["offset"] == 0


# ── POST /agents/{agent_id}/relationships ──────────────────────────────


class TestCreateRelationship:
    @patch("backend.routers.relationships.AuditService.log_action", new_callable=AsyncMock)
    @patch("backend.routers.relationships.RelationshipService.create_relationship", new_callable=AsyncMock)
    def test_creates_successfully(self, mock_create, mock_audit, client):
        mock_create.return_value = MOCK_REL

        resp = client.post(
            f"{BASE_URL}/agents/{AGENT_ID}/relationships",
            json={
                "target_agent_id": str(AGENT_B),
                "relationship_type": "ally",
                "intensity": 7,
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        mock_create.assert_called_once()
        mock_audit.assert_called_once()

    def test_validation_error_missing_fields(self, client):
        resp = client.post(
            f"{BASE_URL}/agents/{AGENT_ID}/relationships",
            json={},
        )
        assert resp.status_code == 422

    def test_validation_error_invalid_intensity(self, client):
        resp = client.post(
            f"{BASE_URL}/agents/{AGENT_ID}/relationships",
            json={
                "target_agent_id": str(AGENT_B),
                "relationship_type": "ally",
                "intensity": 11,  # max is 10
            },
        )
        assert resp.status_code == 422

    @patch("backend.routers.relationships.RelationshipService.create_relationship", new_callable=AsyncMock)
    def test_viewer_cannot_create(self, mock_create, viewer_client):
        """Viewer role should not be able to create relationships (requires editor)."""
        resp = viewer_client.post(
            f"{BASE_URL}/agents/{AGENT_ID}/relationships",
            json={
                "target_agent_id": str(AGENT_B),
                "relationship_type": "ally",
            },
        )
        assert resp.status_code == 403


# ── PATCH /relationships/{relationship_id} ─────────────────────────────


class TestUpdateRelationship:
    @patch("backend.routers.relationships.AuditService.log_action", new_callable=AsyncMock)
    @patch("backend.routers.relationships.RelationshipService.update_relationship", new_callable=AsyncMock)
    def test_updates_successfully(self, mock_update, mock_audit, client):
        updated = {**MOCK_REL, "intensity": 9}
        mock_update.return_value = updated

        resp = client.patch(
            f"{BASE_URL}/relationships/{REL_ID}",
            json={"intensity": 9},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["intensity"] == 9
        mock_audit.assert_called_once()


# ── DELETE /relationships/{relationship_id} ────────────────────────────


class TestDeleteRelationship:
    @patch("backend.routers.relationships.AuditService.log_action", new_callable=AsyncMock)
    @patch("backend.routers.relationships.RelationshipService.delete_relationship", new_callable=AsyncMock)
    def test_deletes_successfully(self, mock_delete, mock_audit, client):
        mock_delete.return_value = {"id": str(REL_ID)}

        resp = client.delete(f"{BASE_URL}/relationships/{REL_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["message"] == "Relationship deleted."
        mock_audit.assert_called_once()
