"""Agent profession CRUD endpoints."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.agent_profession import (
    AgentProfessionCreate,
    AgentProfessionResponse,
    AgentProfessionUpdate,
)
from backend.models.common import CurrentUser, SuccessResponse
from supabase import Client

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
    response = (
        supabase.table("agent_professions")
        .select("*")
        .eq("simulation_id", str(simulation_id))
        .eq("agent_id", str(agent_id))
        .order("is_primary", desc=True)
        .order("qualification_level", desc=True)
        .execute()
    )
    return {"success": True, "data": response.data or []}


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
    data = body.model_dump(exclude_none=True)
    data["simulation_id"] = str(simulation_id)
    data["agent_id"] = str(agent_id)

    response = supabase.table("agent_professions").insert(data).execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add profession.",
        )

    return {"success": True, "data": response.data[0]}


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
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")

    data["updated_at"] = datetime.now(UTC).isoformat()

    response = (
        supabase.table("agent_professions")
        .update(data)
        .eq("simulation_id", str(simulation_id))
        .eq("agent_id", str(agent_id))
        .eq("id", str(profession_id))
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profession '{profession_id}' not found.",
        )

    return {"success": True, "data": response.data[0]}


@router.delete("/{profession_id}", response_model=SuccessResponse[dict])
async def delete_profession(
    simulation_id: UUID,
    agent_id: UUID,
    profession_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Remove a profession from an agent."""
    response = (
        supabase.table("agent_professions")
        .delete()
        .eq("simulation_id", str(simulation_id))
        .eq("agent_id", str(agent_id))
        .eq("id", str(profession_id))
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profession '{profession_id}' not found.",
        )

    return {"success": True, "data": {"message": "Profession removed."}}
