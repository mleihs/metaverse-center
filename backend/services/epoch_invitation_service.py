"""Service layer for epoch invitation operations."""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status

from backend.config import settings
from backend.services.email_service import EmailService
from backend.services.email_templates import epoch_invitation_subject, render_epoch_invitation
from backend.services.external.openrouter import OpenRouterService
from backend.services.prompt_service import PromptResolver
from backend.utils.errors import not_found, server_error
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class EpochInvitationService:
    """Service for epoch invitation CRUD, lore generation, and email sending."""

    @staticmethod
    async def create_invitation(
        supabase: Client,
        epoch_id: UUID,
        invited_by_id: UUID,
        email: str,
        expires_in_hours: int = 168,
    ) -> dict:
        """Create a new epoch invitation with a unique token."""
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(hours=expires_in_hours)

        response = await (
            supabase.table("epoch_invitations")
            .insert(
                {
                    "epoch_id": str(epoch_id),
                    "invited_email": email,
                    "invite_token": token,
                    "invited_by_id": str(invited_by_id),
                    "expires_at": expires_at.isoformat(),
                }
            )
            .execute()
        )

        if not response.data:
            raise server_error("Failed to create epoch invitation.")
        return response.data[0]

    @staticmethod
    async def create_and_send(
        supabase: Client,
        epoch_id: UUID,
        invited_by_id: UUID,
        email: str,
        expires_in_hours: int,
        base_url: str,
        locale: str = "en",
    ) -> dict:
        """Create invitation, generate lore, fetch epoch name, and send email."""
        lore_text = await EpochInvitationService.generate_lore(supabase, epoch_id)

        invitation = await EpochInvitationService.create_invitation(
            supabase,
            epoch_id,
            invited_by_id,
            email,
            expires_in_hours,
        )

        invite_url = f"{base_url}/epoch/join?token={invitation['invite_token']}"

        # Fetch epoch name for email subject
        epoch_response = await supabase.table("game_epochs").select("name").eq("id", str(epoch_id)).single().execute()
        epoch_name = epoch_response.data["name"] if epoch_response.data else "Unknown"

        email_sent = await EpochInvitationService.send_email(
            epoch_name=epoch_name,
            recipient_email=email,
            lore_text=lore_text,
            invite_url=invite_url,
            locale=locale,
        )
        invitation["email_sent"] = email_sent

        return invitation

    @staticmethod
    async def list_invitations(supabase: Client, epoch_id: UUID) -> list[dict]:
        """List all invitations for an epoch, ordered by creation date."""
        response = await (
            supabase.table("epoch_invitations")
            .select("*")
            .eq("epoch_id", str(epoch_id))
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    @staticmethod
    async def get_by_token(supabase: Client, token: str) -> dict:
        """Validate and return invitation + epoch info by token."""
        response = await (
            supabase.table("epoch_invitations")
            .select("*, game_epochs(name, description, status, config)")
            .eq("invite_token", token)
            .limit(1)
            .execute()
        )

        if not response or not response.data:
            raise not_found(detail="Invalid or expired invitation token.")
        return response.data[0]

    @staticmethod
    async def validate_token(supabase: Client, token: str) -> dict:
        """Validate an invitation token and return structured epoch + expiry info."""
        invitation = await EpochInvitationService.get_by_token(supabase, token)
        epoch_data = invitation.get("game_epochs") or {}

        expires_at_str = invitation.get("expires_at", "")
        is_expired = False
        if expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                is_expired = expires_at < datetime.now(UTC)
            except (ValueError, TypeError):
                pass

        config = epoch_data.get("config") or {}
        return {
            "epoch_name": epoch_data.get("name", "Unknown"),
            "epoch_description": epoch_data.get("description"),
            "epoch_status": epoch_data.get("status", "unknown"),
            "lore_text": config.get("invitation_lore"),
            "expires_at": invitation.get("expires_at"),
            "is_expired": is_expired or invitation.get("status") == "expired",
            "is_accepted": invitation.get("status") == "accepted",
        }

    @staticmethod
    async def revoke_invitation(
        supabase: Client,
        invitation_id: UUID,
    ) -> dict:
        """Revoke an invitation by setting status to 'revoked'."""
        response = await (
            supabase.table("epoch_invitations").update({"status": "revoked"}).eq("id", str(invitation_id)).execute()
        )

        if not response.data:
            raise not_found(detail="Invitation not found.")
        logger.info("Epoch invitation revoked", extra={"invitation_id": str(invitation_id)})
        return response.data[0]

    @staticmethod
    async def mark_accepted(
        supabase: Client,
        token: str,
        user_id: UUID,
    ) -> dict:
        """Mark an invitation as accepted."""
        # Fetch the invitation first
        inv_response = await (
            supabase.table("epoch_invitations")
            .select("*")
            .eq("invite_token", token)
            .eq("status", "pending")
            .limit(1)
            .execute()
        )

        if not inv_response or not inv_response.data:
            raise not_found(detail="Invitation not found or already used.")

        invitation = inv_response.data[0]

        # Check expiry
        expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
        if expires_at < datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This invitation has expired.",
            )

        # Mark accepted
        update_response = await (
            supabase.table("epoch_invitations")
            .update(
                {
                    "status": "accepted",
                    "accepted_at": datetime.now(UTC).isoformat(),
                    "accepted_by_id": str(user_id),
                }
            )
            .eq("id", invitation["id"])
            .execute()
        )

        if not update_response.data:
            raise server_error("Failed to accept invitation.")
        logger.info(
            "Epoch invitation accepted",
            extra={"epoch_id": str(invitation["epoch_id"]), "user_id": str(user_id)},
        )
        return update_response.data[0]

    @staticmethod
    async def generate_lore(supabase: Client, epoch_id: UUID) -> str:
        """Generate invitation lore via OpenRouter. Caches in game_epochs.config.invitation_lore."""
        # Fetch epoch
        epoch_response = await (
            supabase.table("game_epochs").select("name, description, config").eq("id", str(epoch_id)).single().execute()
        )

        if not epoch_response.data:
            raise not_found(detail="Epoch not found.")

        epoch = epoch_response.data
        config = epoch.get("config") or {}

        # Return cached lore if exists
        cached_lore = config.get("invitation_lore")
        if cached_lore:
            return cached_lore

        if settings.forge_mock_mode:
            logger.info("MOCK_MODE: returning mock epoch invitation lore")
            mock_lore = (
                f"The epoch '{epoch.get('name', 'Unknown')}' beckons. "
                "Across the multiverse, factions stir. The Bureau has issued the summons. "
                "Will you answer the call? [MOCK LORE]"
            )
            config["invitation_lore"] = mock_lore
            await supabase.table("game_epochs").update({"config": config}).eq("id", str(epoch_id)).execute()
            return mock_lore

        # Fetch participant names
        participants_response = await (
            supabase.table("epoch_participants")
            .select("simulation_id, simulations(name)")
            .eq("epoch_id", str(epoch_id))
            .execute()
        )
        participant_names = (
            ", ".join(p.get("simulations", {}).get("name", "Unknown") for p in (participants_response.data or []))
            or "None yet"
        )

        # Resolve prompt template
        resolver = PromptResolver(supabase)
        prompt = await resolver.resolve("epoch_invitation_lore", locale="en")

        variables = {
            "epoch_name": epoch.get("name", "Unknown Operation"),
            "epoch_description": epoch.get("description") or "Classified",
            "participant_names": participant_names,
        }
        user_prompt = resolver.fill_template(prompt, variables)
        system_prompt = prompt.system_prompt or ""

        # Generate via OpenRouter
        openrouter = OpenRouterService()
        model = prompt.default_model or "deepseek/deepseek-chat-v3-0324"
        lore_text = await openrouter.generate_with_system(
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=prompt.temperature,
            max_tokens=prompt.max_tokens,
        )

        # Cache in config
        config["invitation_lore"] = lore_text
        await supabase.table("game_epochs").update({"config": config}).eq("id", str(epoch_id)).execute()

        return lore_text

    @staticmethod
    async def regenerate_lore(supabase: Client, epoch_id: UUID) -> str:
        """Force-regenerate lore by clearing cache first."""
        # Clear cached lore
        epoch_response = await supabase.table("game_epochs").select("config").eq("id", str(epoch_id)).single().execute()
        if epoch_response.data:
            config = epoch_response.data.get("config") or {}
            config.pop("invitation_lore", None)
            await supabase.table("game_epochs").update({"config": config}).eq("id", str(epoch_id)).execute()

        return await EpochInvitationService.generate_lore(supabase, epoch_id)

    @staticmethod
    async def send_email(
        epoch_name: str,
        recipient_email: str,
        lore_text: str,
        invite_url: str,
        locale: str = "en",
    ) -> bool:
        """Send invitation email via SMTP."""
        html_body = render_epoch_invitation(
            epoch_name=epoch_name,
            lore_text=lore_text,
            invite_url=invite_url,
            locale=locale,
        )

        subject = epoch_invitation_subject(epoch_name, locale)
        return await EmailService.send(recipient_email, subject, html_body)
