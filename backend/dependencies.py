import logging
import time
from typing import Annotated
from uuid import UUID

import jwt as pyjwt
from fastapi import Depends, Header, HTTPException, Path, Query, status
from jwt import PyJWKClient
from supabase_auth.errors import AuthApiError

from backend.config import settings
from backend.models.common import CurrentUser
from supabase import Client, create_client

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

# Cached JWKS client and TTL
_jwks_client: PyJWKClient | None = None
_jwks_fetched_at: float = 0
_JWKS_TTL = 3600  # Re-fetch JWKS keys after 1 hour


def _get_jwks_client() -> PyJWKClient:
    """Get or create a JWKS client with TTL-based cache invalidation."""
    global _jwks_client, _jwks_fetched_at  # noqa: PLW0603
    now = time.monotonic()
    if _jwks_client is None or (now - _jwks_fetched_at) >= _JWKS_TTL:
        url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(url, headers={"apikey": settings.supabase_anon_key})
        _jwks_fetched_at = now
        logger.info("Initialized JWKS client from %s", url)
    return _jwks_client


def _decode_jwt(token: str) -> dict:
    """Decode a JWT using JWKS (ES256) or shared secret (HS256)."""
    header = pyjwt.get_unverified_header(token)
    alg = header.get("alg", "HS256")

    if alg == "HS256":
        return pyjwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )

    # For ES256+, look up the signing key from JWKS
    try:
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)
    except pyjwt.PyJWKClientError as e:
        raise pyjwt.InvalidTokenError(f"No matching JWKS key found: {e}") from e

    return pyjwt.decode(
        token,
        signing_key.key,
        algorithms=[alg],
        audience="authenticated",
    )


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
        payload = _decode_jwt(token)
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
) -> Client:
    """Create a Supabase client authenticated with the user's JWT.

    This ensures RLS policies are applied for the current user.
    """
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    try:
        client.auth.set_session(user.access_token, "")
    except AuthApiError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid.",
        ) from e
    return client


async def get_anon_supabase() -> Client:
    """Create a Supabase client with the anon key only (no JWT).

    Applies anon RLS policies — used for public read-only endpoints.
    """
    return create_client(settings.supabase_url, settings.supabase_anon_key)


async def get_admin_supabase() -> Client:
    """Create a Supabase client with the service role key.

    Use sparingly -- bypasses RLS. Only for admin operations.
    """
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


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
    ) -> str:
        """Verify the user has the required role for this simulation."""
        response = (
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
        response = (
            supabase.table("game_epochs")
            .select("created_by_id")
            .eq("id", str(epoch_id))
            .single()
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Epoch not found.",
            )
        if response.data["created_by_id"] != str(user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the epoch creator can perform this action.",
            )

    return _check_creator


def require_platform_admin():
    """Dependency that checks the user is a platform admin (by email allowlist).

    # TODO: SECURITY — email-based admin checks are fragile.
    # The JWT `email` claim comes from the auth provider and could be spoofed
    # if the provider is misconfigured or if email verification is disabled.
    # Migrate to a `platform_admins` table with user ID lookup:
    #   1. Create `platform_admins` table with `user_id UUID PRIMARY KEY`.
    #   2. Replace email check with a DB lookup by `user.id`.
    #   3. Remove `PLATFORM_ADMIN_EMAILS` config entirely.
    """

    async def _check_admin(
        user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if user.email not in PLATFORM_ADMIN_EMAILS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Platform admin access required.",
            )
        return user

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
    ) -> tuple[CurrentUser, bool]:
        # Platform admin bypasses membership check
        if user.email in PLATFORM_ADMIN_EMAILS:
            return user, True

        # Otherwise must be an owner member
        response = (
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
        if user.email in PLATFORM_ADMIN_EMAILS:
            return user

        wallet_resp = (
            admin_supabase.table("user_wallets")
            .select("is_architect")
            .eq("user_id", str(user.id))
            .maybe_single()
            .execute()
        )
        if not wallet_resp.data or not wallet_resp.data.get("is_architect"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Architect privileges required to access the Simulation Forge.",
            )
        return user

    return _check_architect


def require_epoch_participant():
    """Dependency that checks the user is a participant in the epoch.

    Requires `epoch_id` as a path parameter and `simulation_id` as a query parameter.
    Returns the participant row dict (id, simulation_id, user_id, current_rp).
    """

    async def _check(
        epoch_id: Annotated[UUID, Path()],
        simulation_id: Annotated[UUID, Query()],
        user: CurrentUser = Depends(get_current_user),
        supabase: Client = Depends(get_supabase),
    ) -> dict:
        resp = (
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
    ) -> str:
        response = (
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
