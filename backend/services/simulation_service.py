import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.models.simulation import SimulationCreate, SimulationUpdate
from backend.utils.slug import slugify
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


_THEME_TO_PRESET: dict[str, str] = {
    "dystopian": "cyberpunk",
    "utopian": "illuminated-literary",
    "fantasy": "sunless-sea",
    "scifi": "cyberpunk",
    "historical": "nordic-noir",
}


def _get_preset_for_theme(theme: str) -> str:
    """Map a simulation theme to the recommended design preset name."""
    return _THEME_TO_PRESET.get(theme, "brutalist")


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

        Uses ``simulation_dashboard`` view directly to get simulation fields
        and aggregated counts in a single query (SQL-side JOIN via the view),
        avoiding a Python-side dict merge.
        """
        # Get simulation IDs the user is a member of (templates only).
        # Filter at join level to avoid URI-too-long errors when the user has
        # many game instance / archived memberships (PostgREST URI limit).
        membership_response = await (
            supabase.table("simulation_members")
            .select("simulation_id, simulations!inner(simulation_type)")
            .eq("user_id", str(user_id))
            .eq("simulations.simulation_type", "template")
            .execute()
        )

        sim_ids = [m["simulation_id"] for m in (membership_response.data or [])]

        if not sim_ids:
            return [], 0

        # Query simulation_dashboard view directly — it contains all simulation
        # fields plus pre-aggregated counts (agent, building, event, member).
        # This replaces the previous two-query + Python-side dict merge pattern.
        query = (
            supabase.table("simulation_dashboard")
            .select("*", count="exact")
            .in_("simulation_id", sim_ids)
            .eq("simulation_type", "template")
            .order("created_at", desc=True)
        )

        if status_filter:
            query = query.eq("status", status_filter)

        query = query.range(offset, offset + limit - 1)
        response = await query.execute()

        total = response.count if response.count is not None else len(response.data or [])
        data = response.data or []

        # Normalize simulation_id → id for API contract compatibility
        for sim in data:
            if "simulation_id" in sim and "id" not in sim:
                sim["id"] = sim["simulation_id"]

        return data, total

    @staticmethod
    async def create_simulation(
        supabase: Client,
        user_id: UUID,
        data: SimulationCreate,
    ) -> dict:
        """Create a new simulation and add the creator as owner member."""
        slug = data.slug if data.slug else slugify(data.name)

        # Check slug uniqueness
        existing = await (
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

        sim_response = await (
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
        logger.info(
            "Simulation created",
            extra={"simulation_id": simulation["id"], "slug": slug, "user_id": str(user_id)},
        )

        # Add creator as owner member
        await supabase.table("simulation_members").insert({
            "simulation_id": simulation["id"],
            "user_id": str(user_id),
            "member_role": "owner",
        }).execute()

        # Seed theme_preset design setting so ThemeService resolves the
        # correct base preset instead of always falling back to brutalist.
        preset = _get_preset_for_theme(data.theme)
        if preset != "brutalist":
            await supabase.table("simulation_settings").upsert({
                "simulation_id": simulation["id"],
                "category": "design",
                "setting_key": "theme_preset",
                "setting_value": f'"{preset}"',
                "updated_by_id": str(user_id),
            }).execute()

        return simulation

    @staticmethod
    async def get_simulation(
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Get a single simulation from the ``simulation_dashboard`` view (migration 011, updated 035)."""
        response = await (
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

        response = await (
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
        response = await (
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

        logger.info("Simulation soft-deleted", extra={"simulation_id": str(simulation_id)})
        return response.data[0]

    @staticmethod
    async def hard_delete_simulation(
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Permanently delete a simulation and all related data.

        1. Clean up Storage files (portraits, building images, banners, lore images).
        2. DELETE the simulation row — FK CASCADE handles dependent DB rows.

        Uses admin (service_role) client to bypass RLS.
        """
        fetch = await (
            supabase.table("simulations")
            .select("id, name, slug")
            .eq("id", str(simulation_id))
            .maybe_single()
            .execute()
        )
        if not fetch.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation '{simulation_id}' not found.",
            )

        sim_info = fetch.data
        sim_id_str = str(simulation_id)
        slug = sim_info.get("slug", "")

        # ── Storage cleanup (best-effort) ────────────────────────────
        await SimulationService._purge_storage_folder(supabase, "agent.portraits", sim_id_str)
        await SimulationService._purge_storage_folder(supabase, "building.images", sim_id_str)
        await SimulationService._purge_storage_folder(supabase, "simulation.assets", sim_id_str)
        if slug:
            await SimulationService._purge_storage_folder(supabase, "simulation.assets", slug)

        # ── DB delete (cascades to all dependent tables) ─────────────
        logger.warning(
            "Simulation hard-deleted",
            extra={
                "simulation_id": sim_id_str,
                "simulation_name": sim_info.get("name"),
                "slug": slug,
            },
        )
        await supabase.table("simulations").delete().eq("id", sim_id_str).execute()
        return sim_info

    @staticmethod
    async def _purge_storage_folder(supabase: Client, bucket: str, prefix: str) -> None:
        """Recursively delete all files under a storage prefix (best-effort)."""
        try:
            files = await supabase.storage.from_(bucket).list(prefix)
            if not files:
                return

            # Separate actual files from nested folders
            file_paths: list[str] = []
            for item in files:
                name = item.get("name", "") if isinstance(item, dict) else getattr(item, "name", "")
                if not name or name == ".emptyFolderPlaceholder":
                    continue
                item_id = item.get("id") if isinstance(item, dict) else getattr(item, "id", None)
                if item_id:
                    # Regular file
                    file_paths.append(f"{prefix}/{name}")
                else:
                    # Subfolder — recurse
                    await SimulationService._purge_storage_folder(supabase, bucket, f"{prefix}/{name}")

            if file_paths:
                await supabase.storage.from_(bucket).remove(file_paths)
                logger.info(
                    "Purged storage files",
                    extra={"bucket": bucket, "prefix": prefix, "count": len(file_paths)},
                )
        except Exception:  # noqa: BLE001 — storage cleanup is best-effort
            logger.warning("Storage cleanup failed for %s/%s", bucket, prefix, exc_info=True)

    @staticmethod
    async def list_all_simulations(
        supabase: Client,
        include_deleted: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List all simulations (admin). Optionally include soft-deleted."""
        query = (
            supabase.table("simulations")
            .select("id, name, slug, status, theme, simulation_type, owner_id, created_at, deleted_at", count="exact")
            .eq("simulation_type", "template")
            .order("created_at", desc=True)
        )

        if not include_deleted:
            query = query.is_("deleted_at", "null")

        query = query.range(offset, offset + limit - 1)
        response = await query.execute()

        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @staticmethod
    async def list_deleted_simulations(
        supabase: Client,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List only soft-deleted simulations (admin trash view)."""
        query = (
            supabase.table("simulations")
            .select("id, name, slug, status, theme, simulation_type, owner_id, created_at, deleted_at", count="exact")
            .eq("simulation_type", "template")
            .not_.is_("deleted_at", "null")
            .order("deleted_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        response = await query.execute()

        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @classmethod
    async def get_simulation_context(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> dict | None:
        """Get lightweight simulation context (name + theme) for auto-translation.

        Returns {"name": ..., "theme": ...} or None if not found.
        """
        response = await (
            supabase.table("simulations")
            .select("name, theme")
            .eq("id", str(simulation_id))
            .maybe_single()
            .execute()
        )
        return response.data

    @classmethod
    async def check_exists(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Verify a simulation exists and return its row, or raise 404."""
        response = await (
            supabase.table("simulations")
            .select("id, name")
            .eq("id", str(simulation_id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Simulation not found.",
            )
        return response.data

    @classmethod
    async def list_active_slugs(
        cls,
        supabase: Client,
    ) -> list[dict]:
        """List slugs, IDs, and updated_at for all active simulations (sitemap)."""
        response = await (
            supabase.table("simulations")
            .select("id, slug, updated_at")
            .eq("status", "active")
            .execute()
        )
        return response.data or []

    @staticmethod
    async def restore_simulation(
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Restore a soft-deleted simulation."""
        response = await (
            supabase.table("simulations")
            .update({
                "deleted_at": None,
                "status": "active",
            })
            .eq("id", str(simulation_id))
            .not_.is_("deleted_at", "null")
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation '{simulation_id}' not found or not deleted.",
            )

        logger.info("Simulation restored", extra={"simulation_id": str(simulation_id)})
        return response.data[0]

    # ── Public query methods ─────────────────────────────

    @staticmethod
    async def get_platform_stats(supabase: Client) -> dict:
        """Aggregated platform statistics for landing page."""
        sims = await (
            supabase.table("simulations")
            .select("id", count="exact")
            .eq("simulation_type", "template")
            .is_("deleted_at", "null")
            .execute()
        )
        epochs = await (
            supabase.table("game_epochs")
            .select("id", count="exact")
            .in_("status", ["lobby", "foundation", "competition", "reckoning"])
            .execute()
        )
        resonances = await (
            supabase.table("substrate_resonances")
            .select("id", count="exact")
            .is_("deleted_at", "null")
            .execute()
        )
        return {
            "simulation_count": sims.count or 0,
            "active_epoch_count": epochs.count or 0,
            "resonance_count": resonances.count or 0,
        }

    @staticmethod
    async def enrich_with_counts(supabase: Client, simulations: list[dict]) -> None:
        """Enrich simulation dicts with counts from the ``simulation_dashboard`` view (migration 011, updated 035)."""
        if not simulations:
            return
        ids = [s["id"] for s in simulations]
        count_response = await (
            supabase.table("simulation_dashboard")
            .select("simulation_id, agent_count, building_count, event_count, member_count")
            .in_("simulation_id", ids)
            .execute()
        )
        counts_map = {row["simulation_id"]: row for row in (count_response.data or [])}
        for sim in simulations:
            counts = counts_map.get(sim["id"], {})
            sim["agent_count"] = counts.get("agent_count", 0)
            sim["building_count"] = counts.get("building_count", 0)
            sim["event_count"] = counts.get("event_count", 0)
            sim["member_count"] = counts.get("member_count", 0)

    @staticmethod
    async def list_active_public(
        supabase: Client,
        *,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List active template simulations (public, no auth)."""
        response = await (
            supabase.table("simulations")
            .select("*", count="exact")
            .eq("status", "active")
            .is_("deleted_at", "null")
            .eq("simulation_type", "template")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        data = response.data or []
        total = response.count if response.count is not None else len(data)
        return data, total

    @staticmethod
    async def get_by_slug(supabase: Client, slug: str) -> dict | None:
        """Get a single active simulation by slug (public)."""
        response = await (
            supabase.table("simulations")
            .select("*")
            .eq("slug", slug)
            .eq("status", "active")
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    @staticmethod
    async def get_active_by_id(supabase: Client, simulation_id: UUID) -> dict | None:
        """Get a single active simulation by ID (public)."""
        response = await (
            supabase.table("simulations")
            .select("*")
            .eq("id", str(simulation_id))
            .eq("status", "active")
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None
