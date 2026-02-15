"""Event CRUD endpoints with reactions and tag filtering."""

from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.common import (
    CurrentUser,
    PaginatedResponse,
    PaginationMeta,
    SuccessResponse,
)
from backend.models.event import EventCreate, EventResponse, EventUpdate
from backend.services.audit_service import AuditService
from backend.services.event_service import EventService
from supabase import Client

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/events",
    tags=["events"],
)

_service = EventService()


@router.get("", response_model=PaginatedResponse[EventResponse])
async def list_events(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    event_type: str | None = Query(default=None),
    impact_level: int | None = Query(default=None, ge=1, le=10),
    tag: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List events with optional filters."""
    data, total = await _service.list(
        supabase,
        simulation_id,
        event_type=event_type,
        impact_level=impact_level,
        tag=tag,
        search=search,
        limit=limit,
        offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/{event_id}", response_model=SuccessResponse[EventResponse])
async def get_event(
    simulation_id: UUID,
    event_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single event."""
    event = await _service.get(supabase, simulation_id, event_id)
    return {"success": True, "data": event}


@router.post("", response_model=SuccessResponse[EventResponse], status_code=201)
async def create_event(
    simulation_id: UUID,
    body: EventCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new event."""
    event = await _service.create(
        supabase, simulation_id, user.id, body.model_dump(exclude_none=True)
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "events", event["id"], "create")
    return {"success": True, "data": event}


@router.put("/{event_id}", response_model=SuccessResponse[EventResponse])
async def update_event(
    simulation_id: UUID,
    event_id: UUID,
    body: EventUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update an event."""
    event = await _service.update(
        supabase, simulation_id, event_id, body.model_dump(exclude_none=True)
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "events", event_id, "update")
    return {"success": True, "data": event}


@router.delete("/{event_id}", response_model=SuccessResponse[EventResponse])
async def delete_event(
    simulation_id: UUID,
    event_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Soft-delete an event."""
    event = await _service.soft_delete(supabase, simulation_id, event_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "events", event_id, "delete")
    return {"success": True, "data": event}


@router.get("/{event_id}/reactions", response_model=SuccessResponse[list])
async def get_event_reactions(
    simulation_id: UUID,
    event_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get all reactions for an event."""
    reactions = await _service.get_reactions(supabase, simulation_id, event_id)
    return {"success": True, "data": reactions}


@router.post("/{event_id}/reactions", response_model=SuccessResponse[dict], status_code=201)
async def add_reaction(
    simulation_id: UUID,
    event_id: UUID,
    agent_id: UUID = Body(..., embed=True),
    reaction_text: str = Body(..., embed=True),
    emotion: str | None = Body(default=None, embed=True),
    confidence_score: float | None = Body(default=None, embed=True),
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Add an agent reaction to an event."""
    reaction = await _service.add_reaction(
        supabase,
        simulation_id,
        event_id,
        {
            "agent_id": str(agent_id),
            "reaction_text": reaction_text,
            "emotion": emotion,
            "confidence_score": confidence_score,
        },
    )
    return {"success": True, "data": reaction}


@router.post("/{event_id}/generate-reaction", response_model=SuccessResponse[dict])
async def generate_reaction(
    simulation_id: UUID,
    event_id: UUID,
    agent_id: UUID = Body(..., embed=True),
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Generate an AI reaction for an agent (stub — Phase 3)."""
    return {
        "success": True,
        "data": {
            "event_id": str(event_id),
            "agent_id": str(agent_id),
            "status": "pending",
            "message": "AI reaction generation will be available in Phase 3.",
        },
    }


@router.get("/by-tags/{tags}", response_model=SuccessResponse[list])
async def get_events_by_tags(
    simulation_id: UUID,
    tags: str,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get events by tags (comma-separated)."""
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    events = await _service.get_by_tags(supabase, simulation_id, tag_list)
    return {"success": True, "data": events}
