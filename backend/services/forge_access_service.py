"""Service for forge access (clearance) request system.

Approval/rejection logic lives in Postgres SECURITY DEFINER functions
(fn_approve_forge_access, fn_reject_forge_access) to keep transactional
tier upgrades and wallet sync atomic. This service orchestrates the RPC
calls and handles notifications.
"""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

import httpx
from postgrest.exceptions import APIError

from backend.config import settings
from backend.services.email_service import EmailService
from backend.services.email_templates import (
    render_clearance_denied,
    render_clearance_granted,
    render_clearance_request_admin_notification,
)
from backend.utils.errors import conflict, not_found, server_error
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class ForgeAccessService:
    """Forge access request operations."""

    @classmethod
    def _get_admin_emails(cls) -> list[str]:
        """Platform admin emails from PLATFORM_ADMIN_EMAILS env var."""
        return [e.strip() for e in settings.platform_admin_emails.split(",") if e.strip()]

    @classmethod
    async def create_request(
        cls,
        supabase: Client,
        user_id: UUID,
        message: str | None = None,
        user_email: str | None = None,
    ) -> dict:
        """Create a clearance upgrade request (RLS enforced)."""
        insert_data: dict = {
            "user_id": str(user_id),
            "requested_tier": "architect",
            "message": message,
        }
        try:
            response = await supabase.table("forge_access_requests").insert(insert_data).execute()
        except APIError as e:
            if "idx_forge_access_one_pending" in str(e) or "duplicate" in str(e).lower():
                raise conflict("You already have a pending clearance request.") from e
            raise
        if not response.data:
            raise server_error("Failed to create request.")

        logger.info("Forge access request created: %s for user %s", response.data[0].get("id"), user_id)

        # Notify admin (best-effort, non-blocking)
        if user_email:
            asyncio.create_task(cls._send_admin_notification(user_email, message))

        return response.data[0]

    @classmethod
    async def _send_admin_notification(
        cls,
        user_email: str,
        message: str | None,
    ) -> None:
        """Send admin notification for new clearance request (best-effort)."""
        try:
            html_body = render_clearance_request_admin_notification(
                user_email=user_email,
                message=message,
            )
            admin_emails = cls._get_admin_emails()
            for admin_email in admin_emails:
                await EmailService.send(
                    to=admin_email,
                    subject="BUREAU ALERT // NEW CLEARANCE REQUEST",
                    html_body=html_body,
                )
            logger.info("Admin clearance notification sent for %s to %d recipients", user_email, len(admin_emails))
        except (OSError, httpx.HTTPError):
            logger.exception("Failed to send admin clearance notification")

    @classmethod
    async def get_user_status(
        cls,
        supabase: Client,
        user_id: UUID,
    ) -> dict | None:
        """Get the latest request for a user (RLS enforced)."""
        response = await (
            supabase.table("forge_access_requests")
            .select("*")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    @classmethod
    async def list_pending(
        cls,
        admin_supabase: Client,
    ) -> list[dict]:
        """List pending requests with user emails (admin).

        Uses ``fn_list_pending_forge_requests`` SECURITY DEFINER RPC
        (migration 134) — service_role only, no PostgREST exposure.
        """
        response = await admin_supabase.rpc("fn_list_pending_forge_requests").execute()
        return response.data or []

    @classmethod
    async def get_pending_count(
        cls,
        admin_supabase: Client,
    ) -> int:
        """Count pending requests (admin)."""
        response = (
            await admin_supabase.table("forge_access_requests")
            .select("id", count="exact")
            .eq("status", "pending")
            .execute()
        )
        return response.count or 0

    @classmethod
    async def review(
        cls,
        admin_supabase: Client,
        request_id: UUID,
        action: str,
        admin_notes: str | None,
        reviewer_id: UUID,
    ) -> dict:
        """Approve or reject a request via Postgres RPC.

        The RPC function handles the transactional wallet upgrade (approve)
        or status update (reject) and returns user email + locale for
        notification.
        """
        rpc_name = "fn_approve_forge_access" if action == "approve" else "fn_reject_forge_access"
        try:
            response = await admin_supabase.rpc(
                rpc_name,
                {
                    "p_request_id": str(request_id),
                    "p_admin_notes": admin_notes,
                    "p_reviewer_id": str(reviewer_id),
                },
            ).execute()
        except (APIError, httpx.HTTPError) as e:
            detail = str(e)
            if "not found" in detail.lower() or "already reviewed" in detail.lower():
                raise not_found(detail="Request not found or already reviewed.") from e
            logger.exception("Forge access review failed for %s", request_id)
            raise server_error("Review failed.") from e

        result = response.data
        if not result:
            raise server_error("Review failed.")

        logger.info("Forge access request %s: %s by %s", action, request_id, reviewer_id)

        # Send notification email (best-effort, non-blocking)
        asyncio.create_task(cls._send_review_email(result, action, admin_notes))

        return result

    @classmethod
    async def _send_review_email(
        cls,
        result: dict,
        action: str,
        admin_notes: str | None,
    ) -> None:
        """Send clearance granted/denied email (best-effort)."""
        try:
            user_email = result.get("user_email")
            email_locale = result.get("email_locale")

            if not user_email:
                logger.warning("No email for user %s, skipping notification", result.get("user_id"))
                return

            forge_url = f"{settings.site_url}/forge"

            if action == "approve":
                subject_en = "CLASSIFIED // CLEARANCE GRANTED"
                subject_de = "GEHEIM // FREIGABE ERTEILT"
                subject = subject_de if email_locale == "de" else subject_en
                tokens_granted = result.get("tokens_granted")
                html_body = render_clearance_granted(
                    email_locale=email_locale,
                    forge_url=forge_url,
                    admin_notes=admin_notes,
                    starter_tokens=tokens_granted,
                )
            else:
                subject_en = "CLASSIFIED // CLEARANCE REVIEW"
                subject_de = "GEHEIM // FREIGABEPRÜFUNG"
                subject = subject_de if email_locale == "de" else subject_en
                html_body = render_clearance_denied(
                    email_locale=email_locale,
                    admin_notes=admin_notes,
                )

            await EmailService.send(
                to=user_email,
                subject=subject,
                html_body=html_body,
            )
            logger.info("Clearance %s email sent to %s", action, user_email)
        except (OSError, httpx.HTTPError):
            logger.exception("Failed to send clearance email")
