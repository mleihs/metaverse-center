"""Event CRUD endpoints with reactions and tag filtering."""

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.common import (
    CurrentUser,
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
    GenerateEventReactionsRequest,
)
from backend.services.agent_service import AgentService
from backend.services.audit_service import AuditService
from backend.services.event_service import EventService
from backend.services.external_service_resolver import ExternalServiceResolver
from backend.services.generation_service import GenerationService
from supabase import Client

logger = logging.getLogger(__name__)

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
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
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
        date_from=date_from,
        date_to=date_to,
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
    await _service._post_event_mutation(supabase, simulation_id)
    return {"success": True, "data": event}


@router.put("/{event_id}", response_model=SuccessResponse[EventResponse])
async def update_event(
    simulation_id: UUID,
    event_id: UUID,
    body: EventUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
    if_updated_at: str | None = Header(default=None, alias="If-Updated-At"),
) -> dict:
    """Update an event."""
    event = await _service.update(
        supabase, simulation_id, event_id, body.model_dump(exclude_none=True),
        if_updated_at=if_updated_at,
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "events", event_id, "update")
    await _service._post_event_mutation(supabase, simulation_id)
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
    await _service._post_event_mutation(supabase, simulation_id)
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
    await AuditService.log_action(supabase, simulation_id, user.id, "event_reactions", reaction["id"], "create")
    return {"success": True, "data": reaction}


@router.delete("/{event_id}/reactions/{reaction_id}", response_model=SuccessResponse[dict])
async def delete_event_reaction(
    simulation_id: UUID,
    event_id: UUID,
    reaction_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Delete a single reaction from an event."""
    deleted = await _service.delete_reaction(supabase, simulation_id, reaction_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "event_reactions", reaction_id, "delete")
    return {"success": True, "data": deleted}


@router.post(
    "/{event_id}/generate-reactions",
    response_model=SuccessResponse[list[dict]],
)
async def generate_reactions(
    simulation_id: UUID,
    event_id: UUID,
    body: GenerateEventReactionsRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Generate AI reactions from agents for an event."""
    event = await _service.get(supabase, simulation_id, event_id)

    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()
    gen = GenerationService(supabase, simulation_id, ai_config.openrouter_api_key)

    if body.agent_ids:
        # Specific agents requested
        agents = await AgentService.list_for_reaction(
            supabase, simulation_id, agent_ids=body.agent_ids,
        )

        if not agents:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No agents found for reaction generation.",
            )

        existing = await _service.get_reactions(supabase, simulation_id, event_id)
        existing_map: dict[str, dict] = {r["agent_id"]: r for r in existing}

        reactions: list[dict] = []
        for agent in agents:
            try:
                reaction_text = await gen.generate_agent_reaction(
                    agent_data={
                        "name": agent["name"],
                        "character": agent.get("character", ""),
                        "system": agent.get("system", ""),
                    },
                    event_data={
                        "title": event["title"],
                        "description": event.get("description", ""),
                    },
                )

                prev = existing_map.get(agent["id"])
                if prev:
                    reaction = await _service.update_reaction(
                        supabase, prev["id"],
                        {"reaction_text": reaction_text, "data_source": "ai_generated"},
                    )
                else:
                    reaction = await _service.add_reaction(
                        supabase, simulation_id, event_id,
                        {
                            "agent_id": agent["id"],
                            "agent_name": agent["name"],
                            "reaction_text": reaction_text,
                            "data_source": "ai_generated",
                        },
                    )
                reactions.append(reaction)
            except Exception:
                logger.warning("Agent reaction generation failed", extra={"agent_id": agent["id"]}, exc_info=True)
        # NOTE: reaction_modifier auto-computed by Postgres trigger on event_reactions
    else:
        # General reaction generation via EventService
        reactions = await EventService.generate_reactions(
            supabase, simulation_id, event, gen,
            max_agents=body.max_agents,
        )

        if not reactions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No agents found for reaction generation.",
            )

    return {"success": True, "data": reactions}


@router.put("/{event_id}/status", response_model=SuccessResponse[EventResponse])
async def update_event_status(
    simulation_id: UUID,
    event_id: UUID,
    event_status: str = Body(..., embed=True),
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Transition an event to a new lifecycle status."""
    event = await _service.update_status(supabase, simulation_id, event_id, event_status)
    await AuditService.log_action(
        supabase, simulation_id, user.id, "events", event_id, "status_change",
        details={"new_status": event_status},
    )
    await _service._post_event_mutation(supabase, simulation_id)
    return {"success": True, "data": event}


@router.get("/{event_id}/chains", response_model=SuccessResponse[list[EventChainResponse]])
async def get_event_chains(
    simulation_id: UUID,
    event_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get chain links for an event."""
    chains = await _service.get_chains(supabase, simulation_id, event_id)
    return {"success": True, "data": chains}


@router.post("/{event_id}/chains", response_model=SuccessResponse[EventChainResponse], status_code=201)
async def create_event_chain(
    simulation_id: UUID,
    event_id: UUID,
    body: EventChainCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
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
    return {"success": True, "data": chain}


@router.delete("/{event_id}/chains/{chain_id}", response_model=SuccessResponse[EventChainResponse])
async def delete_event_chain(
    simulation_id: UUID,
    event_id: UUID,
    chain_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Remove an event chain link."""
    deleted = await _service.delete_chain(supabase, simulation_id, chain_id)
    return {"success": True, "data": deleted}


@router.get("/{event_id}/zone-links", response_model=SuccessResponse[list])
async def get_event_zone_links(
    simulation_id: UUID,
    event_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get zone links for an event (auto-assigned + manual)."""
    links = await EventService.get_zone_links(supabase, event_id)
    return {"success": True, "data": links}


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
