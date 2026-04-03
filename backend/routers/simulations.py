import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_supabase,
    require_owner_or_platform_admin,
    require_role,
)
from backend.models.common import (
    CurrentUser,
    PaginatedResponse,
    PaginationMeta,
    SuccessResponse,
)
from backend.models.lore import LoreSectionCreate, LoreSectionReorder, LoreSectionUpdate
from backend.models.simulation import (
    SimulationCreate,
    SimulationDashboardResponse,
    SimulationResponse,
    SimulationUpdate,
)
from backend.services.audit_service import AuditService
from backend.services.lore_service import LoreService
from backend.services.simulation_service import SimulationService
from backend.services.threshold_service import ThresholdService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/simulations", tags=["simulations"])

_service = SimulationService()
_lore_service = LoreService()


@router.get("")
async def list_simulations(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
    status: Annotated[str | None, Query(description="Filter by simulation status")] = None,
    limit: Annotated[int, Query(ge=1, le=100, description="Max results per page")] = 25,
    offset: Annotated[int, Query(ge=0, description="Pagination offset")] = 0,
) -> PaginatedResponse[SimulationResponse]:
    """List all simulations the current user is a member of."""
    data, total = await _service.list_simulations(
        supabase=supabase,
        user_id=user.id,
        status_filter=status,
        limit=limit,
        offset=offset,
    )

    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(
            count=len(data),
            total=total,
            limit=limit,
            offset=offset,
        ),
    )


@router.post("", status_code=201)
async def create_simulation(
    body: SimulationCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[SimulationResponse]:
    """Create a new simulation. Auto-generates slug if not provided. Creator becomes owner."""
    simulation = await _service.create_simulation(
        supabase=supabase,
        user_id=user.id,
        data=body,
    )
    await AuditService.safe_log(
        supabase, UUID(simulation["id"]), user.id, "simulations", simulation["id"], "create",
        details={"name": body.name},
    )

    return SuccessResponse(data=simulation)


@router.get("/{simulation_id}")
async def get_simulation(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[SimulationDashboardResponse]:
    """Get a single simulation with aggregated counts from the dashboard view."""
    simulation = await _service.get_simulation(
        supabase=supabase,
        simulation_id=simulation_id,
    )

    return SuccessResponse(data=simulation)


@router.put("/{simulation_id}")
async def update_simulation(
    simulation_id: UUID,
    body: SimulationUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[SimulationResponse]:
    """Update a simulation. Requires admin role or higher."""
    simulation = await _service.update_simulation(
        supabase=supabase,
        simulation_id=simulation_id,
        data=body,
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "simulations", simulation_id, "update",
    )

    return SuccessResponse(data=simulation)


@router.delete("/{simulation_id}")
async def delete_simulation(
    simulation_id: UUID,
    auth: Annotated[tuple[CurrentUser, bool], Depends(require_owner_or_platform_admin())],
    supabase: Annotated[Client, Depends(get_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[SimulationResponse]:
    """Soft-delete a simulation. Requires owner role or platform admin."""
    _user, is_admin = auth
    client = admin_supabase if is_admin else supabase

    simulation = await _service.delete_simulation(
        supabase=client,
        simulation_id=simulation_id,
    )
    await AuditService.safe_log(
        client, simulation_id, _user.id, "simulations", simulation_id, "delete",
    )

    return SuccessResponse(data=simulation)


# ── Threshold Actions ────────────────────────────────────────────────


@router.post("/{simulation_id}/threshold-actions/{action_type}")
async def execute_threshold_action(
    simulation_id: UUID,
    action_type: str,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    target_building_id: Annotated[UUID | None, Query()] = None,
    target_zone_id: Annotated[UUID | None, Query()] = None,
) -> SuccessResponse:
    """Execute a threshold action (scorched_earth, emergency_draft, reality_anchor).

    Requires simulation health below 0.25 (critical threshold).
    """
    result = await ThresholdService.execute_action(
        admin_supabase,
        simulation_id,
        action_type,
        user.id,
        target_building_id=target_building_id,
        target_zone_id=target_zone_id,
    )
    return SuccessResponse(data=result)


# ── Lore CRUD endpoints ──────────────────────────────────────────────


@router.post("/{simulation_id}/lore", status_code=201)
async def create_lore_section(
    simulation_id: UUID,
    body: LoreSectionCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse:
    """Create a new lore section for a simulation."""
    section = await _lore_service.create_section(
        supabase, simulation_id, body.model_dump(exclude_none=True)
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "lore_sections", section.get("id"), "create",
        details={"title": body.title if hasattr(body, "title") else None},
    )
    return SuccessResponse(data=section)


@router.patch("/{simulation_id}/lore/{section_id}")
async def update_lore_section(
    simulation_id: UUID,
    section_id: UUID,
    body: LoreSectionUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse:
    """Update a lore section. Stale _de fields are auto-nulled."""
    section = await _lore_service.update_section(
        supabase, simulation_id, section_id, body.model_dump(exclude_none=True)
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "lore_sections", section_id, "update",
    )
    return SuccessResponse(data=section)


@router.delete("/{simulation_id}/lore/{section_id}")
async def delete_lore_section(
    simulation_id: UUID,
    section_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse:
    """Delete a lore section and re-sort remaining sections."""
    deleted = await _lore_service.delete_section(supabase, simulation_id, section_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "lore_sections", section_id, "delete",
    )
    return SuccessResponse(data=deleted)


@router.put("/{simulation_id}/lore")
async def reorder_lore_sections(
    simulation_id: UUID,
    body: LoreSectionReorder,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse:
    """Bulk reorder lore sections by providing ordered section IDs."""
    sections = await _lore_service.reorder_sections(
        supabase, simulation_id, body.section_ids
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "lore_sections", None, "reorder",
        details={"section_count": len(body.section_ids)},
    )
    return SuccessResponse(data=sections)
