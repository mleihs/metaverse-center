"""Tests for the dungeon content admin router.

Covers CRUD operations, pagination, composite PK handling, cache reload,
and auth gating (all endpoints require platform admin).

Markers:
    integration: Requires app instantiation but not external services.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import PLATFORM_ADMIN_EMAILS, get_admin_supabase, get_current_user
from backend.models.common import CurrentUser

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ADMIN_EMAIL = "dungeon-admin@velgarien.dev"
NON_ADMIN_EMAIL = "nobody@velgarien.dev"
ADMIN_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_user(uid: UUID, email: str) -> CurrentUser:
    return CurrentUser(id=uid, email=email, access_token="mock")  # noqa: S106


def _mock_supabase():
    mock = MagicMock()
    chain = MagicMock()
    result = MagicMock()
    result.data = []
    result.count = 0
    chain.execute = AsyncMock(return_value=result)
    for m in (
        "select", "eq", "insert", "update", "delete", "upsert",
        "limit", "single", "maybe_single", "order", "range",
        "filter", "in_", "is_", "not_", "or_", "ilike",
    ):
        getattr(chain, m).return_value = chain
    mock.table.return_value = chain
    mock.rpc.return_value = chain
    return mock


def _setup_admin():
    PLATFORM_ADMIN_EMAILS.add(ADMIN_EMAIL)
    user = _make_user(ADMIN_ID, ADMIN_EMAIL)
    mock_sb = _mock_supabase()
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_admin_supabase] = lambda: mock_sb
    return user, mock_sb


def _setup_non_admin():
    user = _make_user(ADMIN_ID, NON_ADMIN_EMAIL)
    mock_sb = _mock_supabase()
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_admin_supabase] = lambda: mock_sb
    return user, mock_sb


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()
    PLATFORM_ADMIN_EMAILS.discard(ADMIN_EMAIL)


# ===========================================================================
# Auth Gate
# ===========================================================================


@pytest.mark.integration
class TestDungeonContentAuthGate:
    """All dungeon content admin endpoints require platform admin."""

    ENDPOINTS = [
        ("GET", "/api/v1/admin/dungeon-content/enemies"),
        ("GET", "/api/v1/admin/dungeon-content/enemies/some-id"),
        ("PUT", "/api/v1/admin/dungeon-content/enemies/some-id"),
        ("POST", "/api/v1/admin/dungeon-content/enemies"),
        ("DELETE", "/api/v1/admin/dungeon-content/enemies/some-id"),
        ("POST", "/api/v1/admin/dungeon-content/reload-cache"),
    ]

    @pytest.mark.parametrize("method,path", ENDPOINTS)
    def test_non_admin_rejected(self, client: TestClient, method: str, path: str):
        _setup_non_admin()
        r = client.request(method, path, json={"data": {}})
        assert r.status_code == 403, (
            f"Non-admin {method} {path} returned {r.status_code}"
        )


# ===========================================================================
# List Content
# ===========================================================================


@pytest.mark.integration
class TestListContent:
    """GET /{content_type} — list with pagination, archetype filter, search."""

    @patch(
        "backend.routers.dungeon_content_admin._service.list_content",
        new_callable=AsyncMock,
    )
    def test_list_enemies(self, mock_list, client: TestClient):
        _setup_admin()
        mock_list.return_value = (
            [{"id": "e1", "name_en": "Shade"}],
            1,
        )
        r = client.get("/api/v1/admin/dungeon-content/enemies")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["meta"]["total"] == 1
        mock_list.assert_called_once()

    @patch(
        "backend.routers.dungeon_content_admin._service.list_content",
        new_callable=AsyncMock,
    )
    def test_list_with_archetype_filter(self, mock_list, client: TestClient):
        _setup_admin()
        mock_list.return_value = ([], 0)
        r = client.get(
            "/api/v1/admin/dungeon-content/banter?archetype=shadow",
        )
        assert r.status_code == 200
        call_kwargs = mock_list.call_args
        assert call_kwargs[1]["archetype"] == "shadow" or call_kwargs[0][2] == "shadow"

    @patch(
        "backend.routers.dungeon_content_admin._service.list_content",
        new_callable=AsyncMock,
    )
    def test_list_with_search(self, mock_list, client: TestClient):
        _setup_admin()
        mock_list.return_value = ([], 0)
        r = client.get(
            "/api/v1/admin/dungeon-content/encounters?search=fire",
        )
        assert r.status_code == 200
        mock_list.assert_called_once()

    @patch(
        "backend.routers.dungeon_content_admin._service.list_content",
        new_callable=AsyncMock,
    )
    def test_list_pagination(self, mock_list, client: TestClient):
        _setup_admin()
        mock_list.return_value = ([{"id": "x"}], 50)
        r = client.get(
            "/api/v1/admin/dungeon-content/loot?page=3&per_page=10",
        )
        assert r.status_code == 200
        body = r.json()
        assert body["meta"]["offset"] == 20
        assert body["meta"]["limit"] == 10

    def test_invalid_content_type_rejected(self, client: TestClient):
        """Invalid content_type should be rejected by FastAPI's Literal validation."""
        _setup_admin()
        r = client.get("/api/v1/admin/dungeon-content/invalid_type")
        assert r.status_code == 422


# ===========================================================================
# Get Single Item
# ===========================================================================


@pytest.mark.integration
class TestGetContentItem:
    @patch(
        "backend.routers.dungeon_content_admin._service.get_item",
        new_callable=AsyncMock,
    )
    def test_get_simple_pk(self, mock_get, client: TestClient):
        _setup_admin()
        mock_get.return_value = {"id": "enemy-1", "name_en": "Wraith"}
        r = client.get("/api/v1/admin/dungeon-content/enemies/enemy-1")
        assert r.status_code == 200
        assert r.json()["data"]["id"] == "enemy-1"

    @patch(
        "backend.routers.dungeon_content_admin._service.get_item",
        new_callable=AsyncMock,
    )
    def test_get_composite_pk(self, mock_get, client: TestClient):
        """Composite PK like encounter_id::choice_id for choices."""
        _setup_admin()
        mock_get.return_value = {"encounter_id": "enc1", "id": "c1"}
        r = client.get("/api/v1/admin/dungeon-content/choices/enc1::c1")
        assert r.status_code == 200
        mock_get.assert_called_once()


# ===========================================================================
# Update Item
# ===========================================================================


@pytest.mark.integration
class TestUpdateContentItem:
    @patch(
        "backend.routers.dungeon_content_admin.load_all_content",
        new_callable=AsyncMock,
    )
    @patch(
        "backend.routers.dungeon_content_admin._service.update_item",
        new_callable=AsyncMock,
    )
    def test_update_item(self, mock_update, mock_reload, client: TestClient):
        _setup_admin()
        mock_update.return_value = {"id": "e1", "name_en": "Updated"}
        r = client.put(
            "/api/v1/admin/dungeon-content/enemies/e1",
            json={"data": {"name_en": "Updated"}},
        )
        assert r.status_code == 200
        assert r.json()["data"]["name_en"] == "Updated"
        mock_update.assert_called_once()
        mock_reload.assert_called_once()  # Cache reloaded


# ===========================================================================
# Create Item
# ===========================================================================


@pytest.mark.integration
class TestCreateContentItem:
    @patch(
        "backend.routers.dungeon_content_admin.load_all_content",
        new_callable=AsyncMock,
    )
    @patch(
        "backend.routers.dungeon_content_admin._service.create_item",
        new_callable=AsyncMock,
    )
    def test_create_item(self, mock_create, mock_reload, client: TestClient):
        _setup_admin()
        mock_create.return_value = {"id": "new-1", "name_en": "New Enemy"}
        r = client.post(
            "/api/v1/admin/dungeon-content/enemies",
            json={"data": {"id": "new-1", "name_en": "New Enemy", "archetype": "shadow"}},
        )
        assert r.status_code == 200
        assert r.json()["data"]["id"] == "new-1"
        mock_create.assert_called_once()
        mock_reload.assert_called_once()


# ===========================================================================
# Delete Item
# ===========================================================================


@pytest.mark.integration
class TestDeleteContentItem:
    @patch(
        "backend.routers.dungeon_content_admin.load_all_content",
        new_callable=AsyncMock,
    )
    @patch(
        "backend.routers.dungeon_content_admin._service.delete_item",
        new_callable=AsyncMock,
    )
    def test_delete_item(self, mock_delete, mock_reload, client: TestClient):
        _setup_admin()
        mock_delete.return_value = {"id": "e1", "deleted": True}
        r = client.delete("/api/v1/admin/dungeon-content/enemies/e1")
        assert r.status_code == 200
        mock_delete.assert_called_once()
        mock_reload.assert_called_once()


# ===========================================================================
# Reload Cache
# ===========================================================================


@pytest.mark.integration
class TestReloadCache:
    @patch(
        "backend.routers.dungeon_content_admin.load_all_content",
        new_callable=AsyncMock,
    )
    def test_reload_cache(self, mock_reload, client: TestClient):
        _setup_admin()
        r = client.post("/api/v1/admin/dungeon-content/reload-cache")
        assert r.status_code == 200
        body = r.json()
        assert body["data"]["message"] == "Cache reloaded."
        mock_reload.assert_called_once()


# ===========================================================================
# Content Types Coverage
# ===========================================================================


@pytest.mark.integration
class TestAllContentTypes:
    """Verify all 10 content types are accessible."""

    CONTENT_TYPES = [
        "banter", "enemies", "spawns", "encounters", "choices",
        "loot", "anchors", "entrance_texts", "barometer_texts", "abilities",
    ]

    @patch(
        "backend.routers.dungeon_content_admin._service.list_content",
        new_callable=AsyncMock,
    )
    @pytest.mark.parametrize("content_type", CONTENT_TYPES)
    def test_all_types_accessible(
        self, mock_list, client: TestClient, content_type: str,
    ):
        _setup_admin()
        mock_list.return_value = ([], 0)
        r = client.get(f"/api/v1/admin/dungeon-content/{content_type}")
        assert r.status_code == 200, (
            f"Content type '{content_type}' returned {r.status_code}"
        )
