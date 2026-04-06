"""Building CRUD endpoints with agent assignments and profession requirements."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query

from backend.dependencies import get_current_user, get_effective_supabase, require_role
from backend.models.building import (
    BuildingAgentResponse,
    BuildingCreate,
    BuildingResponse,
    BuildingUpdate,
    ProfessionRequirementResponse,
)
from backend.models.common import (
    CurrentUser,
    MessageResponse,
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


@router.get("")
async def list_buildings(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    building_type: Annotated[str | None, Query()] = None,
    building_condition: Annotated[str | None, Query()] = None,
    zone_id: Annotated[UUID | None, Query()] = None,
    city_id: Annotated[UUID | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[BuildingResponse]:
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
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


@router.get("/{building_id}")
async def get_building(
    simulation_id: UUID,
    building_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[BuildingResponse]:
    """Get a single building."""
    building = await _service.get(supabase, simulation_id, building_id)
    return SuccessResponse(data=building)


@router.post("", status_code=201)
async def create_building(
    simulation_id: UUID,
    body: BuildingCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[BuildingResponse]:
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
    return SuccessResponse(data=building)


@router.put("/{building_id}")
async def update_building(
    simulation_id: UUID,
    building_id: UUID,
    body: BuildingUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    if_updated_at: Annotated[str | None, Header(alias="If-Updated-At")] = None,
) -> SuccessResponse[BuildingResponse]:
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
    return SuccessResponse(data=building)


@router.delete("/{building_id}")
async def delete_building(
    simulation_id: UUID,
    building_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[BuildingResponse]:
    """Soft-delete a building."""
    building = await _service.soft_delete(supabase, simulation_id, building_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "buildings", building_id, "delete")
    return SuccessResponse(data=building)


@router.get("/{building_id}/agents")
async def get_building_agents(
    simulation_id: UUID,
    building_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[BuildingAgentResponse]]:
    """Get all agents assigned to a building."""
    agents = await _service.get_agents(supabase, simulation_id, building_id)
    return SuccessResponse(data=agents)


@router.post("/{building_id}/assign-agent", status_code=201)
async def assign_agent(
    simulation_id: UUID,
    building_id: UUID,
    agent_id: Annotated[UUID, Query()],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    relation_type: Annotated[str, Query()] = "works",
) -> SuccessResponse[BuildingAgentResponse]:
    """Assign an agent to a building."""
    relation = await _service.assign_agent(supabase, simulation_id, building_id, agent_id, relation_type)
    return SuccessResponse(data=relation)


@router.delete("/{building_id}/unassign-agent")
async def unassign_agent(
    simulation_id: UUID,
    building_id: UUID,
    agent_id: Annotated[UUID, Query()],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[MessageResponse]:
    """Remove an agent from a building."""
    await _service.unassign_agent(supabase, simulation_id, building_id, agent_id)
    return SuccessResponse(data=MessageResponse(message="Agent unassigned from building."))


@router.get("/{building_id}/profession-requirements")
async def get_profession_requirements(
    simulation_id: UUID,
    building_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[ProfessionRequirementResponse]]:
    """Get profession requirements for a building."""
    requirements = await _service.get_profession_requirements(supabase, simulation_id, building_id)
    return SuccessResponse(data=requirements)


@router.post("/{building_id}/profession-requirements", status_code=201)
async def set_profession_requirement(
    simulation_id: UUID,
    building_id: UUID,
    profession: Annotated[str, Query()],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    min_qualification_level: Annotated[int, Query(ge=1, le=5)] = 1,
    is_mandatory: Annotated[bool, Query()] = False,
) -> SuccessResponse[ProfessionRequirementResponse]:
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
    return SuccessResponse(data=req)


@router.get("/by-zone/{zone_id}")
async def get_buildings_by_zone(
    simulation_id: UUID,
    zone_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[BuildingResponse]]:
    """Get all buildings in a specific zone."""
    buildings = await _service.get_by_zone(supabase, simulation_id, zone_id)
    return SuccessResponse(data=buildings)
