"""Game mechanics read-only endpoints — health, readiness, stability, effectiveness.

Reads from materialized views via GameMechanicsService.
All endpoints are read-only (GET) except the admin-only refresh trigger.
"""

import logging
from typing import Annotated
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


@router.get("/health")
async def get_health_dashboard(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[SimulationHealthDashboard]:
    """Full health dashboard combining all metrics for a simulation."""
    data = await GameMechanicsService.get_health_dashboard(supabase, simulation_id)
    return SuccessResponse(data=data)


@router.get("/health/simulation")
async def get_simulation_health(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[SimulationHealthResponse]:
    """Top-level simulation health metrics only."""
    data = await GameMechanicsService.get_simulation_health(supabase, simulation_id)
    return SuccessResponse(data=data)


@router.get("/health/buildings")
async def list_building_readiness(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
    zone_id: Annotated[UUID | None, Query()] = None,
    order_by: Annotated[str, Query()] = "readiness",
    order_asc: Annotated[bool, Query()] = True,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[BuildingReadinessResponse]:
    """List building readiness for all buildings in a simulation."""
    data, total = await GameMechanicsService.list_building_readiness(
        supabase, simulation_id,
        zone_id=zone_id, order_by=order_by, order_asc=order_asc,
        limit=limit, offset=offset,
    )
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


@router.get("/health/buildings/{building_id}")
async def get_building_readiness(
    simulation_id: UUID,
    building_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[BuildingReadinessResponse]:
    """Get readiness metrics for a single building."""
    data = await GameMechanicsService.get_building_readiness(
        supabase, simulation_id, building_id,
    )
    return SuccessResponse(data=data)


@router.get("/health/zones")
async def list_zone_stability(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[list[ZoneStabilityResponse]]:
    """List zone stability for all zones in a simulation."""
    data = await GameMechanicsService.list_zone_stability(supabase, simulation_id)
    return SuccessResponse(data=data)


@router.get("/health/zones/{zone_id}")
async def get_zone_stability(
    simulation_id: UUID,
    zone_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[ZoneStabilityResponse]:
    """Get stability metrics for a single zone."""
    data = await GameMechanicsService.get_zone_stability(
        supabase, simulation_id, zone_id,
    )
    return SuccessResponse(data=data)


@router.get("/health/embassies")
async def list_embassy_effectiveness(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[list[EmbassyEffectivenessResponse]]:
    """List embassy effectiveness for embassies involving this simulation."""
    data = await GameMechanicsService.list_embassy_effectiveness(
        supabase, simulation_id,
    )
    return SuccessResponse(data=data)


@router.post(
    "/health/refresh",
)
async def refresh_metrics(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
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
