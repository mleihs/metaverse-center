"""Agent relationship CRUD endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.relationship import (
    RelationshipCreate,
    RelationshipResponse,
    RelationshipUpdate,
)
from backend.services.audit_service import AuditService
from backend.services.relationship_service import RelationshipService
from supabase import Client

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}",
    tags=["relationships"],
)


@router.get(
    "/agents/{agent_id}/relationships",
    response_model=SuccessResponse[list[RelationshipResponse]],
)
async def list_agent_relationships(
    simulation_id: UUID,
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all relationships for a specific agent (both directions)."""
    data = await RelationshipService.list_for_agent(supabase, simulation_id, agent_id)
    return {"success": True, "data": data}


@router.get(
    "/relationships",
    response_model=PaginatedResponse[RelationshipResponse],
)
async def list_simulation_relationships(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List all relationships in a simulation (for graph views)."""
    data, total = await RelationshipService.list_for_simulation(
        supabase, simulation_id, limit=limit, offset=offset
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.post(
    "/agents/{agent_id}/relationships",
    response_model=SuccessResponse[RelationshipResponse],
    status_code=201,
)
async def create_relationship(
    simulation_id: UUID,
    agent_id: UUID,
    body: RelationshipCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a relationship between two agents."""
    result = await RelationshipService.create_relationship(
        supabase, simulation_id, agent_id, body.model_dump(exclude_none=True)
    )
    await AuditService.log_action(
        supabase, simulation_id, user.id, "agent_relationships", result["id"], "create"
    )
    return {"success": True, "data": result}


@router.patch(
    "/relationships/{relationship_id}",
    response_model=SuccessResponse[RelationshipResponse],
)
async def update_relationship(
    simulation_id: UUID,
    relationship_id: UUID,
    body: RelationshipUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update a relationship."""
    result = await RelationshipService.update_relationship(
        supabase, simulation_id, relationship_id, body.model_dump(exclude_none=True)
    )
    await AuditService.log_action(
        supabase, simulation_id, user.id, "agent_relationships", relationship_id, "update"
    )
    return {"success": True, "data": result}


@router.delete(
    "/relationships/{relationship_id}",
    response_model=SuccessResponse[dict],
)
async def delete_relationship(
    simulation_id: UUID,
    relationship_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Delete a relationship."""
    await RelationshipService.delete_relationship(supabase, simulation_id, relationship_id)
    await AuditService.log_action(
        supabase, simulation_id, user.id, "agent_relationships", relationship_id, "delete"
    )
    return {"success": True, "data": {"message": "Relationship deleted."}}
