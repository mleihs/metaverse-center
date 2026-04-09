"""Agent relationship CRUD endpoints."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_effective_supabase, require_role
from backend.models.common import CurrentUser, MessageResponse, PaginatedResponse, SuccessResponse
from backend.models.relationship import (
    RelationshipCreate,
    RelationshipResponse,
    RelationshipUpdate,
)
from backend.services.audit_service import AuditService
from backend.services.relationship_service import RelationshipService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}",
    tags=["relationships"],
)


@router.get("/agents/{agent_id}/relationships")
async def list_agent_relationships(
    simulation_id: UUID,
    agent_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[RelationshipResponse]]:
    """List all relationships for a specific agent (both directions)."""
    data = await RelationshipService.list_for_agent(supabase, simulation_id, agent_id)
    return SuccessResponse(data=data)


@router.get("/relationships")
async def list_simulation_relationships(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[RelationshipResponse]:
    """List all relationships in a simulation (for graph views)."""
    data, total = await RelationshipService.list_for_simulation(supabase, simulation_id, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


@router.post(
    "/agents/{agent_id}/relationships",
    status_code=201,
)
async def create_relationship(
    simulation_id: UUID,
    agent_id: UUID,
    body: RelationshipCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[RelationshipResponse]:
    """Create a relationship between two agents."""
    result = await RelationshipService.create_relationship(
        supabase, simulation_id, agent_id, body.model_dump(exclude_none=True)
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "agent_relationships", result["id"], "create")
    return SuccessResponse(data=result)


@router.patch("/relationships/{relationship_id}")
async def update_relationship(
    simulation_id: UUID,
    relationship_id: UUID,
    body: RelationshipUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[RelationshipResponse]:
    """Update a relationship."""
    result = await RelationshipService.update_relationship(
        supabase, simulation_id, relationship_id, body.model_dump(exclude_none=True)
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "agent_relationships", relationship_id, "update")
    return SuccessResponse(data=result)


@router.delete(
    "/relationships/{relationship_id}",
)
async def delete_relationship(
    simulation_id: UUID,
    relationship_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[MessageResponse]:
    """Delete a relationship."""
    await RelationshipService.delete_relationship(supabase, simulation_id, relationship_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "agent_relationships", relationship_id, "delete")
    return SuccessResponse(data=MessageResponse(message="Relationship deleted."))
