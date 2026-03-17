"""Service layer for location operations (cities, zones, streets).

Uses thin BaseService subclasses for CRUD, with LocationService as a
convenience facade that delegates to CityService, ZoneService, and
StreetService.
"""

from __future__ import annotations

import logging
from uuid import UUID

from backend.services.base_service import BaseService
from supabase import Client

logger = logging.getLogger(__name__)

# Placeholder user_id — location tables have no created_by_id column, so
# BaseService.create() never writes this value (supports_created_by = False).
_NO_USER = UUID(int=0)


class CityService(BaseService):
    table_name = "cities"
    view_name = None
    supports_created_by = False


class ZoneService(BaseService):
    table_name = "zones"
    view_name = None
    supports_created_by = False


class StreetService(BaseService):
    table_name = "city_streets"
    view_name = None
    supports_created_by = False


class LocationService:
    """Facade for cities, zones, and streets — delegates to sub-services."""

    # --- Cities ---

    @classmethod
    async def list_cities(
        cls, supabase: Client, simulation_id: UUID, limit: int = 25, offset: int = 0,
    ) -> tuple[list[dict], int]:
        return await CityService.list(
            supabase, simulation_id,
            order_by="name", order_desc=False, limit=limit, offset=offset,
        )

    @classmethod
    async def get_city(cls, supabase: Client, simulation_id: UUID, city_id: UUID) -> dict:
        return await CityService.get(supabase, simulation_id, city_id)

    @classmethod
    async def create_city(cls, supabase: Client, simulation_id: UUID, data: dict) -> dict:
        return await CityService.create(supabase, simulation_id, _NO_USER, data)

    @classmethod
    async def update_city(
        cls, supabase: Client, simulation_id: UUID, city_id: UUID, data: dict,
    ) -> dict:
        return await CityService.update(supabase, simulation_id, city_id, data)

    # --- Zones ---

    @classmethod
    async def list_zones(
        cls,
        supabase: Client,
        simulation_id: UUID,
        city_id: UUID | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        filters = {"city_id": str(city_id)} if city_id else None
        return await ZoneService.list(
            supabase, simulation_id,
            filters=filters, order_by="name", order_desc=False,
            limit=limit, offset=offset,
        )

    @classmethod
    async def get_zone(cls, supabase: Client, simulation_id: UUID, zone_id: UUID) -> dict:
        return await ZoneService.get(supabase, simulation_id, zone_id)

    @classmethod
    async def create_zone(cls, supabase: Client, simulation_id: UUID, data: dict) -> dict:
        return await ZoneService.create(supabase, simulation_id, _NO_USER, data)

    @classmethod
    async def update_zone(
        cls, supabase: Client, simulation_id: UUID, zone_id: UUID, data: dict,
    ) -> dict:
        return await ZoneService.update(supabase, simulation_id, zone_id, data)

    # --- Streets ---

    @classmethod
    async def list_streets(
        cls,
        supabase: Client,
        simulation_id: UUID,
        city_id: UUID | None = None,
        zone_id: UUID | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        filters: dict = {}
        if city_id:
            filters["city_id"] = str(city_id)
        if zone_id:
            filters["zone_id"] = str(zone_id)
        return await StreetService.list(
            supabase, simulation_id,
            filters=filters or None, order_by="name", order_desc=False,
            limit=limit, offset=offset,
        )

    @classmethod
    async def create_street(cls, supabase: Client, simulation_id: UUID, data: dict) -> dict:
        return await StreetService.create(supabase, simulation_id, _NO_USER, data)

    @classmethod
    async def update_street(
        cls, supabase: Client, simulation_id: UUID, street_id: UUID, data: dict,
    ) -> dict:
        return await StreetService.update(supabase, simulation_id, street_id, data)
