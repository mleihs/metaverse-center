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

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.email_service import EmailService, MailRecord
from backend.services.email_templates import _nt, render_account_deleted
from backend.utils.db import maybe_single_data
from backend.utils.errors import bad_request, not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

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
        response = await admin_supabase.rpc(
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
        user_resp = await admin_supabase.rpc(
            "admin_get_user",
            {"p_user_id": str(user_id)},
        ).execute()

        if not user_resp.data:
            raise not_found(detail=f"User '{user_id}' not found.")

        user_data = user_resp.data

        # Fetch memberships via PostgREST
        memberships_resp = await (
            admin_supabase.table("simulation_members")
            .select("*, simulations(id, name, name_de, slug)")
            .eq("user_id", str(user_id))
            .execute()
        )
        user_data["memberships"] = extract_list(memberships_resp)

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
            raise bad_request("No update data provided.")

        response = await (
            admin_supabase.table("user_wallets")
            .upsert(
                {
                    "user_id": str(user_id),
                    **update_data,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            )
            .execute()
        )
        if not response.data:
            raise server_error("Failed to update wallet.")
        return response.data[0]

    @classmethod
    async def delete_user(cls, admin_supabase: Client, user_id: UUID) -> None:
        """Delete a user via Postgres ``admin_delete_user`` (migration 040, rewritten 113).

        Transfers simulation ownership to admin, nullifies FKs, cascades rest.

        Sends the confirmation the GDPR expects (Handoff P2.23). The order is
        the whole difficulty: `admin_delete_user` removes the auth record too,
        so **the address and the world count have to be read before the RPC** —
        afterwards there is nobody left to ask. What is gathered first is used
        only if the deletion actually succeeds.
        """
        contact = await cls._deletion_contact(admin_supabase, user_id)

        try:
            await admin_supabase.rpc(
                "admin_delete_user",
                {"p_user_id": str(user_id)},
            ).execute()
            logger.info("User deleted", extra={"user_id": str(user_id)})
        except (PostgrestAPIError, httpx.HTTPError) as e:
            logger.warning("User deletion failed", extra={"user_id": str(user_id)}, exc_info=True)
            raise not_found(detail=f"User '{user_id}' not found or could not be deleted.") from e

        await cls._send_deletion_confirmation(admin_supabase, user_id, contact)

    @classmethod
    async def _deletion_contact(cls, admin_supabase: Client, user_id: UUID) -> dict | None:
        """Address, locale and world count — read BEFORE the account is gone."""
        try:
            profile = await maybe_single_data(
                admin_supabase.table("user_profiles")
                .select("email")
                .eq("id", str(user_id))
                .maybe_single()
            )
            email = (profile or {}).get("email")
            if not email:
                return None

            prefs = await maybe_single_data(
                admin_supabase.table("notification_preferences")
                .select("email_locale")
                .eq("user_id", str(user_id))
                .maybe_single()
            )
            worlds = await (
                admin_supabase.table("simulations")
                .select("id", count="exact")
                .eq("created_by_id", str(user_id))
                .is_("deleted_at", "null")
                .execute()
            )
            return {
                "email": email,
                "email_locale": (prefs or {}).get("email_locale") or "en",
                "worlds": worlds.count or 0,
            }
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            # A deletion must never fail because the confirmation could not be
            # prepared. The right to be forgotten outranks the receipt.
            logger.exception(
                "Could not gather the deletion contact", extra={"user_id": str(user_id)}
            )
            return None

    @classmethod
    async def _send_deletion_confirmation(
        cls, admin_supabase: Client, user_id: UUID, contact: dict | None
    ) -> None:
        """Best-effort: the account is already gone, the mail must not undo that."""
        if not contact:
            logger.warning(
                "Account deleted without a confirmation – no address on file",
                extra={"user_id": str(user_id)},
            )
            return
        try:
            await EmailService.send(
                contact["email"],
                _nt("deleted_subject", contact["email_locale"]),
                render_account_deleted(
                    email_locale=contact["email_locale"],
                    worlds_transferred=contact["worlds"],
                ),
                record=MailRecord(template="account_deleted", user_id=str(user_id)),
            )
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.exception(
                "Deletion confirmation could not be sent", extra={"user_id": str(user_id)}
            )
            sentry_sdk.capture_exception()

    @classmethod
    async def add_membership(
        cls,
        admin_supabase: Client,
        user_id: UUID,
        simulation_id: UUID,
        role: str,
    ) -> dict:
        """Add a user to a simulation with a specific role."""
        response = await (
            admin_supabase.table("simulation_members")
            .insert(
                {
                    "user_id": str(user_id),
                    "simulation_id": str(simulation_id),
                    "member_role": role,
                }
            )
            .execute()
        )
        if not response.data:
            raise bad_request("Failed to add membership. User may already be a member.")
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
        response = await (
            admin_supabase.table("simulation_members")
            .update(
                {
                    "member_role": role,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            )
            .eq("user_id", str(user_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if not response.data:
            raise not_found(detail="Membership not found.")
        return response.data[0]

    @classmethod
    async def remove_membership(
        cls,
        admin_supabase: Client,
        user_id: UUID,
        simulation_id: UUID,
    ) -> dict:
        """Remove a user from a simulation."""
        response = await (
            admin_supabase.table("simulation_members")
            .delete()
            .eq("user_id", str(user_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if not response.data:
            raise not_found(detail="Membership not found.")
        return response.data[0]
