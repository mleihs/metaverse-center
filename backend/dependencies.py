import logging
import re
import time
from typing import Annotated
from uuid import UUID

import anyio.to_thread
import jwt as pyjwt
from cachetools import TTLCache
from fastapi import Depends, Header, HTTPException, Path, Query, status
from jwt import PyJWKClient
from supabase_auth.errors import AuthApiError

from backend.config import settings
from backend.models.common import CurrentUser
from backend.services.simulation_service import SimulationService
from backend.utils.db import maybe_single_data
from backend.utils.supabase_admin_cache import get_admin_supabase_client
from backend.utils.supabase_lifecycle import aclose_supabase_client
from supabase import AsyncClient as Client
from supabase import create_async_client

logger = logging.getLogger(__name__)

# Platform admin — configurable via PLATFORM_ADMIN_EMAILS env var (comma-separated)
PLATFORM_ADMIN_EMAILS: set[str] = {
    e.strip() for e in settings.platform_admin_emails.split(",") if e.strip()
}

# Role hierarchy: higher index = more privileges
ROLE_HIERARCHY: dict[str, int] = {
    "viewer": 0,
    "editor": 1,
    "admin": 2,
    "owner": 3,
}

# ── JWKS client ───────────────────────────────────────────────────────────────
# Re-fetch the key set at most once an hour. Supabase rotates signing keys very
# rarely, and every fetch is a hard dependency on a third-party endpoint being
# reachable *right now*.
_JWKS_TTL = 3600
# A JWKS fetch that takes longer than this is broken, not slow. PyJWT's default
# is 30s, which is far outside any request budget: it is long enough to trip the
# container healthcheck and get the whole app pulled out of the load balancer.
_JWKS_TIMEOUT_SECONDS = 5.0


class _ResilientJWKClient(PyJWKClient):
    """JWKS client that keeps serving the last good key set when the endpoint is down.

    PyJWKClient caches the key set for ``lifespan`` seconds and then *must*
    fetch: on expiry ``get_jwk_set`` calls ``fetch_data``, and a connection
    error there propagates. There is no stale-while-error path, so an
    unreachable JWKS endpoint invalidates every authenticated request in the
    system within one cache lifetime — regardless of how long the keys would
    still have been valid.

    Serving a stale key set during an upstream outage is not a security
    trade-off. JWKS keys are public, and an *older* key set can only fail to
    verify newer tokens; it cannot verify a forgery. The alternative — logging
    every user out because a third party is unreachable — is strictly worse.

    Incident 2026-08-28: Supabase's /auth/v1/.well-known/jwks.json stopped
    responding (TLS established, no bytes) while every other endpoint on the
    same host answered in ~100ms. metaverse.center returned 503 platform-wide.
    """

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]
        self._last_good: dict | None = None
        self._last_good_at: float = 0.0

    def fetch_data(self) -> dict:
        try:
            data = super().fetch_data()
        except pyjwt.PyJWKClientConnectionError:
            if self._last_good is None:
                raise
            logger.warning(
                "JWKS endpoint unreachable – verifying against the last known key set (age %.0fs)",
                time.monotonic() - self._last_good_at,
            )
            return self._last_good
        self._last_good = data
        self._last_good_at = time.monotonic()
        return data


_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    """Return the process-wide JWKS client, building it on first use.

    Built ONCE. The previous version recreated the client every hour, which
    threw away its key cache and turned a routine TTL expiry into a mandatory
    network round trip — and, while the endpoint was down, into a hard failure.
    TTL handling belongs to the client (``lifespan``), which keeps the cached
    key set instead of discarding it.
    """
    global _jwks_client  # noqa: PLW0603
    if _jwks_client is None:
        url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = _ResilientJWKClient(
            url,
            headers={"apikey": settings.supabase_anon_key},
            lifespan=_JWKS_TTL,
            cache_keys=True,
            timeout=_JWKS_TIMEOUT_SECONDS,
        )
        logger.info("Initialized JWKS client from %s", url)
    return _jwks_client


# Supabase JWKS keys are asymmetric (ES256 today, RS256 on legacy projects).
# HS* is deliberately absent: a symmetric alg on the JWKS path would let a
# token demote verification to a shared-secret comparison.
_JWKS_ALGORITHMS = ["ES256", "RS256"]


# Failures that mean "this key material does not match this token" — a wrong
# secret, or a token signed with an algorithm this attempt does not allow.
# Everything else (expired, wrong audience, wrong issuer) is a verdict about
# the token itself and must not be retried against other key material.
_KEY_MISMATCH_ERRORS = (pyjwt.DecodeError, pyjwt.InvalidAlgorithmError)


def _decode_hs256(token: str) -> dict:
    """Verify against the shared secret. Never reachable in production."""
    return pyjwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        audience="authenticated",
    )


def _decode_jwks(token: str) -> dict:
    """Verify against the project's published key set, issuer pinned."""
    try:
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)
    except pyjwt.PyJWKClientError as e:
        raise pyjwt.InvalidTokenError(f"No matching JWKS key found: {e}") from e

    return pyjwt.decode(
        token,
        signing_key.key,
        algorithms=_JWKS_ALGORITHMS,
        audience="authenticated",
        issuer=f"{settings.supabase_url}/auth/v1",
    )


def _decode_jwt(token: str) -> dict:
    """Decode a JWT — JWKS only in production, both local modes in development.

    The verification path is chosen by *environment*, never by the token's own
    ``alg`` header: the header is attacker-controlled, and branching on it
    would let a forged HS256 token opt into the shared-secret path in
    production (deep-audit P1-3). That property is unchanged — production takes
    :func:`_decode_jwks` unconditionally, and each attempt below passes its own
    fixed algorithm allowlist, so no token can ever select how it is verified.

    Development and test accept **both** ways a local Supabase legitimately
    signs, because there is no longer one answer. This branch used to assume
    HS256 with the shared secret, which was true when it was written; the
    Supabase CLI has since moved local projects onto the same asymmetric keys
    production uses, and a local stack now publishes an ES256 key at
    ``/auth/v1/.well-known/jwks.json`` and signs with it. Against that, an
    HS256-only branch rejects every real session the local stack issues — the
    backend answers 401, the client treats a 401 as "signed out", and signing
    in appears to do nothing at all.

    Pinning the other single assumption would only move the rot, so both are
    accepted: the shared secret first (a local HMAC, no network, and what the
    test suite mints), then the key set (what a running local stack issues).
    Only a key-material mismatch falls through; an expired or misaddressed
    token is answered by the first attempt, so its error is not replaced by a
    misleading "no matching key".
    """
    if settings.environment not in ("development", "test"):
        return _decode_jwks(token)

    try:
        return _decode_hs256(token)
    except _KEY_MISMATCH_ERRORS:
        return _decode_jwks(token)


async def get_current_user(
    authorization: Annotated[str, Header()],
) -> CurrentUser:
    """Extract and validate the current user from the JWT Bearer token."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected 'Bearer <token>'.",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        # Offloaded to a worker thread: PyJWKClient fetches the key set with a
        # BLOCKING urllib call. Awaiting it on the event loop lets one slow JWKS
        # response stall the entire single-worker ASGI process — including
        # /api/v1/health and every anonymous route. On 2026-08-28 that turned an
        # upstream Supabase hiccup into a platform-wide 503: the healthcheck
        # timed out, the container went unhealthy, and the proxy had no backend
        # left to route to. Signature verification itself is CPU work and
        # belongs off the loop for the same reason.
        payload = await anyio.to_thread.run_sync(_decode_jwt, token)
    except pyjwt.PyJWTError as e:
        logger.warning("JWT decode failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from e

    user_id = payload.get("sub")
    email = payload.get("email", "")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim.",
        )

    return CurrentUser(id=UUID(user_id), email=email, access_token=token)


async def get_supabase(
    user: CurrentUser = Depends(get_current_user),
):
    """Yield a Supabase client authenticated with the user's JWT.

    This ensures RLS policies are applied for the current user.

    A fresh client is required per request (the JWT session is mutated
    below), so it cannot be shared like the admin singleton. It is
    therefore torn down in ``finally`` — supabase-py's ``AsyncClient``
    holds httpx sub-clients whose sockets would otherwise leak until GC,
    exhausting file descriptors under load
    (``OSError: [Errno 24] Too many open files``).
    """
    client = await create_async_client(settings.supabase_url, settings.supabase_anon_key)
    try:
        try:
            await client.auth.set_session(user.access_token, "")
        except AuthApiError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or invalid.",
            ) from e
        yield client
    finally:
        await aclose_supabase_client(client)


async def get_anon_supabase():
    """Yield a Supabase client with the anon key only (no JWT).

    Applies anon RLS policies — used for public read-only endpoints.

    Torn down in ``finally`` for the same reason as ``get_supabase``:
    supabase-py's ``AsyncClient`` holds httpx sub-clients whose sockets
    would otherwise leak until GC, exhausting file descriptors under load
    (``OSError: [Errno 24] Too many open files``). A process-wide anon
    singleton was avoided deliberately — a shared client binds its httpx
    connection pool to one event loop, which is fine in production but
    fragile across the per-test loops in the suite.
    """
    client = await create_async_client(settings.supabase_url, settings.supabase_anon_key)
    try:
        yield client
    finally:
        await aclose_supabase_client(client)


# ── Slug/UUID Resolution ───────────────────────────────────────────────

_SLUG_UUID_CACHE: TTLCache = TTLCache(maxsize=64, ttl=300)
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


async def resolve_simulation_id(
    simulation_id: str = Path(..., description="Simulation UUID or slug"),
    supabase: Client = Depends(get_anon_supabase),
) -> UUID:
    """Accept a simulation UUID or slug and resolve to UUID.

    Uses a 5-minute TTL cache to avoid DB lookups on repeated slug requests.
    UUID values pass through at zero cost (no DB query).
    """
    # Fast path: already a UUID
    if _UUID_RE.match(simulation_id):
        return UUID(simulation_id)

    # Check in-memory cache
    cached = _SLUG_UUID_CACHE.get(simulation_id)
    if cached is not None:
        return cached

    # DB lookup via SimulationService
    sim = await SimulationService.get_by_slug(supabase, simulation_id)
    if not sim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Simulation '{simulation_id}' not found.",
        )
    resolved = UUID(sim["id"])
    _SLUG_UUID_CACHE[simulation_id] = resolved
    return resolved


async def get_admin_supabase() -> Client:
    """Return the process-wide Supabase client with the service role key.

    Bypasses RLS — use sparingly, only for admin operations. Backed by
    a singleton cache in ``backend/utils/supabase_admin_cache.py`` so
    FastAPI Depends injection and inline service-level callers share
    ONE client per process instead of constructing a new
    ``AsyncClient`` (+ httpx subclients) per call.
    """
    return await get_admin_supabase_client()


async def get_effective_supabase(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> Client:
    """Supabase client with automatic RLS bypass for platform admins.

    Returns admin_supabase (service_role) when the user is a platform admin,
    otherwise returns the user-scoped client. Use in routers where platform
    admins may not have simulation membership but need data access.
    """
    if await is_platform_admin(user, admin_supabase):
        return admin_supabase
    return supabase


def require_role(required_role: str):
    """Dependency factory that checks the user has the required role in a simulation.

    Usage:
        @router.put("/simulations/{simulation_id}")
        async def update(
            simulation_id: UUID,
            user: CurrentUser = Depends(get_current_user),
            _role_check = Depends(require_role("admin")),
            supabase: Client = Depends(get_supabase),
        ):
    """

    async def _check_role(
        simulation_id: Annotated[UUID, Path()],
        user: CurrentUser = Depends(get_current_user),
        supabase: Client = Depends(get_supabase),
        admin_supabase: Client = Depends(get_admin_supabase),
    ) -> str:
        """Verify the user has the required role for this simulation."""
        if await is_platform_admin(user, admin_supabase):
            return "owner"

        response = await (
            supabase.table("simulation_members")
            .select("member_role")
            .eq("simulation_id", str(simulation_id))
            .eq("user_id", str(user.id))
            .limit(1)
            .execute()
        )

        member = (
            response.data[0]
            if response and response.data and isinstance(response.data, list)
            else (response.data if response and response.data else None)
        )

        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this simulation.",
            )

        actual_role = member["member_role"]
        required_level = ROLE_HIERARCHY.get(required_role, 0)
        actual_level = ROLE_HIERARCHY.get(actual_role, 0)

        if actual_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{required_role}' role. You have '{actual_role}'.",
            )

        return actual_role

    return _check_role


def require_epoch_creator():
    """Dependency that checks the user created the epoch.

    Requires `epoch_id` as a path parameter.
    """

    async def _check_creator(
        epoch_id: Annotated[UUID, Path()],
        user: CurrentUser = Depends(get_current_user),
        supabase: Client = Depends(get_supabase),
    ) -> None:
        # maybe_single: `.single()` raises on 0 rows, which turned "no such
        # epoch" into a 500 before this guard could answer 404.
        response_data = await maybe_single_data(
            supabase.table("game_epochs")
            .select("created_by_id")
            .eq("id", str(epoch_id))
            .maybe_single()
        )
        if not response_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Epoch not found.",
            )
        if response_data["created_by_id"] != str(user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the epoch creator can perform this action.",
            )

    return _check_creator


# Cached set of platform admin user IDs (refreshed every 5 min)
_platform_admin_ids: set[str] = set()
_platform_admin_ids_expires = 0.0


async def _refresh_platform_admin_ids(admin_supabase: "Client") -> None:
    """Refresh the in-memory cache of platform admin user IDs from DB."""
    global _platform_admin_ids, _platform_admin_ids_expires  # noqa: PLW0603
    resp = await (
        admin_supabase.table("platform_admins")
        .select("user_id")
        .execute()
    )
    _platform_admin_ids = {r["user_id"] for r in (resp.data or [])}
    _platform_admin_ids_expires = time.monotonic() + 300  # 5 min TTL


async def is_platform_admin(user: CurrentUser, admin_supabase: "Client") -> bool:
    """Check if user is a platform admin using the 3-tier pattern.

    Tier 1: Email allowlist (O(1), zero I/O)
    Tier 2: Cached DB admin IDs (O(1), TTL 5min)
    Tier 3: DB refresh on cache expiry (rare, populates cache)
    """
    if user.email in PLATFORM_ADMIN_EMAILS:
        return True
    if str(user.id) in _platform_admin_ids:
        return True
    if time.monotonic() >= _platform_admin_ids_expires:
        await _refresh_platform_admin_ids(admin_supabase)
        if str(user.id) in _platform_admin_ids:
            return True
    return False


def require_platform_admin():
    """Dependency that checks the user is a platform admin.

    Delegates to is_platform_admin() for the 3-tier check.
    """

    async def _check_admin(
        user: CurrentUser = Depends(get_current_user),
        admin_supabase: Client = Depends(get_admin_supabase),
    ) -> CurrentUser:
        if await is_platform_admin(user, admin_supabase):
            return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin access required.",
        )

    return _check_admin


def require_owner_or_platform_admin():
    """Dependency that allows simulation owners OR platform admins.

    Returns a tuple of (user, is_admin) so the caller knows whether to use
    the admin Supabase client for RLS bypass.
    """

    async def _check(
        simulation_id: Annotated[UUID, Path()],
        user: CurrentUser = Depends(get_current_user),
        supabase: Client = Depends(get_supabase),
        admin_supabase: Client = Depends(get_admin_supabase),
    ) -> tuple[CurrentUser, bool]:
        if await is_platform_admin(user, admin_supabase):
            return user, True

        # Otherwise must be an owner member
        response = await (
            supabase.table("simulation_members")
            .select("member_role")
            .eq("simulation_id", str(simulation_id))
            .eq("user_id", str(user.id))
            .limit(1)
            .execute()
        )

        member = (
            response.data[0]
            if response and response.data and isinstance(response.data, list)
            else (response.data if response and response.data else None)
        )

        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this simulation.",
            )

        actual_level = ROLE_HIERARCHY.get(member["member_role"], 0)
        owner_level = ROLE_HIERARCHY.get("owner", 3)

        if actual_level < owner_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires 'owner' role. You have '{member['member_role']}'.",
            )

        return user, False

    return _check


def require_architect():
    """Dependency that checks the user has the 'architect' role in their wallet.

    Platform admins always pass this check.
    """

    async def _check_architect(
        user: CurrentUser = Depends(get_current_user),
        admin_supabase: Client = Depends(get_admin_supabase),
    ) -> CurrentUser:
        if await is_platform_admin(user, admin_supabase):
            return user

        wallet_data = await maybe_single_data(
            admin_supabase.table("user_wallets")
            .select("is_architect")
            .eq("user_id", str(user.id))
            .maybe_single()
        )
        if not wallet_data or not wallet_data.get("is_architect"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Architect privileges required to access the Simulation Forge.",
            )
        return user

    return _check_architect


async def _load_epoch_participant(
    epoch_id: UUID,
    simulation_id: UUID,
    user: CurrentUser,
    supabase: Client,
) -> dict:
    """Fetch the caller's participant row, or raise 403.

    Shared by both `require_epoch_participant` variants so the authorisation
    query has exactly one definition.
    """
    resp = await (
        supabase.table("epoch_participants")
        .select("id, simulation_id, user_id, current_rp")
        .eq("epoch_id", str(epoch_id))
        .eq("simulation_id", str(simulation_id))
        .eq("user_id", str(user.id))
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You are not a participant in this epoch with this simulation.",
        )
    return resp.data[0]


def require_epoch_participant():
    """Dependency that checks the user is a participant in the epoch.

    Requires `epoch_id` as a path parameter and `simulation_id` as a query parameter.
    Returns the participant row dict (id, simulation_id, user_id, current_rp).

    For routes that carry `simulation_id` in the PATH instead, use
    `require_epoch_participant_path()` — FastAPI resolves the parameter source
    from the annotation, so the two cannot share one signature.
    """

    async def _check(
        epoch_id: Annotated[UUID, Path()],
        simulation_id: Annotated[UUID, Query()],
        user: CurrentUser = Depends(get_current_user),
        supabase: Client = Depends(get_supabase),
    ) -> dict:
        return await _load_epoch_participant(epoch_id, simulation_id, user, supabase)

    return _check


def require_epoch_participant_path():
    """Same check as `require_epoch_participant`, for `simulation_id` in the path.

    Used by `/epochs/{epoch_id}/participants/{simulation_id}/draft`, which had
    no authorisation gate at all: the roster write validated that the drafted
    agents belong to the named simulation, but never that the CALLER owns it.
    """

    async def _check(
        epoch_id: Annotated[UUID, Path()],
        simulation_id: Annotated[UUID, Path()],
        user: CurrentUser = Depends(get_current_user),
        supabase: Client = Depends(get_supabase),
    ) -> dict:
        return await _load_epoch_participant(epoch_id, simulation_id, user, supabase)

    return _check


def require_simulation_member(role: str = "viewer", *, param_name: str = "simulation_id"):
    """Dependency that checks the user has a role in a simulation passed as a query param.

    Unlike require_role() which reads simulation_id from the URL path,
    this reads it from a query parameter (used by competitive layer endpoints).
    """
    required_level = ROLE_HIERARCHY.get(role, 0)

    async def _check_member(
        simulation_id: Annotated[UUID, Query(alias=param_name)],
        user: CurrentUser = Depends(get_current_user),
        supabase: Client = Depends(get_supabase),
        admin_supabase: Client = Depends(get_admin_supabase),
    ) -> str:
        if await is_platform_admin(user, admin_supabase):
            return "owner"

        response = await (
            supabase.table("simulation_members")
            .select("member_role")
            .eq("simulation_id", str(simulation_id))
            .eq("user_id", str(user.id))
            .limit(1)
            .execute()
        )
        member = response.data[0] if response.data else None
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this simulation.",
            )
        actual_level = ROLE_HIERARCHY.get(member["member_role"], 0)
        if actual_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{role}' role in this simulation. You have '{member['member_role']}'.",
            )
        return member["member_role"]

    return _check_member
