"""Service for managing Simulation Forge drafts."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException, status

from backend.dependencies import get_admin_supabase
from backend.models.forge import ForgeDraftCreate, ForgeDraftUpdate
from backend.utils.encryption import encrypt
from supabase import Client

logger = logging.getLogger(__name__)


class ForgeDraftService:
    """Service layer for forge draft operations."""

    @staticmethod
    async def list_drafts(
        supabase: Client,
        user_id: UUID,
        limit: int = 10,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List forge drafts for a user."""
        response = (
            supabase.table("forge_drafts")
            .select("*", count="exact")
            .eq("user_id", str(user_id))
            .order("updated_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return response.data or [], response.count or 0

    @staticmethod
    async def get_draft(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
    ) -> dict:
        """Get a single draft by ID."""
        response = (
            supabase.table("forge_drafts")
            .select("*")
            .eq("id", str(draft_id))
            .eq("user_id", str(user_id))
            .single()
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Forge draft '{draft_id}' not found.",
            )
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
        response = (
            supabase.table("forge_drafts")
            .insert(insert_data)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create forge draft.",
            )
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

        response = (
            supabase.table("forge_drafts")
            .update(update_data)
            .eq("id", str(draft_id))
            .eq("user_id", str(user_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Forge draft '{draft_id}' not found.",
            )
        return response.data[0]

    @staticmethod
    async def delete_draft(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
    ) -> dict:
        """Permanently delete a forge draft."""
        response = (
            supabase.table("forge_drafts")
            .delete()
            .eq("id", str(draft_id))
            .eq("user_id", str(user_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Forge draft '{draft_id}' not found.",
            )
        return response.data[0]

    @staticmethod
    async def update_user_keys(
        supabase: Client,
        user_id: UUID,
        openrouter_key: str | None,
        replicate_key: str | None,
    ) -> dict:
        """Update a user's BYOK encrypted keys.

        Uses admin client because ``user_wallets`` RLS only allows SELECT for
        the owning user — UPDATE requires service_role.
        """
        update_data = {}
        if openrouter_key is not None:
            update_data["encrypted_openrouter_key"] = encrypt(openrouter_key) if openrouter_key else None
        if replicate_key is not None:
            update_data["encrypted_replicate_key"] = encrypt(replicate_key) if replicate_key else None

        if not update_data:
            return {"message": "No keys updated."}

        admin_client = await get_admin_supabase()

        response = (
            admin_client.table("user_wallets")
            .update(update_data)
            .eq("user_id", str(user_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail="User wallet not found. Must be an architect first.")

        return {"message": "Keys updated successfully."}

    @staticmethod
    async def get_wallet(supabase: Client, user_id: UUID) -> dict:
        """Get the current user's forge wallet."""
        response = (
            supabase.table("user_wallets")
            .select("forge_tokens, is_architect")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        return response.data or {"forge_tokens": 0, "is_architect": False}

    @staticmethod
    async def get_admin_stats(admin_supabase: Client) -> dict:
        """Get global forge statistics (admin only)."""
        drafts_resp = (
            admin_supabase.table("forge_drafts")
            .select("id", count="exact")
            .in_("status", ["draft", "processing"])
            .execute()
        )
        active_drafts = drafts_resp.count or 0

        tokens_resp = (
            admin_supabase.table("user_wallets")
            .select("forge_tokens")
            .execute()
        )
        total_tokens = sum(row["forge_tokens"] for row in (tokens_resp.data or []))

        materialized_resp = (
            admin_supabase.table("forge_drafts")
            .select("id", count="exact")
            .eq("status", "completed")
            .execute()
        )
        total_materialized = materialized_resp.count or 0

        return {
            "active_drafts": active_drafts,
            "total_tokens": total_tokens,
            "total_materialized": total_materialized,
        }

    @staticmethod
    async def purge_stale_drafts(
        admin_supabase: Client, cutoff_iso: str
    ) -> int:
        """Purge stale drafts older than the given cutoff date."""
        response = (
            admin_supabase.table("forge_drafts")
            .delete()
            .in_("status", ["draft", "failed"])
            .lt("updated_at", cutoff_iso)
            .execute()
        )
        return len(response.data) if response.data else 0
