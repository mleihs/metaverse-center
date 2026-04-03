"""Agent CRUD endpoints."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.agent import AgentCreate, AgentResponse, AgentUpdate
from backend.models.common import (
    CurrentUser,
    MessageResponse,
    PaginatedResponse,
    PaginationMeta,
    SuccessResponse,
)
from backend.models.event import ReactionResponse
from backend.services.agent_service import AgentService
from backend.services.audit_service import AuditService
from backend.services.event_service import EventService
from backend.services.simulation_service import SimulationService
from backend.services.translation_service import null_de_fields_for_update, schedule_auto_translation
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/agents",
    tags=["agents"],
)

_service = AgentService()


@router.get("")
async def list_agents(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
    system: Annotated[str | None, Query()] = None,
    gender: Annotated[str | None, Query()] = None,
    primary_profession: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query(description="Full-text search")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[AgentResponse]:
    """List agents in a simulation with optional filters."""
    data, total = await _service.list(
        supabase,
        simulation_id,
        system=system,
        gender=gender,
        primary_profession=primary_profession,
        search=search,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


@router.get("/{agent_id}")
async def get_agent(
    simulation_id: UUID,
    agent_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[AgentResponse]:
    """Get a single agent with professions, reactions, and building relations."""
    agent = await _service.get_with_details(supabase, simulation_id, agent_id)
    return SuccessResponse(data=agent)


@router.post("", status_code=201)
async def create_agent(
    simulation_id: UUID,
    body: AgentCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[AgentResponse]:
    """Create a new agent."""
    agent = await _service.create(
        supabase, simulation_id, user.id, body.model_dump(exclude_none=True)
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "agents", agent["id"], "create")
    # Auto-translate in background (best-effort)
    sim = await SimulationService.get_simulation_context(supabase, simulation_id)
    if sim:
        schedule_auto_translation(
            supabase, "agents", agent["id"], agent,
            simulation_name=sim["name"], simulation_theme=sim.get("theme", ""),
            entity_type="agent",
        )
    return SuccessResponse(data=agent)


@router.put("/{agent_id}")
async def update_agent(
    simulation_id: UUID,
    agent_id: UUID,
    body: AgentUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
    if_updated_at: Annotated[str | None, Header(alias="If-Updated-At")] = None,
) -> SuccessResponse[AgentResponse]:
    """Update an existing agent."""
    update_data = body.model_dump(exclude_none=True)
    # Null stale _de fields for changed EN fields
    de_nulls = null_de_fields_for_update("agents", update_data)
    if de_nulls:
        update_data.update(de_nulls)
    agent = await _service.update(
        supabase, simulation_id, agent_id, update_data,
        if_updated_at=if_updated_at,
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "agents", agent_id, "update")
    # Re-translate in background (best-effort)
    if de_nulls:
        sim = await SimulationService.get_simulation_context(supabase, simulation_id)
        if sim:
            schedule_auto_translation(
                supabase, "agents", agent["id"], agent,
                simulation_name=sim["name"], simulation_theme=sim.get("theme", ""),
                entity_type="agent",
            )
    return SuccessResponse(data=agent)


@router.delete("/{agent_id}")
async def delete_agent(
    simulation_id: UUID,
    agent_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[AgentResponse]:
    """Soft-delete an agent."""
    agent = await _service.soft_delete(supabase, simulation_id, agent_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "agents", agent_id, "delete")
    return SuccessResponse(data=agent)



@router.get("/{agent_id}/reactions")
async def get_agent_reactions(
    simulation_id: UUID,
    agent_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[list[ReactionResponse]]:
    """Get all event reactions for an agent."""
    reactions = await _service.get_reactions(supabase, simulation_id, agent_id)
    return SuccessResponse(data=reactions)


@router.delete("/{agent_id}/reactions/{reaction_id}")
async def delete_agent_reaction(
    simulation_id: UUID,
    agent_id: UUID,
    reaction_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[MessageResponse]:
    """Delete a single reaction for an agent."""
    await EventService.delete_reaction(supabase, simulation_id, reaction_id)
    return SuccessResponse(data=MessageResponse(message="Reaction deleted."))
