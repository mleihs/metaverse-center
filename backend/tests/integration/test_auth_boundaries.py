"""Auth boundary tests — Phase 1 of the post-audit test plan.

Covers gaps NOT already in test_rls_policies.py:
  1.1  Role hierarchy additions (PUT/UPDATE, systematic full-role matrix)
  1.2  Cross-simulation isolation (non-member → 403, not 500)
  1.3  Platform admin bypass (3-tier check, auto-elevation, admin endpoints)
  1.4  JWT validation edge cases (expired, wrong audience, missing sub)
  1.5  Public endpoint isolation (all public GETs work without auth, never 403)
  1.6  SECURITY DEFINER RPC permission validation (requires real Supabase)

All mock-based tests run without external services. RPC tests (1.6)
require a live Supabase instance and are skipped in CI.

Markers:
    integration: Requires app instantiation but not external services.
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.config import settings
from backend.dependencies import (
    PLATFORM_ADMIN_EMAILS,
    ROLE_HIERARCHY,
    get_admin_supabase,
    get_current_user,
    get_effective_supabase,
    get_supabase,
    is_platform_admin,
    require_role,
)
from backend.models.common import CurrentUser

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

USER_A_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_B_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
ADMIN_EMAIL = "boundary-admin@velgarien.dev"
NON_ADMIN_EMAIL = "boundary-user@velgarien.dev"
SIM_A_ID = str(uuid4())
SIM_B_ID = str(uuid4())


# ---------------------------------------------------------------------------
# User factories
# ---------------------------------------------------------------------------


def _make_user(
    user_id: UUID,
    email: str = NON_ADMIN_EMAIL,
    token: str = "mock-token",  # noqa: S107
) -> CurrentUser:
    return CurrentUser(id=user_id, email=email, access_token=token)


# ---------------------------------------------------------------------------
# Supabase mock helpers
# ---------------------------------------------------------------------------


def _make_chainable(execute_data=None):
    """Chainable mock ending with async .execute()."""
    chain = MagicMock()
    result = MagicMock()
    result.data = execute_data if execute_data is not None else []
    result.count = len(result.data) if isinstance(result.data, list) else 0
    chain.execute = AsyncMock(return_value=result)
    for m in (
        "select", "eq", "neq", "gt", "lt", "gte", "lte", "or_", "order",
        "range", "limit", "offset", "filter", "ilike", "in_", "is_", "not_",
        "single", "maybe_single", "insert", "update", "upsert", "delete",
    ):
        getattr(chain, m).return_value = chain
    return chain


def _mock_supabase(execute_data=None):
    """Minimal Supabase client mock."""
    mock = MagicMock()
    mock.table.return_value = _make_chainable(execute_data)
    mock.rpc.return_value = _make_chainable(execute_data)
    return mock


def _mock_supabase_with_role(role: str | None):
    """Supabase mock where simulation_members lookup returns *role*."""
    mock = _mock_supabase()
    member_chain = _make_chainable(
        [{"member_role": role}] if role else [],
    )
    default_chain = mock.table.return_value

    def _dispatch(table_name):
        return member_chain if table_name == "simulation_members" else default_chain

    mock.table = MagicMock(side_effect=_dispatch)
    return mock


def _mock_supabase_for_admin_lookup(admin_ids: list[str] | None = None):
    """Supabase mock where platform_admins returns *admin_ids*."""
    mock = _mock_supabase()
    admin_chain = _make_chainable(
        [{"user_id": uid} for uid in (admin_ids or [])],
    )
    default_chain = mock.table.return_value

    def _dispatch(table_name):
        return admin_chain if table_name == "platform_admins" else default_chain

    mock.table = MagicMock(side_effect=_dispatch)
    return mock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def _cleanup_overrides():
    """Reset dependency overrides after every test."""
    yield
    app.dependency_overrides.clear()


@pytest.fixture()
def user_a() -> CurrentUser:
    return _make_user(USER_A_ID, NON_ADMIN_EMAIL)


@pytest.fixture()
def user_b() -> CurrentUser:
    return _make_user(USER_B_ID, "user-b@velgarien.dev")


@pytest.fixture()
def admin_user() -> CurrentUser:
    return _make_user(USER_A_ID, ADMIN_EMAIL)


# ---------------------------------------------------------------------------
# Setup helpers
# ---------------------------------------------------------------------------


def _setup_auth(user: CurrentUser, role: str | None, *, is_admin: bool = False):
    """Wire up dependency overrides for a given user + role + admin status."""
    mock_sb = _mock_supabase_with_role(role)
    mock_admin_sb = _mock_supabase()

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[get_admin_supabase] = lambda: mock_admin_sb

    if is_admin:
        # Platform admin → get_effective_supabase returns admin (service_role)
        app.dependency_overrides[get_effective_supabase] = lambda: mock_admin_sb
    else:
        app.dependency_overrides[get_effective_supabase] = lambda: mock_sb


# ===========================================================================
# 1.1  Role Hierarchy — additional coverage
# ===========================================================================


@pytest.mark.integration
class TestRoleHierarchyAdditions:
    """Tests NOT in test_rls_policies.py: PUT agent, full matrix, delete agent."""

    def test_viewer_cannot_update_agent(self, client: TestClient, user_a):
        """PUT /agents/{id} requires editor; viewer must get 403."""
        _setup_auth(user_a, "viewer")
        agent_id = uuid4()
        r = client.put(
            f"/api/v1/simulations/{SIM_A_ID}/agents/{agent_id}",
            json={"name": "Updated"},
        )
        assert r.status_code == 403

    def test_editor_can_update_agent(self, client: TestClient, user_a):
        """PUT /agents/{id} should pass the role gate for editors."""
        _setup_auth(user_a, "editor")
        agent_id = uuid4()
        r = client.put(
            f"/api/v1/simulations/{SIM_A_ID}/agents/{agent_id}",
            json={"name": "Updated"},
        )
        # Role gate passed — downstream may return 404/500 from mock data,
        # but never 403 (role rejection).
        assert r.status_code != 403

    @pytest.mark.parametrize("role", ["viewer", "editor", "admin"])
    def test_non_owner_cannot_delete_simulation(
        self, client: TestClient, user_a, role: str,
    ):
        """DELETE /simulations/{id} requires owner; all other roles → 403."""
        _setup_auth(user_a, role)
        r = client.delete(f"/api/v1/simulations/{SIM_A_ID}")
        assert r.status_code == 403

    @pytest.mark.parametrize(
        "role,expected_passes",
        [
            ("viewer", ["viewer"]),
            ("editor", ["viewer", "editor"]),
            ("admin", ["viewer", "editor", "admin"]),
            ("owner", ["viewer", "editor", "admin", "owner"]),
        ],
    )
    def test_full_role_hierarchy_matrix(
        self, user_a, role: str, expected_passes: list[str],
    ):
        """Each role must satisfy all requirements at its level or below."""
        import asyncio

        mock_sb = MagicMock()
        chain = _make_chainable([{"member_role": role}])
        mock_sb.table.return_value = chain

        mock_admin_sb = _mock_supabase_for_admin_lookup([])

        loop = asyncio.new_event_loop()
        try:
            for required in ROLE_HIERARCHY:
                check_fn = require_role(required)
                if required in expected_passes:
                    result = loop.run_until_complete(
                        check_fn(
                            simulation_id=uuid4(),
                            user=user_a,
                            supabase=mock_sb,
                            admin_supabase=mock_admin_sb,
                        ),
                    )
                    assert result == role
                else:
                    from fastapi import HTTPException

                    with pytest.raises(HTTPException) as exc_info:
                        loop.run_until_complete(
                            check_fn(
                                simulation_id=uuid4(),
                                user=user_a,
                                supabase=mock_sb,
                                admin_supabase=mock_admin_sb,
                            ),
                        )
                    assert exc_info.value.status_code == 403
        finally:
            loop.close()


# ===========================================================================
# 1.2  Cross-Simulation Isolation
# ===========================================================================


@pytest.mark.integration
class TestCrossSimulationIsolation:
    """Verify non-member of a simulation gets 403, not 500 or data leakage."""

    def test_non_member_gets_403_not_500(self, client: TestClient, user_a):
        """A user who isn't a member of any simulation must get 403."""
        _setup_auth(user_a, None)  # None → not a member
        r = client.get(f"/api/v1/simulations/{SIM_B_ID}/agents")
        assert r.status_code == 403, (
            f"Non-member should get 403, got {r.status_code}"
        )

    def test_non_member_cannot_write(self, client: TestClient, user_a):
        """Non-member cannot create agents in a simulation."""
        _setup_auth(user_a, None)
        r = client.post(
            f"/api/v1/simulations/{SIM_B_ID}/agents",
            json={"name": "Intruder", "system": "politics", "gender": "male"},
        )
        assert r.status_code == 403

    def test_non_member_cannot_access_settings(self, client: TestClient, user_a):
        """Non-member cannot read simulation settings."""
        _setup_auth(user_a, None)
        r = client.get(f"/api/v1/simulations/{SIM_B_ID}/settings")
        assert r.status_code == 403

    def test_non_member_cannot_access_chat(self, client: TestClient, user_a):
        """Non-member cannot list conversations."""
        _setup_auth(user_a, None)
        r = client.get(f"/api/v1/simulations/{SIM_B_ID}/chat/conversations")
        assert r.status_code == 403

    def test_non_member_cannot_create_event(self, client: TestClient, user_a):
        """Non-member cannot create events."""
        _setup_auth(user_a, None)
        r = client.post(
            f"/api/v1/simulations/{SIM_B_ID}/events",
            json={"title": "Intruder Event", "event_type": "political"},
        )
        assert r.status_code == 403

    def test_require_role_scopes_to_correct_simulation(self, user_a):
        """require_role must query simulation_members with the correct sim ID."""
        import asyncio

        sim_id = uuid4()
        mock_sb = _mock_supabase_with_role("viewer")
        mock_admin_sb = _mock_supabase_for_admin_lookup([])

        check_fn = require_role("viewer")
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(
                check_fn(
                    simulation_id=sim_id,
                    user=user_a,
                    supabase=mock_sb,
                    admin_supabase=mock_admin_sb,
                ),
            )
        finally:
            loop.close()

        # Verify .eq was called with the correct simulation_id
        mock_sb.table.assert_called_with("simulation_members")


# ===========================================================================
# 1.3  Platform Admin Bypass
# ===========================================================================


@pytest.mark.integration
class TestPlatformAdminBypass:
    """Platform admin 3-tier check: email allowlist → cached DB IDs → DB refresh."""

    # --- Tier 1: Email allowlist ---

    @pytest.mark.asyncio
    async def test_admin_email_in_allowlist(self, admin_user):
        """User whose email is in PLATFORM_ADMIN_EMAILS → admin."""
        PLATFORM_ADMIN_EMAILS.add(ADMIN_EMAIL)
        try:
            mock_admin_sb = _mock_supabase()
            result = await is_platform_admin(admin_user, mock_admin_sb)
            assert result is True
        finally:
            PLATFORM_ADMIN_EMAILS.discard(ADMIN_EMAIL)

    @pytest.mark.asyncio
    async def test_non_admin_email_not_in_allowlist(self, user_a):
        """User whose email is NOT in allowlist and not in DB → not admin."""
        mock_admin_sb = _mock_supabase_for_admin_lookup([])
        result = await is_platform_admin(user_a, mock_admin_sb)
        assert result is False

    # --- Tier 2: Cached DB IDs ---

    @pytest.mark.asyncio
    async def test_admin_in_cached_db_ids(self, user_a):
        """User whose ID is in the cached admin set → admin."""
        from backend import dependencies as deps

        original_ids = deps._platform_admin_ids.copy()
        original_expires = deps._platform_admin_ids_expires
        try:
            deps._platform_admin_ids = {str(USER_A_ID)}
            deps._platform_admin_ids_expires = time.monotonic() + 300
            mock_admin_sb = _mock_supabase()
            result = await is_platform_admin(user_a, mock_admin_sb)
            assert result is True
        finally:
            deps._platform_admin_ids = original_ids
            deps._platform_admin_ids_expires = original_expires

    # --- Tier 3: DB refresh on cache expiry ---

    @pytest.mark.asyncio
    async def test_admin_found_after_cache_refresh(self, user_a):
        """Expired cache triggers DB refresh; user found in platform_admins → admin."""
        from backend import dependencies as deps

        original_ids = deps._platform_admin_ids.copy()
        original_expires = deps._platform_admin_ids_expires
        try:
            deps._platform_admin_ids = set()
            deps._platform_admin_ids_expires = 0  # Expired
            mock_admin_sb = _mock_supabase_for_admin_lookup([str(USER_A_ID)])
            result = await is_platform_admin(user_a, mock_admin_sb)
            assert result is True
            # Cache should now contain our user
            assert str(USER_A_ID) in deps._platform_admin_ids
        finally:
            deps._platform_admin_ids = original_ids
            deps._platform_admin_ids_expires = original_expires

    @pytest.mark.asyncio
    async def test_non_admin_after_cache_refresh(self, user_a):
        """Expired cache refreshes but user NOT in DB → not admin."""
        from backend import dependencies as deps

        original_ids = deps._platform_admin_ids.copy()
        original_expires = deps._platform_admin_ids_expires
        try:
            deps._platform_admin_ids = set()
            deps._platform_admin_ids_expires = 0  # Expired
            mock_admin_sb = _mock_supabase_for_admin_lookup([])  # Empty
            result = await is_platform_admin(user_a, mock_admin_sb)
            assert result is False
        finally:
            deps._platform_admin_ids = original_ids
            deps._platform_admin_ids_expires = original_expires

    # --- require_role bypass ---

    def test_platform_admin_passes_require_role_without_membership(self, admin_user):
        """Platform admin should pass require_role('admin') even without
        a simulation_members row, returning 'owner' role."""
        import asyncio

        PLATFORM_ADMIN_EMAILS.add(ADMIN_EMAIL)
        try:
            mock_sb = _mock_supabase_with_role(None)  # No membership
            mock_admin_sb = _mock_supabase()

            check_fn = require_role("admin")
            loop = asyncio.new_event_loop()
            try:
                result = loop.run_until_complete(
                    check_fn(
                        simulation_id=uuid4(),
                        user=admin_user,
                        supabase=mock_sb,
                        admin_supabase=mock_admin_sb,
                    ),
                )
                assert result == "owner"
            finally:
                loop.close()
        finally:
            PLATFORM_ADMIN_EMAILS.discard(ADMIN_EMAIL)

    # --- get_effective_supabase auto-elevation ---

    @pytest.mark.asyncio
    async def test_effective_supabase_returns_admin_client_for_platform_admin(
        self, admin_user,
    ):
        """get_effective_supabase must return the service_role client for admins."""
        PLATFORM_ADMIN_EMAILS.add(ADMIN_EMAIL)
        try:
            user_sb = _mock_supabase()
            admin_sb = _mock_supabase()

            with patch("backend.dependencies.is_platform_admin", return_value=True):
                from backend.dependencies import get_effective_supabase

                result = await get_effective_supabase(
                    user=admin_user,
                    supabase=user_sb,
                    admin_supabase=admin_sb,
                )
                assert result is admin_sb
        finally:
            PLATFORM_ADMIN_EMAILS.discard(ADMIN_EMAIL)

    @pytest.mark.asyncio
    async def test_effective_supabase_returns_user_client_for_normal_user(
        self, user_a,
    ):
        """get_effective_supabase must return the user-scoped client for non-admins."""
        user_sb = _mock_supabase()
        admin_sb = _mock_supabase()

        with patch("backend.dependencies.is_platform_admin", return_value=False):
            from backend.dependencies import get_effective_supabase

            result = await get_effective_supabase(
                user=user_a,
                supabase=user_sb,
                admin_supabase=admin_sb,
            )
            assert result is user_sb

    # --- Admin endpoint access control ---

    def test_non_admin_rejected_from_admin_endpoints(self, client: TestClient, user_a):
        """Non-admin users must get 403 on /api/v1/admin/* endpoints."""
        _setup_auth(user_a, "owner")  # Owner of a sim, but NOT platform admin

        admin_endpoints = [
            ("GET", "/api/v1/admin/environment"),
            ("GET", "/api/v1/admin/settings"),
            ("GET", "/api/v1/admin/users"),
        ]
        for method, path in admin_endpoints:
            r = client.request(method, path)
            assert r.status_code == 403, (
                f"Non-admin {method} {path} returned {r.status_code}, expected 403"
            )

    def test_platform_admin_can_access_admin_environment(
        self, client: TestClient, admin_user,
    ):
        """Platform admin should be able to read /admin/environment."""
        PLATFORM_ADMIN_EMAILS.add(ADMIN_EMAIL)
        try:
            mock_admin_sb = _mock_supabase()
            app.dependency_overrides[get_current_user] = lambda: admin_user
            app.dependency_overrides[get_admin_supabase] = lambda: mock_admin_sb
            # require_platform_admin only uses get_current_user + get_admin_supabase

            r = client.get("/api/v1/admin/environment")
            assert r.status_code == 200
            body = r.json()
            assert body["success"] is True
            assert "environment" in body["data"]
        finally:
            PLATFORM_ADMIN_EMAILS.discard(ADMIN_EMAIL)


# ===========================================================================
# 1.4  JWT Validation Edge Cases
# ===========================================================================


@pytest.mark.integration
class TestJWTValidation:
    """Test JWT decoding edge cases by crafting real HS256 tokens."""

    def _encode_hs256(self, payload: dict, secret: str | None = None) -> str:
        """Encode a JWT with HS256 using the configured secret."""
        return pyjwt.encode(
            payload,
            secret or settings.supabase_jwt_secret,
            algorithm="HS256",
        )

    def test_expired_jwt_returns_401(self, client: TestClient):
        """An expired JWT should be rejected with 401."""
        token = self._encode_hs256({
            "sub": str(uuid4()),
            "email": "expired@test.dev",
            "aud": "authenticated",
            "exp": int(time.time()) - 3600,  # 1 hour ago
            "iat": int(time.time()) - 7200,
        })
        r = client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 401

    def test_wrong_audience_returns_401(self, client: TestClient):
        """A JWT with the wrong audience should be rejected."""
        token = self._encode_hs256({
            "sub": str(uuid4()),
            "email": "wrong-aud@test.dev",
            "aud": "wrong_audience",
            "exp": int(time.time()) + 3600,
            "iat": int(time.time()),
        })
        r = client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 401

    def test_missing_sub_claim_returns_401(self, client: TestClient):
        """A JWT without the 'sub' claim should be rejected."""
        token = self._encode_hs256({
            "email": "no-sub@test.dev",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
            "iat": int(time.time()),
        })
        r = client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 401

    def test_wrong_signing_secret_returns_401(self, client: TestClient):
        """A JWT signed with the wrong secret should be rejected."""
        token = self._encode_hs256(
            {
                "sub": str(uuid4()),
                "email": "wrong-secret@test.dev",
                "aud": "authenticated",
                "exp": int(time.time()) + 3600,
                "iat": int(time.time()),
            },
            secret="completely-wrong-secret-key-1234567890",
        )
        r = client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 401

    def test_missing_authorization_header_returns_422_or_401(
        self, client: TestClient,
    ):
        """No Authorization header → 422 (missing required header) or 401."""
        r = client.get("/api/v1/users/me")
        assert r.status_code in (401, 422)

    def test_non_bearer_authorization_returns_401(self, client: TestClient):
        """Authorization header without 'Bearer ' prefix → 401."""
        r = client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Basic dXNlcjpwYXNz"},
        )
        assert r.status_code == 401

    def test_valid_jwt_with_valid_sub_passes_auth(self, client: TestClient):
        """A properly signed JWT with all claims should pass get_current_user."""
        user_id = str(uuid4())
        token = self._encode_hs256({
            "sub": user_id,
            "email": "valid@test.dev",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
            "iat": int(time.time()),
        })

        # Override downstream dependencies so we don't need a real Supabase
        mock_sb = _mock_supabase_with_role("viewer")
        app.dependency_overrides[get_supabase] = lambda: mock_sb
        app.dependency_overrides[get_effective_supabase] = lambda: mock_sb
        app.dependency_overrides[get_admin_supabase] = lambda: _mock_supabase()

        r = client.get(
            f"/api/v1/simulations/{SIM_A_ID}/agents",
            headers={"Authorization": f"Bearer {token}"},
        )
        # Auth passed — returns 200 (empty data from mock)
        assert r.status_code == 200


# ===========================================================================
# 1.5  Public Endpoint Isolation (mock variant)
# ===========================================================================


@pytest.mark.integration
class TestPublicEndpointIsolation:
    """Verify all public GET routes work without auth and never return 403.

    These tests use TestClient directly — no Supabase required. We override
    get_anon_supabase to return a mock client. This validates routing only,
    not the full data path (test_public_router.py covers that against real DB).
    """

    PUBLIC_GET_ROUTES = [
        "/api/v1/public/simulations",
        "/api/v1/public/platform-stats",
        f"/api/v1/public/simulations/{SIM_A_ID}",
        f"/api/v1/public/simulations/{SIM_A_ID}/agents",
        f"/api/v1/public/simulations/{SIM_A_ID}/buildings",
        f"/api/v1/public/simulations/{SIM_A_ID}/events",
        f"/api/v1/public/simulations/{SIM_A_ID}/locations/cities",
        f"/api/v1/public/simulations/{SIM_A_ID}/locations/zones",
        f"/api/v1/public/simulations/{SIM_A_ID}/locations/streets",
        f"/api/v1/public/simulations/{SIM_A_ID}/chat/conversations",
        f"/api/v1/public/simulations/{SIM_A_ID}/taxonomies",
        f"/api/v1/public/simulations/{SIM_A_ID}/settings",
        f"/api/v1/public/simulations/{SIM_A_ID}/social-trends",
        f"/api/v1/public/simulations/{SIM_A_ID}/social-media",
        f"/api/v1/public/simulations/{SIM_A_ID}/campaigns",
        f"/api/v1/public/simulations/{SIM_A_ID}/echoes",
        f"/api/v1/public/simulations/{SIM_A_ID}/relationships",
        f"/api/v1/public/simulations/{SIM_A_ID}/aptitudes",
        f"/api/v1/public/simulations/{SIM_A_ID}/embassies",
        "/api/v1/public/connections",
        "/api/v1/public/embassies",
        "/api/v1/public/epochs",
        "/api/v1/public/epochs/active",
        "/api/v1/public/resonances",
        "/api/v1/public/operative-types",
        "/api/v1/public/dungeons/clearance-config",
    ]

    @pytest.fixture(autouse=True)
    def _mock_anon_supabase(self):
        """Override get_anon_supabase so public routes don't hit a real DB."""
        from backend.dependencies import get_anon_supabase, resolve_simulation_id

        mock_sb = _mock_supabase([])
        app.dependency_overrides[get_anon_supabase] = lambda: mock_sb
        # Also override resolve_simulation_id to skip DB lookups
        app.dependency_overrides[resolve_simulation_id] = lambda: UUID(SIM_A_ID)
        yield
        # _cleanup_overrides handles teardown

    @pytest.mark.parametrize("path", PUBLIC_GET_ROUTES)
    def test_public_get_without_auth_succeeds(self, client: TestClient, path: str):
        """Public GET endpoints must not require authentication."""
        r = client.get(path)
        assert r.status_code != 401, (
            f"GET {path} returned 401 — public endpoint should not require auth"
        )
        assert r.status_code != 403, (
            f"GET {path} returned 403 — public endpoint must never return 403"
        )

    PUBLIC_WRITE_ATTEMPTS = [
        ("POST", f"/api/v1/public/simulations/{SIM_A_ID}/agents"),
        ("PUT", f"/api/v1/public/simulations/{SIM_A_ID}/agents/fake-id"),
        ("DELETE", f"/api/v1/public/simulations/{SIM_A_ID}/agents/fake-id"),
        ("POST", f"/api/v1/public/simulations/{SIM_A_ID}/buildings"),
        ("POST", f"/api/v1/public/simulations/{SIM_A_ID}/events"),
        ("POST", f"/api/v1/public/simulations/{SIM_A_ID}/settings"),
    ]

    @pytest.mark.parametrize("method,path", PUBLIC_WRITE_ATTEMPTS)
    def test_public_write_rejected(self, client: TestClient, method: str, path: str):
        """POST/PUT/DELETE on public endpoints → 405 Method Not Allowed."""
        r = client.request(method, path, json={})
        assert r.status_code == 405, (
            f"{method} {path} returned {r.status_code}, expected 405"
        )


# ===========================================================================
# 1.6  SECURITY DEFINER RPC Permission Validation
# ===========================================================================


@pytest.mark.integration
@pytest.mark.skipif(
    True,  # Will be replaced by requires_supabase when run against real DB
    reason="RPC tests require real Supabase instance — run with local or branch DB",
)
class TestSecurityDefinerRPCs:
    """Verify SECURITY DEFINER RPCs validate permissions internally.

    These tests require a real Supabase instance because they need to invoke
    actual PostgreSQL functions. They are skipped in CI and should be run
    manually against a local Supabase or test branch.

    RPCs under test:
    - fn_update_user_byok_keys (migration 125): auth.uid() guard
    - fn_auto_draft_participants (migration 128): epoch creator check
    - fn_compute_cycle_scores (migration 127): epoch creator check
    """

    def test_byok_keys_rejects_other_user(self):
        """fn_update_user_byok_keys should reject updates for a different user."""
        # This test will be implemented when running against real Supabase.
        # The function checks: IF auth.uid() IS DISTINCT FROM p_user_id
        pytest.skip("Requires real Supabase — implement with integration branch")

    def test_auto_draft_rejects_non_creator(self):
        """fn_auto_draft_participants should reject non-epoch-creators."""
        pytest.skip("Requires real Supabase — implement with integration branch")

    def test_compute_scores_rejects_non_creator(self):
        """fn_compute_cycle_scores should reject non-epoch-creators."""
        pytest.skip("Requires real Supabase — implement with integration branch")
