from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import get_current_user
from backend.models.common import CurrentUser
from backend.services import dungeon_content_service as _dcs

MOCK_USER_ID = UUID("11111111-1111-1111-1111-111111111111")
MOCK_USER_EMAIL = "test@velgarien.dev"
MOCK_ADMIN_EMAIL = "admin-test@velgarien.dev"

# Ensure the test admin email is always in the platform admin set,
# regardless of env var configuration (avoids StopIteration in CI).
from backend.dependencies import PLATFORM_ADMIN_EMAILS  # noqa: E402

PLATFORM_ADMIN_EMAILS.add(MOCK_ADMIN_EMAIL)


def _seed_content_cache() -> None:
    """Populate dungeon content cache from YAML packs for tests.

    Called once at session start so all tests see content without touching
    the DB. Reads from `content/dungeon/**/*.yaml` via the content-pack
    loader — the canonical authoring source since A1.4. Runtime cache shape
    is identical to what the DB-backed `load_all_content()` produces.
    """
    if _dcs._content is not None:
        return  # already seeded

    # Local import: the content_packs module pulls in pyyaml + pydantic
    # validators; keep this inside the function so `conftest.py` import
    # stays fast when tests skip the content-cache path.
    from backend.services.content_packs.loader import load_packs_for_tests

    load_packs_for_tests()


# Auto-seed before any test collection
_seed_content_cache()


@pytest.fixture()
def test_app():
    """FastAPI TestClient instance."""
    return TestClient(app)


@pytest.fixture()
def mock_user_token() -> str:
    """A fake JWT token string for testing."""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature"


# Every postgrest builder method the production code chains onto a query.
#
# This list has to be a SUPERSET of what the code under test calls, and the
# failure mode when it is not is nasty: MagicMock invents any missing
# attribute, so `.gte(...)` on an unwired mock silently returns a *different*
# mock instead of the chain. The next `.execute()` is then a plain MagicMock —
# the test dies on `await` with a TypeError that names neither the method nor
# the query, or, worse, asserts against a builder the service never touched.
#
# Regenerate with:
#   grep -rhoE '\.(select|insert|...)\(' backend/services backend/routers backend/utils \
#     | sort -u
CHAIN_METHODS = (
    # writes
    "insert", "update", "upsert", "delete",
    # projection / shaping
    "select", "order", "limit", "offset", "range",
    # filters
    "eq", "neq", "gt", "gte", "lt", "lte",
    "like", "ilike", "is_", "in_", "not_", "or_", "filter", "match",
    "contains", "overlaps",
    # terminators that still return a builder
    "single", "maybe_single",
)


def make_chain_mock(execute_data=None, execute_count=None):
    """Reusable Supabase query chain mock.

    Usage: chain = make_chain_mock(execute_data=[...])
    Every method in CHAIN_METHODS returns the chain; execute() is an AsyncMock
    resolving to a response whose .data / .count carry the arguments.
    """
    c = MagicMock()
    for method in CHAIN_METHODS:
        getattr(c, method).return_value = c
    resp = MagicMock()
    resp.data = execute_data
    resp.count = execute_count
    c.execute = AsyncMock(return_value=resp)
    return c


def make_table_mock(data=None, count=None):
    """A Supabase client mock whose .table()/.rpc() hand back one fluent chain.

    Returns ``(client, chain, response)``. Prefer this over hand-wiring a
    builder inside a test module: a local list of chain methods drifts from
    the code the moment a service starts using one it does not name.
    """
    chain = make_chain_mock(execute_data=data, execute_count=count)
    client = MagicMock()
    client.table.return_value = chain
    client.rpc.return_value = chain
    return client, chain, chain.execute.return_value


def make_async_supabase_mock(execute_data=None):
    """Build a full Supabase mock whose .table()/.rpc() chains return AsyncMock.

    Use as dependency override for get_supabase / get_admin_supabase in tests
    that go through the FastAPI app (TestClient) and hit async service code.
    """
    chain = make_chain_mock(execute_data=execute_data)
    mock_sb = MagicMock()
    mock_sb.table.return_value = chain
    mock_sb.rpc.return_value = chain
    return mock_sb


@pytest.fixture()
def mock_current_user():
    """Patch get_current_user to return a mock user without JWT validation."""
    user = CurrentUser(
        id=MOCK_USER_ID,
        email=MOCK_USER_EMAIL,
        access_token="mock-access-token",
    )

    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(autouse=True)
def _reset_admin_supabase_cache():
    """Drop the process-wide admin-Supabase client cache between tests.

    Why: ``supabase.AsyncClient`` wraps ``httpx.AsyncClient``, whose
    internal async primitives are bound to the event loop where they
    were constructed. Our pytest config uses function-scoped loops
    (``asyncio_default_fixture_loop_scope=function``) — without this
    fixture, a client cached during test N would be attached to a
    dead loop by the time test N+1 runs, raising
    ``RuntimeError: ... attached to a different loop``.

    Synchronous + autouse + function-scoped so it applies universally
    to both async and sync tests. No teardown needed — the NEXT
    test's setup clears again.

    The reset function is a no-op if the cache has never been
    populated (the case for tests that use
    ``app.dependency_overrides[get_admin_supabase]``), so this
    fixture adds essentially zero overhead for the common path.
    """
    from backend.dependencies import reset_platform_admin_cache
    from backend.utils.supabase_admin_cache import reset_admin_supabase_cache

    reset_admin_supabase_cache()
    # Same reasoning one level up: the platform-admin ID set is process-wide
    # with a 5-minute TTL, so without this every test after the first inherits
    # whatever the first one resolved. See reset_platform_admin_cache().
    reset_platform_admin_cache()
    yield


@pytest.fixture()
def route_secdef_admin(monkeypatch):
    """Route migration-258 service_role RPC calls to a test's mock client.

    Since ADR-006 part 2 (migration 258), the privileged SECURITY DEFINER write
    service methods obtain the RPC client via ``get_admin_supabase_client()``
    (service_role) instead of the caller-supplied client, so an authenticated
    user can no longer reach them directly. Unit tests that pass a mock client
    and assert on / depend on ``.rpc()`` must point that getter at their mock —
    otherwise the call falls through to a real service-role client (a live DB
    hit, which fails in CI). Usage: ``route_secdef_admin(sb)`` after ``sb`` is
    configured, before invoking the service method.
    """

    def _route(client):
        for module in (
            "cycle_resolution_service",
            "epoch_participation_service",
            "scoring_service",
            "forge_feature_service",
            "lore_service",
            "forge_orchestrator_service",
        ):
            monkeypatch.setattr(
                f"backend.services.{module}.get_admin_supabase_client",
                AsyncMock(return_value=client),
                raising=False,
            )

    return _route
