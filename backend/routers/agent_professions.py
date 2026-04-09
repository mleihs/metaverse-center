"""Agent profession CRUD endpoints."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.dependencies import get_current_user, get_effective_supabase, require_role
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


@router.get("")
async def list_professions(
    simulation_id: UUID,
    agent_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[AgentProfessionResponse]]:
    """List all professions for an agent."""
    data = await AgentProfessionService.list_for_agent(supabase, simulation_id, agent_id)
    return SuccessResponse(data=data)


@router.post("", status_code=201)
async def add_profession(
    simulation_id: UUID,
    agent_id: UUID,
    body: AgentProfessionCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[AgentProfessionResponse]:
    """Add a profession to an agent. Primary-profession uniqueness enforced by DB trigger."""
    result = await AgentProfessionService.add(supabase, simulation_id, agent_id, body.model_dump(exclude_none=True))
    await AuditService.log_action(supabase, simulation_id, user.id, "agent_professions", result["id"], "create")
    return SuccessResponse(data=result)


@router.put("/{profession_id}")
async def update_profession(
    simulation_id: UUID,
    agent_id: UUID,
    profession_id: UUID,
    body: AgentProfessionUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[AgentProfessionResponse]:
    """Update an agent profession."""
    result = await AgentProfessionService.update(
        supabase,
        simulation_id,
        profession_id,
        body.model_dump(exclude_none=True),
        extra_filters={"agent_id": agent_id},
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "agent_professions", profession_id, "update")
    return SuccessResponse(data=result)


@router.delete("/{profession_id}")
async def delete_profession(
    simulation_id: UUID,
    agent_id: UUID,
    profession_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[MessageResponse]:
    """Remove a profession from an agent."""
    await AgentProfessionService.remove(supabase, simulation_id, agent_id, profession_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "agent_professions", profession_id, "delete")
    return SuccessResponse(data=MessageResponse(message="Profession removed."))
