"""Bot player preset CRUD service."""

import logging
from uuid import UUID

from fastapi import HTTPException, status

from supabase import Client

logger = logging.getLogger(__name__)


class BotPlayerService:
    """Service for bot player preset CRUD operations."""

    @classmethod
    async def list_for_user(cls, supabase: Client, user_id: UUID) -> tuple[list[dict], int]:
        """List the current user's bot player presets."""
        resp = (
            supabase.table("bot_players")
            .select("*", count="exact")
            .eq("created_by_id", str(user_id))
            .order("created_at", desc=True)
            .execute()
        )
        data = resp.data or []
        return data, resp.count or 0

    @classmethod
    async def get(cls, supabase: Client, bot_id: UUID) -> dict:
        """Get a single bot player preset."""
        resp = (
            supabase.table("bot_players")
            .select("*")
            .eq("id", str(bot_id))
            .single()
            .execute()
        )
        if not resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bot player not found.")
        return resp.data

    @classmethod
    async def create(cls, supabase: Client, user_id: UUID, data: dict) -> dict:
        """Create a new bot player preset."""
        data["created_by_id"] = str(user_id)
        resp = supabase.table("bot_players").insert(data).execute()
        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to create bot player.")
        return resp.data[0]

    @classmethod
    async def update(cls, supabase: Client, bot_id: UUID, user_id: UUID, updates: dict) -> dict:
        """Update a bot player preset (own bots only)."""
        if not updates:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update.")
        resp = (
            supabase.table("bot_players")
            .update(updates)
            .eq("id", str(bot_id))
            .eq("created_by_id", str(user_id))
            .execute()
        )
        if not resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bot player not found or not owned by you.")
        return resp.data[0]

    @classmethod
    async def delete(cls, supabase: Client, bot_id: UUID, user_id: UUID) -> None:
        """Delete a bot player preset (own bots only)."""
        resp = (
            supabase.table("bot_players")
            .delete()
            .eq("id", str(bot_id))
            .eq("created_by_id", str(user_id))
            .execute()
        )
        if not resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bot player not found or not owned by you.")
