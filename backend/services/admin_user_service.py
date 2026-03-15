"""Service for platform-level user management.

Uses admin (service_role) Supabase client. User listing/detail/deletion
go through SECURITY DEFINER RPC functions (admin_list_users, admin_get_user,
admin_delete_user) because GoTrue admin API requires ES256 tokens not
available in all environments. Membership CRUD uses direct PostgREST.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from supabase import Client

logger = logging.getLogger(__name__)


class AdminUserService:
    """Platform-level user and membership management (admin-only)."""

    @classmethod
    async def list_users(
        cls,
        admin_supabase: Client,
        *,
        page: int = 1,
        per_page: int = 50,
    ) -> dict:
        """List all auth users with pagination via Postgres ``admin_list_users`` (migration 040, updated 057)."""
        response = admin_supabase.rpc(
            "admin_list_users",
            {"p_page": page, "p_per_page": per_page},
        ).execute()
        return response.data or {"users": [], "total": 0}

    @classmethod
    async def get_user_with_memberships(
        cls,
        admin_supabase: Client,
        user_id: UUID,
    ) -> dict:
        """Get a single user with all their simulation memberships."""
        # admin_get_user RPC already LEFT JOINs user_wallets (migration 057)
        # — returns forge_tokens + is_architect as flat fields (null when no wallet)
        user_resp = admin_supabase.rpc(
            "admin_get_user",
            {"p_user_id": str(user_id)},
        ).execute()

        if not user_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User '{user_id}' not found.",
            )

        user_data = user_resp.data

        # Fetch memberships via PostgREST
        memberships_resp = (
            admin_supabase.table("simulation_members")
            .select("*, simulations(id, name, slug)")
            .eq("user_id", str(user_id))
            .execute()
        )
        user_data["memberships"] = memberships_resp.data or []

        # Construct nested wallet object from RPC flat fields (frontend expects AdminUserDetail.wallet)
        ft = user_data.get("forge_tokens")
        ia = user_data.get("is_architect")
        user_data["wallet"] = (
            {"user_id": str(user_id), "forge_tokens": ft or 0, "is_architect": ia or False}
            if ft is not None or ia is not None
            else None
        )

        return user_data

    @classmethod
    async def update_user_wallet(
        cls,
        admin_supabase: Client,
        user_id: UUID,
        forge_tokens: int | None = None,
        is_architect: bool | None = None,
    ) -> dict:
        """Update or create a user's forge wallet."""
        update_data = {}
        if forge_tokens is not None:
            update_data["forge_tokens"] = forge_tokens
        if is_architect is not None:
            update_data["is_architect"] = is_architect

        if not update_data:
            raise HTTPException(status_code=400, detail="No update data provided.")

        response = (
            admin_supabase.table("user_wallets")
            .upsert({
                "user_id": str(user_id),
                **update_data,
                "updated_at": datetime.now(UTC).isoformat(),
            })
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update wallet.")
        return response.data[0]

    @classmethod
    async def delete_user(cls, admin_supabase: Client, user_id: UUID) -> None:
        """Delete a user via Postgres ``admin_delete_user`` (migration 040, rewritten 113). Transfers simulation ownership to admin, nullifies FKs, cascades rest."""
        try:
            admin_supabase.rpc(
                "admin_delete_user",
                {"p_user_id": str(user_id)},
            ).execute()
            logger.info("User deleted", extra={"user_id": str(user_id)})
        except Exception as e:
            logger.warning("User deletion failed", extra={"user_id": str(user_id)}, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User '{user_id}' not found or could not be deleted.",
            ) from e

    @classmethod
    async def add_membership(
        cls,
        admin_supabase: Client,
        user_id: UUID,
        simulation_id: UUID,
        role: str,
    ) -> dict:
        """Add a user to a simulation with a specific role."""
        response = (
            admin_supabase.table("simulation_members")
            .insert({
                "user_id": str(user_id),
                "simulation_id": str(simulation_id),
                "member_role": role,
            })
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to add membership. User may already be a member.",
            )
        return response.data[0]

    @classmethod
    async def change_membership_role(
        cls,
        admin_supabase: Client,
        user_id: UUID,
        simulation_id: UUID,
        role: str,
    ) -> dict:
        """Change a user's role in a simulation."""
        response = (
            admin_supabase.table("simulation_members")
            .update({
                "member_role": role,
                "updated_at": datetime.now(UTC).isoformat(),
            })
            .eq("user_id", str(user_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Membership not found.",
            )
        return response.data[0]

    @classmethod
    async def remove_membership(
        cls,
        admin_supabase: Client,
        user_id: UUID,
        simulation_id: UUID,
    ) -> dict:
        """Remove a user from a simulation."""
        response = (
            admin_supabase.table("simulation_members")
            .delete()
            .eq("user_id", str(user_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Membership not found.",
            )
        return response.data[0]
