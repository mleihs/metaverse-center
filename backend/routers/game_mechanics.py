"""Game mechanics read-only endpoints — health, readiness, stability, effectiveness.

Reads from materialized views via GameMechanicsService.
All endpoints are read-only (GET) except the admin-only refresh trigger.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_admin_supabase, get_current_user, get_supabase, require_role
from backend.models.common import CurrentUser, MessageResponse, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.game_mechanics import (
    BuildingReadinessResponse,
    EmbassyEffectivenessResponse,
    SimulationHealthDashboard,
    SimulationHealthResponse,
    ZoneStabilityResponse,
)
from backend.services.audit_service import AuditService
from backend.services.game_mechanics_service import GameMechanicsService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}",
    tags=["game-mechanics"],
)


@router.get(
    "/health",
    response_model=SuccessResponse[SimulationHealthDashboard],
)
async def get_health_dashboard(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Full health dashboard combining all metrics for a simulation."""
    data = await GameMechanicsService.get_health_dashboard(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get(
    "/health/simulation",
    response_model=SuccessResponse[SimulationHealthResponse],
)
async def get_simulation_health(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Top-level simulation health metrics only."""
    data = await GameMechanicsService.get_simulation_health(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get(
    "/health/buildings",
    response_model=PaginatedResponse[BuildingReadinessResponse],
)
async def list_building_readiness(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    zone_id: UUID | None = Query(default=None),
    order_by: str = Query(default="readiness"),
    order_asc: bool = Query(default=True),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List building readiness for all buildings in a simulation."""
    data, total = await GameMechanicsService.list_building_readiness(
        supabase, simulation_id,
        zone_id=zone_id, order_by=order_by, order_asc=order_asc,
        limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get(
    "/health/buildings/{building_id}",
    response_model=SuccessResponse[BuildingReadinessResponse],
)
async def get_building_readiness(
    simulation_id: UUID,
    building_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get readiness metrics for a single building."""
    data = await GameMechanicsService.get_building_readiness(
        supabase, simulation_id, building_id,
    )
    return {"success": True, "data": data}


@router.get(
    "/health/zones",
    response_model=SuccessResponse[list[ZoneStabilityResponse]],
)
async def list_zone_stability(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List zone stability for all zones in a simulation."""
    data = await GameMechanicsService.list_zone_stability(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get(
    "/health/zones/{zone_id}",
    response_model=SuccessResponse[ZoneStabilityResponse],
)
async def get_zone_stability(
    simulation_id: UUID,
    zone_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get stability metrics for a single zone."""
    data = await GameMechanicsService.get_zone_stability(
        supabase, simulation_id, zone_id,
    )
    return {"success": True, "data": data}


@router.get(
    "/health/embassies",
    response_model=SuccessResponse[list[EmbassyEffectivenessResponse]],
)
async def list_embassy_effectiveness(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List embassy effectiveness for embassies involving this simulation."""
    data = await GameMechanicsService.list_embassy_effectiveness(
        supabase, simulation_id,
    )
    return {"success": True, "data": data}


@router.post(
    "/health/refresh",
    response_model=SuccessResponse[MessageResponse],
)
async def refresh_metrics(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> SuccessResponse[MessageResponse]:
    """Trigger a full refresh of all game mechanics materialized views.

    Admin-only — materialized views normally refresh via triggers,
    but this allows a manual refresh if needed.
    """
    await GameMechanicsService.refresh_metrics(admin_supabase)
    await AuditService.safe_log(
        admin_supabase, simulation_id, user.id,
        "game_mechanics", None, "refresh_metrics",
    )
    return SuccessResponse(data=MessageResponse(message="Game metrics refresh triggered."))
