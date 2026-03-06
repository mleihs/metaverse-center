from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_admin_supabase, get_current_user, get_supabase, require_owner_or_platform_admin, require_role
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
from backend.services.lore_service import LoreService
from backend.services.simulation_service import SimulationService
from supabase import Client

router = APIRouter(prefix="/api/v1/simulations", tags=["simulations"])

_service = SimulationService()
_lore_service = LoreService()


@router.get("", response_model=PaginatedResponse[SimulationResponse])
async def list_simulations(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    status: str | None = Query(default=None, description="Filter by simulation status"),
    limit: int = Query(default=25, ge=1, le=100, description="Max results per page"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
) -> dict:
    """List all simulations the current user is a member of."""
    data, total = await _service.list_simulations(
        supabase=supabase,
        user_id=user.id,
        status_filter=status,
        limit=limit,
        offset=offset,
    )

    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(
            count=len(data),
            total=total,
            limit=limit,
            offset=offset,
        ),
    }


@router.post("", response_model=SuccessResponse[SimulationResponse], status_code=201)
async def create_simulation(
    body: SimulationCreate,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new simulation. Auto-generates slug if not provided. Creator becomes owner."""
    simulation = await _service.create_simulation(
        supabase=supabase,
        user_id=user.id,
        data=body,
    )

    return {"success": True, "data": simulation}


@router.get("/{simulation_id}", response_model=SuccessResponse[SimulationDashboardResponse])
async def get_simulation(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single simulation with aggregated counts from the dashboard view."""
    simulation = await _service.get_simulation(
        supabase=supabase,
        simulation_id=simulation_id,
    )

    return {"success": True, "data": simulation}


@router.put("/{simulation_id}", response_model=SuccessResponse[SimulationResponse])
async def update_simulation(
    simulation_id: UUID,
    body: SimulationUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update a simulation. Requires admin role or higher."""
    simulation = await _service.update_simulation(
        supabase=supabase,
        simulation_id=simulation_id,
        data=body,
    )

    return {"success": True, "data": simulation}


@router.delete("/{simulation_id}", response_model=SuccessResponse[SimulationResponse])
async def delete_simulation(
    simulation_id: UUID,
    auth: tuple[CurrentUser, bool] = Depends(require_owner_or_platform_admin()),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Soft-delete a simulation. Requires owner role or platform admin."""
    _user, is_admin = auth
    client = admin_supabase if is_admin else supabase

    simulation = await _service.delete_simulation(
        supabase=client,
        simulation_id=simulation_id,
    )

    return {"success": True, "data": simulation}


# ── Lore CRUD endpoints ──────────────────────────────────────────────


@router.post("/{simulation_id}/lore", response_model=SuccessResponse, status_code=201)
async def create_lore_section(
    simulation_id: UUID,
    body: LoreSectionCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new lore section for a simulation."""
    section = await _lore_service.create_section(
        supabase, simulation_id, body.model_dump(exclude_none=True)
    )
    return {"success": True, "data": section}


@router.patch("/{simulation_id}/lore/{section_id}", response_model=SuccessResponse)
async def update_lore_section(
    simulation_id: UUID,
    section_id: UUID,
    body: LoreSectionUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update a lore section. Stale _de fields are auto-nulled."""
    section = await _lore_service.update_section(
        supabase, simulation_id, section_id, body.model_dump(exclude_none=True)
    )
    return {"success": True, "data": section}


@router.delete("/{simulation_id}/lore/{section_id}", response_model=SuccessResponse)
async def delete_lore_section(
    simulation_id: UUID,
    section_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Delete a lore section and re-sort remaining sections."""
    deleted = await _lore_service.delete_section(supabase, simulation_id, section_id)
    return {"success": True, "data": deleted}


@router.put("/{simulation_id}/lore", response_model=SuccessResponse)
async def reorder_lore_sections(
    simulation_id: UUID,
    body: LoreSectionReorder,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Bulk reorder lore sections by providing ordered section IDs."""
    sections = await _lore_service.reorder_sections(
        supabase, simulation_id, body.section_ids
    )
    return {"success": True, "data": sections}
