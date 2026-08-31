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


def make_chain_mock(execute_data=None, execute_count=None):
    """Reusable Supabase query chain mock.

    Usage: chain = make_chain_mock(execute_data=[...])
    Supports: .select(), .eq(), .in_(), .lt(), .gt(), .or_(), .order(),
              .limit(), .single(), .maybe_single(), .is_(), .not_(),
              .range(), .insert(), .update(), .delete(), .upsert()
    """
    c = MagicMock()
    for method in (
        "select", "eq", "in_", "lt", "gt", "or_", "order",
        "limit", "single", "maybe_single", "is_", "not_",
        "range", "insert", "update", "delete", "upsert",
    ):
        getattr(c, method).return_value = c
    resp = MagicMock()
    resp.data = execute_data
    resp.count = execute_count
    c.execute = AsyncMock(return_value=resp)
    return c


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
    from backend.utils.supabase_admin_cache import reset_admin_supabase_cache

    reset_admin_supabase_cache()
    yield


@pytest.fixture(autouse=True)
def _reset_platform_admin_id_cache():
    """Kühle den Plattform-Admin-Zwischenspeicher vor jedem Test aus.

    Warum: ``dependencies.is_platform_admin`` hält die Admin-IDs in zwei
    MODULWEITEN Variablen mit 5-Minuten-Frist (``_platform_admin_ids``,
    ``_platform_admin_ids_expires``). Ein Test, der die Frist füllt, schaltet
    für die nächsten fünf Minuten Stufe 3 ab — und damit die einzige Stelle
    im Rollentor, die den Admin-Client überhaupt anfasst.

    Ohne diesen Rücksetzer hängt das Ergebnis eines Tests davon ab, WAS VORHER
    LIEF. Gemessen am 31.08.2026: 26 Fälle in drei Dateien scheiterten allein
    aufgerufen mit ``TypeError: object MagicMock can't be used in 'await'
    expression`` und liefen im vollen Lauf grün — sie überschreiben
    ``get_admin_supabase`` mit einem blanken ``MagicMock``, und im vollen Lauf
    kam der Aufruf nie dort an.

    Ein Test, der nur besteht, weil ein FRÜHERER Test einen globalen Zustand
    gefüllt hat, besteht nicht — er wird übersprungen. Mit kaltem Speicher
    scheitert eine falsche Attrappe immer und sichtbar, statt per Los.

    Dasselbe Muster wie ``_reset_admin_supabase_cache`` direkt darüber, aus
    demselben Grund: synchron, autouse, funktionsweit.
    """
    from backend import dependencies as _deps

    _deps._platform_admin_ids = set()
    _deps._platform_admin_ids_expires = 0.0
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
