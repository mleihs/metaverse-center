"""Agent aptitude CRUD endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.aptitude import AptitudeResponse, AptitudeSet
from backend.models.common import CurrentUser, SuccessResponse
from backend.services.aptitude_service import AptitudeService
from backend.services.audit_service import AuditService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}",
    tags=["agent-aptitudes"],
)


# ── Simulation-wide aptitudes ─────────────────────────


@router.get("/aptitudes", response_model=SuccessResponse[list[AptitudeResponse]])
async def get_simulation_aptitudes(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get all aptitude scores for all agents in a simulation."""
    data = await AptitudeService.get_all_for_simulation(supabase, simulation_id)
    return {"success": True, "data": data}


# ── Per-agent aptitudes ───────────────────────────────


@router.get("/agents/{agent_id}/aptitudes", response_model=SuccessResponse[list[AptitudeResponse]])
async def get_aptitudes(
    simulation_id: UUID,
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get all aptitude scores for an agent."""
    data = await AptitudeService.get_for_agent(supabase, simulation_id, agent_id)
    return {"success": True, "data": data}


@router.put("/agents/{agent_id}/aptitudes", response_model=SuccessResponse[list[AptitudeResponse]])
async def set_aptitudes(
    simulation_id: UUID,
    agent_id: UUID,
    body: AptitudeSet,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Set all 6 aptitude scores for an agent (budget must equal 36)."""
    data = await AptitudeService.set_aptitudes(
        supabase, simulation_id, agent_id, body
    )
    await AuditService.log_action(
        supabase, simulation_id, user.id,
        "agent_aptitudes", agent_id, "update",
        details={"aptitudes": body.model_dump()},
    )
    return {"success": True, "data": data}
