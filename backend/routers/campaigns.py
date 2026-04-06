"""Campaign CRUD endpoints with events and metrics."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query

from backend.dependencies import get_current_user, get_effective_supabase, require_role
from backend.models.campaign import (
    CampaignAnalyticsResponse,
    CampaignCreate,
    CampaignEventResponse,
    CampaignMetricResponse,
    CampaignResponse,
    CampaignUpdate,
)
from backend.models.common import (
    CurrentUser,
    MessageResponse,
    PaginatedResponse,
    PaginationMeta,
    SuccessResponse,
)
from backend.services.audit_service import AuditService
from backend.services.campaign_service import CampaignService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/campaigns",
    tags=["campaigns"],
)


@router.get("")
async def list_campaigns(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    campaign_type: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[CampaignResponse]:
    """List campaigns with optional type filter."""
    data, total = await CampaignService.list_campaigns(
        supabase, simulation_id, campaign_type=campaign_type, limit=limit, offset=offset,
    )
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


@router.get("/{campaign_id}")
async def get_campaign(
    simulation_id: UUID,
    campaign_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[CampaignResponse]:
    """Get a single campaign."""
    campaign = await CampaignService.get(supabase, simulation_id, campaign_id)
    return SuccessResponse(data=campaign)


@router.post("", status_code=201)
async def create_campaign(
    simulation_id: UUID,
    body: CampaignCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[CampaignResponse]:
    """Create a new campaign."""
    campaign = await CampaignService.create(
        supabase, simulation_id, user_id=user.id, data=body.model_dump(exclude_none=True),
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "campaigns", campaign["id"], "create")
    return SuccessResponse(data=campaign)


@router.put("/{campaign_id}")
async def update_campaign(
    simulation_id: UUID,
    campaign_id: UUID,
    body: CampaignUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[CampaignResponse]:
    """Update a campaign."""
    campaign = await CampaignService.update(
        supabase, simulation_id, campaign_id, body.model_dump(exclude_none=True),
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "campaigns", campaign_id, "update")
    return SuccessResponse(data=campaign)


@router.delete("/{campaign_id}")
async def delete_campaign(
    simulation_id: UUID,
    campaign_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[MessageResponse]:
    """Delete a campaign. Requires admin role."""
    await CampaignService.hard_delete(supabase, simulation_id, campaign_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "campaigns", campaign_id, "delete")
    return SuccessResponse(data=MessageResponse(message="Campaign deleted."))


@router.get("/{campaign_id}/analytics")
async def get_campaign_analytics(
    simulation_id: UUID,
    campaign_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[CampaignAnalyticsResponse]:
    """Get aggregated analytics for a campaign."""
    data = await CampaignService.get_analytics(supabase, simulation_id, campaign_id)
    return SuccessResponse(data=data)


@router.get("/{campaign_id}/events")
async def get_campaign_events(
    simulation_id: UUID,
    campaign_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[CampaignEventResponse]]:
    """Get all events linked to a campaign."""
    events = await CampaignService.get_campaign_events(supabase, simulation_id, campaign_id)
    return SuccessResponse(data=events)


@router.post("/{campaign_id}/events", status_code=201)
async def add_campaign_event(
    simulation_id: UUID,
    campaign_id: UUID,
    event_id: Annotated[UUID, Body(embed=True)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    integration_type: Annotated[str, Body(embed=True)] = "manual",
) -> SuccessResponse[CampaignEventResponse]:
    """Link an event to a campaign."""
    result = await CampaignService.add_campaign_event(
        supabase, simulation_id, campaign_id, event_id, integration_type,
    )
    return SuccessResponse(data=result)


@router.get("/{campaign_id}/metrics")
async def get_campaign_metrics(
    simulation_id: UUID,
    campaign_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[CampaignMetricResponse]]:
    """Get metrics for a campaign."""
    metrics = await CampaignService.get_campaign_metrics(supabase, simulation_id, campaign_id)
    return SuccessResponse(data=metrics)
