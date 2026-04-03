"""Agent profession CRUD endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.agent_profession import (
    AgentProfessionCreate,
    AgentProfessionResponse,
    AgentProfessionUpdate,
)
from backend.models.common import CurrentUser, MessageResponse, SuccessResponse
from backend.services.agent_profession_service import AgentProfessionService
from backend.services.audit_service import AuditService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/agents/{agent_id}/professions",
    tags=["agent-professions"],
)


@router.get("", response_model=SuccessResponse[list[AgentProfessionResponse]])
async def list_professions(
    simulation_id: UUID,
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all professions for an agent."""
    data = await AgentProfessionService.list_for_agent(
        supabase, simulation_id, agent_id
    )
    return {"success": True, "data": data}


@router.post("", response_model=SuccessResponse[AgentProfessionResponse], status_code=201)
async def add_profession(
    simulation_id: UUID,
    agent_id: UUID,
    body: AgentProfessionCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Add a profession to an agent. Primary-profession uniqueness enforced by DB trigger."""
    result = await AgentProfessionService.add(
        supabase, simulation_id, agent_id, body.model_dump(exclude_none=True)
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "agent_professions", result["id"], "create")
    return {"success": True, "data": result}


@router.put("/{profession_id}", response_model=SuccessResponse[AgentProfessionResponse])
async def update_profession(
    simulation_id: UUID,
    agent_id: UUID,
    profession_id: UUID,
    body: AgentProfessionUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update an agent profession."""
    result = await AgentProfessionService.update(
        supabase,
        simulation_id,
        profession_id,
        body.model_dump(exclude_none=True),
        extra_filters={"agent_id": agent_id},
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "agent_professions", profession_id, "update")
    return {"success": True, "data": result}


@router.delete("/{profession_id}", response_model=SuccessResponse[MessageResponse])
async def delete_profession(
    simulation_id: UUID,
    agent_id: UUID,
    profession_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> SuccessResponse[MessageResponse]:
    """Remove a profession from an agent."""
    await AgentProfessionService.remove(
        supabase, simulation_id, agent_id, profession_id
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "agent_professions", profession_id, "delete")
    return SuccessResponse(data=MessageResponse(message="Profession removed."))
