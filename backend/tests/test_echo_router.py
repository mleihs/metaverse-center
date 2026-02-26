"""Tests for echo API endpoints (routers/echoes.py)."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import get_admin_supabase, get_current_user, get_supabase
from backend.models.common import CurrentUser
from backend.tests.conftest import MOCK_USER_EMAIL, MOCK_USER_ID

SIM_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
SIM_B = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2")
EVENT_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
ECHO_ID = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")

BASE_URL = f"/api/v1/simulations/{SIM_ID}"

MOCK_ECHO = {
    "id": str(ECHO_ID),
    "source_event_id": str(EVENT_ID),
    "source_simulation_id": str(SIM_ID),
    "target_simulation_id": str(SIM_B),
    "target_event_id": None,
    "echo_vector": "resonance",
    "echo_strength": 0.8,
    "echo_depth": 1,
    "root_event_id": None,
    "status": "pending",
    "bleed_metadata": {"source_title": "Big Event", "source_impact": 9},
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
    "source_event": None,
    "target_event": None,
}


def _mock_supabase_with_role(role: str = "admin") -> MagicMock:
    """Create a mock Supabase that passes role checks.

    require_role queries simulation_members — the mock must return a member row.
    Subsequent table() calls (e.g. events lookup) also use this mock.
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
        b.execute.return_value = r
        return b

    mock.table.side_effect = make_builder
    return mock


@pytest.fixture()
def client():
    """TestClient with auth, role-passing supabase, and admin supabase overrides."""
    user = CurrentUser(id=MOCK_USER_ID, email=MOCK_USER_EMAIL, access_token="mock-token")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: _mock_supabase_with_role("admin")
    app.dependency_overrides[get_admin_supabase] = lambda: MagicMock()

    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def viewer_client():
    """TestClient with viewer role."""
    user = CurrentUser(id=MOCK_USER_ID, email=MOCK_USER_EMAIL, access_token="mock-token")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: _mock_supabase_with_role("viewer")
    app.dependency_overrides[get_admin_supabase] = lambda: MagicMock()

    yield TestClient(app)
    app.dependency_overrides.clear()


# ── GET /echoes ────────────────────────────────────────────────────────


class TestListEchoes:
    @patch("backend.routers.echoes.EchoService.list_for_simulation", new_callable=AsyncMock)
    def test_returns_paginated_echoes(self, mock_list, client):
        mock_list.return_value = ([MOCK_ECHO], 1)

        resp = client.get(f"{BASE_URL}/echoes?direction=incoming&limit=25&offset=0")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["meta"]["total"] == 1
        assert body["data"][0]["echo_vector"] == "resonance"

    @patch("backend.routers.echoes.EchoService.list_for_simulation", new_callable=AsyncMock)
    def test_direction_outgoing(self, mock_list, client):
        mock_list.return_value = ([], 0)

        resp = client.get(f"{BASE_URL}/echoes?direction=outgoing")
        assert resp.status_code == 200
        mock_list.assert_called_once()
        call_kwargs = mock_list.call_args.kwargs
        assert call_kwargs["direction"] == "outgoing"

    def test_invalid_direction_rejected(self, client):
        resp = client.get(f"{BASE_URL}/echoes?direction=sideways")
        assert resp.status_code == 422

    @patch("backend.routers.echoes.EchoService.list_for_simulation", new_callable=AsyncMock)
    def test_status_filter(self, mock_list, client):
        mock_list.return_value = ([], 0)

        resp = client.get(f"{BASE_URL}/echoes?status=pending")
        assert resp.status_code == 200
        call_kwargs = mock_list.call_args.kwargs
        assert call_kwargs["status_filter"] == "pending"

    def test_requires_authentication(self):
        app.dependency_overrides.clear()
        raw_client = TestClient(app)
        resp = raw_client.get(f"{BASE_URL}/echoes")
        assert resp.status_code in (401, 422)


# ── GET /events/{event_id}/echoes ──────────────────────────────────────


class TestListEventEchoes:
    @patch("backend.routers.echoes.EchoService.list_for_event", new_callable=AsyncMock)
    def test_returns_echoes_for_event(self, mock_list, client):
        mock_list.return_value = [MOCK_ECHO]

        resp = client.get(f"{BASE_URL}/events/{EVENT_ID}/echoes")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1

    @patch("backend.routers.echoes.EchoService.list_for_event", new_callable=AsyncMock)
    def test_empty_list(self, mock_list, client):
        mock_list.return_value = []

        resp = client.get(f"{BASE_URL}/events/{EVENT_ID}/echoes")
        assert resp.status_code == 200
        assert resp.json()["data"] == []


# ── POST /echoes ───────────────────────────────────────────────────────


class TestTriggerEcho:
    @patch("backend.routers.echoes.AuditService.log_action", new_callable=AsyncMock)
    @patch("backend.routers.echoes.EchoService.create_echo", new_callable=AsyncMock)
    def test_triggers_echo_successfully(self, mock_create, mock_audit, client):
        # Override supabase to return role + event data
        mock_supabase = MagicMock()
        call_count = [0]

        def make_builder(table_name):
            b = MagicMock()
            b.select.return_value = b
            b.eq.return_value = b
            b.limit.return_value = b
            b.single.return_value = b

            r = MagicMock()
            call_count[0] += 1
            if table_name == "simulation_members":
                r.data = [{"member_role": "admin"}]
            elif table_name == "events":
                r.data = {
                    "id": str(EVENT_ID),
                    "title": "Big Event",
                    "impact_level": 9,
                    "simulation_id": str(SIM_ID),
                }
            else:
                r.data = None
            b.execute.return_value = r
            return b

        mock_supabase.table.side_effect = make_builder
        app.dependency_overrides[get_supabase] = lambda: mock_supabase

        mock_create.return_value = MOCK_ECHO

        resp = client.post(
            f"{BASE_URL}/echoes",
            json={
                "source_event_id": str(EVENT_ID),
                "target_simulation_id": str(SIM_B),
                "echo_vector": "resonance",
                "echo_strength": 0.8,
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        mock_create.assert_called_once()
        mock_audit.assert_called_once()

    @patch("backend.routers.echoes.EchoService.create_echo", new_callable=AsyncMock)
    def test_404_when_event_not_found(self, mock_create, client):
        # supabase already returns None for non-member tables
        resp = client.post(
            f"{BASE_URL}/echoes",
            json={
                "source_event_id": str(EVENT_ID),
                "target_simulation_id": str(SIM_B),
                "echo_vector": "resonance",
                "echo_strength": 0.8,
            },
        )
        assert resp.status_code == 404

    def test_validation_error_invalid_vector(self, client):
        resp = client.post(
            f"{BASE_URL}/echoes",
            json={
                "source_event_id": str(EVENT_ID),
                "target_simulation_id": str(SIM_B),
                "echo_vector": "invalid_vector",
                "echo_strength": 0.8,
            },
        )
        assert resp.status_code == 422

    def test_validation_error_strength_out_of_range(self, client):
        resp = client.post(
            f"{BASE_URL}/echoes",
            json={
                "source_event_id": str(EVENT_ID),
                "target_simulation_id": str(SIM_B),
                "echo_vector": "resonance",
                "echo_strength": 1.5,  # max is 1
            },
        )
        assert resp.status_code == 422

    @patch("backend.routers.echoes.EchoService.create_echo", new_callable=AsyncMock)
    def test_viewer_cannot_trigger_echo(self, mock_create, viewer_client):
        """Viewer role should not be able to trigger echoes (requires admin)."""
        resp = viewer_client.post(
            f"{BASE_URL}/echoes",
            json={
                "source_event_id": str(EVENT_ID),
                "target_simulation_id": str(SIM_B),
                "echo_vector": "resonance",
                "echo_strength": 0.5,
            },
        )
        assert resp.status_code == 403


# ── PATCH /echoes/{echo_id}/approve ────────────────────────────────────


class TestApproveEcho:
    @patch("backend.routers.echoes.AuditService.log_action", new_callable=AsyncMock)
    @patch("backend.routers.echoes.EchoService.approve_echo", new_callable=AsyncMock)
    def test_approves_successfully(self, mock_approve, mock_audit, client):
        approved = {**MOCK_ECHO, "status": "generating"}
        mock_approve.return_value = approved

        resp = client.patch(f"{BASE_URL}/echoes/{ECHO_ID}/approve")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["status"] == "generating"
        mock_audit.assert_called_once()

    @patch("backend.routers.echoes.EchoService.approve_echo", new_callable=AsyncMock)
    def test_approve_non_pending_returns_400(self, mock_approve, client):
        mock_approve.side_effect = HTTPException(
            status_code=400,
            detail="Cannot approve echo with status 'completed'.",
        )

        resp = client.patch(f"{BASE_URL}/echoes/{ECHO_ID}/approve")
        assert resp.status_code == 400


# ── PATCH /echoes/{echo_id}/reject ─────────────────────────────────────


class TestRejectEcho:
    @patch("backend.routers.echoes.AuditService.log_action", new_callable=AsyncMock)
    @patch("backend.routers.echoes.EchoService.reject_echo", new_callable=AsyncMock)
    def test_rejects_successfully(self, mock_reject, mock_audit, client):
        rejected = {**MOCK_ECHO, "status": "rejected"}
        mock_reject.return_value = rejected

        resp = client.patch(f"{BASE_URL}/echoes/{ECHO_ID}/reject")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["status"] == "rejected"
        mock_audit.assert_called_once()

    @patch("backend.routers.echoes.EchoService.reject_echo", new_callable=AsyncMock)
    def test_reject_non_pending_returns_400(self, mock_reject, client):
        mock_reject.side_effect = HTTPException(
            status_code=400,
            detail="Cannot reject echo with status 'generating'.",
        )

        resp = client.patch(f"{BASE_URL}/echoes/{ECHO_ID}/reject")
        assert resp.status_code == 400
