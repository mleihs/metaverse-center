"""Embassy endpoints — cross-simulation building links."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_effective_supabase,
    require_role,
)
from backend.models.common import CurrentUser, PaginatedResponse, SuccessResponse
from backend.models.embassy import (
    EmbassyCreate,
    EmbassyResponse,
    EmbassyUpdate,
)
from backend.services.audit_service import AuditService
from backend.services.connection_service import ConnectionService
from backend.services.embassy_service import EmbassyService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}",
    tags=["embassies"],
)


@router.get("/embassies")
async def list_embassies(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    status: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[EmbassyResponse]:
    """List embassies for a simulation."""
    data, total = await EmbassyService.list_for_simulation(
        supabase,
        simulation_id,
        status_filter=status,
        limit=limit,
        offset=offset,
    )
    return paginated(data, total, limit, offset)


@router.get("/embassies/{embassy_id}")
async def get_embassy(
    simulation_id: UUID,
    embassy_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EmbassyResponse]:
    """Get a single embassy."""
    data = await EmbassyService.get(supabase, embassy_id)
    return SuccessResponse(data=data)


@router.get("/buildings/{building_id}/embassy")
async def get_building_embassy(
    simulation_id: UUID,
    building_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EmbassyResponse | None]:
    """Get the embassy linked to a specific building."""
    data = await EmbassyService.get_for_building(supabase, building_id)
    return SuccessResponse(data=data)


@router.post("/embassies", status_code=201)
async def create_embassy(
    simulation_id: UUID,
    body: EmbassyCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EmbassyResponse]:
    """Create an embassy between two buildings in different simulations."""
    result = await EmbassyService.create_embassy(
        admin_supabase,
        body.model_dump(exclude_none=True),
        created_by_id=user.id,
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "embassies", result["id"], "create")
    ConnectionService._map_data_cache.clear()
    return SuccessResponse(data=result)


@router.patch("/embassies/{embassy_id}")
async def update_embassy(
    simulation_id: UUID,
    embassy_id: UUID,
    body: EmbassyUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EmbassyResponse]:
    """Update embassy metadata."""
    result = await EmbassyService.update_embassy(
        admin_supabase,
        embassy_id,
        body.model_dump(exclude_none=True),
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "embassies", embassy_id, "update")
    ConnectionService._map_data_cache.clear()
    return SuccessResponse(data=result)


@router.patch("/embassies/{embassy_id}/activate")
async def activate_embassy(
    simulation_id: UUID,
    embassy_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EmbassyResponse]:
    """Activate a proposed or suspended embassy."""
    result = await EmbassyService.transition_status(admin_supabase, embassy_id, "active")
    await AuditService.log_action(supabase, simulation_id, user.id, "embassies", embassy_id, "update")
    ConnectionService._map_data_cache.clear()
    return SuccessResponse(data=result)


@router.patch("/embassies/{embassy_id}/suspend")
async def suspend_embassy(
    simulation_id: UUID,
    embassy_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EmbassyResponse]:
    """Suspend an active embassy."""
    result = await EmbassyService.transition_status(admin_supabase, embassy_id, "suspended")
    await AuditService.log_action(supabase, simulation_id, user.id, "embassies", embassy_id, "update")
    ConnectionService._map_data_cache.clear()
    return SuccessResponse(data=result)


@router.patch("/embassies/{embassy_id}/dissolve")
async def dissolve_embassy(
    simulation_id: UUID,
    embassy_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EmbassyResponse]:
    """Dissolve an embassy (clears building special attributes)."""
    result = await EmbassyService.transition_status(admin_supabase, embassy_id, "dissolved")
    await AuditService.log_action(supabase, simulation_id, user.id, "embassies", embassy_id, "update")
    ConnectionService._map_data_cache.clear()
    return SuccessResponse(data=result)


# ── Ward Mechanic (migration 191) ────────────────────


@router.patch("/embassies/{embassy_id}/ward")
async def set_embassy_ward(
    simulation_id: UUID,
    embassy_id: UUID,
    ward_vector: Annotated[str, Query(description="Bleed vector to ward against")],
    ward_strength: Annotated[float, Query(ge=0.0, le=1.0, description="Ward reduction strength")] = 0.5,
    user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    _role_check: Annotated[str, Depends(require_role("editor"))] = None,
    supabase: Annotated[Client, Depends(get_effective_supabase)] = None,
) -> SuccessResponse[EmbassyResponse]:
    """Set a bleed ward on an embassy to reduce incoming echo strength.

    The ward reduces the echo_strength of matching-vector echoes by
    ``ward_strength`` (e.g., 0.5 = halve incoming echo power). Only
    one ward_vector per embassy; setting a new one replaces the old.
    """
    result = await EmbassyService.set_ward(supabase, embassy_id, ward_vector, ward_strength)
    await AuditService.log_action(supabase, simulation_id, user.id, "embassies", embassy_id, "update")
    return SuccessResponse(data=result)


@router.delete("/embassies/{embassy_id}/ward")
async def remove_embassy_ward(
    simulation_id: UUID,
    embassy_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    _role_check: Annotated[str, Depends(require_role("editor"))] = None,
    supabase: Annotated[Client, Depends(get_effective_supabase)] = None,
) -> SuccessResponse[EmbassyResponse]:
    """Remove the bleed ward from an embassy."""
    result = await EmbassyService.remove_ward(supabase, embassy_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "embassies", embassy_id, "update")
    return SuccessResponse(data=result)
