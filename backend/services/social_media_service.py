"""Service layer for social media post operations."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from supabase import Client

logger = logging.getLogger(__name__)


class SocialMediaService:
    """Service for social media posts CRUD."""

    @staticmethod
    async def list_posts(
        supabase: Client,
        simulation_id: UUID,
        *,
        platform: str | None = None,
        transformed: bool | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List social media posts with filters."""
        query = (
            supabase.table("social_media_posts")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("source_created_at", desc=True)
        )

        if platform:
            query = query.eq("platform", platform)
        if transformed is True:
            query = query.not_.is_("transformed_content", "null")
        elif transformed is False:
            query = query.is_("transformed_content", "null")

        query = query.range(offset, offset + limit - 1)
        response = query.execute()

        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @staticmethod
    async def get_post(supabase: Client, simulation_id: UUID, post_id: UUID) -> dict:
        """Get a single post."""
        response = (
            supabase.table("social_media_posts")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(post_id))
            .limit(1)
            .execute()
        )
        if not response or not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Social media post '{post_id}' not found.",
            )
        return response.data[0]

    @staticmethod
    async def store_posts(
        supabase: Client,
        simulation_id: UUID,
        posts: list[dict],
    ) -> list[dict]:
        """Store imported posts (upsert by platform + platform_id)."""
        if not posts:
            return []

        rows = []
        for p in posts:
            rows.append({
                **p,
                "simulation_id": str(simulation_id),
                "imported_at": datetime.now(UTC).isoformat(),
                "last_synced_at": datetime.now(UTC).isoformat(),
            })

        response = (
            supabase.table("social_media_posts")
            .upsert(rows, on_conflict="simulation_id,platform,platform_id")
            .execute()
        )
        return response.data or []

    @staticmethod
    async def update_post(
        supabase: Client,
        simulation_id: UUID,
        post_id: UUID,
        data: dict,
    ) -> dict:
        """Update a post (e.g., after transformation or sentiment analysis)."""
        data["updated_at"] = datetime.now(UTC).isoformat()
        response = (
            supabase.table("social_media_posts")
            .update(data)
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(post_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Social media post '{post_id}' not found.",
            )
        return response.data[0]

    @staticmethod
    async def store_comment(
        supabase: Client,
        simulation_id: UUID,
        post_id: UUID,
        data: dict,
    ) -> dict:
        """Store a single comment for a post."""
        response = (
            supabase.table("social_media_comments")
            .insert({
                **data,
                "simulation_id": str(simulation_id),
                "post_id": str(post_id),
            })
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store comment.",
            )
        return response.data[0]

    @staticmethod
    async def get_comments(
        supabase: Client,
        simulation_id: UUID,
        post_id: UUID,
    ) -> list[dict]:
        """Get all comments for a post."""
        response = (
            supabase.table("social_media_comments")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("post_id", str(post_id))
            .order("source_created_at", desc=True)
            .execute()
        )
        return response.data or []

    @staticmethod
    async def store_agent_reaction(
        supabase: Client,
        simulation_id: UUID,
        data: dict,
    ) -> dict:
        """Store an agent reaction to a post or comment."""
        response = (
            supabase.table("social_media_agent_reactions")
            .insert({**data, "simulation_id": str(simulation_id)})
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store agent reaction.",
            )
        return response.data[0]

    @staticmethod
    async def get_agent_reactions(
        supabase: Client,
        simulation_id: UUID,
        post_id: UUID,
    ) -> list[dict]:
        """Get all agent reactions for a post."""
        response = (
            supabase.table("social_media_agent_reactions")
            .select("*, agents(id, name, system)")
            .eq("simulation_id", str(simulation_id))
            .eq("post_id", str(post_id))
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []
