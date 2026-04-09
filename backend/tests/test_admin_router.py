"""Tests for platform admin router (routers/admin.py).

Every endpoint requires require_platform_admin() and uses get_admin_supabase.
All tests are mock-based — no real DB or external services.

Markers:
    integration: Requires app instantiation but not external services.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import PLATFORM_ADMIN_EMAILS, get_admin_supabase, get_current_user
from backend.models.common import CurrentUser

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ADMIN_EMAIL = "test-admin@velgarien.dev"
ADMIN_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
NON_ADMIN_EMAIL = "nobody@velgarien.dev"
SOME_SIM_ID = uuid4()
SOME_USER_ID = uuid4()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_user(
    uid: UUID,
    email: str,
    token: str = "mock-token",  # noqa: S107
) -> CurrentUser:
    return CurrentUser(id=uid, email=email, access_token=token)


def _mock_supabase() -> MagicMock:
    """Minimal Supabase client mock with full chainable query builder."""
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


def _setup_admin() -> tuple[CurrentUser, MagicMock]:
    """Configure dependency overrides for an admin user."""
    PLATFORM_ADMIN_EMAILS.add(ADMIN_EMAIL)
    user = _make_user(ADMIN_ID, ADMIN_EMAIL)
    mock_sb = _mock_supabase()
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_admin_supabase] = lambda: mock_sb
    return user, mock_sb


def _setup_non_admin() -> tuple[CurrentUser, MagicMock]:
    """Configure dependency overrides for a non-admin user."""
    PLATFORM_ADMIN_EMAILS.discard(ADMIN_EMAIL)
    PLATFORM_ADMIN_EMAILS.discard(NON_ADMIN_EMAIL)
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
    PLATFORM_ADMIN_EMAILS.discard(NON_ADMIN_EMAIL)


# ===========================================================================
# 1. Auth Gate — non-admin gets 403
# ===========================================================================


@pytest.mark.integration
class TestAdminAuthGate:
    """Non-admin users must receive 403 for all admin endpoints."""

    def test_get_environment_forbidden(self, client: TestClient):
        _setup_non_admin()
        resp = client.get("/api/v1/admin/environment")
        assert resp.status_code == 403

    def test_get_settings_forbidden(self, client: TestClient):
        _setup_non_admin()
        resp = client.get("/api/v1/admin/settings")
        assert resp.status_code == 403

    def test_get_users_forbidden(self, client: TestClient):
        _setup_non_admin()
        resp = client.get("/api/v1/admin/users")
        assert resp.status_code == 403

    def test_put_setting_forbidden(self, client: TestClient):
        _setup_non_admin()
        resp = client.put(
            "/api/v1/admin/settings/some_key",
            json={"value": "new"},
        )
        assert resp.status_code == 403

    def test_delete_user_forbidden(self, client: TestClient):
        _setup_non_admin()
        resp = client.delete(f"/api/v1/admin/users/{SOME_USER_ID}")
        assert resp.status_code == 403

    def test_generate_showcase_forbidden(self, client: TestClient):
        _setup_non_admin()
        resp = client.post(
            "/api/v1/admin/dungeon-showcase/generate-image",
            json={"archetype_id": "shadow"},
        )
        assert resp.status_code == 403

    def test_get_dungeon_config_forbidden(self, client: TestClient):
        _setup_non_admin()
        resp = client.get("/api/v1/admin/dungeon-config/global")
        assert resp.status_code == 403

    def test_get_dungeon_override_forbidden(self, client: TestClient):
        _setup_non_admin()
        resp = client.get("/api/v1/admin/dungeon-override")
        assert resp.status_code == 403

    def test_get_health_effects_forbidden(self, client: TestClient):
        _setup_non_admin()
        resp = client.get("/api/v1/admin/health-effects")
        assert resp.status_code == 403

    def test_get_simulations_forbidden(self, client: TestClient):
        _setup_non_admin()
        resp = client.get("/api/v1/admin/simulations")
        assert resp.status_code == 403

    def test_get_ai_usage_forbidden(self, client: TestClient):
        _setup_non_admin()
        resp = client.get("/api/v1/admin/ai-usage/stats")
        assert resp.status_code == 403


# ===========================================================================
# 2. Environment
# ===========================================================================


@pytest.mark.integration
class TestAdminEnvironment:
    """GET /admin/environment returns the current server environment."""

    def test_get_environment(self, client: TestClient):
        _setup_admin()
        resp = client.get("/api/v1/admin/environment")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "environment" in body["data"]


# ===========================================================================
# 3. Platform Settings
# ===========================================================================


@pytest.mark.integration
class TestAdminSettings:
    """GET/PUT /admin/settings endpoints."""

    @patch(
        "backend.routers.admin.PlatformSettingsService.list_all",
        new_callable=AsyncMock,
    )
    def test_list_settings(self, mock_list_all: AsyncMock, client: TestClient):
        _setup_admin()
        mock_list_all.return_value = [
            {"setting_key": "site_name", "setting_value": "Velgarien"},
        ]
        resp = client.get("/api/v1/admin/settings")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)
        assert body["data"][0]["setting_key"] == "site_name"
        mock_list_all.assert_awaited_once()

    @patch(
        "backend.routers.admin.encrypt_value",
        return_value="encrypted-value",
    )
    @patch(
        "backend.routers.admin.PlatformSettingsService.update",
        new_callable=AsyncMock,
    )
    def test_update_setting(
        self,
        mock_update: AsyncMock,
        mock_encrypt: MagicMock,
        client: TestClient,
    ):
        _setup_admin()
        mock_update.return_value = {
            "setting_key": "site_name",
            "setting_value": "New Name",
        }
        resp = client.put(
            "/api/v1/admin/settings/site_name",
            json={"value": "New Name"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["setting_key"] == "site_name"
        mock_update.assert_awaited_once()

    @patch(
        "backend.routers.admin.encrypt_value",
        return_value="encrypted-secret",
    )
    @patch(
        "backend.routers.admin.PlatformSettingsService.update",
        new_callable=AsyncMock,
    )
    def test_update_sensitive_setting_encrypts(
        self,
        mock_update: AsyncMock,
        mock_encrypt: MagicMock,
        client: TestClient,
    ):
        """Sensitive keys (ending with api_key etc.) are encrypted before storage."""
        _setup_admin()
        mock_update.return_value = {
            "setting_key": "openai_api_key",
            "setting_value": "encrypted-secret",
        }
        resp = client.put(
            "/api/v1/admin/settings/openai_api_key",
            json={"value": "sk-real-key"},
        )
        assert resp.status_code == 200
        # encrypt_value should have been called with the plaintext
        mock_encrypt.assert_called_once_with("sk-real-key")
        # The service should receive the encrypted value
        call_args = mock_update.call_args
        assert call_args.args[1] == "openai_api_key"
        assert call_args.args[2] == "encrypted-secret"


# ===========================================================================
# 4. User Management
# ===========================================================================


@pytest.mark.integration
class TestAdminUsers:
    """GET /admin/users and GET /admin/users/{id}."""

    @patch(
        "backend.routers.admin.AdminUserService.list_users",
        new_callable=AsyncMock,
    )
    def test_list_users(self, mock_list: AsyncMock, client: TestClient):
        _setup_admin()
        mock_list.return_value = {"users": [], "total": 0}
        resp = client.get("/api/v1/admin/users")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        mock_list.assert_awaited_once()

    @patch(
        "backend.routers.admin.AdminUserService.list_users",
        new_callable=AsyncMock,
    )
    def test_list_users_pagination(self, mock_list: AsyncMock, client: TestClient):
        _setup_admin()
        mock_list.return_value = {"users": [{"id": str(SOME_USER_ID)}], "total": 1}
        resp = client.get("/api/v1/admin/users?page=2&per_page=10")
        assert resp.status_code == 200
        call_kwargs = mock_list.call_args.kwargs
        assert call_kwargs["page"] == 2
        assert call_kwargs["per_page"] == 10

    @patch(
        "backend.routers.admin.AdminUserService.get_user_with_memberships",
        new_callable=AsyncMock,
    )
    def test_get_user_detail(self, mock_get: AsyncMock, client: TestClient):
        _setup_admin()
        mock_get.return_value = {
            "memberships": [{"simulation_id": str(SOME_SIM_ID), "member_role": "viewer"}],
            "wallet": {"forge_tokens": 10, "is_architect": False},
        }
        resp = client.get(f"/api/v1/admin/users/{SOME_USER_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "memberships" in body["data"]
        mock_get.assert_awaited_once()

    @patch(
        "backend.routers.admin.AdminUserService.delete_user",
        new_callable=AsyncMock,
    )
    def test_delete_user(self, mock_delete: AsyncMock, client: TestClient):
        _setup_admin()
        mock_delete.return_value = None
        resp = client.delete(f"/api/v1/admin/users/{SOME_USER_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["deleted"] is True
        mock_delete.assert_awaited_once()

    @patch(
        "backend.routers.admin.AdminUserService.add_membership",
        new_callable=AsyncMock,
    )
    def test_add_membership(self, mock_add: AsyncMock, client: TestClient):
        _setup_admin()
        mock_add.return_value = {
            "user_id": str(SOME_USER_ID),
            "simulation_id": str(SOME_SIM_ID),
            "member_role": "editor",
        }
        resp = client.post(
            f"/api/v1/admin/users/{SOME_USER_ID}/memberships",
            json={"simulation_id": str(SOME_SIM_ID), "role": "editor"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["member_role"] == "editor"
        mock_add.assert_awaited_once()

    @patch(
        "backend.routers.admin.AdminUserService.change_membership_role",
        new_callable=AsyncMock,
    )
    def test_change_membership_role(self, mock_change: AsyncMock, client: TestClient):
        _setup_admin()
        mock_change.return_value = {
            "user_id": str(SOME_USER_ID),
            "simulation_id": str(SOME_SIM_ID),
            "member_role": "admin",
        }
        resp = client.put(
            f"/api/v1/admin/users/{SOME_USER_ID}/memberships/{SOME_SIM_ID}",
            json={"role": "admin"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["member_role"] == "admin"
        mock_change.assert_awaited_once()

    @patch(
        "backend.routers.admin.AdminUserService.remove_membership",
        new_callable=AsyncMock,
    )
    def test_remove_membership(self, mock_remove: AsyncMock, client: TestClient):
        _setup_admin()
        mock_remove.return_value = {
            "user_id": str(SOME_USER_ID),
            "simulation_id": str(SOME_SIM_ID),
            "member_role": "editor",
        }
        resp = client.delete(
            f"/api/v1/admin/users/{SOME_USER_ID}/memberships/{SOME_SIM_ID}",
        )
        assert resp.status_code == 200
        mock_remove.assert_awaited_once()

    @patch(
        "backend.routers.admin.AdminUserService.update_user_wallet",
        new_callable=AsyncMock,
    )
    def test_update_user_wallet(self, mock_wallet: AsyncMock, client: TestClient):
        _setup_admin()
        mock_wallet.return_value = {
            "user_id": str(SOME_USER_ID),
            "forge_tokens": 50,
            "is_architect": True,
        }
        resp = client.put(
            f"/api/v1/admin/users/{SOME_USER_ID}/wallet",
            json={"forge_tokens": 50, "is_architect": True},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["forge_tokens"] == 50
        assert body["data"]["is_architect"] is True
        mock_wallet.assert_awaited_once()


# ===========================================================================
# 5. Dungeon Global Config
# ===========================================================================


@pytest.mark.integration
class TestAdminDungeonConfig:
    """GET/PUT /admin/dungeon-config/global."""

    @patch(
        "backend.routers.admin.PlatformSettingsService.get_dungeon_global_config",
        new_callable=AsyncMock,
    )
    def test_get_global_config(self, mock_get: AsyncMock, client: TestClient):
        _setup_admin()
        mock_get.return_value = {
            "override_mode": "off",
            "override_archetypes": [],
            "clearance_mode": "standard",
            "clearance_threshold": 10,
        }
        resp = client.get("/api/v1/admin/dungeon-config/global")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["override_mode"] == "off"
        assert body["data"]["clearance_mode"] == "standard"
        mock_get.assert_awaited_once()

    @patch(
        "backend.routers.admin.PlatformSettingsService.update_dungeon_global_config",
        new_callable=AsyncMock,
    )
    def test_update_global_config(self, mock_update: AsyncMock, client: TestClient):
        _setup_admin()
        mock_update.return_value = {
            "override_mode": "supplement",
            "override_archetypes": ["The Shadow", "The Tower"],
            "clearance_mode": "custom",
            "clearance_threshold": 5,
        }
        resp = client.put(
            "/api/v1/admin/dungeon-config/global",
            json={
                "override_mode": "supplement",
                "override_archetypes": ["The Shadow", "The Tower"],
                "clearance_mode": "custom",
                "clearance_threshold": 5,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["override_mode"] == "supplement"
        assert body["data"]["override_archetypes"] == ["The Shadow", "The Tower"]
        mock_update.assert_awaited_once()

    def test_update_global_config_invalid_mode(self, client: TestClient):
        """Invalid override_mode is rejected by Pydantic validation."""
        _setup_admin()
        resp = client.put(
            "/api/v1/admin/dungeon-config/global",
            json={
                "override_mode": "invalid_mode",
                "override_archetypes": [],
                "clearance_mode": "standard",
                "clearance_threshold": 10,
            },
        )
        assert resp.status_code == 422


# ===========================================================================
# 6. Dungeon Per-Simulation Override
# ===========================================================================


@pytest.mark.integration
class TestAdminDungeonOverride:
    """GET /admin/dungeon-override and per-simulation endpoints."""

    @patch(
        "backend.routers.admin.SettingsService.list_dungeon_overrides",
        new_callable=AsyncMock,
    )
    def test_list_overrides(self, mock_list: AsyncMock, client: TestClient):
        _setup_admin()
        mock_list.return_value = [
            {
                "id": str(SOME_SIM_ID),
                "name": "Test Sim",
                "slug": "test-sim",
                "mode": "off",
                "archetypes": [],
            },
        ]
        resp = client.get("/api/v1/admin/dungeon-override")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)
        assert body["data"][0]["mode"] == "off"
        mock_list.assert_awaited_once()

    @patch(
        "backend.routers.admin.SettingsService.get_dungeon_override",
        new_callable=AsyncMock,
    )
    def test_get_override_for_simulation(self, mock_get: AsyncMock, client: TestClient):
        _setup_admin()
        mock_get.return_value = {"mode": "supplement", "archetypes": ["The Shadow"]}
        resp = client.get(f"/api/v1/admin/dungeon-override/simulations/{SOME_SIM_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["mode"] == "supplement"
        assert body["data"]["archetypes"] == ["The Shadow"]
        mock_get.assert_awaited_once()

    @patch(
        "backend.routers.admin.SettingsService.upsert_setting",
        new_callable=AsyncMock,
    )
    def test_update_override_for_simulation(
        self, mock_upsert: AsyncMock, client: TestClient,
    ):
        _setup_admin()
        mock_upsert.return_value = None
        resp = client.put(
            f"/api/v1/admin/dungeon-override/simulations/{SOME_SIM_ID}",
            json={"mode": "override", "archetypes": ["The Tower", "The Shadow"]},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["mode"] == "override"
        assert body["data"]["archetypes"] == ["The Tower", "The Shadow"]
        mock_upsert.assert_awaited_once()


# ===========================================================================
# 7. Showcase Image Generation
# ===========================================================================


@pytest.mark.integration
class TestShowcaseImageValidation:
    """POST /admin/dungeon-showcase/generate-image."""

    def test_invalid_archetype_returns_400(self, client: TestClient):
        _setup_admin()
        resp = client.post(
            "/api/v1/admin/dungeon-showcase/generate-image",
            json={"archetype_id": "nonexistent"},
        )
        assert resp.status_code == 400
        assert "Unknown archetype" in resp.json()["detail"]

    @patch(
        "backend.routers.admin.generate_and_upload_showcase",
        new_callable=AsyncMock,
    )
    def test_valid_archetype_returns_200(
        self, mock_generate: AsyncMock, client: TestClient,
    ):
        _setup_admin()
        mock_generate.return_value = {
            "archetype": "shadow",
            "model": "black-forest-labs/flux.2-max",
            "url": "https://storage.example.com/showcase/shadow-thumb.avif",
            "full_path": "dungeon-showcase/shadow-full.avif",
            "thumb_path": "dungeon-showcase/shadow-thumb.avif",
            "bytes": 123456,
            "usage": None,
        }
        resp = client.post(
            "/api/v1/admin/dungeon-showcase/generate-image",
            json={"archetype_id": "shadow"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["archetype"] == "shadow"
        assert body["data"]["url"].endswith(".avif")
        mock_generate.assert_awaited_once()

    def test_missing_archetype_id_returns_422(self, client: TestClient):
        """Missing required field archetype_id triggers Pydantic 422."""
        _setup_admin()
        resp = client.post(
            "/api/v1/admin/dungeon-showcase/generate-image",
            json={},
        )
        assert resp.status_code == 422


# ===========================================================================
# 8. Health Effects
# ===========================================================================


@pytest.mark.integration
class TestAdminHealthEffects:
    """GET /admin/health-effects and PUT per-simulation toggle."""

    @patch(
        "backend.routers.admin.GameMechanicsService.get_health_effects_dashboard",
        new_callable=AsyncMock,
    )
    def test_get_health_effects_dashboard(
        self, mock_dashboard: AsyncMock, client: TestClient,
    ):
        _setup_admin()
        mock_dashboard.return_value = {
            "global_enabled": True,
            "simulations": [],
        }
        resp = client.get("/api/v1/admin/health-effects")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["global_enabled"] is True
        mock_dashboard.assert_awaited_once()

    @patch(
        "backend.routers.admin.SettingsService.upsert_setting",
        new_callable=AsyncMock,
    )
    def test_toggle_simulation_health_effects(
        self, mock_upsert: AsyncMock, client: TestClient,
    ):
        _setup_admin()
        mock_upsert.return_value = None
        resp = client.put(
            f"/api/v1/admin/health-effects/simulations/{SOME_SIM_ID}",
            json={"enabled": False},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["enabled"] is False
        mock_upsert.assert_awaited_once()


# ===========================================================================
# 9. Simulation Management
# ===========================================================================


@pytest.mark.integration
class TestAdminSimulations:
    """GET/DELETE/POST /admin/simulations endpoints."""

    @patch(
        "backend.routers.admin._sim_service.list_all_simulations",
        new_callable=AsyncMock,
    )
    def test_list_simulations(self, mock_list: AsyncMock, client: TestClient):
        _setup_admin()
        mock_list.return_value = ([], 0)
        resp = client.get("/api/v1/admin/simulations")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)
        assert "meta" in body
        mock_list.assert_awaited_once()

    @patch(
        "backend.routers.admin._sim_service.list_all_simulations",
        new_callable=AsyncMock,
    )
    def test_list_simulations_pagination(self, mock_list: AsyncMock, client: TestClient):
        _setup_admin()
        sim_item = {
            "id": str(SOME_SIM_ID),
            "name": "Test",
            "slug": "test",
            "status": "active",
            "theme": "dark",
            "simulation_type": "template",
            "owner_id": str(ADMIN_ID),
            "created_at": "2026-01-01T00:00:00Z",
            "deleted_at": None,
        }
        mock_list.return_value = ([sim_item], 1)
        resp = client.get("/api/v1/admin/simulations?page=1&per_page=25")
        assert resp.status_code == 200
        body = resp.json()
        assert body["meta"]["limit"] == 25
        assert body["meta"]["offset"] == 0

    @patch(
        "backend.routers.admin._sim_service.list_deleted_simulations",
        new_callable=AsyncMock,
    )
    def test_list_deleted_simulations(self, mock_list: AsyncMock, client: TestClient):
        _setup_admin()
        mock_list.return_value = ([], 0)
        resp = client.get("/api/v1/admin/simulations/deleted")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        mock_list.assert_awaited_once()

    @patch(
        "backend.routers.admin._sim_service.restore_simulation",
        new_callable=AsyncMock,
    )
    def test_restore_simulation(self, mock_restore: AsyncMock, client: TestClient):
        _setup_admin()
        mock_restore.return_value = {
            "id": str(SOME_SIM_ID),
            "name": "Restored",
            "slug": "restored",
            "theme": "dark",
            "status": "active",
            "content_locale": "en",
            "owner_id": str(ADMIN_ID),
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
        resp = client.post(f"/api/v1/admin/simulations/{SOME_SIM_ID}/restore")
        assert resp.status_code == 200
        mock_restore.assert_awaited_once()

    @patch(
        "backend.routers.admin._sim_service.delete_simulation",
        new_callable=AsyncMock,
    )
    def test_soft_delete_simulation(self, mock_delete: AsyncMock, client: TestClient):
        _setup_admin()
        mock_delete.return_value = {"id": str(SOME_SIM_ID), "deleted_at": "2026-01-01T00:00:00Z"}
        resp = client.delete(f"/api/v1/admin/simulations/{SOME_SIM_ID}")
        assert resp.status_code == 200
        mock_delete.assert_awaited_once()

    @patch(
        "backend.routers.admin._sim_service.hard_delete_simulation",
        new_callable=AsyncMock,
    )
    def test_hard_delete_simulation(self, mock_hard: AsyncMock, client: TestClient):
        _setup_admin()
        mock_hard.return_value = {"id": str(SOME_SIM_ID)}
        resp = client.delete(f"/api/v1/admin/simulations/{SOME_SIM_ID}?hard=true")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["deleted"] is True
        mock_hard.assert_awaited_once()


# ===========================================================================
# 10. AI Usage Stats
# ===========================================================================


@pytest.mark.integration
class TestAdminAIUsage:
    """GET /admin/ai-usage/stats."""

    @patch(
        "backend.routers.admin.AIUsageService.get_platform_stats",
        new_callable=AsyncMock,
    )
    def test_get_ai_usage_stats(self, mock_stats: AsyncMock, client: TestClient):
        _setup_admin()
        mock_stats.return_value = {
            "period_days": 30,
            "total_calls": 100,
            "total_tokens": 50000,
            "total_cost_usd": 12.50,
            "avg_cost_per_call": 0.125,
            "by_provider": [],
            "by_model": [],
            "by_purpose": [],
            "by_simulation": [],
            "daily_trend": [],
            "key_sources": {},
        }
        resp = client.get("/api/v1/admin/ai-usage/stats")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["total_calls"] == 100
        mock_stats.assert_awaited_once()

    @patch(
        "backend.routers.admin.AIUsageService.get_platform_stats",
        new_callable=AsyncMock,
    )
    def test_ai_usage_stats_custom_days(self, mock_stats: AsyncMock, client: TestClient):
        _setup_admin()
        mock_stats.return_value = {
            "period_days": 7,
            "total_calls": 20,
            "total_tokens": 10000,
            "total_cost_usd": 2.50,
            "avg_cost_per_call": 0.125,
            "by_provider": [],
            "by_model": [],
            "by_purpose": [],
            "by_simulation": [],
            "daily_trend": [],
            "key_sources": {},
        }
        resp = client.get("/api/v1/admin/ai-usage/stats?days=7")
        assert resp.status_code == 200
        call_kwargs = mock_stats.call_args.kwargs
        assert call_kwargs["days"] == 7


# ===========================================================================
# 11. Cleanup Endpoints
# ===========================================================================


@pytest.mark.integration
class TestAdminCleanup:
    """GET/POST /admin/cleanup endpoints."""

    @patch(
        "backend.routers.admin.CleanupService.get_stats",
        new_callable=AsyncMock,
    )
    def test_get_cleanup_stats(self, mock_stats: AsyncMock, client: TestClient):
        _setup_admin()
        category = {"count": 10, "oldest_at": None}
        mock_stats.return_value = {
            "completed_epochs": category,
            "cancelled_epochs": category,
            "stale_lobbies": category,
            "archived_instances": category,
            "audit_log_entries": category,
            "bot_decision_entries": category,
        }
        resp = client.get("/api/v1/admin/cleanup/stats")
        assert resp.status_code == 200
        mock_stats.assert_awaited_once()

    @patch(
        "backend.routers.admin.CleanupService.preview",
        new_callable=AsyncMock,
    )
    def test_preview_cleanup(self, mock_preview: AsyncMock, client: TestClient):
        _setup_admin()
        mock_preview.return_value = {
            "cleanup_type": "completed_epochs",
            "min_age_days": 30,
            "primary_count": 5,
            "cascade_counts": {},
            "items": [],
        }
        resp = client.post(
            "/api/v1/admin/cleanup/preview",
            json={"cleanup_type": "completed_epochs", "min_age_days": 30},
        )
        assert resp.status_code == 200
        mock_preview.assert_awaited_once()

    @patch(
        "backend.routers.admin.CleanupService.execute",
        new_callable=AsyncMock,
    )
    def test_execute_cleanup(self, mock_execute: AsyncMock, client: TestClient):
        _setup_admin()
        mock_execute.return_value = {
            "cleanup_type": "completed_epochs",
            "min_age_days": 30,
            "deleted_count": 5,
            "cascade_counts": {},
        }
        resp = client.post(
            "/api/v1/admin/cleanup/execute",
            json={"cleanup_type": "completed_epochs", "min_age_days": 30},
        )
        assert resp.status_code == 200
        mock_execute.assert_awaited_once()

    def test_invalid_cleanup_type_returns_422(self, client: TestClient):
        """Invalid cleanup_type is rejected by Pydantic validation."""
        _setup_admin()
        resp = client.post(
            "/api/v1/admin/cleanup/preview",
            json={"cleanup_type": "invalid_type", "min_age_days": 30},
        )
        assert resp.status_code == 422


# ===========================================================================
# 12. Impersonation
# ===========================================================================


@pytest.mark.integration
class TestAdminImpersonate:
    """POST /admin/impersonate."""

    def test_impersonate_user(self, client: TestClient):
        _setup_admin()
        # The endpoint calls admin_supabase.auth.admin.get_user_by_id
        # and admin_supabase.auth.admin.generate_link — need auth mock.
        mock_sb = _mock_supabase()

        # Mock the auth admin methods
        mock_user = MagicMock()
        mock_user.user = MagicMock()
        mock_user.user.email = "target@velgarien.dev"
        mock_sb.auth.admin.get_user_by_id = AsyncMock(return_value=mock_user)

        mock_link = MagicMock()
        mock_link.properties.hashed_token = "abc123-hashed"
        mock_sb.auth.admin.generate_link = AsyncMock(return_value=mock_link)

        app.dependency_overrides[get_admin_supabase] = lambda: mock_sb

        resp = client.post(
            "/api/v1/admin/impersonate",
            json={"user_id": str(SOME_USER_ID)},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["hashed_token"] == "abc123-hashed"
        assert body["data"]["email"] == "target@velgarien.dev"

    def test_impersonate_nonexistent_user_returns_404(self, client: TestClient):
        _setup_admin()
        mock_sb = _mock_supabase()

        mock_user_resp = MagicMock()
        mock_user_resp.user = None
        mock_sb.auth.admin.get_user_by_id = AsyncMock(return_value=mock_user_resp)

        app.dependency_overrides[get_admin_supabase] = lambda: mock_sb

        resp = client.post(
            "/api/v1/admin/impersonate",
            json={"user_id": str(SOME_USER_ID)},
        )
        assert resp.status_code == 404
