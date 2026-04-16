"""Service for managing Simulation Forge drafts."""

from __future__ import annotations

import logging
from uuid import UUID

import httpx
import sentry_sdk
from fastapi import HTTPException, status
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.models.forge import ForgeDraftCreate, ForgeDraftUpdate
from backend.utils.db import maybe_single_data
from backend.utils.encryption import decrypt, encrypt
from backend.utils.errors import not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class ForgeDraftService:
    """Service layer for forge draft operations."""

    # Forge state machine: current_phase → set of legal next phases.
    # Terminal states ('completed') have no outgoing edges; 'failed' can
    # restart from 'astrolabe'.
    VALID_PHASE_TRANSITIONS: dict[str, set[str]] = {
        "astrolabe": {"drafting"},
        "drafting": {"darkroom", "astrolabe"},
        "darkroom": {"ignition", "drafting"},
        "ignition": {"completed", "failed", "darkroom"},
        "completed": set(),
        "failed": {"astrolabe"},
    }

    @staticmethod
    def validate_draft_update(data: ForgeDraftUpdate, *, current_phase: str = "astrolabe") -> None:
        """Enforce forge draft business rules before persisting.

        Raises ``HTTPException(422)`` when:
        - A client attempts to set *status* to ``'completed'`` directly
          (only the ignition pipeline may do this).
        - A *current_phase* transition violates the forge state machine.
        """
        if data.status == "completed":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Status 'completed' can only be set by the ignition process.",
            )

        if data.current_phase is not None:
            allowed = ForgeDraftService.VALID_PHASE_TRANSITIONS.get(current_phase, set())
            if data.current_phase not in allowed:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Cannot transition from '{current_phase}' to '{data.current_phase}'.",
                )

    @staticmethod
    async def list_drafts(
        supabase: Client,
        user_id: UUID,
        limit: int = 10,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List forge drafts for a user."""
        response = await (
            supabase.table("forge_drafts")
            .select("*", count="exact")
            .eq("user_id", str(user_id))
            .order("updated_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return extract_list(response), response.count or 0

    @staticmethod
    async def get_draft(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
    ) -> dict:
        """Get a single draft by ID."""
        response = await (
            supabase.table("forge_drafts")
            .select("*")
            .eq("id", str(draft_id))
            .eq("user_id", str(user_id))
            .single()
            .execute()
        )
        if not response.data:
            raise not_found("forge_draft", draft_id)
        return response.data

    @staticmethod
    async def create_draft(
        supabase: Client,
        user_id: UUID,
        data: ForgeDraftCreate,
    ) -> dict:
        """Initialize a new forge draft.

        Note: Architect permission is enforced by the ``require_architect()``
        dependency in the router layer — no duplicate check needed here.
        """
        insert_data = {
            "user_id": str(user_id),
            "seed_prompt": data.seed_prompt,
            "current_phase": "astrolabe",
            "status": "draft",
        }
        response = await supabase.table("forge_drafts").insert(insert_data).execute()
        if not response.data:
            raise server_error("Failed to create forge draft.")
        return response.data[0]

    @staticmethod
    async def update_draft(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
        data: ForgeDraftUpdate,
    ) -> dict:
        """Update draft state."""
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await ForgeDraftService.get_draft(supabase, user_id, draft_id)

        response = await (
            supabase.table("forge_drafts")
            .update(update_data)
            .eq("id", str(draft_id))
            .eq("user_id", str(user_id))
            .execute()
        )
        if not response.data:
            raise not_found("forge_draft", draft_id)
        return response.data[0]

    @staticmethod
    async def append_entity(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
        entity_type: str,
        entity: dict,
    ) -> dict:
        """Append a single entity to the draft's agent/building array.

        Safe because writes are user-sequential (frontend drives the loop)
        and RLS-gated by ``user_id``.
        """
        draft = await ForgeDraftService.get_draft(supabase, user_id, draft_id)
        current_list = draft.get(entity_type, [])
        current_list.append(entity)
        return await ForgeDraftService.update_draft(
            supabase, user_id, draft_id, ForgeDraftUpdate(**{entity_type: current_list})
        )

    @staticmethod
    async def delete_draft(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
    ) -> dict:
        """Permanently delete a forge draft."""
        response = await (
            supabase.table("forge_drafts").delete().eq("id", str(draft_id)).eq("user_id", str(user_id)).execute()
        )
        if not response.data:
            raise not_found("forge_draft", draft_id)
        return response.data[0]

    @staticmethod
    async def get_user_keys(supabase: Client, user_id: UUID) -> tuple[str | None, str | None]:
        """Fetch and decrypt a user's BYOK API keys.

        Returns (openrouter_key, replicate_key) — None if not set.
        """
        logger.debug("Fetching BYOK keys for user %s", user_id)
        data = await maybe_single_data(
            supabase.table("user_wallets")
            .select("encrypted_openrouter_key, encrypted_replicate_key")
            .eq("user_id", str(user_id))
            .maybe_single()
        ) or {}

        or_key = data.get("encrypted_openrouter_key")
        rep_key = data.get("encrypted_replicate_key")

        decrypted_or = decrypt(or_key) if or_key else None
        decrypted_rep = decrypt(rep_key) if rep_key else None

        if decrypted_or:
            logger.debug("Using personal OpenRouter key for user %s", user_id)
        if decrypted_rep:
            logger.debug("Using personal Replicate key for user %s", user_id)

        return decrypted_or, decrypted_rep

    @staticmethod
    async def check_byok_allowed(supabase: Client, user_id: UUID) -> bool:
        """Check whether a user is allowed to use BYOK keys.

        Calls the fn_user_byok_allowed RPC which evaluates per-user and
        system-wide BYOK access policies.

        Returns True if allowed, False otherwise.
        """
        resp = await supabase.rpc("fn_user_byok_allowed", {"p_user_id": str(user_id)}).execute()
        return bool(resp.data)

    @staticmethod
    async def update_user_keys(
        supabase: Client,
        user_id: UUID,
        openrouter_key: str | None,
        replicate_key: str | None,
    ) -> dict:
        """Update a user's BYOK encrypted keys.

        Uses ``fn_update_user_byok_keys`` RPC (migration 125, updated 218)
        which runs as SECURITY DEFINER, validating ownership inside the
        function.  This avoids the previous service_role bypass.
        """
        params: dict[str, str | bool | None] = {"p_user_id": str(user_id)}
        has_update = False

        if openrouter_key is not None:
            params["p_encrypted_openrouter_key"] = encrypt(openrouter_key) if openrouter_key else None
            has_update = True
        if replicate_key is not None:
            params["p_encrypted_replicate_key"] = encrypt(replicate_key) if replicate_key else None
            has_update = True

        if not has_update:
            return {"message": "No keys updated."}

        resp = await supabase.rpc("fn_update_user_byok_keys", params).execute()
        result = resp.data or {}

        if not result.get("success"):
            raise HTTPException(
                status_code=404,
                detail=result.get("error", "User wallet not found. Must be an architect first."),
            )

        return {"message": "Keys updated successfully."}

    @staticmethod
    async def clear_user_key(
        supabase: Client,
        user_id: UUID,
        provider: str,
    ) -> dict:
        """Remove a single BYOK key (set to NULL).

        Uses the ``p_clear_*`` flags added in migration 218.
        """
        params: dict[str, str | bool | None] = {"p_user_id": str(user_id)}
        if provider == "openrouter":
            params["p_clear_openrouter"] = True
        elif provider == "replicate":
            params["p_clear_replicate"] = True
        else:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

        resp = await supabase.rpc("fn_update_user_byok_keys", params).execute()
        result = resp.data or {}

        if not result.get("success"):
            raise HTTPException(
                status_code=404,
                detail=result.get("error", "User wallet not found. Must be an architect first."),
            )

        return {"message": f"{provider} key removed successfully."}

    @staticmethod
    async def get_wallet(supabase: Client, user_id: UUID) -> dict:
        """Get the current user's forge wallet (includes account_tier and BYOK status).

        Uses a single composite RPC (fn_get_wallet_summary, migration 108)
        that consolidates the wallet query, BYOK policy checks, and platform
        settings into one DB round-trip.
        """
        _default: dict = {
            "forge_tokens": 0,
            "is_architect": False,
            "account_tier": "observer",
            "byok_status": {
                "has_openrouter_key": False,
                "has_replicate_key": False,
                "byok_allowed": False,
                "byok_bypass": False,
                "system_bypass_enabled": False,
                "effective_bypass": False,
                "access_policy": "per_user",
            },
        }
        try:
            resp = await supabase.rpc("fn_get_wallet_summary", {"p_user_id": str(user_id)}).execute()
            return resp.data or _default
        except (PostgrestAPIError, httpx.HTTPError) as exc:
            logger.exception("fn_get_wallet_summary RPC failed")
            sentry_sdk.capture_exception(exc)
            raise HTTPException(
                status_code=503,
                detail="Unable to retrieve wallet data. Please try again later.",
            ) from None

    @staticmethod
    async def list_bundles(supabase: Client) -> list[dict]:
        """Fetch active token bundles, ordered by sort_order.

        Reads from ``token_bundles`` table (migration 101).
        """
        resp = await (
            supabase.table("token_bundles")
            .select("id, slug, display_name, tokens, price_cents, savings_pct, sort_order")
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        return extract_list(resp)

    @staticmethod
    async def purchase_tokens(supabase: Client, bundle_slug: str) -> dict:
        """Execute mock purchase via ``fn_purchase_tokens`` RPC (migration 101)."""
        resp = await supabase.rpc("fn_purchase_tokens", {"p_bundle_slug": bundle_slug}).execute()
        return resp.data

    @staticmethod
    async def get_purchase_history(
        supabase: Client,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Fetch user's token purchase ledger, most recent first."""
        resp = await (
            supabase.table("token_purchases")
            .select("*", count="exact")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return extract_list(resp), resp.count or 0

    @staticmethod
    async def get_token_economy_stats(admin_supabase: Client) -> dict:
        """Aggregated token economy stats via ``token_economy_stats`` view (migration 102)."""
        resp = await admin_supabase.table("token_economy_stats").select("*").single().execute()
        return resp.data

    @staticmethod
    async def admin_grant_tokens(
        admin_supabase: Client,
        user_id: UUID,
        tokens: int,
        reason: str | None,
    ) -> dict:
        """Admin token grant via ``fn_admin_grant_tokens`` RPC (migration 102)."""
        resp = await admin_supabase.rpc(
            "fn_admin_grant_tokens",
            {
                "p_user_id": str(user_id),
                "p_tokens": tokens,
                "p_reason": reason,
            },
        ).execute()
        return resp.data

    @staticmethod
    async def admin_list_purchases(
        admin_supabase: Client,
        limit: int = 50,
        offset: int = 0,
        payment_method: str | None = None,
    ) -> tuple[list[dict], int]:
        """Admin: fetch all purchases with bundle slug join, most recent first."""
        query = (
            admin_supabase.table("token_purchases")
            .select("*, token_bundles(slug)", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if payment_method:
            query = query.eq("payment_method", payment_method)
        resp = await query.execute()
        return extract_list(resp), resp.count or 0

    @staticmethod
    async def admin_update_bundle(
        admin_supabase: Client,
        bundle_id: UUID,
        updates: dict,
    ) -> dict:
        """Admin: update bundle pricing/availability."""
        resp = await admin_supabase.table("token_bundles").update(updates).eq("id", str(bundle_id)).execute()
        return resp.data[0] if resp.data else {}

    @staticmethod
    async def admin_list_all_bundles(admin_supabase: Client) -> list[dict]:
        """Admin: fetch ALL bundles including inactive. Uses admin client to bypass RLS."""
        resp = await admin_supabase.table("token_bundles").select("*").order("sort_order").execute()
        return extract_list(resp)

    @staticmethod
    async def get_admin_stats(admin_supabase: Client) -> dict:
        """Get global forge statistics (admin only).

        Uses ``token_economy_stats`` view for token aggregation (server-side SUM)
        instead of fetching all wallet rows and summing in Python.
        """
        drafts_resp = await (
            admin_supabase.table("forge_drafts")
            .select("id", count="exact")
            .in_("status", ["draft", "processing"])
            .execute()
        )
        active_drafts = drafts_resp.count or 0

        # Server-side aggregation via the token_economy_stats view (migration 102)
        economy_resp = await (
            admin_supabase.table("token_economy_stats").select("tokens_in_circulation").single().execute()
        )
        total_tokens = int(economy_resp.data.get("tokens_in_circulation", 0)) if economy_resp.data else 0

        materialized_resp = await (
            admin_supabase.table("forge_drafts").select("id", count="exact").eq("status", "completed").execute()
        )
        total_materialized = materialized_resp.count or 0

        return {
            "active_drafts": active_drafts,
            "total_tokens": total_tokens,
            "total_materialized": total_materialized,
        }

    # ── BYOK Settings (Admin) ────────────────────────────────────────────

    @staticmethod
    async def get_byok_system_settings(admin_supabase: Client) -> dict:
        """Get all BYOK-related platform settings (admin only)."""
        resp = await (
            admin_supabase.table("platform_settings")
            .select("setting_key, setting_value")
            .in_("setting_key", ["byok_bypass_enabled", "byok_access_policy"])
            .execute()
        )
        result: dict = {"byok_bypass_enabled": False, "byok_access_policy": "per_user"}
        for row in extract_list(resp):
            if row["setting_key"] == "byok_bypass_enabled":
                val = row.get("setting_value")
                result["byok_bypass_enabled"] = val is True or val == "true"
            elif row["setting_key"] == "byok_access_policy":
                val = row.get("setting_value")
                result["byok_access_policy"] = val if isinstance(val, str) else "per_user"
        return result

    @staticmethod
    async def update_byok_bypass_setting(
        admin_supabase: Client,
        enabled: bool,
        admin_id: UUID,
    ) -> dict:
        """Toggle system-wide BYOK bypass (admin only)."""
        await (
            admin_supabase.table("platform_settings")
            .update(
                {
                    "setting_value": enabled,
                    "updated_by_id": str(admin_id),
                }
            )
            .eq("setting_key", "byok_bypass_enabled")
            .execute()
        )
        return {"byok_bypass_enabled": enabled}

    @staticmethod
    async def update_byok_access_policy(
        admin_supabase: Client,
        policy: str,
        admin_id: UUID,
    ) -> dict:
        """Set global BYOK access policy: 'none', 'all', or 'per_user' (admin only)."""
        await (
            admin_supabase.table("platform_settings")
            .update(
                {
                    "setting_value": policy,
                    "updated_by_id": str(admin_id),
                }
            )
            .eq("setting_key", "byok_access_policy")
            .execute()
        )
        return {"byok_access_policy": policy}

    @staticmethod
    async def update_user_byok_bypass(
        admin_supabase: Client,
        target_user_id: UUID,
        enabled: bool,
    ) -> dict:
        """Toggle per-user BYOK bypass (admin only).

        Raises HTTPException 404 if user wallet not found.
        """
        resp = await (
            admin_supabase.table("user_wallets")
            .update({"byok_bypass": enabled})
            .eq("user_id", str(target_user_id))
            .execute()
        )
        if not resp.data:
            raise not_found("wallet")
        return {"user_id": str(target_user_id), "byok_bypass": enabled}

    @staticmethod
    async def update_user_byok_allowed(
        admin_supabase: Client,
        target_user_id: UUID,
        enabled: bool,
    ) -> dict:
        """Grant or revoke BYOK access for a specific user (admin only).

        Raises HTTPException 404 if user wallet not found.
        """
        resp = await (
            admin_supabase.table("user_wallets")
            .update({"byok_allowed": enabled})
            .eq("user_id", str(target_user_id))
            .execute()
        )
        if not resp.data:
            raise not_found("wallet")
        return {"user_id": str(target_user_id), "byok_allowed": enabled}

    @staticmethod
    async def purge_stale_drafts(admin_supabase: Client, cutoff_iso: str) -> int:
        """Purge stale drafts older than the given cutoff date."""
        response = await (
            admin_supabase.table("forge_drafts")
            .delete()
            .in_("status", ["draft", "failed"])
            .lt("updated_at", cutoff_iso)
            .execute()
        )
        return len(response.data) if response.data else 0
