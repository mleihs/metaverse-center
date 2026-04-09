"""Service layer for invitation operations."""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status

from backend.utils.errors import not_found, server_error
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class InvitationService:
    """Service for invitation CRUD operations."""

    @staticmethod
    async def create_invitation(
        supabase: Client,
        simulation_id: UUID,
        invited_by_id: UUID,
        *,
        invited_email: str | None = None,
        invited_role: str = "viewer",
        expires_in_hours: int = 168,
    ) -> dict:
        """Create a new invitation with a unique token."""
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(hours=expires_in_hours)

        response = await (
            supabase.table("simulation_invitations")
            .insert(
                {
                    "simulation_id": str(simulation_id),
                    "invited_email": invited_email,
                    "invite_token": token,
                    "invited_role": invited_role,
                    "invited_by_id": str(invited_by_id),
                    "expires_at": expires_at.isoformat(),
                }
            )
            .execute()
        )

        if not response.data:
            raise server_error("Failed to create invitation.")
        logger.info("Invitation created", extra={"simulation_id": str(simulation_id), "invited_role": invited_role})
        return response.data[0]

    @staticmethod
    async def get_by_token(supabase: Client, token: str) -> dict:
        """Validate and return an invitation by token."""
        response = await (
            supabase.table("simulation_invitations")
            .select("*, simulations(name)")
            .eq("invite_token", token)
            .limit(1)
            .execute()
        )

        if not response or not response.data:
            raise not_found(detail="Invalid or expired invitation token.")
        return response.data[0]

    @staticmethod
    async def accept_invitation(
        supabase: Client,
        token: str,
        user_id: UUID,
    ) -> dict:
        """Accept an invitation — creates a member and marks invitation as accepted."""
        # Fetch invitation
        inv_response = await (
            supabase.table("simulation_invitations")
            .select("*")
            .eq("invite_token", token)
            .is_("accepted_at", "null")
            .limit(1)
            .execute()
        )

        if not inv_response or not inv_response.data:
            raise not_found(detail="Invitation not found or already accepted.")

        invitation = inv_response.data[0]

        # Check expiry
        expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
        if expires_at < datetime.now(UTC):
            logger.info("Expired invitation rejected", extra={"simulation_id": invitation["simulation_id"]})
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This invitation has expired.",
            )

        # Create member
        member_response = await (
            supabase.table("simulation_members")
            .insert(
                {
                    "simulation_id": invitation["simulation_id"],
                    "user_id": str(user_id),
                    "member_role": invitation["invited_role"],
                    "invited_by_id": invitation["invited_by_id"],
                }
            )
            .execute()
        )

        if not member_response.data:
            raise server_error("Failed to create membership.")

        # Mark invitation as accepted
        await (
            supabase.table("simulation_invitations")
            .update(
                {
                    "accepted_at": datetime.now(UTC).isoformat(),
                }
            )
            .eq("id", invitation["id"])
            .execute()
        )

        logger.info(
            "Invitation accepted",
            extra={"simulation_id": invitation["simulation_id"], "user_id": str(user_id)},
        )
        return member_response.data[0]

    @staticmethod
    async def list_invitations(
        supabase: Client,
        simulation_id: UUID,
    ) -> list[dict]:
        """List all invitations for a simulation."""
        response = await (
            supabase.table("simulation_invitations")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []
