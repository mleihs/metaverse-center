"""Service layer for location operations (cities, zones, streets)."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from supabase import Client


class LocationService:
    """Service for cities, zones, and streets — not using BaseService since no soft-delete."""

    # --- Cities ---

    @staticmethod
    async def list_cities(
        supabase: Client,
        simulation_id: UUID,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List all cities in a simulation."""
        response = (
            supabase.table("cities")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("name")
            .range(offset, offset + limit - 1)
            .execute()
        )
        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @staticmethod
    async def get_city(supabase: Client, simulation_id: UUID, city_id: UUID) -> dict:
        """Get a single city."""
        response = (
            supabase.table("cities")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(city_id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"City '{city_id}' not found.")
        return response.data

    @staticmethod
    async def create_city(supabase: Client, simulation_id: UUID, data: dict) -> dict:
        """Create a new city."""
        response = (
            supabase.table("cities")
            .insert({**data, "simulation_id": str(simulation_id)})
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create city.")
        return response.data[0]

    @staticmethod
    async def update_city(supabase: Client, simulation_id: UUID, city_id: UUID, data: dict) -> dict:
        """Update a city."""
        if not data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")
        data["updated_at"] = datetime.now(UTC).isoformat()
        response = (
            supabase.table("cities")
            .update(data)
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(city_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"City '{city_id}' not found.")
        return response.data[0]

    # --- Zones ---

    @staticmethod
    async def list_zones(
        supabase: Client,
        simulation_id: UUID,
        city_id: UUID | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List zones, optionally filtered by city."""
        query = (
            supabase.table("zones")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("name")
        )
        if city_id:
            query = query.eq("city_id", str(city_id))
        query = query.range(offset, offset + limit - 1)
        response = query.execute()
        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @staticmethod
    async def get_zone(supabase: Client, simulation_id: UUID, zone_id: UUID) -> dict:
        """Get a single zone."""
        response = (
            supabase.table("zones")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(zone_id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Zone '{zone_id}' not found.")
        return response.data

    @staticmethod
    async def create_zone(supabase: Client, simulation_id: UUID, data: dict) -> dict:
        """Create a new zone."""
        response = (
            supabase.table("zones")
            .insert({**data, "simulation_id": str(simulation_id)})
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create zone.")
        return response.data[0]

    @staticmethod
    async def update_zone(supabase: Client, simulation_id: UUID, zone_id: UUID, data: dict) -> dict:
        """Update a zone."""
        if not data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")
        data["updated_at"] = datetime.now(UTC).isoformat()
        response = (
            supabase.table("zones")
            .update(data)
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(zone_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Zone '{zone_id}' not found.")
        return response.data[0]

    # --- Streets ---

    @staticmethod
    async def list_streets(
        supabase: Client,
        simulation_id: UUID,
        city_id: UUID | None = None,
        zone_id: UUID | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List streets, optionally filtered by city or zone."""
        query = (
            supabase.table("city_streets")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("name")
        )
        if city_id:
            query = query.eq("city_id", str(city_id))
        if zone_id:
            query = query.eq("zone_id", str(zone_id))
        query = query.range(offset, offset + limit - 1)
        response = query.execute()
        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @staticmethod
    async def create_street(supabase: Client, simulation_id: UUID, data: dict) -> dict:
        """Create a new street."""
        response = (
            supabase.table("city_streets")
            .insert({**data, "simulation_id": str(simulation_id)})
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create street.")
        return response.data[0]

    @staticmethod
    async def update_street(supabase: Client, simulation_id: UUID, street_id: UUID, data: dict) -> dict:
        """Update a street."""
        if not data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")
        data["updated_at"] = datetime.now(UTC).isoformat()
        response = (
            supabase.table("city_streets")
            .update(data)
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(street_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Street '{street_id}' not found.")
        return response.data[0]
