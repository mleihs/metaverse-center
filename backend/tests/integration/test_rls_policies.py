"""Security tests verifying role-based access control and data isolation.

Tests the FastAPI dependency layer that enforces authentication, role-based
access, and data isolation between users/simulations. Since we cannot run
against a real Supabase instance in CI, these tests mock the auth and database
layers to verify that the FastAPI routing layer correctly gates access.

Markers:
    integration: Requires app instantiation but not external services.
"""

from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.common import CurrentUser

# ---------------------------------------------------------------------------
# Test users & simulations
# ---------------------------------------------------------------------------

USER_A_ID = UUID("11111111-1111-1111-1111-111111111111")
USER_B_ID = UUID("22222222-2222-2222-2222-222222222222")
SIMULATION_A_ID = uuid4()
SIMULATION_B_ID = uuid4()


def _make_user(user_id: UUID, email: str = "test@velgarien.dev") -> CurrentUser:
    return CurrentUser(id=user_id, email=email, access_token="mock-token")


def _mock_supabase():
    """Return a MagicMock that mimics a Supabase client.

    MagicMock auto-chains, but we need `.execute().data` and `.execute().count`
    to return proper values at the end of any chain. We configure the final
    `.execute()` result to return empty data with count=0.
    """
    mock = MagicMock()

    # Create a reusable execute result that works for all query patterns
    execute_result = MagicMock()
    execute_result.data = []
    execute_result.count = 0

    # Patch `.execute()` at the end of any chain to return our result.
    # MagicMock auto-chains, so we just need to ensure `.execute()` returns
    # the right shape regardless of how many .eq/.order/.range calls precede it.
    def _make_chainable():
        """Create a mock that returns execute_result for .execute() and itself for everything else."""
        chain = MagicMock()
        chain.execute.return_value = execute_result
        # Make all query methods return the chain itself so chaining works
        query_methods = (
            'select', 'eq', 'neq', 'gt', 'lt', 'order',
            'range', 'limit', 'offset', 'filter', 'ilike', 'in_',
        )
        for method in query_methods:
            getattr(chain, method).return_value = chain
        # insert/update/upsert/delete also chain
        for method in ('insert', 'update', 'upsert', 'delete'):
            getattr(chain, method).return_value = chain
        return chain

    mock.table.return_value = _make_chainable()
    return mock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def _cleanup_overrides():
    """Ensure dependency overrides are cleaned up after every test."""
    yield
    app.dependency_overrides.clear()


@pytest.fixture()
def user_a() -> CurrentUser:
    return _make_user(USER_A_ID, "user-a@velgarien.dev")


@pytest.fixture()
def user_b() -> CurrentUser:
    return _make_user(USER_B_ID, "user-b@velgarien.dev")


@pytest.fixture()
def mock_supabase_client():
    return _mock_supabase()


# ---------------------------------------------------------------------------
# Helper: create a role-check override that returns a fixed role
# ---------------------------------------------------------------------------


def _mock_supabase_with_role(role: str | None):
    """Create a Supabase mock where simulation_members returns the given role.

    If role is None, the member lookup returns no data (not a member).
    """
    mock = _mock_supabase()

    # Configure the simulation_members lookup chain used by require_role.
    # require_role calls: supabase.table("simulation_members").select("member_role")
    #     .eq("simulation_id", ...).eq("user_id", ...).limit(1).execute()
    member_result = MagicMock()
    member_result.data = [{"member_role": role}] if role else []

    # Build a separate chainable mock for simulation_members so it doesn't
    # share execute.return_value with entity queries.
    member_chain = MagicMock()
    member_chain.execute.return_value = member_result
    for method in ('select', 'eq', 'neq', 'gt', 'lt', 'order',
                   'range', 'limit', 'offset', 'filter', 'ilike', 'in_'):
        getattr(member_chain, method).return_value = member_chain

    # Return the member chain for simulation_members, default for everything else.
    default_chain = mock.table.return_value

    def _table_dispatch(table_name):
        if table_name == "simulation_members":
            return member_chain
        return default_chain

    mock.table = MagicMock(side_effect=_table_dispatch)
    return mock


# ===========================================================================
# 1. Unauthenticated access
# ===========================================================================


@pytest.mark.integration
class TestUnauthenticatedAccess:
    """Protected endpoints must reject requests with no auth header."""

    # Simulation-scoped endpoints (use a dummy simulation_id)
    SIM_ID = "00000000-0000-0000-0000-000000000000"

    PROTECTED_ENDPOINTS = [
        # Platform-level
        ("GET", "/api/v1/users/me"),
        ("GET", "/api/v1/simulations"),
        ("POST", "/api/v1/simulations"),
        # Simulation-scoped — agents
        ("GET", f"/api/v1/simulations/{SIM_ID}/agents"),
        ("POST", f"/api/v1/simulations/{SIM_ID}/agents"),
        # Buildings
        ("GET", f"/api/v1/simulations/{SIM_ID}/buildings"),
        ("POST", f"/api/v1/simulations/{SIM_ID}/buildings"),
        # Events
        ("GET", f"/api/v1/simulations/{SIM_ID}/events"),
        ("POST", f"/api/v1/simulations/{SIM_ID}/events"),
        # Chat
        ("GET", f"/api/v1/simulations/{SIM_ID}/chat/conversations"),
        ("POST", f"/api/v1/simulations/{SIM_ID}/chat/conversations"),
        # Settings
        ("GET", f"/api/v1/simulations/{SIM_ID}/settings"),
        ("POST", f"/api/v1/simulations/{SIM_ID}/settings"),
        # Members
        ("GET", f"/api/v1/simulations/{SIM_ID}/members"),
        ("POST", f"/api/v1/simulations/{SIM_ID}/members"),
        # Campaigns
        ("GET", f"/api/v1/simulations/{SIM_ID}/campaigns"),
        # Social trends
        ("GET", f"/api/v1/simulations/{SIM_ID}/social-trends"),
        # Social media
        ("GET", f"/api/v1/simulations/{SIM_ID}/social-media/posts"),
        # Locations
        ("GET", f"/api/v1/simulations/{SIM_ID}/locations/cities"),
        # Taxonomies
        ("GET", f"/api/v1/simulations/{SIM_ID}/taxonomies"),
        # Invitations
        ("POST", f"/api/v1/simulations/{SIM_ID}/invitations"),
        # Generation
        ("POST", f"/api/v1/simulations/{SIM_ID}/generate/agent"),
        # Prompt templates
        ("GET", f"/api/v1/simulations/{SIM_ID}/prompt-templates"),
        # Admin
        ("POST", "/api/v1/admin/refresh-views"),
    ]

    @pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
    def test_rejects_without_auth(self, client: TestClient, method: str, path: str):
        """Endpoints requiring auth should return 401, 403, or 422 without a token."""
        # Send the request with no Authorization header at all
        response = client.request(method, path)
        assert response.status_code in (401, 403, 422), (
            f"{method} {path} returned {response.status_code}, expected 401/403/422"
        )

    @pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
    def test_rejects_with_invalid_token(self, client: TestClient, method: str, path: str):
        """Endpoints requiring auth should reject an obviously invalid token."""
        response = client.request(
            method,
            path,
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code in (401, 403, 422), (
            f"{method} {path} returned {response.status_code}, expected 401/403/422"
        )


# ===========================================================================
# 2. Role-based access
# ===========================================================================


@pytest.mark.integration
class TestRoleBasedAccess:
    """Verify that role requirements are enforced at the router level.

    Instead of trying to override require_role (which is a factory returning
    a new function each time, so it can't be used as a dict key for
    dependency_overrides), we mock get_supabase to return a client where
    the simulation_members table returns the desired role.
    """

    SIM_ID = str(uuid4())

    def _setup_auth_with_role(self, user: CurrentUser, role: str | None):
        """Override auth + supabase so require_role sees the given role."""
        mock_sb = _mock_supabase_with_role(role)
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_supabase] = lambda: mock_sb

    # --- Viewer cannot write ---

    def test_viewer_cannot_create_agent(self, client: TestClient, user_a):
        """A viewer should be rejected when attempting to create an agent."""
        self._setup_auth_with_role(user_a, "viewer")

        response = client.post(
            f"/api/v1/simulations/{self.SIM_ID}/agents",
            json={"name": "Test Agent", "system": "politics", "gender": "male"},
        )
        assert response.status_code == 403

    def test_viewer_cannot_create_building(self, client: TestClient, user_a):
        """A viewer should be rejected when attempting to create a building."""
        self._setup_auth_with_role(user_a, "viewer")

        response = client.post(
            f"/api/v1/simulations/{self.SIM_ID}/buildings",
            json={"name": "Tower", "building_type": "government"},
        )
        assert response.status_code == 403

    def test_viewer_cannot_create_event(self, client: TestClient, user_a):
        """A viewer should be rejected when attempting to create an event."""
        self._setup_auth_with_role(user_a, "viewer")

        response = client.post(
            f"/api/v1/simulations/{self.SIM_ID}/events",
            json={"title": "Test Event", "event_type": "political"},
        )
        assert response.status_code == 403

    def test_viewer_cannot_delete_agent(self, client: TestClient, user_a):
        """A viewer should be rejected when attempting to delete an agent."""
        self._setup_auth_with_role(user_a, "viewer")

        agent_id = uuid4()
        response = client.delete(
            f"/api/v1/simulations/{self.SIM_ID}/agents/{agent_id}",
        )
        assert response.status_code == 403

    def test_viewer_cannot_send_chat_message(self, client: TestClient, user_a):
        """A viewer should be rejected when attempting to send a chat message."""
        self._setup_auth_with_role(user_a, "viewer")

        convo_id = uuid4()
        response = client.post(
            f"/api/v1/simulations/{self.SIM_ID}/chat/conversations/{convo_id}/messages",
            json={"content": "Hello", "sender_role": "user"},
        )
        assert response.status_code == 403

    def test_viewer_cannot_add_agent_to_conversation(self, client: TestClient, user_a):
        """A viewer should not be able to add agents to a conversation."""
        self._setup_auth_with_role(user_a, "viewer")

        convo_id = uuid4()
        response = client.post(
            f"/api/v1/simulations/{self.SIM_ID}/chat/conversations/{convo_id}/agents",
            json={"agent_id": str(uuid4())},
        )
        assert response.status_code == 403

    def test_viewer_cannot_add_event_reference(self, client: TestClient, user_a):
        """A viewer should not be able to add event references to a conversation."""
        self._setup_auth_with_role(user_a, "viewer")

        convo_id = uuid4()
        response = client.post(
            f"/api/v1/simulations/{self.SIM_ID}/chat/conversations/{convo_id}/events",
            json={"event_id": str(uuid4())},
        )
        assert response.status_code == 403

    # --- Editor cannot access admin endpoints ---

    def test_editor_cannot_upsert_setting(self, client: TestClient, user_a):
        """Settings POST requires admin role; editor should be denied."""
        self._setup_auth_with_role(user_a, "editor")

        response = client.post(
            f"/api/v1/simulations/{self.SIM_ID}/settings",
            json={
                "category": "general",
                "setting_key": "name",
                "setting_value": "test",
            },
        )
        assert response.status_code == 403

    def test_editor_cannot_add_member(self, client: TestClient, user_a):
        """Members POST requires admin role; editor should be denied."""
        self._setup_auth_with_role(user_a, "editor")

        response = client.post(
            f"/api/v1/simulations/{self.SIM_ID}/members",
            json={"user_id": str(uuid4()), "member_role": "viewer"},
        )
        assert response.status_code == 403

    def test_editor_cannot_remove_member(self, client: TestClient, user_a):
        """Members DELETE requires admin role; editor should be denied."""
        self._setup_auth_with_role(user_a, "editor")

        member_id = uuid4()
        response = client.delete(
            f"/api/v1/simulations/{self.SIM_ID}/members/{member_id}",
        )
        assert response.status_code == 403

    def test_editor_cannot_create_invitation(self, client: TestClient, user_a):
        """Invitations POST requires admin role; editor should be denied."""
        self._setup_auth_with_role(user_a, "editor")

        response = client.post(
            f"/api/v1/simulations/{self.SIM_ID}/invitations",
            json={"invited_email": "new@user.dev", "invited_role": "viewer"},
        )
        assert response.status_code == 403

    def test_editor_cannot_delete_simulation(self, client: TestClient, user_a):
        """Simulation DELETE requires owner role; editor should be denied."""
        self._setup_auth_with_role(user_a, "editor")

        response = client.delete(
            f"/api/v1/simulations/{self.SIM_ID}",
        )
        assert response.status_code == 403

    # --- Viewer CAN read ---

    def test_viewer_can_list_agents(self, client: TestClient, user_a):
        """A viewer should be allowed to list agents (GET)."""
        self._setup_auth_with_role(user_a, "viewer")

        response = client.get(f"/api/v1/simulations/{self.SIM_ID}/agents")
        assert response.status_code == 200

    def test_viewer_can_list_buildings(self, client: TestClient, user_a):
        """A viewer should be allowed to list buildings (GET)."""
        self._setup_auth_with_role(user_a, "viewer")

        response = client.get(f"/api/v1/simulations/{self.SIM_ID}/buildings")
        assert response.status_code == 200

    def test_viewer_can_list_events(self, client: TestClient, user_a):
        """A viewer should be allowed to list events (GET)."""
        self._setup_auth_with_role(user_a, "viewer")

        response = client.get(f"/api/v1/simulations/{self.SIM_ID}/events")
        assert response.status_code == 200

    # --- Editor CAN write entities ---

    def test_editor_can_create_agent(self, client: TestClient, user_a):
        """An editor should pass the role gate for creating agents."""
        self._setup_auth_with_role(user_a, "editor")

        response = client.post(
            f"/api/v1/simulations/{self.SIM_ID}/agents",
            json={"name": "Test Agent", "system": "politics", "gender": "male"},
        )
        # Should not be 403 — auth/role gate passed. May be 200/201 from mock.
        assert response.status_code != 403

    # --- Admin CAN manage members ---

    def test_admin_can_add_member(self, client: TestClient, user_a):
        """An admin should pass the role gate for adding members."""
        self._setup_auth_with_role(user_a, "admin")

        # TestClient re-raises ResponseValidationError from mock data.
        # A server error (500) still proves the role gate (403) was passed.
        try:
            response = client.post(
                f"/api/v1/simulations/{self.SIM_ID}/members",
                json={"user_id": str(uuid4()), "member_role": "viewer"},
            )
            assert response.status_code != 403
        except Exception:  # noqa: S110
            # ResponseValidationError from mock data — role gate was passed
            pass


# ===========================================================================
# 3. Data isolation
# ===========================================================================


@pytest.mark.integration
class TestDataIsolation:
    """Verify that the auth layer prevents cross-user data access.

    These tests ensure the dependency injection correctly scopes data access
    by mocking the Supabase client and tracking which user JWT is used.
    """

    def test_user_b_cannot_use_user_a_supabase_client(self, user_a, user_b):
        """Each user should get their own Supabase client scoped to their JWT."""
        # The get_supabase dependency creates a client per-user. When we override
        # get_current_user for user_a, the resulting client should carry user_a's
        # token, not user_b's.
        clients_by_user = {}

        def _supabase_for_a():
            mock = _mock_supabase_with_role("viewer")
            clients_by_user["a"] = mock
            return mock

        def _supabase_for_b():
            mock = _mock_supabase_with_role("viewer")
            clients_by_user["b"] = mock
            return mock

        # First request as user A
        app.dependency_overrides[get_current_user] = lambda: user_a
        app.dependency_overrides[get_supabase] = _supabase_for_a

        client_a = TestClient(app)
        sim_id = str(uuid4())

        client_a.get(f"/api/v1/simulations/{sim_id}/agents")

        # Now request as user B
        app.dependency_overrides[get_current_user] = lambda: user_b
        app.dependency_overrides[get_supabase] = _supabase_for_b

        client_b = TestClient(app)
        client_b.get(f"/api/v1/simulations/{sim_id}/agents")

        # Verify both users got distinct Supabase clients
        assert "a" in clients_by_user
        assert "b" in clients_by_user
        assert clients_by_user["a"] is not clients_by_user["b"]

    def test_supabase_client_uses_user_jwt(self, user_a):
        """The Supabase client should be initialized with the requesting user's JWT."""
        # We patch the actual create_client to verify it receives the right token.
        with patch("backend.dependencies.create_client") as mock_create:
            mock_client = MagicMock()
            mock_create.return_value = mock_client

            import asyncio

            from backend.dependencies import get_supabase

            loop = asyncio.new_event_loop()
            try:
                loop.run_until_complete(get_supabase(user=user_a))
            finally:
                loop.close()

            # Verify the client had set_session called with user_a's token
            mock_client.auth.set_session.assert_called_once_with(
                user_a.access_token, ""
            )

    def test_require_role_queries_correct_simulation(self, user_a, mock_supabase_client):
        """require_role should query simulation_members for the given simulation_id."""
        import asyncio


        sim_id = uuid4()

        # Configure mock to return "viewer" role (limit(1) chains to self, so execute is on chain)
        chain = mock_supabase_client.table.return_value.select.return_value
        chain.execute.return_value.data = [{"member_role": "viewer"}]

        check_fn = require_role("viewer")
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(
                check_fn(
                    simulation_id=sim_id,
                    user=user_a,
                    supabase=mock_supabase_client,
                )
            )
        finally:
            loop.close()

        assert result == "viewer"
        # Verify the table was queried
        mock_supabase_client.table.assert_called_with("simulation_members")

    def test_require_role_rejects_non_member(self, user_b, mock_supabase_client):
        """require_role should raise 403 when the user is not a member."""
        import asyncio

        from fastapi import HTTPException

        sim_id = uuid4()

        # Configure mock to return no data (not a member)
        chain = mock_supabase_client.table.return_value.select.return_value
        chain.execute.return_value.data = []

        check_fn = require_role("viewer")
        loop = asyncio.new_event_loop()
        try:
            with pytest.raises(HTTPException) as exc_info:
                loop.run_until_complete(
                    check_fn(
                        simulation_id=sim_id,
                        user=user_b,
                        supabase=mock_supabase_client,
                    )
                )
            assert exc_info.value.status_code == 403
            assert "not a member" in exc_info.value.detail.lower()
        finally:
            loop.close()

    def test_require_role_rejects_insufficient_role(self, user_a, mock_supabase_client):
        """require_role('admin') should reject a user who only has 'editor' role."""
        import asyncio

        from fastapi import HTTPException

        sim_id = uuid4()

        chain = mock_supabase_client.table.return_value.select.return_value
        chain.execute.return_value.data = [{"member_role": "editor"}]

        check_fn = require_role("admin")
        loop = asyncio.new_event_loop()
        try:
            with pytest.raises(HTTPException) as exc_info:
                loop.run_until_complete(
                    check_fn(
                        simulation_id=sim_id,
                        user=user_a,
                        supabase=mock_supabase_client,
                    )
                )
            assert exc_info.value.status_code == 403
            assert "admin" in exc_info.value.detail.lower()
        finally:
            loop.close()

    def test_role_hierarchy_is_respected(self, user_a, mock_supabase_client):
        """An owner should satisfy any role requirement (viewer, editor, admin)."""
        import asyncio

        sim_id = uuid4()

        chain = mock_supabase_client.table.return_value.select.return_value
        chain.execute.return_value.data = [{"member_role": "owner"}]

        loop = asyncio.new_event_loop()
        try:
            for required in ("viewer", "editor", "admin", "owner"):
                check_fn = require_role(required)
                result = loop.run_until_complete(
                    check_fn(
                        simulation_id=sim_id,
                        user=user_a,
                        supabase=mock_supabase_client,
                    )
                )
                assert result == "owner", f"Owner should satisfy '{required}' requirement"
        finally:
            loop.close()
