"""Tests for the World Map router (public read + admin regenerate).

Covers:
1. Public GET — payload shape, ETag stability, version-based ETag change,
   404 on unavailable, slug-or-UUID URL form, Game-Instance shape.
2. Admin POST — 403 for non-members, success for platform admin and owner,
   audit log insert, body validation (invalid preset → 422, empty body
   defers to service defaults).

WorldMapService.get_public_map and ForgeMapService.generate_map are patched
at the router-import seam so the tests exercise routing/serialization/auth
without touching real Supabase.
"""

from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_supabase,
    resolve_simulation_id,
)
from backend.models.common import CurrentUser
from backend.models.world_map import (
    MapGenerationResult,
    WorldMapAgentMarker,
    WorldMapBuilding,
    WorldMapCity,
    WorldMapResponse,
    WorldMapStreet,
    WorldMapThemeHints,
    WorldMapZone,
)
from backend.tests.conftest import (
    MOCK_ADMIN_EMAIL,
    MOCK_USER_EMAIL,
    MOCK_USER_ID,
    make_async_supabase_mock,
)

# ── Constants ────────────────────────────────────────────────────────────

SIM_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
TEMPLATE_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
ZONE_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
BUILDING_ID = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
AGENT_ID = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
CITY_ID = UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")
STREET_ID = UUID("99999999-9999-9999-9999-999999999999")


# ── Helpers ──────────────────────────────────────────────────────────────


def _make_user(email: str = MOCK_USER_EMAIL) -> CurrentUser:
    return CurrentUser(id=MOCK_USER_ID, email=email, access_token="mock-token")


def _sample_payload(*, version: int = 1, is_instance: bool = False) -> WorldMapResponse:
    return WorldMapResponse(
        simulation_id=SIM_ID,
        simulation_slug="velgarien",
        is_game_instance=is_instance,
        geometry_source_id=TEMPLATE_ID if is_instance else SIM_ID,
        geometry_version=version,
        cities=[
            WorldMapCity(
                id=CITY_ID,
                name="Velgarien-Stadt",
                map_center_lat=0.5,
                map_center_lng=0.5,
                map_default_zoom=12,
            ),
        ],
        zones=[
            WorldMapZone(
                id=ZONE_ID,
                name="Regierungsviertel",
                zone_type="government",
                stability=0.62,
                stability_label="functional",
            ),
        ],
        streets=[
            WorldMapStreet(
                id=STREET_ID,
                name="Hauptstraße",
                street_type="arterial",
                length_km=1.2,
            ),
        ],
        buildings=[
            WorldMapBuilding(id=BUILDING_ID, name="Rathaus", building_type="government"),
        ],
        agent_markers=[
            WorldMapAgentMarker(agent_id=AGENT_ID, name="Herr Korn", home_building_id=BUILDING_ID),
        ],
        theme_hints=WorldMapThemeHints(color_primary="#aa0000", font_heading="serif"),
    )


def _sample_result() -> MapGenerationResult:
    return MapGenerationResult(
        simulation_id=SIM_ID,
        preset_used="medieval_walled",
        seed_used="velgarien-test-seed",
        geometry_version=2,
        cities_updated=2,
        zones_updated=3,
        streets_inserted=140,
        buildings_updated=80,
        lives_at_inserted=20,
        duration_seconds=12.345,
    )


# ── Public endpoint fixtures ─────────────────────────────────────────────


@pytest.fixture()
def public_client():
    """Public endpoint fixture — admin supabase mock + slug/UUID resolved to SIM_ID."""
    admin_sb = make_async_supabase_mock()
    app.dependency_overrides[get_admin_supabase] = lambda: admin_sb
    app.dependency_overrides[resolve_simulation_id] = lambda: SIM_ID
    yield TestClient(app), admin_sb
    app.dependency_overrides.clear()


# ── Public endpoint tests ────────────────────────────────────────────────


class TestPublicWorldMap:
    @patch(
        "backend.routers.world_map.WorldMapService.get_public_map",
        new_callable=AsyncMock,
    )
    def test_returns_payload(self, mock_get, public_client):
        client, _ = public_client
        mock_get.return_value = _sample_payload()

        resp = client.get(f"/api/v1/public/simulations/{SIM_ID}/map")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert data["simulation_slug"] == "velgarien"
        assert data["geometry_version"] == 1
        assert data["zones"][0]["stability"] == 0.62
        assert data["zones"][0]["stability_label"] == "functional"
        assert data["agent_markers"][0]["name"] == "Herr Korn"
        assert data["theme_hints"]["color_primary"] == "#aa0000"

    @patch(
        "backend.routers.world_map.WorldMapService.get_public_map",
        new_callable=AsyncMock,
    )
    def test_sets_cache_headers(self, mock_get, public_client):
        client, _ = public_client
        mock_get.return_value = _sample_payload()

        resp = client.get(f"/api/v1/public/simulations/{SIM_ID}/map")

        assert resp.status_code == 200
        assert "ETag" in resp.headers
        assert "max-age=60" in resp.headers["Cache-Control"]
        assert "stale-while-revalidate" in resp.headers["Cache-Control"]

    @patch(
        "backend.routers.world_map.WorldMapService.get_public_map",
        new_callable=AsyncMock,
    )
    def test_returns_404_when_unavailable(self, mock_get, public_client):
        client, _ = public_client
        mock_get.return_value = None

        resp = client.get(f"/api/v1/public/simulations/{SIM_ID}/map")

        assert resp.status_code == 404

    @patch(
        "backend.routers.world_map.WorldMapService.get_public_map",
        new_callable=AsyncMock,
    )
    def test_accepts_slug_url(self, mock_get, public_client):
        client, _ = public_client
        mock_get.return_value = _sample_payload()

        resp = client.get("/api/v1/public/simulations/velgarien/map")

        assert resp.status_code == 200
        # The override returns SIM_ID regardless of input — confirms the slug
        # URL form reached the handler with the resolved UUID.
        mock_get.assert_awaited_once()
        assert mock_get.await_args.args[1] == SIM_ID

    @patch(
        "backend.routers.world_map.WorldMapService.get_public_map",
        new_callable=AsyncMock,
    )
    def test_etag_stable_for_same_version(self, mock_get, public_client):
        client, _ = public_client
        mock_get.return_value = _sample_payload(version=3)

        r1 = client.get(f"/api/v1/public/simulations/{SIM_ID}/map")
        r2 = client.get(f"/api/v1/public/simulations/{SIM_ID}/map")

        assert r1.headers["ETag"] == r2.headers["ETag"]

    @patch(
        "backend.routers.world_map.WorldMapService.get_public_map",
        new_callable=AsyncMock,
    )
    def test_etag_changes_with_version(self, mock_get, public_client):
        client, _ = public_client
        mock_get.side_effect = [_sample_payload(version=1), _sample_payload(version=2)]

        r1 = client.get(f"/api/v1/public/simulations/{SIM_ID}/map")
        r2 = client.get(f"/api/v1/public/simulations/{SIM_ID}/map")

        assert r1.headers["ETag"] != r2.headers["ETag"]

    @patch(
        "backend.routers.world_map.WorldMapService.get_public_map",
        new_callable=AsyncMock,
    )
    def test_game_instance_returns_template_geometry_source(self, mock_get, public_client):
        client, _ = public_client
        mock_get.return_value = _sample_payload(is_instance=True)

        resp = client.get(f"/api/v1/public/simulations/{SIM_ID}/map")

        body = resp.json()["data"]
        assert body["is_game_instance"] is True
        assert body["geometry_source_id"] == str(TEMPLATE_ID)
        assert body["simulation_id"] == str(SIM_ID)


# ── Admin endpoint fixtures ──────────────────────────────────────────────


@pytest.fixture()
def admin_user_client():
    """Platform-admin user — passes role check via email-allowlist short-circuit."""
    user = _make_user(email=MOCK_ADMIN_EMAIL)
    mock_sb = make_async_supabase_mock(execute_data=[])
    admin_sb = make_async_supabase_mock(execute_data=[])
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[get_admin_supabase] = lambda: admin_sb
    yield TestClient(app), admin_sb
    app.dependency_overrides.clear()


@pytest.fixture()
def owner_user_client():
    """Non-admin user with owner member_role — passes role check via membership.

    is_platform_admin is patched to False so the test doesn't depend on the
    cross-test state of the platform-admin-IDs cache.
    """
    user = _make_user(email=MOCK_USER_EMAIL)
    mock_sb = make_async_supabase_mock(execute_data=[{"member_role": "owner"}])
    admin_sb = make_async_supabase_mock(execute_data=[])
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[get_admin_supabase] = lambda: admin_sb
    with patch(
        "backend.dependencies.is_platform_admin",
        new_callable=AsyncMock,
        return_value=False,
    ):
        yield TestClient(app), admin_sb
    app.dependency_overrides.clear()


@pytest.fixture()
def non_member_client():
    """Non-admin user with no membership — fails role check (403)."""
    user = _make_user(email=MOCK_USER_EMAIL)
    mock_sb = make_async_supabase_mock(execute_data=[])
    admin_sb = make_async_supabase_mock(execute_data=[])
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[get_admin_supabase] = lambda: admin_sb
    with patch(
        "backend.dependencies.is_platform_admin",
        new_callable=AsyncMock,
        return_value=False,
    ):
        yield TestClient(app)
    app.dependency_overrides.clear()


# ── Admin endpoint tests ─────────────────────────────────────────────────


class TestRegenerateAuthGate:
    def test_non_member_returns_403(self, non_member_client):
        resp = non_member_client.post(
            f"/api/v1/admin/simulations/{SIM_ID}/map/regenerate",
            json={},
        )
        assert resp.status_code == 403


class TestRegenerateAsPlatformAdmin:
    @patch(
        "backend.routers.world_map.ForgeMapService.generate_map",
        new_callable=AsyncMock,
    )
    def test_succeeds_with_overrides(self, mock_gen, admin_user_client):
        client, _ = admin_user_client
        mock_gen.return_value = _sample_result()

        resp = client.post(
            f"/api/v1/admin/simulations/{SIM_ID}/map/regenerate",
            json={"seed": "alt-seed", "preset": "medieval_walled"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["geometry_version"] == 2
        assert body["data"]["preset_used"] == "medieval_walled"
        assert body["data"]["seed_used"] == "velgarien-test-seed"

        mock_gen.assert_awaited_once()
        kwargs = mock_gen.await_args.kwargs
        assert kwargs["seed"] == "alt-seed"
        assert kwargs["preset"] == "medieval_walled"
        assert kwargs["forge_draft_id"] is None
        # First positional is the simulation_id UUID
        assert mock_gen.await_args.args[0] == SIM_ID

    @patch(
        "backend.routers.world_map.ForgeMapService.generate_map",
        new_callable=AsyncMock,
    )
    def test_writes_audit_log(self, mock_gen, admin_user_client):
        client, admin_sb = admin_user_client
        mock_gen.return_value = _sample_result()

        resp = client.post(
            f"/api/v1/admin/simulations/{SIM_ID}/map/regenerate",
            json={},
        )

        assert resp.status_code == 200
        admin_sb.table.assert_any_call("audit_log")


class TestRegenerateAsOwner:
    @patch(
        "backend.routers.world_map.ForgeMapService.generate_map",
        new_callable=AsyncMock,
    )
    def test_owner_can_regenerate(self, mock_gen, owner_user_client):
        client, _ = owner_user_client
        mock_gen.return_value = _sample_result()

        resp = client.post(
            f"/api/v1/admin/simulations/{SIM_ID}/map/regenerate",
            json={},
        )

        assert resp.status_code == 200
        mock_gen.assert_awaited_once()


class TestRegenerateBodyValidation:
    def test_invalid_preset_returns_422(self, admin_user_client):
        client, _ = admin_user_client
        resp = client.post(
            f"/api/v1/admin/simulations/{SIM_ID}/map/regenerate",
            json={"preset": "not_a_real_preset"},
        )
        assert resp.status_code == 422

    @patch(
        "backend.routers.world_map.ForgeMapService.generate_map",
        new_callable=AsyncMock,
    )
    def test_empty_body_uses_service_defaults(self, mock_gen, admin_user_client):
        client, _ = admin_user_client
        mock_gen.return_value = _sample_result()

        resp = client.post(
            f"/api/v1/admin/simulations/{SIM_ID}/map/regenerate",
            json={},
        )

        assert resp.status_code == 200
        kwargs = mock_gen.await_args.kwargs
        assert kwargs["seed"] is None
        assert kwargs["preset"] is None
