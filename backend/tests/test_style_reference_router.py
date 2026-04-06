"""Tests for style reference router endpoints (routers/style_references.py).

Covers:
1. POST /upload — validation, success, role checks
2. GET /{entity_type} — list references, validation
3. DELETE /{entity_type} — delete, role checks
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import get_current_user, get_effective_supabase, get_supabase
from backend.models.common import CurrentUser
from backend.tests.conftest import MOCK_USER_EMAIL, MOCK_USER_ID

SIM_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
ENTITY_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

BASE_URL = f"/api/v1/simulations/{SIM_ID}/style-references"


def _mock_supabase_with_role(role: str = "editor") -> MagicMock:
    """Create a mock Supabase that passes role checks via simulation_members."""
    mock = MagicMock()

    def make_builder(table_name):
        b = MagicMock()
        for m in (
            "select", "eq", "in_", "limit", "single", "not_", "is_",
            "order", "range", "insert", "update", "delete", "upsert",
        ):
            getattr(b, m).return_value = b
        r = MagicMock()
        if table_name == "simulation_members":
            r.data = [{"member_role": role}]
        else:
            r.data = None
        b.execute = AsyncMock(return_value=r)
        return b

    mock.table.side_effect = make_builder
    mock.storage.from_.return_value.upload.return_value = None
    mock.storage.from_.return_value.get_public_url.return_value = (
        "https://storage.example.com/ref.avif"
    )
    mock.storage.from_.return_value.remove.return_value = None
    return mock


@pytest.fixture()
def client():
    """TestClient with editor role (sufficient for upload/delete)."""
    user = CurrentUser(id=MOCK_USER_ID, email=MOCK_USER_EMAIL, access_token="mock-token")
    mock_sb = _mock_supabase_with_role("editor")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_effective_supabase] = lambda: mock_sb
    app.dependency_overrides[get_supabase] = lambda: mock_sb

    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def viewer_client():
    """TestClient with viewer role (insufficient for upload/delete)."""
    user = CurrentUser(id=MOCK_USER_ID, email=MOCK_USER_EMAIL, access_token="mock-token")
    mock_sb = _mock_supabase_with_role("viewer")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_effective_supabase] = lambda: mock_sb
    app.dependency_overrides[get_supabase] = lambda: mock_sb

    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# POST /upload
# ---------------------------------------------------------------------------


class TestUploadEndpoint:
    """Tests for POST /upload."""

    def test_returns_400_when_no_file_and_no_url(self, client):
        resp = client.post(
            f"{BASE_URL}/upload",
            data={"entity_type": "portrait", "scope": "global"},
        )
        assert resp.status_code == 400
        assert "Either 'file' or 'image_url'" in resp.json()["detail"]

    def test_returns_400_for_unsupported_file_type(self, client):
        resp = client.post(
            f"{BASE_URL}/upload",
            data={"entity_type": "portrait", "scope": "global"},
            files={"file": ("test.txt", b"hello", "text/plain")},
        )
        assert resp.status_code == 400
        assert "Unsupported file type" in resp.json()["detail"]

    @patch(
        "backend.routers.style_references.StyleReferenceService.upload_reference",
        new_callable=AsyncMock,
    )
    def test_successful_file_upload(self, mock_upload, client):
        mock_upload.return_value = "https://storage.example.com/ref.avif"

        resp = client.post(
            f"{BASE_URL}/upload",
            data={
                "entity_type": "portrait",
                "scope": "global",
                "strength": "0.70",
            },
            files={"file": ("image.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 50, "image/png")},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["url"] == "https://storage.example.com/ref.avif"
        assert body["data"]["scope"] == "global"
        assert body["data"]["entity_type"] == "portrait"

    @patch(
        "backend.routers.style_references.StyleReferenceService.upload_reference",
        new_callable=AsyncMock,
    )
    def test_successful_upload_with_entity_id(self, mock_upload, client):
        mock_upload.return_value = "https://storage.example.com/entity-ref.avif"

        resp = client.post(
            f"{BASE_URL}/upload",
            data={
                "entity_type": "building",
                "scope": "entity",
                "entity_id": str(ENTITY_ID),
            },
            files={"file": ("img.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 50, "image/jpeg")},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["entity_id"] == str(ENTITY_ID)
        assert body["data"]["entity_type"] == "building"
        assert body["data"]["scope"] == "entity"

    @patch(
        "backend.routers.style_references.StyleReferenceService.fetch_from_url",
        new_callable=AsyncMock,
    )
    @patch(
        "backend.routers.style_references.StyleReferenceService.upload_reference",
        new_callable=AsyncMock,
    )
    def test_successful_url_upload(self, mock_upload, mock_fetch, client):
        mock_fetch.return_value = (b"\x89PNG" + b"\x00" * 50, "image/png")
        mock_upload.return_value = "https://storage.example.com/fetched.avif"

        resp = client.post(
            f"{BASE_URL}/upload",
            data={
                "entity_type": "portrait",
                "scope": "global",
                "image_url": "https://public.example.com/style.png",
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["url"] == "https://storage.example.com/fetched.avif"
        mock_fetch.assert_called_once_with("https://public.example.com/style.png")

    @patch(
        "backend.routers.style_references.StyleReferenceService.upload_reference",
        new_callable=AsyncMock,
    )
    def test_upload_service_value_error_returns_400(self, mock_upload, client):
        mock_upload.side_effect = ValueError("Invalid entity_type: vehicle")

        resp = client.post(
            f"{BASE_URL}/upload",
            data={"entity_type": "portrait", "scope": "global"},
            files={"file": ("img.png", b"\x89PNG" + b"\x00" * 50, "image/png")},
        )

        assert resp.status_code == 400
        assert "Invalid entity_type" in resp.json()["detail"]

    def test_viewer_role_rejected_for_upload(self, viewer_client):
        """Viewer role cannot upload (requires editor)."""
        resp = viewer_client.post(
            f"{BASE_URL}/upload",
            data={"entity_type": "portrait", "scope": "global"},
            files={"file": ("img.png", b"\x89PNG" + b"\x00" * 50, "image/png")},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /{entity_type}
# ---------------------------------------------------------------------------


class TestListEndpoint:
    """Tests for GET /{entity_type}."""

    @patch(
        "backend.routers.style_references.StyleReferenceService.list_references",
        new_callable=AsyncMock,
    )
    def test_returns_list_of_references(self, mock_list, client):
        mock_list.return_value = [
            {
                "entity_type": "portrait",
                "scope": "global",
                "reference_image_url": "https://example.com/ref.avif",
                "strength": 0.75,
                "entity_id": None,
                "entity_name": None,
            },
        ]

        resp = client.get(f"{BASE_URL}/portrait")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["data"][0]["scope"] == "global"
        assert body["data"][0]["reference_image_url"] == "https://example.com/ref.avif"

    def test_returns_400_for_invalid_entity_type(self, client):
        resp = client.get(f"{BASE_URL}/vehicle")

        assert resp.status_code == 400
        assert "entity_type must be" in resp.json()["detail"]

    @patch(
        "backend.routers.style_references.StyleReferenceService.list_references",
        new_callable=AsyncMock,
    )
    def test_returns_empty_list(self, mock_list, client):
        mock_list.return_value = []

        resp = client.get(f"{BASE_URL}/building")

        assert resp.status_code == 200
        assert resp.json()["data"] == []


# ---------------------------------------------------------------------------
# DELETE /{entity_type}
# ---------------------------------------------------------------------------


class TestDeleteEndpoint:
    """Tests for DELETE /{entity_type}."""

    @patch(
        "backend.routers.style_references.StyleReferenceService.delete_reference",
        new_callable=AsyncMock,
    )
    def test_deletes_successfully(self, mock_delete, client):
        mock_delete.return_value = None

        resp = client.delete(f"{BASE_URL}/portrait?scope=global")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["deleted"] is True

    def test_returns_400_for_invalid_entity_type(self, client):
        resp = client.delete(f"{BASE_URL}/vehicle")

        assert resp.status_code == 400
        assert "entity_type must be" in resp.json()["detail"]

    @patch(
        "backend.routers.style_references.StyleReferenceService.delete_reference",
        new_callable=AsyncMock,
    )
    def test_delete_passes_entity_id(self, mock_delete, client):
        mock_delete.return_value = None

        resp = client.delete(
            f"{BASE_URL}/building?scope=entity&entity_id={ENTITY_ID}",
        )

        assert resp.status_code == 200
        mock_delete.assert_called_once()
        call_kwargs = mock_delete.call_args
        assert call_kwargs.kwargs.get("entity_id") == ENTITY_ID or (
            len(call_kwargs.args) >= 5 and call_kwargs.args[4] == ENTITY_ID
        )

    def test_viewer_role_rejected_for_delete(self, viewer_client):
        """Viewer role cannot delete (requires editor)."""
        resp = viewer_client.delete(f"{BASE_URL}/portrait?scope=global")
        assert resp.status_code == 403

    @patch(
        "backend.routers.style_references.StyleReferenceService.delete_reference",
        new_callable=AsyncMock,
    )
    def test_delete_value_error_returns_400(self, mock_delete, client):
        mock_delete.side_effect = ValueError("entity_id is required when scope is 'entity'")

        resp = client.delete(f"{BASE_URL}/portrait?scope=entity")

        assert resp.status_code == 400
        assert "entity_id is required" in resp.json()["detail"]
