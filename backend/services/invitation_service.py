"""Service layer for invitation operations."""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.config import settings
from backend.services.email_service import EmailService, MailRecord
from backend.services.email_templates import (
    render_simulation_invitation,
    simulation_invitation_subject,
)
from backend.utils.db import maybe_single_data
from backend.utils.errors import gone, not_found, server_error
from backend.utils.locale_fields import localized_field
from backend.utils.responses import extract_list
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
        inviter_label: str | None = None,
        email_locale: str | None = None,
    ) -> dict:
        """Create a new invitation with a unique token, and tell the invitee."""
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

        invitation = response.data[0]
        logger.info("Invitation created", extra={"simulation_id": str(simulation_id), "invited_role": invited_role})

        # Until now the service stopped here: the address and the token were
        # stored and nobody was told (finding E3). The invitation existed only
        # in a table, so the invited person could not act on it and the inviter
        # had no way to notice.
        invitation["email_sent"] = await InvitationService._send_invitation_email(
            supabase, invitation, inviter_label=inviter_label, email_locale=email_locale
        )
        return invitation

    @staticmethod
    async def _send_invitation_email(
        supabase: Client,
        invitation: dict,
        *,
        inviter_label: str | None,
        email_locale: str | None,
    ) -> bool:
        """Send the invitation mail. Best-effort: the row is the deliverable.

        A mail failure must not undo a created invitation — the token is valid
        either way and the inviter can copy the link. The result is returned so
        the caller can say whether it went out instead of implying that it did.
        """
        recipient = invitation.get("invited_email")
        if not recipient:
            # A link-only invitation: no address was given, so there is nobody
            # to write to. Not a failure.
            return False

        try:
            simulation = await maybe_single_data(
                supabase.table("simulations")
                .select("name, name_de")
                .eq("id", invitation["simulation_id"])
                .maybe_single()
            )
            simulation_name = localized_field(simulation, "name", email_locale) or "a simulation"
            invite_url = f"{settings.site_url}/invitations/{invitation['invite_token']}"

            html_body = render_simulation_invitation(
                simulation_name=simulation_name,
                inviter=inviter_label or "A member",
                invite_url=invite_url,
                invited_role=invitation.get("invited_role", "viewer"),
                expires_at=invitation.get("expires_at"),
                email_locale=email_locale,
            )
            subject = simulation_invitation_subject(simulation_name, inviter_label or "A member", email_locale)
            return await EmailService.send(
                recipient,
                subject,
                html_body,
                record=MailRecord(
                    template="simulation_invitation",
                    simulation_id=str(invitation["simulation_id"]),
                ),
            )
        except (PostgrestAPIError, httpx.HTTPError, OSError, KeyError, TypeError, ValueError):
            logger.warning(
                "Invitation email failed – the invitation itself stands",
                extra={"simulation_id": invitation.get("simulation_id")},
                exc_info=True,
            )
            sentry_sdk.capture_exception()
            return False

    @staticmethod
    async def get_by_token(supabase: Client, token: str) -> dict:
        """Validate and return an invitation by token."""
        response = await (
            supabase.table("simulation_invitations")
            .select("*, simulations(name, name_de)")
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
        # Fetch invitation — consumer uses id, expires_at, simulation_id,
        # invited_role, invited_by_id only.
        inv_response = await (
            supabase.table("simulation_invitations")
            .select("id, expires_at, simulation_id, invited_role, invited_by_id")
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
            raise gone("This invitation has expired.")

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
        return extract_list(response)
