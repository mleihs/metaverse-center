"""Game instance management — clone, archive, and delete epoch simulation instances."""

import logging
from uuid import UUID

from fastapi import HTTPException, status

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class GameInstanceService:
    """Service for managing simulation game instances during epochs.

    Game instances are cloned copies of template simulations, created
    atomically when an epoch starts. All gameplay (operatives, scoring)
    runs on instances, leaving templates untouched.
    """

    @classmethod
    async def clone_for_epoch(
        cls,
        admin_supabase: Client,
        epoch_id: UUID,
        created_by_id: UUID,
        epoch_number: int = 1,
    ) -> list[dict]:
        """Clone all participating simulations into game instances.

        Uses Postgres ``clone_simulations_for_epoch`` (migration 035, updated 038/047/060)
        for atomic batch cloning with embassy/connection remapping and normalized
        gameplay values.

        Args:
            admin_supabase: Supabase client with service_role (bypasses RLS)
            epoch_id: The epoch to clone simulations for
            created_by_id: User ID who owns the new instances
            epoch_number: Sequential epoch number (for slug suffix)

        Returns:
            List of {template_id, instance_id, slug, name} mappings
        """
        resp = await admin_supabase.rpc(
            "clone_simulations_for_epoch",
            {
                "p_epoch_id": str(epoch_id),
                "p_created_by_id": str(created_by_id),
                "p_epoch_number": epoch_number,
            },
        ).execute()

        if not resp.data:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "Failed to clone simulations for epoch.",
            )

        mapping = resp.data
        if not isinstance(mapping, list):
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "Clone function returned unexpected format.",
            )

        logger.info(
            "Cloned simulations for epoch",
            extra={"instance_count": len(mapping), "epoch_id": str(epoch_id)},
        )

        # Refresh materialized views so scoring picks up new instances
        await cls._refresh_game_metrics(admin_supabase)

        return mapping

    @classmethod
    async def archive_instances(
        cls,
        admin_supabase: Client,
        epoch_id: UUID,
    ) -> None:
        """Mark all game instances as archived via Postgres ``archive_epoch_instances`` (migration 035)."""
        await admin_supabase.rpc(
            "archive_epoch_instances",
            {"p_epoch_id": str(epoch_id)},
        ).execute()

        logger.info("Archived instances for epoch", extra={"epoch_id": str(epoch_id)})

    @classmethod
    async def delete_instances(
        cls,
        admin_supabase: Client,
        epoch_id: UUID,
    ) -> None:
        """Delete all game instances for a cancelled epoch via Postgres ``delete_epoch_instances`` (migration 035)."""
        await admin_supabase.rpc(
            "delete_epoch_instances",
            {"p_epoch_id": str(epoch_id)},
        ).execute()

        logger.info("Deleted instances for epoch", extra={"epoch_id": str(epoch_id)})

    @classmethod
    async def list_instances(
        cls,
        supabase: Client,
        epoch_id: UUID,
    ) -> list[dict]:
        """List all game instances for an epoch."""
        resp = await (
            supabase.table("simulations")
            .select("id, name, slug, theme, simulation_type, source_template_id, icon_url, banner_url")
            .eq("epoch_id", str(epoch_id))
            .in_("simulation_type", ["game_instance", "archived"])
            .order("name")
            .execute()
        )
        return resp.data or []

    @classmethod
    async def get_instance_by_template(
        cls,
        supabase: Client,
        epoch_id: UUID,
        template_id: UUID,
    ) -> dict | None:
        """Get the game instance created from a specific template in an epoch."""
        resp = await (
            supabase.table("simulations")
            .select("*")
            .eq("epoch_id", str(epoch_id))
            .eq("source_template_id", str(template_id))
            .in_("simulation_type", ["game_instance", "archived"])
            .maybe_single()
            .execute()
        )
        return resp.data

    @classmethod
    async def _refresh_game_metrics(cls, admin_supabase: Client) -> None:
        """Refresh all game materialized views after cloning via ``refresh_all_game_metrics`` (migration 031)."""
        await admin_supabase.rpc("refresh_all_game_metrics", {}).execute()
        logger.debug("Refreshed game materialized views")

    @classmethod
    async def get_epoch_number(cls, supabase: Client) -> int:
        """Get the next epoch number (count of all epochs + 1)."""
        resp = await (
            supabase.table("game_epochs")
            .select("id", count="exact")
            .execute()
        )
        return (resp.count or 0) + 1
