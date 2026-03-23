"""Building CRUD endpoints with agent assignments and profession requirements."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.building import BuildingCreate, BuildingResponse, BuildingUpdate
from backend.models.common import (
    CurrentUser,
    PaginatedResponse,
    PaginationMeta,
    SuccessResponse,
)
from backend.services.audit_service import AuditService
from backend.services.building_service import BuildingService
from backend.services.simulation_service import SimulationService
from backend.services.translation_service import null_de_fields_for_update, schedule_auto_translation
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/buildings",
    tags=["buildings"],
)

_service = BuildingService()


@router.get("", response_model=PaginatedResponse[BuildingResponse])
async def list_buildings(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    building_type: str | None = Query(default=None),
    building_condition: str | None = Query(default=None),
    zone_id: UUID | None = Query(default=None),
    city_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List buildings in a simulation with optional filters."""
    data, total = await _service.list(
        supabase,
        simulation_id,
        building_type=building_type,
        building_condition=building_condition,
        zone_id=zone_id,
        city_id=city_id,
        search=search,
        limit=limit,
        offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/{building_id}", response_model=SuccessResponse[BuildingResponse])
async def get_building(
    simulation_id: UUID,
    building_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single building."""
    building = await _service.get(supabase, simulation_id, building_id)
    return {"success": True, "data": building}


@router.post("", response_model=SuccessResponse[BuildingResponse], status_code=201)
async def create_building(
    simulation_id: UUID,
    body: BuildingCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new building."""
    building = await _service.create(
        supabase, simulation_id, user.id, body.model_dump(exclude_none=True)
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "buildings", building["id"], "create")
    sim = await SimulationService.get_simulation_context(supabase, simulation_id)
    if sim:
        schedule_auto_translation(
            supabase, "buildings", building["id"], building,
            simulation_name=sim["name"], simulation_theme=sim.get("theme", ""),
            entity_type="building",
        )
    return {"success": True, "data": building}


@router.put("/{building_id}", response_model=SuccessResponse[BuildingResponse])
async def update_building(
    simulation_id: UUID,
    building_id: UUID,
    body: BuildingUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
    if_updated_at: str | None = Header(default=None, alias="If-Updated-At"),
) -> dict:
    """Update a building."""
    update_data = body.model_dump(exclude_none=True)
    de_nulls = null_de_fields_for_update("buildings", update_data)
    if de_nulls:
        update_data.update(de_nulls)
    building = await _service.update(
        supabase, simulation_id, building_id, update_data,
        if_updated_at=if_updated_at,
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "buildings", building_id, "update")
    if de_nulls:
        sim = await SimulationService.get_simulation_context(supabase, simulation_id)
        if sim:
            schedule_auto_translation(
                supabase, "buildings", building["id"], building,
                simulation_name=sim["name"], simulation_theme=sim.get("theme", ""),
                entity_type="building",
            )
    return {"success": True, "data": building}


@router.delete("/{building_id}", response_model=SuccessResponse[BuildingResponse])
async def delete_building(
    simulation_id: UUID,
    building_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Soft-delete a building."""
    building = await _service.soft_delete(supabase, simulation_id, building_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "buildings", building_id, "delete")
    return {"success": True, "data": building}


@router.get("/{building_id}/agents", response_model=SuccessResponse[list])
async def get_building_agents(
    simulation_id: UUID,
    building_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get all agents assigned to a building."""
    agents = await _service.get_agents(supabase, simulation_id, building_id)
    return {"success": True, "data": agents}


@router.post("/{building_id}/assign-agent", response_model=SuccessResponse[dict], status_code=201)
async def assign_agent(
    simulation_id: UUID,
    building_id: UUID,
    agent_id: UUID = Query(...),
    relation_type: str = Query(default="works"),
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Assign an agent to a building."""
    relation = await _service.assign_agent(supabase, simulation_id, building_id, agent_id, relation_type)
    return {"success": True, "data": relation}


@router.delete("/{building_id}/unassign-agent", response_model=SuccessResponse[dict])
async def unassign_agent(
    simulation_id: UUID,
    building_id: UUID,
    agent_id: UUID = Query(...),
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Remove an agent from a building."""
    await _service.unassign_agent(supabase, simulation_id, building_id, agent_id)
    return {"success": True, "data": {"message": "Agent unassigned from building."}}


@router.get("/{building_id}/profession-requirements", response_model=SuccessResponse[list])
async def get_profession_requirements(
    simulation_id: UUID,
    building_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get profession requirements for a building."""
    requirements = await _service.get_profession_requirements(supabase, simulation_id, building_id)
    return {"success": True, "data": requirements}


@router.post("/{building_id}/profession-requirements", response_model=SuccessResponse[dict], status_code=201)
async def set_profession_requirement(
    simulation_id: UUID,
    building_id: UUID,
    profession: str = Query(...),
    min_qualification_level: int = Query(default=1, ge=1, le=5),
    is_mandatory: bool = Query(default=False),
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Set or update a profession requirement for a building."""
    req = await _service.set_profession_requirement(
        supabase,
        simulation_id,
        building_id,
        {
            "profession": profession,
            "min_qualification_level": min_qualification_level,
            "is_mandatory": is_mandatory,
        },
    )
    return {"success": True, "data": req}


@router.get("/by-zone/{zone_id}", response_model=SuccessResponse[list])
async def get_buildings_by_zone(
    simulation_id: UUID,
    zone_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get all buildings in a specific zone."""
    buildings = await _service.get_by_zone(supabase, simulation_id, zone_id)
    return {"success": True, "data": buildings}
