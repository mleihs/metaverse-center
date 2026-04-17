"""Service for generating AI tactical situation reports (SITREPs)."""

import logging

from backend.config import settings
from backend.services.generation_service import GenerationService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

MOCK_SITREP = (
    "SITREP — CYCLE {cycle}\n\n"
    "Operational tempo remains elevated. Multiple operatives deployed across "
    "contested sectors. Detection rates within acceptable parameters.\n\n"
    "Intelligence suggests escalating tensions between rival simulations. "
    "Embassy channels report unusual bleed activity along primary vectors. "
    "Recommend heightened surveillance during next cycle."
)


class SitrepService:
    """Generates per-cycle tactical summaries from battle log data."""

    @classmethod
    async def get_cycle_summary(
        cls,
        supabase: Client,
        epoch_id: str,
        cycle_number: int,
        *,
        simulation_id: str | None = None,
    ) -> dict:
        """Get aggregated battle stats for a cycle via Postgres ``get_cycle_battle_summary`` (migration 065b)."""
        params: dict = {
            "p_epoch_id": epoch_id,
            "p_cycle_number": cycle_number,
        }
        if simulation_id:
            params["p_simulation_id"] = simulation_id
        response = await supabase.rpc("get_cycle_battle_summary", params).execute()
        return (
            response.data
            if response.data
            else {
                "cycle_number": cycle_number,
                "missions_deployed": 0,
                "successes": 0,
                "failures": 0,
                "detections": 0,
                "events_by_type": {},
                "narrative_highlights": [],
            }
        )

    @classmethod
    async def generate_sitrep(
        cls,
        supabase: Client,
        epoch_id: str,
        cycle_number: int,
        simulation_id: str | None = None,
    ) -> dict:
        """Generate an AI tactical situation report for a cycle."""
        summary = await cls.get_cycle_summary(
            supabase,
            epoch_id,
            cycle_number,
            simulation_id=simulation_id,
        )

        if settings.forge_mock_mode:
            logger.info("MOCK_MODE: returning template sitrep for cycle %d", cycle_number)
            return {
                "cycle_number": cycle_number,
                "sitrep": MOCK_SITREP.format(cycle=cycle_number),
                "summary": summary,
                "model_used": "mock",
            }

        # Resolve simulation_id for GenerationService (use first participant if not specified)
        gen_sim_id = simulation_id
        if not gen_sim_id:
            epoch = await supabase.table("game_epochs").select("id").eq("id", epoch_id).limit(1).execute()
            if epoch.data:
                parts = await (
                    supabase.table("epoch_participants")
                    .select("simulation_id")
                    .eq("epoch_id", epoch_id)
                    .limit(1)
                    .execute()
                )
                if parts.data:
                    gen_sim_id = parts.data[0]["simulation_id"]

        if not gen_sim_id:
            return {
                "cycle_number": cycle_number,
                "sitrep": MOCK_SITREP.format(cycle=cycle_number),
                "summary": summary,
                "model_used": "fallback",
            }

        gen = GenerationService(
            supabase,
            gen_sim_id,
            settings.openrouter_api_key,
        )
        draft = await gen.generate_cycle_sitrep(
            cycle_number=cycle_number,
            battle_stats=summary,
        )

        return {
            "cycle_number": cycle_number,
            "sitrep": draft.sitrep,
            "summary": summary,
            "model_used": draft.model_used,
        }
