"""Process-wide singleton cache for the service-role Supabase client.

# Why this exists

Before this module:
  * ``backend/dependencies.py::get_admin_supabase`` created a fresh
    ``supabase.AsyncClient`` on every call (FastAPI ``Depends`` path).
  * The Bureau Ops Deferral A.2 pattern inlined
    ``await get_admin_supabase()`` into 36+ AI call sites across services,
    meaning every AI call wound up constructing another client.
  * ``backend/services/cache_config.py``,
    ``backend/services/agent_memory_service.py``, and
    ``backend/services/external_service_resolver.py`` each had their own
    parallel ``create_async_client(...)`` call.

Each ``AsyncClient`` construction eagerly builds a ``supabase_auth``
httpx client + registers an auth-state-change listener, and lazily
initialises ``postgrest`` and ``storage3`` httpx clients on first use.
Constructing and tearing down httpx clients per AI call accumulates
TCP/TLS/DNS overhead and file descriptors.

After this module: **one client per process**, reused for the process
lifetime. The FastAPI ``Depends`` path still works — it just gets the
cached instance.

# Thread / async safety

``asyncio.Lock`` with double-checked locking around the lazy-init. The
``create_async_client`` call in ``supabase-py`` 2.x is actually
synchronous in its body (see supabase/supabase-py#798) — the ``async``
marker is a forward-compatibility wrapper — so the critical section is
brief.

# Event-loop affinity (pytest gotcha)

``httpx.AsyncClient`` (wrapped by ``postgrest.AsyncPostgrestClient``,
``storage3.AsyncStorageClient``, etc. inside ``supabase.AsyncClient``)
binds internal async primitives — locks, transports, streams — to the
``asyncio`` event loop where it was constructed. In production
(uvicorn), ONE loop runs for the process lifetime, so the cached
instance is reusable. In ``pytest-asyncio`` with
``asyncio_default_fixture_loop_scope=function`` (our config),
each test owns a fresh loop — a singleton from test N would be
attached to a dead loop by the time test N+1 runs, raising
``RuntimeError: ... is attached to a different loop``.

``reset_admin_supabase_cache()`` is the escape hatch for tests. An
autouse ``conftest.py`` fixture calls it before each test so every
test sees a fresh client bound to its own loop. Production code MUST
NEVER call this function.

# Not a connection pool

This module pools THE CLIENT OBJECT, not database connections. Supabase
connection-pool tuning happens at the Supavisor layer (port 6543,
transaction mode) — see docs/guides/deployment-infrastructure.md.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from backend.config import settings
from supabase import create_async_client

if TYPE_CHECKING:
    from supabase import AsyncClient as Client

_client: Client | None = None
_lock: asyncio.Lock | None = None


async def get_admin_supabase_client() -> Client:
    """Return the process-wide admin Supabase client (service role).

    Lazily initialised on first call. Subsequent calls return the same
    instance. Bypasses RLS — use only for admin / system operations.

    Callers that need the FastAPI ``Depends`` injection path should
    keep using ``backend.dependencies.get_admin_supabase`` (which now
    delegates here). Inline service-code callers can import and await
    this function directly.
    """
    global _client, _lock
    if _client is not None:
        return _client

    # Lazy-create the lock too so the module import has zero
    # asyncio-context dependency (e.g. safe to import during unit
    # tests that never run the event loop).
    if _lock is None:
        _lock = asyncio.Lock()

    async with _lock:
        # Re-check inside the lock — another coroutine may have raced
        # past the outer check between its None-observation and
        # lock acquisition.
        if _client is None:
            _client = await create_async_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )
    return _client


def reset_admin_supabase_cache() -> None:
    """Drop the cached client. TEST-ONLY.

    Production code must never call this — it strands any in-flight
    request holding the old reference, without graceful teardown.
    supabase-py does not currently expose ``aclose()`` on
    ``AsyncClient``, so the previous client is left for the garbage
    collector to eventually tear down (or for process exit).

    Synchronous (not ``async``) so the autouse fixture in
    ``backend/tests/conftest.py`` can run regardless of whether the
    active test is sync or async — the body is just two assignments,
    no event loop needed.
    """
    global _client, _lock
    _client = None
    _lock = None
