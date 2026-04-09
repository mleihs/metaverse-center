"""Zone action endpoints (fortification system)."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.dependencies import get_current_user, get_effective_supabase, require_role
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.zone_action import ZoneActionCreate, ZoneActionResponse
from backend.services.audit_service import AuditService
from backend.services.zone_action_service import ZoneActionService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/zones/{zone_id}/actions",
    tags=["zone-actions"],
)


@router.get("")
async def list_zone_actions(
    simulation_id: UUID,
    zone_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[ZoneActionResponse]]:
    """List active and recent actions for a zone."""
    data = await ZoneActionService.list_actions(supabase, simulation_id, zone_id)
    return SuccessResponse(data=data)


@router.post("", status_code=201)
async def create_zone_action(
    simulation_id: UUID,
    zone_id: UUID,
    body: ZoneActionCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ZoneActionResponse]:
    """Create a zone fortification action."""
    action = await ZoneActionService.create_action(
        supabase,
        simulation_id,
        zone_id,
        body.action_type,
        user.id,
    )
    await AuditService.log_action(
        supabase,
        simulation_id,
        user.id,
        "zone_actions",
        action["id"],
        "create",
        details={"action_type": body.action_type},
    )
    return SuccessResponse(data=action)


@router.delete("/{action_id}")
async def cancel_zone_action(
    simulation_id: UUID,
    zone_id: UUID,
    action_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ZoneActionResponse]:
    """Cancel an active zone action."""
    action = await ZoneActionService.cancel_action(
        supabase,
        simulation_id,
        zone_id,
        action_id,
    )
    await AuditService.log_action(
        supabase,
        simulation_id,
        user.id,
        "zone_actions",
        action_id,
        "cancel",
    )
    return SuccessResponse(data=action)
