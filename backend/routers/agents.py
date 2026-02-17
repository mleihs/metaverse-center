"""Agent CRUD endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.agent import AgentCreate, AgentResponse, AgentUpdate
from backend.models.common import (
    CurrentUser,
    PaginatedResponse,
    PaginationMeta,
    SuccessResponse,
)
from backend.services.agent_service import AgentService
from backend.services.audit_service import AuditService
from backend.services.event_service import EventService
from supabase import Client

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/agents",
    tags=["agents"],
)

_service = AgentService()


@router.get("", response_model=PaginatedResponse[AgentResponse])
async def list_agents(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    system: str | None = Query(default=None),
    gender: str | None = Query(default=None),
    primary_profession: str | None = Query(default=None),
    search: str | None = Query(default=None, description="Full-text search"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
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
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/{agent_id}", response_model=SuccessResponse[AgentResponse])
async def get_agent(
    simulation_id: UUID,
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single agent with professions, reactions, and building relations."""
    agent = await _service.get_with_details(supabase, simulation_id, agent_id)
    return {"success": True, "data": agent}


@router.post("", response_model=SuccessResponse[AgentResponse], status_code=201)
async def create_agent(
    simulation_id: UUID,
    body: AgentCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new agent."""
    agent = await _service.create(
        supabase, simulation_id, user.id, body.model_dump(exclude_none=True)
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "agents", agent["id"], "create")
    return {"success": True, "data": agent}


@router.put("/{agent_id}", response_model=SuccessResponse[AgentResponse])
async def update_agent(
    simulation_id: UUID,
    agent_id: UUID,
    body: AgentUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
    if_updated_at: str | None = Header(default=None, alias="If-Updated-At"),
) -> dict:
    """Update an existing agent."""
    agent = await _service.update(
        supabase, simulation_id, agent_id, body.model_dump(exclude_none=True),
        if_updated_at=if_updated_at,
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "agents", agent_id, "update")
    return {"success": True, "data": agent}


@router.delete("/{agent_id}", response_model=SuccessResponse[AgentResponse])
async def delete_agent(
    simulation_id: UUID,
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Soft-delete an agent."""
    agent = await _service.soft_delete(supabase, simulation_id, agent_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "agents", agent_id, "delete")
    return {"success": True, "data": agent}


@router.post("/{agent_id}/generate-portrait", response_model=SuccessResponse[dict])
async def generate_portrait(
    simulation_id: UUID,
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Generate a portrait for an agent (stub — AI integration in Phase 3)."""
    agent = await _service.get(supabase, simulation_id, agent_id)
    return {
        "success": True,
        "data": {
            "agent_id": agent["id"],
            "status": "pending",
            "message": "Portrait generation will be available in Phase 3.",
        },
    }


@router.get("/{agent_id}/reactions", response_model=SuccessResponse[list])
async def get_agent_reactions(
    simulation_id: UUID,
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get all event reactions for an agent."""
    reactions = await _service.get_reactions(supabase, simulation_id, agent_id)
    return {"success": True, "data": reactions}


@router.delete("/{agent_id}/reactions/{reaction_id}", response_model=SuccessResponse[dict])
async def delete_agent_reaction(
    simulation_id: UUID,
    agent_id: UUID,
    reaction_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Delete a single reaction for an agent."""
    deleted = await EventService.delete_reaction(supabase, simulation_id, reaction_id)
    return {"success": True, "data": deleted}
