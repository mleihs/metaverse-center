"""Event CRUD endpoints with reactions and tag filtering."""

import logging
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status

from backend.dependencies import get_current_user, get_effective_supabase, require_role
from backend.models.common import (
    CurrentUser,
    MessageResponse,
    PaginatedResponse,
    PaginationMeta,
    SuccessResponse,
)
from backend.models.event import (
    EventChainCreate,
    EventChainResponse,
    EventCreate,
    EventResponse,
    EventUpdate,
    EventZoneLinkResponse,
    GenerateEventReactionsRequest,
    ReactionResponse,
)
from backend.services.audit_service import AuditService
from backend.services.event_service import EventService
from backend.services.external_service_resolver import ExternalServiceResolver
from backend.services.generation_service import GenerationService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/events",
    tags=["events"],
)

_service = EventService()


@router.get("")
async def list_events(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    event_type: Annotated[str | None, Query()] = None,
    impact_level: Annotated[int | None, Query(ge=1, le=10)] = None,
    tag: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    date_from: Annotated[datetime | None, Query()] = None,
    date_to: Annotated[datetime | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[EventResponse]:
    """List events with optional filters."""
    data, total = await _service.list(
        supabase,
        simulation_id,
        event_type=event_type,
        impact_level=impact_level,
        tag=tag,
        search=search,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


@router.get("/{event_id}")
async def get_event(
    simulation_id: UUID,
    event_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EventResponse]:
    """Get a single event."""
    event = await _service.get(supabase, simulation_id, event_id)
    return SuccessResponse(data=event)


@router.post("", status_code=201)
async def create_event(
    simulation_id: UUID,
    body: EventCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EventResponse]:
    """Create a new event."""
    event = await _service.create(
        supabase, simulation_id, user.id, body.model_dump(exclude_none=True)
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "events", event["id"], "create")
    await _service._post_event_mutation(supabase, simulation_id)
    return SuccessResponse(data=event)


@router.put("/{event_id}")
async def update_event(
    simulation_id: UUID,
    event_id: UUID,
    body: EventUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    if_updated_at: Annotated[str | None, Header(alias="If-Updated-At")] = None,
) -> SuccessResponse[EventResponse]:
    """Update an event."""
    event = await _service.update(
        supabase, simulation_id, event_id, body.model_dump(exclude_none=True),
        if_updated_at=if_updated_at,
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "events", event_id, "update")
    await _service._post_event_mutation(supabase, simulation_id)
    return SuccessResponse(data=event)


@router.delete("/{event_id}")
async def delete_event(
    simulation_id: UUID,
    event_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EventResponse]:
    """Soft-delete an event."""
    event = await _service.soft_delete(supabase, simulation_id, event_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "events", event_id, "delete")
    await _service._post_event_mutation(supabase, simulation_id)
    return SuccessResponse(data=event)


@router.get("/{event_id}/reactions")
async def get_event_reactions(
    simulation_id: UUID,
    event_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[ReactionResponse]]:
    """Get all reactions for an event."""
    reactions = await _service.get_reactions(supabase, simulation_id, event_id)
    return SuccessResponse(data=reactions)


@router.post("/{event_id}/reactions", status_code=201)
async def add_reaction(
    simulation_id: UUID,
    event_id: UUID,
    agent_id: Annotated[UUID, Body(embed=True)],
    reaction_text: Annotated[str, Body(embed=True)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    emotion: Annotated[str | None, Body(embed=True)] = None,
    confidence_score: Annotated[float | None, Body(embed=True)] = None,
) -> SuccessResponse[ReactionResponse]:
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
    await AuditService.log_action(supabase, simulation_id, user.id, "event_reactions", reaction["id"], "create")
    return SuccessResponse(data=reaction)


@router.delete("/{event_id}/reactions/{reaction_id}")
async def delete_event_reaction(
    simulation_id: UUID,
    event_id: UUID,
    reaction_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[MessageResponse]:
    """Delete a single reaction from an event."""
    await _service.delete_reaction(supabase, simulation_id, reaction_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "event_reactions", reaction_id, "delete")
    return SuccessResponse(data=MessageResponse(message="Reaction deleted."))


@router.post("/{event_id}/generate-reactions")
async def generate_reactions(
    simulation_id: UUID,
    event_id: UUID,
    body: GenerateEventReactionsRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[dict]]:
    """Generate AI reactions from agents for an event."""
    event = await _service.get(supabase, simulation_id, event_id)

    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()
    gen = GenerationService(supabase, simulation_id, ai_config.openrouter_api_key)

    # Delegate fully to EventService — supports both specific agent_ids and auto-selection
    agent_id_strs = [str(a) for a in body.agent_ids] if body.agent_ids else None
    reactions = await EventService.generate_reactions(
        supabase, simulation_id, event, gen,
        agent_ids=agent_id_strs,
        max_agents=body.max_agents,
    )

    if not reactions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No agents found for reaction generation.",
        )

    return SuccessResponse(data=reactions)


@router.put("/{event_id}/status")
async def update_event_status(
    simulation_id: UUID,
    event_id: UUID,
    event_status: Annotated[str, Body(embed=True)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EventResponse]:
    """Transition an event to a new lifecycle status."""
    event = await _service.update_status(supabase, simulation_id, event_id, event_status)
    await AuditService.log_action(
        supabase, simulation_id, user.id, "events", event_id, "status_change",
        details={"new_status": event_status},
    )
    await _service._post_event_mutation(supabase, simulation_id)
    return SuccessResponse(data=event)


@router.get("/{event_id}/chains")
async def get_event_chains(
    simulation_id: UUID,
    event_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[EventChainResponse]]:
    """Get chain links for an event."""
    chains = await _service.get_chains(supabase, simulation_id, event_id)
    return SuccessResponse(data=chains)


@router.post("/{event_id}/chains", status_code=201)
async def create_event_chain(
    simulation_id: UUID,
    event_id: UUID,
    body: EventChainCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EventChainResponse]:
    """Link two events in a narrative chain."""
    chain = await _service.add_chain(
        supabase, simulation_id,
        {
            "parent_event_id": str(body.parent_event_id),
            "child_event_id": str(body.child_event_id),
            "chain_type": body.chain_type,
        },
    )
    await AuditService.log_action(
        supabase, simulation_id, user.id, "event_chains", chain["id"], "create",
    )
    return SuccessResponse(data=chain)


@router.delete("/{event_id}/chains/{chain_id}")
async def delete_event_chain(
    simulation_id: UUID,
    event_id: UUID,
    chain_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EventChainResponse]:
    """Remove an event chain link."""
    deleted = await _service.delete_chain(supabase, simulation_id, chain_id)
    return SuccessResponse(data=deleted)


@router.get("/{event_id}/zone-links")
async def get_event_zone_links(
    simulation_id: UUID,
    event_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[EventZoneLinkResponse]]:
    """Get zone links for an event (auto-assigned + manual)."""
    links = await EventService.get_zone_links(supabase, event_id)
    return SuccessResponse(data=links)


@router.get("/by-tags/{tags}")
async def get_events_by_tags(
    simulation_id: UUID,
    tags: str,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[EventResponse]]:
    """Get events by tags (comma-separated)."""
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    events = await _service.get_by_tags(supabase, simulation_id, tag_list)
    return SuccessResponse(data=events)
