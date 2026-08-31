"""Service layer for epoch invitation operations."""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
import sentry_sdk
from fastapi import HTTPException
from postgrest.exceptions import APIError as PostgrestAPIError
from pydantic_ai.exceptions import ModelAPIError

from backend.config import settings
from backend.dependencies import get_admin_supabase
from backend.services.email_service import EmailService, MailRecord
from backend.services.email_templates import epoch_invitation_subject, render_epoch_invitation
from backend.services.external.openrouter import BudgetContext, OpenRouterError, OpenRouterService
from backend.services.platform_model_config import get_platform_model
from backend.services.prompt_service import PromptResolver
from backend.utils.db import maybe_single_data
from backend.utils.errors import gone, not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Stand-in when the lore model cannot be reached. Deliberately written, not
# generated: an invitation without a line of welcome still has to read like one.
_LORE_FALLBACK = {
    "en": (
        "The Bureau has issued the summons. Across the multiverse, factions stir "
        "and ledgers are opened. Your seat at the table is held \u2014 for now."
    ),
    "de": (
        "Das B\u00fcro hat die Vorladung ausgestellt. Quer durch das Multiversum "
        "regen sich die Fraktionen, und die B\u00fccher werden aufgeschlagen. "
        "Ihr Platz an diesem Tisch ist reserviert \u2014 vorerst."
    ),
}


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
        """Create invitation, generate lore, fetch epoch name, and send email.

        Order matters (E12). The lore call used to come FIRST and without any
        handler: the first invitation of an epoch needs a model round-trip, and
        a model outage turned the whole request into a 500 — no invitation row,
        no token, no mail, and nothing to retry from. The invitation is the
        thing being created; the lore is decoration on it.
        """
        invitation = await EpochInvitationService.create_invitation(
            supabase,
            epoch_id,
            invited_by_id,
            email,
            expires_in_hours,
        )

        lore_text = await EpochInvitationService._lore_or_fallback(supabase, epoch_id, locale)

        invite_url = f"{base_url}/epoch/join?token={invitation['invite_token']}"

        # Name AND cycle length: the invitation states "N-hour cycles" in its
        # mission parameters, and that sentence was hard-wired to 8 — a 24-hour
        # epoch invited people to something it is not (E9).
        epoch_response = await (
            supabase.table("game_epochs").select("name, config").eq("id", str(epoch_id)).single().execute()
        )
        epoch_row = epoch_response.data or {}
        epoch_name = epoch_row.get("name") or "Unknown"
        cycle_hours = int((epoch_row.get("config") or {}).get("cycle_hours", 8))

        email_sent = await EpochInvitationService.send_email(
            epoch_name=epoch_name,
            recipient_email=email,
            lore_text=lore_text,
            invite_url=invite_url,
            locale=locale,
            cycle_hours=cycle_hours,
            epoch_id=epoch_id,
        )
        invitation["email_sent"] = email_sent

        return invitation

    @staticmethod
    async def _lore_or_fallback(supabase: Client, epoch_id: UUID, locale: str) -> str:
        """Invitation lore, or a written stand-in when the model cannot be reached.

        ``generate_lore`` keeps raising for its other caller — ``regenerate_lore``
        is an explicit admin action and a silent fallback there would look like a
        successful regeneration. Only the send path degrades.

        The tuple names ``OpenRouterError`` itself, not its three subclasses:
        ``openrouter.py`` raises the BASE class for an API error, for a failed
        connection and for exhausted retries, so a handler that lists only
        ``RateLimitError`` and ``ModelUnavailableError`` looks careful and misses
        the common cases.
        """
        try:
            return await EpochInvitationService.generate_lore(supabase, epoch_id)
        except (
            OpenRouterError,
            ModelAPIError,
            httpx.HTTPError,
            PostgrestAPIError,
            HTTPException,
            KeyError,
            TypeError,
            ValueError,
        ):
            logger.warning(
                "Invitation lore unavailable — sending the invitation without it",
                extra={"epoch_id": str(epoch_id)},
                exc_info=True,
            )
            sentry_sdk.capture_exception()
            return _LORE_FALLBACK.get(locale, _LORE_FALLBACK["en"])

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
        return extract_list(response)

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
        # Fetch the invitation first — only expires_at + epoch_id consumed
        inv_response = await (
            supabase.table("epoch_invitations")
            .select("id, expires_at, epoch_id")
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
            raise gone("This invitation has expired.")

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
        epoch = await maybe_single_data(
            supabase.table("game_epochs").select("name, description, config").eq("id", str(epoch_id)).maybe_single()
        )

        if not epoch:
            raise not_found(detail="Epoch not found.")
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
            ", ".join(p.get("simulations", {}).get("name", "Unknown") for p in (extract_list(participants_response)))
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
        system_prompt = resolver.fill_system_prompt(prompt, variables)

        # Generate via OpenRouter
        openrouter = OpenRouterService()
        # The DB prompt may pin its own model; otherwise the configured default
        # (Admin > Models) decides. It used to fall back to a literal, which meant
        # this one path silently ignored the platform setting.
        model = prompt.default_model or get_platform_model("default")
        # Bureau Ops Deferral A.2 — epoch lore is cached per-epoch; no
        # simulation_id or user_id in scope (epoch_id is not a budget axis).
        # Global + purpose enforcement only. The cache above guarantees at
        # most 1 LLM call per epoch regardless of invitee volume.
        admin_supabase = await get_admin_supabase()
        budget = BudgetContext(
            admin_supabase=admin_supabase,
            purpose="epoch_invitation_lore",
        )
        lore_text = await openrouter.generate_with_system(
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=prompt.temperature,
            max_tokens=prompt.max_tokens,
            budget=budget,
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
        *,
        cycle_hours: int = 8,
        epoch_id: UUID | None = None,
    ) -> bool:
        """Send invitation email.

        ``locale`` reaches the renderer as ``email_locale`` now. It used to be
        passed to a positional parameter of the same name that nothing read, so
        the invitee's language choice was collected, stored and ignored (E9).
        """
        html_body = render_epoch_invitation(
            epoch_name=epoch_name,
            lore_text=lore_text,
            invite_url=invite_url,
            email_locale=locale,
            cycle_hours=cycle_hours,
        )

        subject = epoch_invitation_subject(epoch_name, locale)
        return await EmailService.send(
            recipient_email,
            subject,
            html_body,
            record=MailRecord(template="epoch_invitation", epoch_id=str(epoch_id) if epoch_id else None),
        )
