import re
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.models.simulation import SimulationCreate, SimulationUpdate
from supabase import Client


def _slugify(name: str) -> str:
    """Generate a URL-safe slug from a simulation name."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")[:100]


class SimulationService:
    """Service layer for simulation CRUD operations."""

    @staticmethod
    async def list_simulations(
        supabase: Client,
        user_id: UUID,
        status_filter: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List simulations the user is a member of.

        Returns (data, total_count).
        """
        # Get simulation IDs the user is a member of
        membership_response = (
            supabase.table("simulation_members")
            .select("simulation_id")
            .eq("user_id", str(user_id))
            .execute()
        )

        sim_ids = [m["simulation_id"] for m in (membership_response.data or [])]

        if not sim_ids:
            return [], 0

        # Query simulations with filters (exclude game instances by default)
        query = (
            supabase.table("simulations")
            .select("*", count="exact")
            .in_("id", sim_ids)
            .is_("deleted_at", "null")
            .eq("simulation_type", "template")
            .order("created_at", desc=True)
        )

        if status_filter:
            query = query.eq("status", status_filter)

        query = query.range(offset, offset + limit - 1)
        response = query.execute()

        total = response.count if response.count is not None else len(response.data or [])
        data = response.data or []

        # Enrich with counts from the simulation_dashboard view
        if data:
            ids = [s["id"] for s in data]
            count_response = (
                supabase.table("simulation_dashboard")
                .select("simulation_id, agent_count, building_count, event_count, member_count")
                .in_("simulation_id", ids)
                .execute()
            )
            counts_map = {
                row["simulation_id"]: row
                for row in (count_response.data or [])
            }
            for sim in data:
                counts = counts_map.get(sim["id"], {})
                sim["agent_count"] = counts.get("agent_count", 0)
                sim["building_count"] = counts.get("building_count", 0)
                sim["event_count"] = counts.get("event_count", 0)
                sim["member_count"] = counts.get("member_count", 0)

        return data, total

    @staticmethod
    async def create_simulation(
        supabase: Client,
        user_id: UUID,
        data: SimulationCreate,
    ) -> dict:
        """Create a new simulation and add the creator as owner member."""
        slug = data.slug if data.slug else _slugify(data.name)

        # Check slug uniqueness
        existing = (
            supabase.table("simulations")
            .select("id")
            .eq("slug", slug)
            .limit(1)
            .execute()
        )

        if existing and existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A simulation with slug '{slug}' already exists.",
            )

        # Create simulation
        sim_data = {
            "name": data.name,
            "slug": slug,
            "description": data.description,
            "theme": data.theme,
            "content_locale": data.content_locale,
            "additional_locales": data.additional_locales,
            "owner_id": str(user_id),
        }

        sim_response = (
            supabase.table("simulations")
            .insert(sim_data)
            .execute()
        )

        if not sim_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create simulation.",
            )

        simulation = sim_response.data[0]

        # Add creator as owner member
        supabase.table("simulation_members").insert({
            "simulation_id": simulation["id"],
            "user_id": str(user_id),
            "member_role": "owner",
        }).execute()

        return simulation

    @staticmethod
    async def get_simulation(
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Get a single simulation from the simulation_dashboard view."""
        response = (
            supabase.table("simulation_dashboard")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .limit(1)
            .execute()
        )

        if not response or not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation '{simulation_id}' not found.",
            )

        return response.data[0]

    @staticmethod
    async def update_simulation(
        supabase: Client,
        simulation_id: UUID,
        data: SimulationUpdate,
    ) -> dict:
        """Update an existing simulation."""
        update_data = data.model_dump(exclude_none=True)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update.",
            )

        update_data["updated_at"] = datetime.now(UTC).isoformat()

        response = (
            supabase.table("simulations")
            .update(update_data)
            .eq("id", str(simulation_id))
            .is_("deleted_at", "null")
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation '{simulation_id}' not found.",
            )

        return response.data[0]

    @staticmethod
    async def delete_simulation(
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Soft-delete a simulation by setting deleted_at."""
        response = (
            supabase.table("simulations")
            .update({
                "deleted_at": datetime.now(UTC).isoformat(),
                "status": "archived",
            })
            .eq("id", str(simulation_id))
            .is_("deleted_at", "null")
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation '{simulation_id}' not found or already deleted.",
            )

        return response.data[0]
