"""Service layer for campaign operations."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from supabase import Client


class CampaignService:
    """Service for campaign CRUD and related operations."""

    @staticmethod
    async def list_campaigns(
        supabase: Client,
        simulation_id: UUID,
        *,
        campaign_type: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List campaigns with optional type filter."""
        query = (
            supabase.table("campaigns")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("created_at", desc=True)
        )

        if campaign_type:
            query = query.eq("campaign_type", campaign_type)

        query = query.range(offset, offset + limit - 1)
        response = query.execute()

        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @staticmethod
    async def get_campaign(supabase: Client, simulation_id: UUID, campaign_id: UUID) -> dict:
        """Get a single campaign."""
        response = (
            supabase.table("campaigns")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(campaign_id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campaign '{campaign_id}' not found.",
            )
        return response.data

    @staticmethod
    async def create_campaign(supabase: Client, simulation_id: UUID, data: dict) -> dict:
        """Create a new campaign."""
        response = (
            supabase.table("campaigns")
            .insert({**data, "simulation_id": str(simulation_id)})
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create campaign.",
            )
        return response.data[0]

    @staticmethod
    async def update_campaign(
        supabase: Client,
        simulation_id: UUID,
        campaign_id: UUID,
        data: dict,
    ) -> dict:
        """Update a campaign."""
        if not data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")
        data["updated_at"] = datetime.now(UTC).isoformat()
        response = (
            supabase.table("campaigns")
            .update(data)
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(campaign_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campaign '{campaign_id}' not found.",
            )
        return response.data[0]

    @staticmethod
    async def delete_campaign(supabase: Client, simulation_id: UUID, campaign_id: UUID) -> dict:
        """Delete a campaign (hard delete)."""
        response = (
            supabase.table("campaigns")
            .delete()
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(campaign_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campaign '{campaign_id}' not found.",
            )
        return response.data[0]

    @staticmethod
    async def get_campaign_events(
        supabase: Client,
        simulation_id: UUID,
        campaign_id: UUID,
    ) -> list[dict]:
        """Get all events linked to a campaign."""
        response = (
            supabase.table("campaign_events")
            .select("*, events(id, title, event_type, occurred_at)")
            .eq("simulation_id", str(simulation_id))
            .eq("campaign_id", str(campaign_id))
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    @staticmethod
    async def add_campaign_event(
        supabase: Client,
        simulation_id: UUID,
        campaign_id: UUID,
        event_id: UUID,
        integration_type: str = "manual",
    ) -> dict:
        """Link an event to a campaign."""
        response = (
            supabase.table("campaign_events")
            .insert({
                "simulation_id": str(simulation_id),
                "campaign_id": str(campaign_id),
                "event_id": str(event_id),
                "integration_type": integration_type,
            })
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add event to campaign.",
            )
        return response.data[0]

    @staticmethod
    async def get_campaign_metrics(
        supabase: Client,
        simulation_id: UUID,
        campaign_id: UUID,
    ) -> list[dict]:
        """Get metrics for a campaign."""
        response = (
            supabase.table("campaign_metrics")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("campaign_id", str(campaign_id))
            .order("measured_at", desc=True)
            .execute()
        )
        return response.data or []
