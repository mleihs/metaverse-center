"""Location endpoints: cities, zones, and streets."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.common import (
    CurrentUser,
    PaginatedResponse,
    PaginationMeta,
    SuccessResponse,
)
from backend.models.location import (
    CityCreate,
    CityResponse,
    CityUpdate,
    StreetCreate,
    StreetResponse,
    StreetUpdate,
    ZoneCreate,
    ZoneResponse,
    ZoneUpdate,
)
from backend.services.audit_service import AuditService
from backend.services.location_service import LocationService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/locations",
    tags=["locations"],
)

_service = LocationService()


# --- Cities ---


@router.get("/cities")
async def list_cities(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[CityResponse]:
    """List all cities in a simulation."""
    data, total = await _service.list_cities(supabase, simulation_id, limit=limit, offset=offset)
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


@router.get("/cities/{city_id}")
async def get_city(
    simulation_id: UUID,
    city_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[CityResponse]:
    """Get a single city."""
    city = await _service.get_city(supabase, simulation_id, city_id)
    return SuccessResponse(data=city)


@router.post("/cities", status_code=201)
async def create_city(
    simulation_id: UUID,
    body: CityCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[CityResponse]:
    """Create a new city."""
    city = await _service.create_city(supabase, simulation_id, body.model_dump(exclude_none=True))
    await AuditService.log_action(supabase, simulation_id, user.id, "cities", city["id"], "create")
    return SuccessResponse(data=city)


@router.put("/cities/{city_id}")
async def update_city(
    simulation_id: UUID,
    city_id: UUID,
    body: CityUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[CityResponse]:
    """Update a city. Requires admin role."""
    city = await _service.update_city(supabase, simulation_id, city_id, body.model_dump(exclude_none=True))
    await AuditService.log_action(supabase, simulation_id, user.id, "cities", city_id, "update")
    return SuccessResponse(data=city)


# --- Zones ---


@router.get("/zones")
async def list_zones(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
    city_id: Annotated[UUID | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[ZoneResponse]:
    """List zones, optionally filtered by city."""
    data, total = await _service.list_zones(supabase, simulation_id, city_id=city_id, limit=limit, offset=offset)
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


@router.get("/zones/{zone_id}")
async def get_zone(
    simulation_id: UUID,
    zone_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[ZoneResponse]:
    """Get a single zone."""
    zone = await _service.get_zone(supabase, simulation_id, zone_id)
    return SuccessResponse(data=zone)


@router.post("/zones", status_code=201)
async def create_zone(
    simulation_id: UUID,
    body: ZoneCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[ZoneResponse]:
    """Create a new zone."""
    zone = await _service.create_zone(supabase, simulation_id, body.model_dump(exclude_none=True))
    await AuditService.log_action(supabase, simulation_id, user.id, "zones", zone["id"], "create")
    return SuccessResponse(data=zone)


@router.put("/zones/{zone_id}")
async def update_zone(
    simulation_id: UUID,
    zone_id: UUID,
    body: ZoneUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[ZoneResponse]:
    """Update a zone. Requires admin role."""
    zone = await _service.update_zone(supabase, simulation_id, zone_id, body.model_dump(exclude_none=True))
    await AuditService.log_action(supabase, simulation_id, user.id, "zones", zone_id, "update")
    return SuccessResponse(data=zone)


# --- Streets ---


@router.get("/streets")
async def list_streets(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
    city_id: Annotated[UUID | None, Query()] = None,
    zone_id: Annotated[UUID | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[StreetResponse]:
    """List streets, optionally filtered by city or zone."""
    data, total = await _service.list_streets(
        supabase, simulation_id, city_id=city_id, zone_id=zone_id, limit=limit, offset=offset,
    )
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


@router.post("/streets", status_code=201)
async def create_street(
    simulation_id: UUID,
    body: StreetCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[StreetResponse]:
    """Create a new street."""
    street = await _service.create_street(supabase, simulation_id, body.model_dump(exclude_none=True))
    await AuditService.log_action(supabase, simulation_id, user.id, "city_streets", street["id"], "create")
    return SuccessResponse(data=street)


@router.put("/streets/{street_id}")
async def update_street(
    simulation_id: UUID,
    street_id: UUID,
    body: StreetUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[StreetResponse]:
    """Update a street. Requires admin role."""
    street = await _service.update_street(supabase, simulation_id, street_id, body.model_dump(exclude_none=True))
    await AuditService.log_action(supabase, simulation_id, user.id, "city_streets", street_id, "update")
    return SuccessResponse(data=street)
