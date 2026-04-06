"""Tests for embassy API endpoints (routers/embassies.py)."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import get_admin_supabase, get_current_user, get_effective_supabase, get_supabase
from backend.models.common import CurrentUser
from backend.tests.conftest import MOCK_USER_EMAIL, MOCK_USER_ID

SIM_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
SIM_B = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02")
BUILDING_A = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
BUILDING_B = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
EMBASSY_ID = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")

BASE_URL = f"/api/v1/simulations/{SIM_ID}"

MOCK_EMBASSY = {
    "id": str(EMBASSY_ID),
    "building_a_id": str(BUILDING_A),
    "simulation_a_id": str(SIM_ID),
    "building_b_id": str(BUILDING_B),
    "simulation_b_id": str(SIM_B),
    "status": "proposed",
    "connection_type": "embassy",
    "description": "Trade route between worlds",
    "established_by": "Council of Elders",
    "bleed_vector": "commerce",
    "event_propagation": True,
    "embassy_metadata": None,
    "created_by_id": str(MOCK_USER_ID),
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
    "building_a": None,
    "building_b": None,
    "simulation_a": None,
    "simulation_b": None,
}


def _mock_supabase_with_role(role: str = "editor") -> MagicMock:
    """Create a mock Supabase that passes role checks.

    require_role queries simulation_members — the mock must return a member row.
    """
    mock = MagicMock()

    def make_builder(table_name):
        b = MagicMock()
        b.select.return_value = b
        b.eq.return_value = b
        b.limit.return_value = b
        b.single.return_value = b

        r = MagicMock()
        if table_name == "simulation_members":
            r.data = [{"member_role": role}]
        else:
            r.data = None
        b.execute = AsyncMock(return_value=r)
        return b

    mock.table.side_effect = make_builder
    return mock


@pytest.fixture()
def client():
    """TestClient with auth, editor role, and admin supabase overrides."""
    user = CurrentUser(id=MOCK_USER_ID, email=MOCK_USER_EMAIL, access_token="mock-token")
    mock_sb = _mock_supabase_with_role("editor")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_effective_supabase] = lambda: mock_sb
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[get_admin_supabase] = lambda: MagicMock()

    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_client():
    """TestClient with admin role."""
    user = CurrentUser(id=MOCK_USER_ID, email=MOCK_USER_EMAIL, access_token="mock-token")
    mock_sb = _mock_supabase_with_role("admin")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_effective_supabase] = lambda: mock_sb
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[get_admin_supabase] = lambda: MagicMock()

    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def viewer_client():
    """TestClient with viewer role (read-only)."""
    user = CurrentUser(id=MOCK_USER_ID, email=MOCK_USER_EMAIL, access_token="mock-token")
    mock_sb = _mock_supabase_with_role("viewer")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_effective_supabase] = lambda: mock_sb
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[get_admin_supabase] = lambda: MagicMock()

    yield TestClient(app)
    app.dependency_overrides.clear()


# ── GET /embassies ────────────────────────────────────────────────────


class TestListEmbassies:
    @patch("backend.routers.embassies.EmbassyService.list_for_simulation", new_callable=AsyncMock)
    def test_returns_paginated_embassies(self, mock_list, client):
        mock_list.return_value = ([MOCK_EMBASSY], 1)

        resp = client.get(f"{BASE_URL}/embassies?limit=25&offset=0")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["meta"]["total"] == 1
        assert len(body["data"]) == 1
        assert body["data"][0]["id"] == str(EMBASSY_ID)

    @patch("backend.routers.embassies.EmbassyService.list_for_simulation", new_callable=AsyncMock)
    def test_status_filter_passed(self, mock_list, client):
        mock_list.return_value = ([], 0)

        resp = client.get(f"{BASE_URL}/embassies?status=active")
        assert resp.status_code == 200
        call_kwargs = mock_list.call_args.kwargs
        assert call_kwargs["status_filter"] == "active"

    @patch("backend.routers.embassies.EmbassyService.list_for_simulation", new_callable=AsyncMock)
    def test_default_pagination(self, mock_list, client):
        mock_list.return_value = ([], 0)

        resp = client.get(f"{BASE_URL}/embassies")
        assert resp.status_code == 200
        mock_list.assert_called_once()
        call_kwargs = mock_list.call_args
        assert call_kwargs.kwargs["limit"] == 25
        assert call_kwargs.kwargs["offset"] == 0

    def test_requires_authentication(self):
        """Unauthenticated request should fail."""
        app.dependency_overrides.clear()
        raw_client = TestClient(app)
        resp = raw_client.get(f"{BASE_URL}/embassies")
        assert resp.status_code in (401, 422)


# ── GET /embassies/{embassy_id} ───────────────────────────────────────


class TestGetEmbassy:
    @patch("backend.routers.embassies.EmbassyService.get", new_callable=AsyncMock)
    def test_returns_embassy(self, mock_get, client):
        mock_get.return_value = MOCK_EMBASSY

        resp = client.get(f"{BASE_URL}/embassies/{EMBASSY_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["id"] == str(EMBASSY_ID)
        assert body["data"]["bleed_vector"] == "commerce"

    @patch("backend.routers.embassies.EmbassyService.get", new_callable=AsyncMock)
    def test_not_found(self, mock_get, client):
        mock_get.side_effect = HTTPException(status_code=404, detail="Embassy not found.")

        resp = client.get(f"{BASE_URL}/embassies/{EMBASSY_ID}")
        assert resp.status_code == 404

    def test_requires_authentication(self):
        """Unauthenticated request should fail."""
        app.dependency_overrides.clear()
        raw_client = TestClient(app)
        resp = raw_client.get(f"{BASE_URL}/embassies/{EMBASSY_ID}")
        assert resp.status_code in (401, 422)


# ── GET /buildings/{building_id}/embassy ──────────────────────────────


class TestGetBuildingEmbassy:
    @patch("backend.routers.embassies.EmbassyService.get_for_building", new_callable=AsyncMock)
    def test_returns_embassy_for_building(self, mock_get, client):
        mock_get.return_value = MOCK_EMBASSY

        resp = client.get(f"{BASE_URL}/buildings/{BUILDING_A}/embassy")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["building_a_id"] == str(BUILDING_A)

    @patch("backend.routers.embassies.EmbassyService.get_for_building", new_callable=AsyncMock)
    def test_no_embassy_returns_null(self, mock_get, client):
        mock_get.return_value = None

        resp = client.get(f"{BASE_URL}/buildings/{BUILDING_A}/embassy")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"] is None

    def test_requires_authentication(self):
        """Unauthenticated request should fail."""
        app.dependency_overrides.clear()
        raw_client = TestClient(app)
        resp = raw_client.get(f"{BASE_URL}/buildings/{BUILDING_A}/embassy")
        assert resp.status_code in (401, 422)


# ── POST /embassies ───────────────────────────────────────────────────


class TestCreateEmbassy:
    @patch("backend.routers.embassies.AuditService.log_action", new_callable=AsyncMock)
    @patch("backend.routers.embassies.EmbassyService.create_embassy", new_callable=AsyncMock)
    def test_creates_successfully(self, mock_create, mock_audit, admin_client):
        mock_create.return_value = MOCK_EMBASSY

        resp = admin_client.post(
            f"{BASE_URL}/embassies",
            json={
                "building_a_id": str(BUILDING_A),
                "simulation_a_id": str(SIM_ID),
                "building_b_id": str(BUILDING_B),
                "simulation_b_id": str(SIM_B),
                "connection_type": "embassy",
                "bleed_vector": "commerce",
                "description": "Trade route between worlds",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["id"] == str(EMBASSY_ID)
        mock_create.assert_called_once()
        mock_audit.assert_called_once()

    def test_validation_error_missing_fields(self, admin_client):
        resp = admin_client.post(
            f"{BASE_URL}/embassies",
            json={},
        )
        assert resp.status_code == 422

    def test_validation_error_invalid_bleed_vector(self, admin_client):
        resp = admin_client.post(
            f"{BASE_URL}/embassies",
            json={
                "building_a_id": str(BUILDING_A),
                "simulation_a_id": str(SIM_ID),
                "building_b_id": str(BUILDING_B),
                "simulation_b_id": str(SIM_B),
                "bleed_vector": "invalid_vector",
            },
        )
        assert resp.status_code == 422

    @patch("backend.routers.embassies.EmbassyService.create_embassy", new_callable=AsyncMock)
    def test_viewer_cannot_create(self, mock_create, viewer_client):
        """Viewer role should not be able to create embassies (requires admin)."""
        resp = viewer_client.post(
            f"{BASE_URL}/embassies",
            json={
                "building_a_id": str(BUILDING_A),
                "simulation_a_id": str(SIM_ID),
                "building_b_id": str(BUILDING_B),
                "simulation_b_id": str(SIM_B),
            },
        )
        assert resp.status_code == 403

    @patch("backend.routers.embassies.EmbassyService.create_embassy", new_callable=AsyncMock)
    def test_editor_cannot_create(self, mock_create, client):
        """Editor role should not be able to create embassies (requires admin)."""
        resp = client.post(
            f"{BASE_URL}/embassies",
            json={
                "building_a_id": str(BUILDING_A),
                "simulation_a_id": str(SIM_ID),
                "building_b_id": str(BUILDING_B),
                "simulation_b_id": str(SIM_B),
            },
        )
        assert resp.status_code == 403


# ── PATCH /embassies/{embassy_id} ─────────────────────────────────────


class TestUpdateEmbassy:
    @patch("backend.routers.embassies.AuditService.log_action", new_callable=AsyncMock)
    @patch("backend.routers.embassies.EmbassyService.update_embassy", new_callable=AsyncMock)
    def test_updates_successfully(self, mock_update, mock_audit, admin_client):
        updated = {**MOCK_EMBASSY, "description": "Updated description"}
        mock_update.return_value = updated

        resp = admin_client.patch(
            f"{BASE_URL}/embassies/{EMBASSY_ID}",
            json={"description": "Updated description"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["description"] == "Updated description"
        mock_audit.assert_called_once()

    @patch("backend.routers.embassies.EmbassyService.update_embassy", new_callable=AsyncMock)
    def test_not_found(self, mock_update, admin_client):
        mock_update.side_effect = HTTPException(
            status_code=404, detail="Embassy not found."
        )

        resp = admin_client.patch(
            f"{BASE_URL}/embassies/{EMBASSY_ID}",
            json={"description": "New desc"},
        )
        assert resp.status_code == 404

    @patch("backend.routers.embassies.EmbassyService.update_embassy", new_callable=AsyncMock)
    def test_editor_cannot_update(self, mock_update, client):
        """Editor role should not be able to update embassies (requires admin)."""
        resp = client.patch(
            f"{BASE_URL}/embassies/{EMBASSY_ID}",
            json={"description": "Should fail"},
        )
        assert resp.status_code == 403


# ── PATCH /embassies/{embassy_id}/activate ────────────────────────────


class TestActivateEmbassy:
    @patch("backend.routers.embassies.AuditService.log_action", new_callable=AsyncMock)
    @patch("backend.routers.embassies.EmbassyService.transition_status", new_callable=AsyncMock)
    def test_activates_successfully(self, mock_transition, mock_audit, admin_client):
        activated = {**MOCK_EMBASSY, "status": "active"}
        mock_transition.return_value = activated

        resp = admin_client.patch(f"{BASE_URL}/embassies/{EMBASSY_ID}/activate")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["status"] == "active"
        mock_transition.assert_called_once()
        # Verify the positional args (skip mock client identity comparison)
        call_args = mock_transition.call_args
        assert call_args[0][1] == EMBASSY_ID
        assert call_args[0][2] == "active"
        mock_audit.assert_called_once()

    @patch("backend.routers.embassies.EmbassyService.transition_status", new_callable=AsyncMock)
    def test_editor_cannot_activate(self, mock_transition, client):
        """Editor role should not be able to activate embassies (requires admin)."""
        resp = client.patch(f"{BASE_URL}/embassies/{EMBASSY_ID}/activate")
        assert resp.status_code == 403


# ── PATCH /embassies/{embassy_id}/suspend ─────────────────────────────


class TestSuspendEmbassy:
    @patch("backend.routers.embassies.AuditService.log_action", new_callable=AsyncMock)
    @patch("backend.routers.embassies.EmbassyService.transition_status", new_callable=AsyncMock)
    def test_suspends_successfully(self, mock_transition, mock_audit, admin_client):
        suspended = {**MOCK_EMBASSY, "status": "suspended"}
        mock_transition.return_value = suspended

        resp = admin_client.patch(f"{BASE_URL}/embassies/{EMBASSY_ID}/suspend")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["status"] == "suspended"
        mock_audit.assert_called_once()

    @patch("backend.routers.embassies.EmbassyService.transition_status", new_callable=AsyncMock)
    def test_viewer_cannot_suspend(self, mock_transition, viewer_client):
        """Viewer role should not be able to suspend embassies (requires admin)."""
        resp = viewer_client.patch(f"{BASE_URL}/embassies/{EMBASSY_ID}/suspend")
        assert resp.status_code == 403


# ── PATCH /embassies/{embassy_id}/dissolve ────────────────────────────


class TestDissolveEmbassy:
    @patch("backend.routers.embassies.AuditService.log_action", new_callable=AsyncMock)
    @patch("backend.routers.embassies.EmbassyService.transition_status", new_callable=AsyncMock)
    def test_dissolves_successfully(self, mock_transition, mock_audit, admin_client):
        dissolved = {**MOCK_EMBASSY, "status": "dissolved"}
        mock_transition.return_value = dissolved

        resp = admin_client.patch(f"{BASE_URL}/embassies/{EMBASSY_ID}/dissolve")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["status"] == "dissolved"
        mock_audit.assert_called_once()

    @patch("backend.routers.embassies.EmbassyService.transition_status", new_callable=AsyncMock)
    def test_editor_cannot_dissolve(self, mock_transition, client):
        """Editor role should not be able to dissolve embassies (requires admin)."""
        resp = client.patch(f"{BASE_URL}/embassies/{EMBASSY_ID}/dissolve")
        assert resp.status_code == 403

    @patch("backend.routers.embassies.EmbassyService.transition_status", new_callable=AsyncMock)
    def test_invalid_transition_returns_400(self, mock_transition, admin_client):
        mock_transition.side_effect = HTTPException(
            status_code=400,
            detail="Cannot transition from 'dissolved' to 'dissolved'.",
        )

        resp = admin_client.patch(f"{BASE_URL}/embassies/{EMBASSY_ID}/dissolve")
        assert resp.status_code == 400
