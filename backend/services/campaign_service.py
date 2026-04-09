"""Service layer for campaign operations."""

from __future__ import annotations

import logging
from uuid import UUID

from backend.services.base_service import BaseService
from backend.utils.errors import server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class CampaignService(BaseService):
    """Campaign CRUD — no soft-delete, with related events and metrics."""

    table_name = "campaigns"
    view_name = None
    supports_created_by = False

    @classmethod
    async def list_campaigns(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        campaign_type: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List campaigns with optional type filter."""
        filters = {}
        if campaign_type:
            filters["campaign_type"] = campaign_type

        return await cls.list(
            supabase,
            simulation_id,
            filters=filters,
            order_by="created_at",
            order_desc=True,
            limit=limit,
            offset=offset,
        )

    @classmethod
    async def get_campaign_events(
        cls,
        supabase: Client,
        simulation_id: UUID,
        campaign_id: UUID,
    ) -> list[dict]:
        """Get all events linked to a campaign."""
        response = await (
            supabase.table("campaign_events")
            .select("*, events(id, title, event_type, occurred_at)")
            .eq("simulation_id", str(simulation_id))
            .eq("campaign_id", str(campaign_id))
            .order("created_at", desc=True)
            .execute()
        )
        return extract_list(response)

    @classmethod
    async def add_campaign_event(
        cls,
        supabase: Client,
        simulation_id: UUID,
        campaign_id: UUID,
        event_id: UUID,
        integration_type: str = "manual",
    ) -> dict:
        """Link an event to a campaign."""
        response = await (
            supabase.table("campaign_events")
            .insert(
                {
                    "simulation_id": str(simulation_id),
                    "campaign_id": str(campaign_id),
                    "event_id": str(event_id),
                    "integration_type": integration_type,
                }
            )
            .execute()
        )
        if not response.data:
            raise server_error("Failed to add event to campaign.")
        return response.data[0]

    @classmethod
    async def get_analytics(
        cls,
        supabase: Client,
        simulation_id: UUID,
        campaign_id: UUID,
    ) -> dict:
        """Aggregated campaign analytics via Postgres ``get_campaign_analytics`` (migration 065)."""
        response = await supabase.rpc(
            "get_campaign_analytics",
            {
                "p_simulation_id": str(simulation_id),
                "p_campaign_id": str(campaign_id),
            },
        ).execute()
        return (
            response.data
            if response.data
            else {
                "event_count": 0,
                "events_by_type": {},
                "echo_count": 0,
                "avg_impact": None,
                "metrics_timeline": [],
            }
        )

    @classmethod
    async def get_campaign_metrics(
        cls,
        supabase: Client,
        simulation_id: UUID,
        campaign_id: UUID,
    ) -> list[dict]:
        """Get metrics for a campaign."""
        response = await (
            supabase.table("campaign_metrics")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("campaign_id", str(campaign_id))
            .order("measured_at", desc=True)
            .execute()
        )
        return extract_list(response)
