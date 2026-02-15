"""Campaign CRUD endpoints with events and metrics."""

from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.campaign import CampaignCreate, CampaignMetricResponse, CampaignResponse, CampaignUpdate
from backend.models.common import (
    CurrentUser,
    PaginatedResponse,
    PaginationMeta,
    SuccessResponse,
)
from backend.services.audit_service import AuditService
from backend.services.campaign_service import CampaignService
from supabase import Client

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/campaigns",
    tags=["campaigns"],
)

_service = CampaignService()


@router.get("", response_model=PaginatedResponse[CampaignResponse])
async def list_campaigns(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    campaign_type: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List campaigns with optional type filter."""
    data, total = await _service.list_campaigns(
        supabase, simulation_id, campaign_type=campaign_type, limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/{campaign_id}", response_model=SuccessResponse[CampaignResponse])
async def get_campaign(
    simulation_id: UUID,
    campaign_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single campaign."""
    campaign = await _service.get_campaign(supabase, simulation_id, campaign_id)
    return {"success": True, "data": campaign}


@router.post("", response_model=SuccessResponse[CampaignResponse], status_code=201)
async def create_campaign(
    simulation_id: UUID,
    body: CampaignCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new campaign."""
    campaign = await _service.create_campaign(supabase, simulation_id, body.model_dump(exclude_none=True))
    await AuditService.log_action(supabase, simulation_id, user.id, "campaigns", campaign["id"], "create")
    return {"success": True, "data": campaign}


@router.put("/{campaign_id}", response_model=SuccessResponse[CampaignResponse])
async def update_campaign(
    simulation_id: UUID,
    campaign_id: UUID,
    body: CampaignUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update a campaign."""
    campaign = await _service.update_campaign(
        supabase, simulation_id, campaign_id, body.model_dump(exclude_none=True),
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "campaigns", campaign_id, "update")
    return {"success": True, "data": campaign}


@router.delete("/{campaign_id}", response_model=SuccessResponse[dict])
async def delete_campaign(
    simulation_id: UUID,
    campaign_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Delete a campaign. Requires admin role."""
    await _service.delete_campaign(supabase, simulation_id, campaign_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "campaigns", campaign_id, "delete")
    return {"success": True, "data": {"message": "Campaign deleted."}}


@router.get("/{campaign_id}/events", response_model=SuccessResponse[list])
async def get_campaign_events(
    simulation_id: UUID,
    campaign_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get all events linked to a campaign."""
    events = await _service.get_campaign_events(supabase, simulation_id, campaign_id)
    return {"success": True, "data": events}


@router.post("/{campaign_id}/events", response_model=SuccessResponse[dict], status_code=201)
async def add_campaign_event(
    simulation_id: UUID,
    campaign_id: UUID,
    event_id: UUID = Body(..., embed=True),
    integration_type: str = Body(default="manual", embed=True),
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Link an event to a campaign."""
    result = await _service.add_campaign_event(
        supabase, simulation_id, campaign_id, event_id, integration_type,
    )
    return {"success": True, "data": result}


@router.get("/{campaign_id}/metrics", response_model=SuccessResponse[list[CampaignMetricResponse]])
async def get_campaign_metrics(
    simulation_id: UUID,
    campaign_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get metrics for a campaign."""
    metrics = await _service.get_campaign_metrics(supabase, simulation_id, campaign_id)
    return {"success": True, "data": metrics}
