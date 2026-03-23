"""Zone action endpoints (fortification system)."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.dependencies import get_current_user, get_supabase, require_role
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


@router.get("", response_model=SuccessResponse[list[ZoneActionResponse]])
async def list_zone_actions(
    simulation_id: UUID,
    zone_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List active and recent actions for a zone."""
    data = await ZoneActionService.list_actions(supabase, simulation_id, zone_id)
    return {"success": True, "data": data}


@router.post("", response_model=SuccessResponse[ZoneActionResponse], status_code=201)
async def create_zone_action(
    simulation_id: UUID,
    zone_id: UUID,
    body: ZoneActionCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a zone fortification action."""
    action = await ZoneActionService.create_action(
        supabase, simulation_id, zone_id, body.action_type, user.id,
    )
    await AuditService.log_action(
        supabase, simulation_id, user.id, "zone_actions", action["id"], "create",
        details={"action_type": body.action_type},
    )
    return {"success": True, "data": action}


@router.delete("/{action_id}", response_model=SuccessResponse[ZoneActionResponse])
async def cancel_zone_action(
    simulation_id: UUID,
    zone_id: UUID,
    action_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Cancel an active zone action."""
    action = await ZoneActionService.cancel_action(
        supabase, simulation_id, zone_id, action_id,
    )
    await AuditService.log_action(
        supabase, simulation_id, user.id, "zone_actions", action_id, "cancel",
    )
    return {"success": True, "data": action}
