"""Service layer for simulation member operations."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class LastOwnerError(Exception):
    """Raised when an operation would leave a simulation without an owner."""


def _check_last_owner_error(exc: Exception) -> None:
    """Raise ``LastOwnerError`` if *exc* originates from the DB trigger."""
    error_msg = str(exc).lower()
    if "last owner" in error_msg or "cannot remove" in error_msg:
        raise LastOwnerError(
            "Cannot modify: this is the last owner of the simulation."
        ) from exc


class MemberService:
    """Simulation member CRUD with last-owner protection."""

    table_name = "simulation_members"

    @classmethod
    async def get_user_memberships(
        cls,
        supabase: Client,
        user_id: UUID,
    ) -> list[dict]:
        """Get all simulation memberships for a user, including simulation names."""
        response = await (
            supabase.table(cls.table_name)
            .select("simulation_id, member_role, simulations(name, slug)")
            .eq("user_id", str(user_id))
            .execute()
        )
        return response.data or []

    @classmethod
    async def list_members(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> list[dict]:
        """List all members of a simulation, owners first."""
        response = await (
            supabase.table(cls.table_name)
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .order("member_role", desc=True)
            .execute()
        )
        return response.data or []

    @classmethod
    async def add(
        cls,
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        member_role: str,
        invited_by_id: UUID,
    ) -> dict:
        """Add a new member to a simulation."""
        response = await (
            supabase.table(cls.table_name)
            .insert({
                "simulation_id": str(simulation_id),
                "user_id": str(user_id),
                "member_role": member_role,
                "invited_by_id": str(invited_by_id),
            })
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add member.",
            )
        logger.info(
            "Member added",
            extra={"user_id": str(user_id), "simulation_id": str(simulation_id), "role": member_role},
        )
        return response.data[0]

    @classmethod
    async def change_role(
        cls,
        supabase: Client,
        simulation_id: UUID,
        member_id: UUID,
        member_role: str,
    ) -> dict:
        """Change a member's role.

        Raises ``LastOwnerError`` if the DB trigger prevents the change.
        """
        try:
            response = await (
                supabase.table(cls.table_name)
                .update({
                    "member_role": member_role,
                    "updated_at": datetime.now(UTC).isoformat(),
                })
                .eq("simulation_id", str(simulation_id))
                .eq("id", str(member_id))
                .execute()
            )
        except Exception as e:
            try:
                _check_last_owner_error(e)
            except LastOwnerError:
                logger.warning(
                    "Last-owner protection triggered on role change",
                    extra={"simulation_id": str(simulation_id), "member_id": str(member_id)},
                )
                raise
            raise

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Member '{member_id}' not found.",
            )
        logger.info(
            "Member role changed",
            extra={"member_id": str(member_id), "simulation_id": str(simulation_id), "new_role": member_role},
        )
        return response.data[0]

    @classmethod
    async def remove(
        cls,
        supabase: Client,
        simulation_id: UUID,
        member_id: UUID,
    ) -> None:
        """Remove a member from a simulation.

        Raises ``LastOwnerError`` if the DB trigger prevents removal.
        """
        try:
            response = await (
                supabase.table(cls.table_name)
                .delete()
                .eq("simulation_id", str(simulation_id))
                .eq("id", str(member_id))
                .execute()
            )
        except Exception as e:
            try:
                _check_last_owner_error(e)
            except LastOwnerError:
                logger.warning(
                    "Last-owner protection triggered on removal",
                    extra={"member_id": str(member_id), "simulation_id": str(simulation_id)},
                )
                raise
            raise

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Member '{member_id}' not found.",
            )
        logger.info("Member removed", extra={"member_id": str(member_id), "simulation_id": str(simulation_id)})
