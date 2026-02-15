"""Location endpoints: cities, zones, and streets."""

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
from backend.services.location_service import LocationService
from supabase import Client

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/locations",
    tags=["locations"],
)

_service = LocationService()


# --- Cities ---


@router.get("/cities", response_model=PaginatedResponse[CityResponse])
async def list_cities(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List all cities in a simulation."""
    data, total = await _service.list_cities(supabase, simulation_id, limit=limit, offset=offset)
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/cities/{city_id}", response_model=SuccessResponse[CityResponse])
async def get_city(
    simulation_id: UUID,
    city_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single city."""
    city = await _service.get_city(supabase, simulation_id, city_id)
    return {"success": True, "data": city}


@router.post("/cities", response_model=SuccessResponse[CityResponse], status_code=201)
async def create_city(
    simulation_id: UUID,
    body: CityCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new city."""
    city = await _service.create_city(supabase, simulation_id, body.model_dump(exclude_none=True))
    return {"success": True, "data": city}


@router.put("/cities/{city_id}", response_model=SuccessResponse[CityResponse])
async def update_city(
    simulation_id: UUID,
    city_id: UUID,
    body: CityUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update a city. Requires admin role."""
    city = await _service.update_city(supabase, simulation_id, city_id, body.model_dump(exclude_none=True))
    return {"success": True, "data": city}


# --- Zones ---


@router.get("/zones", response_model=PaginatedResponse[ZoneResponse])
async def list_zones(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    city_id: UUID | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List zones, optionally filtered by city."""
    data, total = await _service.list_zones(supabase, simulation_id, city_id=city_id, limit=limit, offset=offset)
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/zones/{zone_id}", response_model=SuccessResponse[ZoneResponse])
async def get_zone(
    simulation_id: UUID,
    zone_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single zone."""
    zone = await _service.get_zone(supabase, simulation_id, zone_id)
    return {"success": True, "data": zone}


@router.post("/zones", response_model=SuccessResponse[ZoneResponse], status_code=201)
async def create_zone(
    simulation_id: UUID,
    body: ZoneCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new zone."""
    zone = await _service.create_zone(supabase, simulation_id, body.model_dump(exclude_none=True))
    return {"success": True, "data": zone}


@router.put("/zones/{zone_id}", response_model=SuccessResponse[ZoneResponse])
async def update_zone(
    simulation_id: UUID,
    zone_id: UUID,
    body: ZoneUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update a zone. Requires admin role."""
    zone = await _service.update_zone(supabase, simulation_id, zone_id, body.model_dump(exclude_none=True))
    return {"success": True, "data": zone}


# --- Streets ---


@router.get("/streets", response_model=PaginatedResponse[StreetResponse])
async def list_streets(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    city_id: UUID | None = Query(default=None),
    zone_id: UUID | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List streets, optionally filtered by city or zone."""
    data, total = await _service.list_streets(
        supabase, simulation_id, city_id=city_id, zone_id=zone_id, limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.post("/streets", response_model=SuccessResponse[StreetResponse], status_code=201)
async def create_street(
    simulation_id: UUID,
    body: StreetCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new street."""
    street = await _service.create_street(supabase, simulation_id, body.model_dump(exclude_none=True))
    return {"success": True, "data": street}


@router.put("/streets/{street_id}", response_model=SuccessResponse[StreetResponse])
async def update_street(
    simulation_id: UUID,
    street_id: UUID,
    body: StreetUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update a street. Requires admin role."""
    street = await _service.update_street(supabase, simulation_id, street_id, body.model_dump(exclude_none=True))
    return {"success": True, "data": street}
