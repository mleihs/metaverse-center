"""Service layer for epoch invitation operations."""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
from fastapi import HTTPException, status

from backend.config import settings
from backend.services.email_templates import render_epoch_invitation
from backend.services.external.openrouter import OpenRouterService
from backend.services.prompt_service import PromptResolver
from supabase import Client

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

        response = (
            supabase.table("epoch_invitations")
            .insert({
                "epoch_id": str(epoch_id),
                "invited_email": email,
                "invite_token": token,
                "invited_by_id": str(invited_by_id),
                "expires_at": expires_at.isoformat(),
            })
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create epoch invitation.",
            )
        return response.data[0]

    @staticmethod
    async def create_and_send(
        supabase: Client,
        epoch_id: UUID,
        invited_by_id: UUID,
        email: str,
        expires_in_hours: int,
        base_url: str,
    ) -> dict:
        """Create invitation, generate lore, fetch epoch name, and send email."""
        lore_text = await EpochInvitationService.generate_lore(supabase, epoch_id)

        invitation = await EpochInvitationService.create_invitation(
            supabase, epoch_id, invited_by_id, email, expires_in_hours,
        )

        invite_url = f"{base_url}/epoch/join?token={invitation['invite_token']}"

        # Fetch epoch name for email subject
        epoch_response = (
            supabase.table("game_epochs")
            .select("name")
            .eq("id", str(epoch_id))
            .single()
            .execute()
        )
        epoch_name = epoch_response.data["name"] if epoch_response.data else "Unknown"

        email_sent = await EpochInvitationService.send_email(
            epoch_name=epoch_name,
            recipient_email=email,
            lore_text=lore_text,
            invite_url=invite_url,
        )
        invitation["email_sent"] = email_sent

        return invitation

    @staticmethod
    async def list_invitations(supabase: Client, epoch_id: UUID) -> list[dict]:
        """List all invitations for an epoch, ordered by creation date."""
        response = (
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
        response = (
            supabase.table("epoch_invitations")
            .select("*, game_epochs(name, description, status, config)")
            .eq("invite_token", token)
            .limit(1)
            .execute()
        )

        if not response or not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid or expired invitation token.",
            )
        return response.data[0]

    @staticmethod
    async def revoke_invitation(
        supabase: Client, invitation_id: UUID,
    ) -> dict:
        """Revoke an invitation by setting status to 'revoked'."""
        response = (
            supabase.table("epoch_invitations")
            .update({"status": "revoked"})
            .eq("id", str(invitation_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found.",
            )
        return response.data[0]

    @staticmethod
    async def mark_accepted(
        supabase: Client, token: str, user_id: UUID,
    ) -> dict:
        """Mark an invitation as accepted."""
        # Fetch the invitation first
        inv_response = (
            supabase.table("epoch_invitations")
            .select("*")
            .eq("invite_token", token)
            .eq("status", "pending")
            .limit(1)
            .execute()
        )

        if not inv_response or not inv_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found or already used.",
            )

        invitation = inv_response.data[0]

        # Check expiry
        expires_at = datetime.fromisoformat(
            invitation["expires_at"].replace("Z", "+00:00")
        )
        if expires_at < datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This invitation has expired.",
            )

        # Mark accepted
        update_response = (
            supabase.table("epoch_invitations")
            .update({
                "status": "accepted",
                "accepted_at": datetime.now(UTC).isoformat(),
                "accepted_by_id": str(user_id),
            })
            .eq("id", invitation["id"])
            .execute()
        )

        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to accept invitation.",
            )
        return update_response.data[0]

    @staticmethod
    async def generate_lore(supabase: Client, epoch_id: UUID) -> str:
        """Generate invitation lore via OpenRouter. Caches in game_epochs.config.invitation_lore."""
        # Fetch epoch
        epoch_response = (
            supabase.table("game_epochs")
            .select("name, description, config")
            .eq("id", str(epoch_id))
            .single()
            .execute()
        )

        if not epoch_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Epoch not found.",
            )

        epoch = epoch_response.data
        config = epoch.get("config") or {}

        # Return cached lore if exists
        cached_lore = config.get("invitation_lore")
        if cached_lore:
            return cached_lore

        # Fetch participant names
        participants_response = (
            supabase.table("epoch_participants")
            .select("simulation_id, simulations(name)")
            .eq("epoch_id", str(epoch_id))
            .execute()
        )
        participant_names = ", ".join(
            p.get("simulations", {}).get("name", "Unknown")
            for p in (participants_response.data or [])
        ) or "None yet"

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
        supabase.table("game_epochs").update({"config": config}).eq(
            "id", str(epoch_id)
        ).execute()

        return lore_text

    @staticmethod
    async def regenerate_lore(supabase: Client, epoch_id: UUID) -> str:
        """Force-regenerate lore by clearing cache first."""
        # Clear cached lore
        epoch_response = (
            supabase.table("game_epochs")
            .select("config")
            .eq("id", str(epoch_id))
            .single()
            .execute()
        )
        if epoch_response.data:
            config = epoch_response.data.get("config") or {}
            config.pop("invitation_lore", None)
            supabase.table("game_epochs").update({"config": config}).eq(
                "id", str(epoch_id)
            ).execute()

        return await EpochInvitationService.generate_lore(supabase, epoch_id)

    @staticmethod
    async def send_email(
        epoch_name: str,
        recipient_email: str,
        lore_text: str,
        invite_url: str,
    ) -> bool:
        """Send invitation email via Resend API."""
        if not settings.resend_api_key:
            logger.warning("Resend API key not configured, skipping email send")
            return False

        html_body = render_epoch_invitation(
            epoch_name=epoch_name,
            lore_text=lore_text,
            invite_url=invite_url,
        )

        payload = {
            "from": "metaverse.center <onboarding@resend.dev>",
            "to": [recipient_email],
            "subject": f"CLASSIFIED: Epoch Summons — {epoch_name}",
            "html": html_body,
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {settings.resend_api_key}",
                        "Content-Type": "application/json",
                    },
                )

            if response.status_code in (200, 201):
                logger.info("Epoch invitation email sent to %s", recipient_email)
                return True

            logger.error(
                "Resend API error %d: %s",
                response.status_code,
                response.text[:200],
            )
            return False

        except (httpx.TimeoutException, httpx.ConnectError) as e:
            logger.error("Failed to send email via Resend: %s", e)
            return False
