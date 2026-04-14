"""Integration tests for the Epoch lifecycle router (routers/epochs.py).

Covers auth gates, CRUD, lifecycle (creator-only), and battle-log pagination.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import get_admin_supabase, get_current_user, get_effective_supabase, get_supabase
from backend.models.common import CurrentUser
from backend.tests.conftest import make_async_supabase_mock

USER_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_EMAIL = "epoch-test@velgarien.dev"
OTHER_USER_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
EPOCH_ID = uuid4()
NOW = datetime.now(tz=UTC).isoformat()


def _make_user(uid: UUID = USER_ID, email: str = USER_EMAIL) -> CurrentUser:
    return CurrentUser(id=uid, email=email, access_token="mock-token")


def _mock_supabase():
    """Convenience wrapper around conftest helper."""
    return make_async_supabase_mock()


def _mock_supabase_for_creator(user_id: UUID):
    """Build a supabase mock whose table().select().eq().single().execute()
    returns a row with ``created_by_id`` matching *user_id*.

    This satisfies the ``require_epoch_creator`` dependency which queries
    ``game_epochs`` via the user-scoped ``get_supabase`` client.
    """
    mock = _mock_supabase()
    result = MagicMock()
    result.data = {"created_by_id": str(user_id)}
    mock.table.return_value.execute = AsyncMock(return_value=result)
    return mock


def _mock_supabase_for_non_creator():
    """Return a supabase mock that reports a *different* creator, causing a 403."""
    return _mock_supabase_for_creator(OTHER_USER_ID)


def _setup_auth_user(*, creator: bool = False):
    """Override FastAPI dependencies with a mock authenticated user.

    When *creator* is True, the supabase mock used by ``get_supabase`` (and thus
    ``require_epoch_creator``) reports the current user as the epoch creator.
    """
    user = _make_user(USER_ID, USER_EMAIL)
    mock_sb = _mock_supabase_for_creator(USER_ID) if creator else _mock_supabase()
    mock_admin_sb = _mock_supabase()

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_effective_supabase] = lambda: mock_sb
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[get_admin_supabase] = lambda: mock_admin_sb

    return user, mock_sb, mock_admin_sb


def _setup_non_creator():
    """Override dependencies so the user is authenticated but NOT the epoch creator."""
    user = _make_user(USER_ID, USER_EMAIL)
    mock_sb = _mock_supabase_for_non_creator()
    mock_admin_sb = _mock_supabase()

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_effective_supabase] = lambda: mock_sb
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[get_admin_supabase] = lambda: mock_admin_sb

    return user, mock_sb, mock_admin_sb


def _epoch_row(epoch_id: UUID = EPOCH_ID, **overrides) -> dict:
    """Return a plausible epoch dict as services would produce."""
    base = {
        "id": str(epoch_id),
        "name": "Test Epoch",
        "description": "A test epoch",
        "created_by_id": str(USER_ID),
        "starts_at": None,
        "ends_at": None,
        "current_cycle": 0,
        "status": "lobby",
        "config": {},
        "epoch_type": "competitive",
        "created_at": NOW,
        "updated_at": NOW,
        "participant_count": 0,
        "team_count": 0,
    }
    base.update(overrides)
    return base


def _battle_log_entry(epoch_id: UUID = EPOCH_ID, **overrides) -> dict:
    """Return a plausible battle-log entry dict."""
    base = {
        "id": str(uuid4()),
        "epoch_id": str(epoch_id),
        "cycle_number": 1,
        "event_type": "mission_result",
        "source_simulation_id": None,
        "target_simulation_id": None,
        "mission_id": None,
        "narrative": "A battle took place.",
        "is_public": True,
        "metadata": {},
        "created_at": NOW,
    }
    base.update(overrides)
    return base


# ═══════════════════════════════════════════════════════════════════════
# Auth Gate
# ═══════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestEpochAuthGate:
    """Verify that unauthenticated requests are rejected."""

    def test_list_epochs_no_auth_rejected(self):
        app.dependency_overrides.clear()
        client = TestClient(app)
        resp = client.get("/api/v1/epochs")
        assert resp.status_code in (401, 403, 422)

    def test_create_epoch_no_auth_rejected(self):
        app.dependency_overrides.clear()
        client = TestClient(app)
        resp = client.post(
            "/api/v1/epochs",
            json={"name": "Unauthorized Epoch"},
        )
        assert resp.status_code in (401, 403, 422)

    @patch("backend.routers.epochs.EpochService.list_epochs", new_callable=AsyncMock)
    def test_authenticated_user_can_list_epochs(self, mock_list):
        mock_list.return_value = ([], 0)
        _setup_auth_user()
        try:
            client = TestClient(app)
            resp = client.get("/api/v1/epochs")
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is True
        finally:
            app.dependency_overrides.clear()


# ═══════════════════════════════════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestEpochCRUD:
    """Test basic CRUD endpoints (no creator check required except create)."""

    @pytest.fixture(autouse=True)
    def _auth(self):
        _setup_auth_user()
        yield
        app.dependency_overrides.clear()

    @patch("backend.routers.epochs.EpochService.create", new_callable=AsyncMock)
    def test_create_epoch(self, mock_create):
        epoch = _epoch_row()
        mock_create.return_value = epoch

        client = TestClient(app)
        resp = client.post(
            "/api/v1/epochs",
            json={"name": "My Epoch", "description": "Testing"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["name"] == "Test Epoch"
        mock_create.assert_called_once()

    @patch("backend.routers.epochs.EpochService.list_epochs", new_callable=AsyncMock)
    def test_list_epochs_with_pagination(self, mock_list):
        epochs = [_epoch_row(), _epoch_row(epoch_id=uuid4(), name="Second Epoch")]
        mock_list.return_value = (epochs, 2)

        client = TestClient(app)
        resp = client.get("/api/v1/epochs?limit=10&offset=0")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["meta"]["total"] == 2
        assert body["meta"]["count"] == 2
        assert body["meta"]["limit"] == 10
        assert body["meta"]["offset"] == 0
        assert len(body["data"]) == 2

    @patch("backend.routers.epochs.EpochService.get_active_epochs", new_callable=AsyncMock)
    def test_get_active_epochs(self, mock_active):
        active = [_epoch_row(status="foundation")]
        mock_active.return_value = active

        client = TestClient(app)
        resp = client.get("/api/v1/epochs/active")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["data"][0]["status"] == "foundation"

    @patch("backend.routers.epochs.EpochService.get", new_callable=AsyncMock)
    def test_get_epoch_by_id(self, mock_get):
        epoch = _epoch_row()
        mock_get.return_value = epoch

        client = TestClient(app)
        resp = client.get(f"/api/v1/epochs/{EPOCH_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["id"] == str(EPOCH_ID)

    @patch("backend.routers.epochs.EpochService.list_epochs", new_callable=AsyncMock)
    def test_list_epochs_with_status_filter(self, mock_list):
        mock_list.return_value = ([], 0)

        client = TestClient(app)
        resp = client.get("/api/v1/epochs?status=lobby")
        assert resp.status_code == 200
        mock_list.assert_called_once()
        call_kwargs = mock_list.call_args
        assert call_kwargs.kwargs.get("status_filter") == "lobby" or call_kwargs[1].get("status_filter") == "lobby"


# ═══════════════════════════════════════════════════════════════════════
# Lifecycle (creator-only endpoints)
# ═══════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestEpochLifecycle:
    """Test lifecycle endpoints that require the epoch creator."""

    @pytest.fixture(autouse=True)
    def _auth(self):
        _setup_auth_user(creator=True)
        yield
        app.dependency_overrides.clear()

    @patch("backend.routers.epochs.EpochService.start_epoch", new_callable=AsyncMock)
    def test_start_epoch(self, mock_start):
        started = _epoch_row(status="foundation")
        mock_start.return_value = started

        client = TestClient(app)
        resp = client.post(f"/api/v1/epochs/{EPOCH_ID}/start")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["status"] == "foundation"
        mock_start.assert_called_once()

    @patch("backend.routers.epochs.EpochService.advance_phase", new_callable=AsyncMock)
    def test_advance_phase(self, mock_advance):
        advanced = _epoch_row(status="competition", current_cycle=5)
        mock_advance.return_value = advanced

        client = TestClient(app)
        resp = client.post(f"/api/v1/epochs/{EPOCH_ID}/advance")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["status"] == "competition"
        mock_advance.assert_called_once()

    @patch("backend.routers.epochs.EpochService.cancel_epoch", new_callable=AsyncMock)
    @patch("backend.routers.epochs.EpochService.get", new_callable=AsyncMock)
    def test_cancel_epoch(self, mock_get, mock_cancel):
        mock_get.return_value = _epoch_row(status="foundation")
        cancelled = _epoch_row(status="cancelled")
        mock_cancel.return_value = cancelled

        client = TestClient(app)
        resp = client.post(f"/api/v1/epochs/{EPOCH_ID}/cancel")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["status"] == "cancelled"
        mock_cancel.assert_called_once()

    @patch("backend.routers.epochs.EpochService.delete_epoch", new_callable=AsyncMock)
    def test_delete_epoch(self, mock_delete):
        deleted = _epoch_row(status="lobby")
        mock_delete.return_value = deleted

        client = TestClient(app)
        resp = client.delete(f"/api/v1/epochs/{EPOCH_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["id"] == str(EPOCH_ID)
        mock_delete.assert_called_once()

    @patch("backend.routers.epochs.EpochService.resolve_cycle_full", new_callable=AsyncMock)
    def test_resolve_cycle(self, mock_resolve):
        resolved = _epoch_row(status="competition", current_cycle=2)
        mock_resolve.return_value = resolved

        client = TestClient(app)
        resp = client.post(f"/api/v1/epochs/{EPOCH_ID}/resolve-cycle")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["current_cycle"] == 2
        mock_resolve.assert_called_once()


@pytest.mark.integration
class TestEpochLifecycleNonCreator:
    """Verify that lifecycle endpoints reject non-creators with 403."""

    @pytest.fixture(autouse=True)
    def _auth(self):
        _setup_non_creator()
        yield
        app.dependency_overrides.clear()

    def test_start_epoch_non_creator_403(self):
        client = TestClient(app)
        resp = client.post(f"/api/v1/epochs/{EPOCH_ID}/start")
        assert resp.status_code == 403

    def test_advance_phase_non_creator_403(self):
        client = TestClient(app)
        resp = client.post(f"/api/v1/epochs/{EPOCH_ID}/advance")
        assert resp.status_code == 403

    def test_cancel_epoch_non_creator_403(self):
        client = TestClient(app)
        resp = client.post(f"/api/v1/epochs/{EPOCH_ID}/cancel")
        assert resp.status_code == 403

    def test_delete_epoch_non_creator_403(self):
        client = TestClient(app)
        resp = client.delete(f"/api/v1/epochs/{EPOCH_ID}")
        assert resp.status_code == 403

    def test_resolve_cycle_non_creator_403(self):
        client = TestClient(app)
        resp = client.post(f"/api/v1/epochs/{EPOCH_ID}/resolve-cycle")
        assert resp.status_code == 403


# ═══════════════════════════════════════════════════════════════════════
# Battle Log
# ═══════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestEpochBattleLog:
    """Test the paginated battle-log endpoint."""

    @pytest.fixture(autouse=True)
    def _auth(self):
        _setup_auth_user()
        yield
        app.dependency_overrides.clear()

    @patch("backend.routers.epochs.BattleLogService.list_entries", new_callable=AsyncMock)
    def test_battle_log_returns_paginated(self, mock_list):
        entries = [_battle_log_entry(), _battle_log_entry()]
        mock_list.return_value = (entries, 2)

        client = TestClient(app)
        resp = client.get(f"/api/v1/epochs/{EPOCH_ID}/battle-log?limit=50&offset=0")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["meta"]["total"] == 2
        assert body["meta"]["count"] == 2
        assert body["meta"]["limit"] == 50
        assert body["meta"]["offset"] == 0
        assert len(body["data"]) == 2

    @patch("backend.routers.epochs.BattleLogService.list_entries", new_callable=AsyncMock)
    def test_battle_log_empty(self, mock_list):
        mock_list.return_value = ([], 0)

        client = TestClient(app)
        resp = client.get(f"/api/v1/epochs/{EPOCH_ID}/battle-log")
        assert resp.status_code == 200
        body = resp.json()
        assert body["meta"]["total"] == 0
        assert body["data"] == []

    @patch("backend.routers.epochs.BattleLogService.list_entries", new_callable=AsyncMock)
    def test_battle_log_event_type_filter(self, mock_list):
        mock_list.return_value = ([], 0)

        client = TestClient(app)
        resp = client.get(f"/api/v1/epochs/{EPOCH_ID}/battle-log?event_type=mission_result")
        assert resp.status_code == 200
        mock_list.assert_called_once()
        call_kwargs = mock_list.call_args
        assert call_kwargs.kwargs.get("event_type") == "mission_result" or call_kwargs[1].get("event_type") == "mission_result"

    @patch("backend.routers.epochs.BattleLogService.list_entries_for_player", new_callable=AsyncMock)
    def test_battle_log_allied_intel_tagging(self, mock_list):
        """When simulation_id is passed, fog-of-war RPC tags allied intel in metadata."""
        sim_id = uuid4()
        other_sim = uuid4()
        entry = _battle_log_entry(
            source_simulation_id=str(other_sim),
            target_simulation_id=None,
            is_public=False,
            metadata={"allied_intel": True},  # RPC tags this
        )
        mock_list.return_value = ([entry], 1)

        client = TestClient(app)
        resp = client.get(f"/api/v1/epochs/{EPOCH_ID}/battle-log?simulation_id={sim_id}")
        assert resp.status_code == 200
        body = resp.json()
        tagged_entry = body["data"][0]
        assert tagged_entry["metadata"]["allied_intel"] is True

    @patch("backend.routers.epochs.BattleLogService.list_entries_for_player", new_callable=AsyncMock)
    def test_battle_log_own_entries_not_tagged(self, mock_list):
        """Own entries (source matches simulation_id) should NOT be tagged as allied_intel."""
        sim_id = uuid4()
        entry = _battle_log_entry(
            source_simulation_id=str(sim_id),
            target_simulation_id=None,
            is_public=False,
            metadata={},
        )
        mock_list.return_value = ([entry], 1)

        client = TestClient(app)
        resp = client.get(f"/api/v1/epochs/{EPOCH_ID}/battle-log?simulation_id={sim_id}")
        assert resp.status_code == 200
        body = resp.json()
        tagged_entry = body["data"][0]
        assert tagged_entry["metadata"].get("allied_intel") is not True

    @patch("backend.routers.epochs.BattleLogService.list_entries_for_player", new_callable=AsyncMock)
    def test_battle_log_fog_of_war_delegates_to_rpc(self, mock_list):
        """With simulation_id, endpoint delegates to list_entries_for_player (RPC-based fog-of-war)."""
        sim_id = uuid4()
        mock_list.return_value = ([], 0)

        client = TestClient(app)
        resp = client.get(f"/api/v1/epochs/{EPOCH_ID}/battle-log?simulation_id={sim_id}")
        assert resp.status_code == 200
        mock_list.assert_called_once()
        call_args = mock_list.call_args
        assert str(call_args[0][1]) == str(EPOCH_ID)  # epoch_id
        assert str(call_args[0][2]) == str(sim_id)  # viewer_simulation_id

    @patch("backend.routers.epochs.BattleLogService.list_entries", new_callable=AsyncMock)
    def test_battle_log_spectator_mode_public_only(self, mock_list):
        """Without simulation_id, endpoint returns public events only (spectator mode)."""
        mock_list.return_value = ([], 0)

        client = TestClient(app)
        resp = client.get(f"/api/v1/epochs/{EPOCH_ID}/battle-log")
        assert resp.status_code == 200
        mock_list.assert_called_once()
        call_kwargs = mock_list.call_args
        assert call_kwargs.kwargs.get("public_only") is True
