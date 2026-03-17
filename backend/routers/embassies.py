"""Embassy endpoints — cross-simulation building links."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_supabase,
    require_role,
)
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.embassy import (
    EmbassyCreate,
    EmbassyResponse,
    EmbassyUpdate,
)
from backend.services.audit_service import AuditService
from backend.services.embassy_service import EmbassyService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}",
    tags=["embassies"],
)


@router.get("/embassies", response_model=PaginatedResponse[EmbassyResponse])
async def list_embassies(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    status: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List embassies for a simulation."""
    data, total = await EmbassyService.list_for_simulation(
        supabase, simulation_id,
        status_filter=status, limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get(
    "/embassies/{embassy_id}",
    response_model=SuccessResponse[EmbassyResponse],
)
async def get_embassy(
    simulation_id: UUID,
    embassy_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single embassy."""
    data = await EmbassyService.get(supabase, embassy_id)
    return {"success": True, "data": data}


@router.get(
    "/buildings/{building_id}/embassy",
    response_model=SuccessResponse[EmbassyResponse | None],
)
async def get_building_embassy(
    simulation_id: UUID,
    building_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get the embassy linked to a specific building."""
    data = await EmbassyService.get_for_building(supabase, building_id)
    return {"success": True, "data": data}


@router.post(
    "/embassies",
    response_model=SuccessResponse[EmbassyResponse],
    status_code=201,
)
async def create_embassy(
    simulation_id: UUID,
    body: EmbassyCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    admin_supabase: Client = Depends(get_admin_supabase),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create an embassy between two buildings in different simulations."""
    result = await EmbassyService.create_embassy(
        admin_supabase,
        body.model_dump(exclude_none=True),
        created_by_id=user.id,
    )
    await AuditService.log_action(
        supabase, simulation_id, user.id, "embassies", result["id"], "create"
    )
    return {"success": True, "data": result}


@router.patch(
    "/embassies/{embassy_id}",
    response_model=SuccessResponse[EmbassyResponse],
)
async def update_embassy(
    simulation_id: UUID,
    embassy_id: UUID,
    body: EmbassyUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    admin_supabase: Client = Depends(get_admin_supabase),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update embassy metadata."""
    result = await EmbassyService.update_embassy(
        admin_supabase, embassy_id,
        body.model_dump(exclude_none=True),
    )
    await AuditService.log_action(
        supabase, simulation_id, user.id, "embassies", embassy_id, "update"
    )
    return {"success": True, "data": result}


@router.patch(
    "/embassies/{embassy_id}/activate",
    response_model=SuccessResponse[EmbassyResponse],
)
async def activate_embassy(
    simulation_id: UUID,
    embassy_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    admin_supabase: Client = Depends(get_admin_supabase),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Activate a proposed or suspended embassy."""
    result = await EmbassyService.transition_status(admin_supabase, embassy_id, "active")
    await AuditService.log_action(
        supabase, simulation_id, user.id, "embassies", embassy_id, "update"
    )
    return {"success": True, "data": result}


@router.patch(
    "/embassies/{embassy_id}/suspend",
    response_model=SuccessResponse[EmbassyResponse],
)
async def suspend_embassy(
    simulation_id: UUID,
    embassy_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    admin_supabase: Client = Depends(get_admin_supabase),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Suspend an active embassy."""
    result = await EmbassyService.transition_status(admin_supabase, embassy_id, "suspended")
    await AuditService.log_action(
        supabase, simulation_id, user.id, "embassies", embassy_id, "update"
    )
    return {"success": True, "data": result}


@router.patch(
    "/embassies/{embassy_id}/dissolve",
    response_model=SuccessResponse[EmbassyResponse],
)
async def dissolve_embassy(
    simulation_id: UUID,
    embassy_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    admin_supabase: Client = Depends(get_admin_supabase),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Dissolve an embassy (clears building special attributes)."""
    result = await EmbassyService.transition_status(admin_supabase, embassy_id, "dissolved")
    await AuditService.log_action(
        supabase, simulation_id, user.id, "embassies", embassy_id, "update"
    )
    return {"success": True, "data": result}
