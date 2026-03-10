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

from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from supabase import Client

from backend.services.email_service import EmailService
from backend.services.email_templates import (
    render_clearance_denied,
    render_clearance_granted,
    render_clearance_request_admin_notification,
)

logger = logging.getLogger(__name__)


class ForgeAccessService:
    """Forge access request operations."""

    _ADMIN_EMAIL = "matthias.leihs@gmail.com"

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
            response = (
                supabase.table("forge_access_requests")
                .insert(insert_data)
                .execute()
            )
        except APIError as e:
            if "idx_forge_access_one_pending" in str(e) or "duplicate" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="You already have a pending clearance request.",
                ) from e
            raise
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create request.",
            )

        # Notify admin (best-effort, non-blocking)
        if user_email:
            asyncio.create_task(
                cls._send_admin_notification(user_email, message)
            )

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
            await EmailService.send(
                to=cls._ADMIN_EMAIL,
                subject="BUREAU ALERT // NEW CLEARANCE REQUEST",
                html_body=html_body,
            )
            logger.info("Admin clearance notification sent for %s", user_email)
        except Exception:
            logger.exception("Failed to send admin clearance notification")

    @classmethod
    async def get_user_status(
        cls,
        supabase: Client,
        user_id: UUID,
    ) -> dict | None:
        """Get the latest request for a user (RLS enforced)."""
        response = (
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
        """List pending requests with user emails (admin, via view)."""
        response = (
            admin_supabase.table("v_pending_forge_requests")
            .select("*")
            .execute()
        )
        return response.data or []

    @classmethod
    async def get_pending_count(
        cls,
        admin_supabase: Client,
    ) -> int:
        """Count pending requests (admin)."""
        response = (
            admin_supabase.table("forge_access_requests")
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
        rpc_name = (
            "fn_approve_forge_access" if action == "approve"
            else "fn_reject_forge_access"
        )
        try:
            response = admin_supabase.rpc(
                rpc_name,
                {
                    "p_request_id": str(request_id),
                    "p_admin_notes": admin_notes,
                    "p_reviewer_id": str(reviewer_id),
                },
            ).execute()
        except Exception as e:
            detail = str(e)
            if "not found" in detail.lower() or "already reviewed" in detail.lower():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Request not found or already reviewed.",
                ) from e
            raise

        result = response.data
        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Review failed.",
            )

        # Send notification email (best-effort, non-blocking)
        asyncio.create_task(
            cls._send_review_email(result, action, admin_notes)
        )

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

            forge_url = "https://metaverse.center/forge"

            if action == "approve":
                subject_en = "CLASSIFIED // CLEARANCE GRANTED"
                subject_de = "GEHEIM // FREIGABE ERTEILT"
                subject = subject_de if email_locale == "de" else subject_en
                html_body = render_clearance_granted(
                    email_locale=email_locale,
                    forge_url=forge_url,
                    admin_notes=admin_notes,
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
        except Exception:
            logger.exception("Failed to send clearance email")
