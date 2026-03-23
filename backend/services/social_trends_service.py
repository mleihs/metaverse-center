"""Service layer for social trends operations."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class SocialTrendsService:
    """Service for social trends CRUD and workflow operations."""

    @staticmethod
    async def list_trends(
        supabase: Client,
        simulation_id: UUID,
        *,
        platform: str | None = None,
        sentiment: str | None = None,
        is_processed: bool | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List social trends with optional filters."""
        query = (
            supabase.table("social_trends")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("fetched_at", desc=True)
        )

        if platform:
            query = query.eq("platform", platform)
        if sentiment:
            query = query.eq("sentiment", sentiment)
        if is_processed is not None:
            query = query.eq("is_processed", is_processed)

        query = query.range(offset, offset + limit - 1)
        response = await query.execute()

        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @staticmethod
    async def get_trend(supabase: Client, simulation_id: UUID, trend_id: UUID) -> dict:
        """Get a single trend."""
        response = await (
            supabase.table("social_trends")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(trend_id))
            .limit(1)
            .execute()
        )
        if not response or not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Social trend '{trend_id}' not found.",
            )
        return response.data[0]

    @staticmethod
    async def create_trend(supabase: Client, simulation_id: UUID, data: dict) -> dict:
        """Create a trend manually."""
        response = await (
            supabase.table("social_trends")
            .insert({**data, "simulation_id": str(simulation_id)})
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create social trend.",
            )
        return response.data[0]

    @staticmethod
    async def store_fetched_trends(
        supabase: Client,
        simulation_id: UUID,
        trends: list[dict],
    ) -> list[dict]:
        """Store multiple fetched trends (upsert by name + platform)."""
        if not trends:
            return []

        rows = []
        for t in trends:
            rows.append({
                **t,
                "simulation_id": str(simulation_id),
                "fetched_at": datetime.now(UTC).isoformat(),
            })

        response = await supabase.table("social_trends").insert(rows).execute()
        return response.data or []

    @staticmethod
    async def mark_processed(
        supabase: Client,
        simulation_id: UUID,
        trend_id: UUID,
    ) -> dict:
        """Mark a trend as processed."""
        response = await (
            supabase.table("social_trends")
            .update({
                "is_processed": True,
                "updated_at": datetime.now(UTC).isoformat(),
            })
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(trend_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Social trend '{trend_id}' not found.",
            )
        return response.data[0]
