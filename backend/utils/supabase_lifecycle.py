"""Best-effort teardown for per-request Supabase ``AsyncClient`` instances.

supabase-py's ``AsyncClient`` exposes no ``aclose()`` (see the docstring
in ``supabase_admin_cache.py``). Each instance instead holds several
httpx sub-clients: an eagerly-created GoTrue ``auth`` client plus
lazily-created ``postgrest`` / ``storage`` / ``functions`` clients. A
dependency that builds a fresh client per request (``get_supabase``,
which needs a per-user JWT and so cannot be shared) MUST close those
sub-clients, or their sockets leak until the garbage collector runs —
exhausting file descriptors under load
(``OSError: [Errno 24] Too many open files``).

Only sub-clients that were actually instantiated are closed: the lazy
ones are read from their private ``_postgrest`` / ``_storage`` /
``_functions`` slots so we never *create* a client just to close it.
Every close is guarded — teardown must never raise into the request
path — and method lookup is duck-typed (``aclose`` or ``close``,
sync or async) so this survives supabase-py minor-version drift.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# auth is eager (created in __init__); the rest are lazy and cached in
# these private slots — None until their public property is first read.
_LAZY_SLOTS = ("_postgrest", "_storage", "_functions")


async def aclose_supabase_client(client: Client) -> None:
    """Close every instantiated httpx sub-client of a per-request client."""
    auth = getattr(client, "auth", None)
    if auth is not None:
        await _try_close(auth)

    for slot in _LAZY_SLOTS:
        sub = getattr(client, slot, None)
        if sub is not None:
            await _try_close(sub)


async def _try_close(obj: object) -> None:
    # Prefer the sub-client's own close method (postgrest exposes
    # ``aclose``, GoTrue exposes ``close``). Some clients — notably
    # storage3 in supabase-py 2.25 — surface no close method at all and
    # instead hold their httpx client as ``.session``; close that
    # directly so its sockets are released too.
    closer = getattr(obj, "aclose", None) or getattr(obj, "close", None)
    if closer is None:
        session = getattr(obj, "session", None)
        closer = getattr(session, "aclose", None) if session is not None else None
    if closer is None:
        return
    try:
        result = closer()
        if hasattr(result, "__await__"):
            await result
    except Exception:  # noqa: BLE001 — teardown must never break the request
        logger.debug(
            "Failed to close Supabase sub-client %r", type(obj), exc_info=True
        )
