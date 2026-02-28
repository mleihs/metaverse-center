import logging
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, Header, HTTPException, Path, Query, status
from jose import JWTError, jwt
from supabase_auth.errors import AuthApiError

from backend.config import settings
from backend.models.common import CurrentUser
from supabase import Client, create_client

logger = logging.getLogger(__name__)

# Role hierarchy: higher index = more privileges
ROLE_HIERARCHY: dict[str, int] = {
    "viewer": 0,
    "editor": 1,
    "admin": 2,
    "owner": 3,
}

# Cached JWKS keys (populated on first use)
_jwks_cache: dict | None = None


def _get_jwks() -> dict:
    """Fetch and cache the JWKS from the Supabase Auth server."""
    global _jwks_cache  # noqa: PLW0603
    if _jwks_cache is not None:
        return _jwks_cache
    try:
        url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        resp = httpx.get(url, headers={"apikey": settings.supabase_anon_key}, timeout=5)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        logger.info("Fetched JWKS from %s (%d keys)", url, len(_jwks_cache.get("keys", [])))
    except Exception:
        logger.warning("Could not fetch JWKS, falling back to HS256 only")
        _jwks_cache = {"keys": []}
    return _jwks_cache


def _decode_jwt(token: str) -> dict:
    """Decode a JWT using JWKS (ES256) or shared secret (HS256)."""
    # Read the unverified header to determine algorithm
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "HS256")

    if alg == "HS256":
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )

    # For ES256+, look up the signing key from JWKS
    kid = header.get("kid")
    jwks_data = _get_jwks()
    signing_key = None
    for key_data in jwks_data.get("keys", []):
        if key_data.get("kid") == kid:
            signing_key = key_data
            break

    if not signing_key:
        raise JWTError(f"No matching JWKS key found for kid={kid}")

    return jwt.decode(
        token,
        signing_key,
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
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
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
            detail=f"Session expired or invalid: {e}",
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
