"""Service for reading game mechanics materialized views (migration 031).

Does NOT extend BaseService — materialized views are read-only and
not simulation-scoped in the usual CRUD sense. Uses admin client
for reads (materialized views don't have per-row RLS) and filters
by simulation_id in the query.

Views: ``mv_simulation_health``, ``mv_building_readiness``, ``mv_zone_stability``,
``mv_embassy_effectiveness``. Refreshed via ``refresh_all_game_metrics`` RPC.
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException, status

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class GameMechanicsService:
    """Read-only service for game mechanics materialized views."""

    @staticmethod
    async def get_simulation_health(
        supabase: Client,
        simulation_id: UUID,
    ) -> dict | None:
        """Get top-level health metrics for a simulation."""
        response = await (
            supabase.table("mv_simulation_health")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    @staticmethod
    async def list_simulation_health(
        supabase: Client,
    ) -> list[dict]:
        """Get health metrics for all simulations (for map/dashboard)."""
        response = await (
            supabase.table("mv_simulation_health")
            .select("*")
            .order("overall_health", desc=True)
            .execute()
        )
        return response.data or []

    @staticmethod
    async def get_building_readiness(
        supabase: Client,
        simulation_id: UUID,
        building_id: UUID,
    ) -> dict:
        """Get readiness metrics for a single building."""
        response = await (
            supabase.table("mv_building_readiness")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("building_id", str(building_id))
            .limit(1)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Building readiness not found for '{building_id}'.",
            )
        return response.data[0]

    @staticmethod
    async def list_building_readiness(
        supabase: Client,
        simulation_id: UUID,
        *,
        zone_id: UUID | None = None,
        order_by: str = "readiness",
        order_asc: bool = True,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List building readiness for a simulation, optionally filtered by zone."""
        query = (
            supabase.table("mv_building_readiness")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order(order_by, desc=not order_asc)
        )

        if zone_id:
            query = query.eq("zone_id", str(zone_id))

        query = query.range(offset, offset + limit - 1)
        response = await query.execute()
        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @staticmethod
    async def get_zone_stability(
        supabase: Client,
        simulation_id: UUID,
        zone_id: UUID,
    ) -> dict:
        """Get stability metrics for a single zone."""
        response = await (
            supabase.table("mv_zone_stability")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("zone_id", str(zone_id))
            .limit(1)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Zone stability not found for '{zone_id}'.",
            )
        return response.data[0]

    @staticmethod
    async def list_zone_stability(
        supabase: Client,
        simulation_id: UUID,
    ) -> list[dict]:
        """List zone stability for all zones in a simulation."""
        response = await (
            supabase.table("mv_zone_stability")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .order("stability", desc=False)
            .execute()
        )
        return response.data or []

    @staticmethod
    async def list_embassy_effectiveness(
        supabase: Client,
        simulation_id: UUID,
    ) -> list[dict]:
        """List embassy effectiveness for embassies involving a simulation."""
        response = await (
            supabase.table("mv_embassy_effectiveness")
            .select("*")
            .or_(
                f"simulation_a_id.eq.{simulation_id},"
                f"simulation_b_id.eq.{simulation_id}"
            )
            .order("effectiveness", desc=True)
            .execute()
        )
        return response.data or []

    @staticmethod
    async def get_health_dashboard(
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Assemble the full health dashboard for a simulation.

        Combines: simulation health + zone stability + building readiness +
        embassy effectiveness + recent high-impact events.
        """
        health = await GameMechanicsService.get_simulation_health(
            supabase, simulation_id
        )
        if not health:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No health data for simulation '{simulation_id}'.",
            )

        zones = await GameMechanicsService.list_zone_stability(
            supabase, simulation_id
        )
        buildings, _ = await GameMechanicsService.list_building_readiness(
            supabase, simulation_id, limit=200
        )
        embassies = await GameMechanicsService.list_embassy_effectiveness(
            supabase, simulation_id
        )

        # Recent high-impact events (last 30 days, impact >= 7)
        events_response = await (
            supabase.table("active_events")
            .select("id, title, impact_level, location, occurred_at, event_type, tags")
            .eq("simulation_id", str(simulation_id))
            .gte("impact_level", 7)
            .order("occurred_at", desc=True)
            .limit(10)
            .execute()
        )
        recent_events = events_response.data or []

        return {
            "health": health,
            "zones": zones,
            "buildings": buildings,
            "embassies": embassies,
            "recent_high_impact_events": recent_events,
        }

    @staticmethod
    async def build_generation_context(
        supabase: Client,
        simulation_id: UUID,
        *,
        zone_id: UUID | None = None,
    ) -> dict:
        """Build a game context dict for AI generation prompts.

        Fetches simulation health and optionally zone stability, then
        constructs a context dict with narrative guidance derived from
        the metrics. This is cheap (reads materialized views) and safe
        to call before every generation request.
        """
        ctx: dict = {}

        # Simulation-level health
        health = await GameMechanicsService.get_simulation_health(
            supabase, simulation_id
        )
        if health:
            ctx["simulation_health"] = health.get("overall_health", 0.5)
            ctx["health_label"] = health.get("health_label", "")
            ctx["building_readiness"] = health.get("avg_readiness", 0.5)
            ctx["critical_buildings"] = health.get(
                "critically_understaffed_buildings", 0
            )
            ctx["diplomatic_reach"] = health.get("diplomatic_reach", 0)
            ctx["bleed_permeability"] = health.get("bleed_permeability", 0)

        # Zone-level stability (if zone_id provided)
        if zone_id:
            try:
                zone = await GameMechanicsService.get_zone_stability(
                    supabase, simulation_id, zone_id
                )
                ctx["zone_stability"] = zone.get("stability", 0.5)
                ctx["zone_stability_label"] = zone.get("stability_label", "")
                ctx["zone_security"] = zone.get("security_level", "moderate")
                ctx["event_pressure"] = zone.get("event_pressure", 0)
            except HTTPException:
                pass  # Zone not in materialized view yet

        # Derive narrative guidance from metrics
        ctx["narrative_guidance"] = (
            GameMechanicsService._derive_narrative_guidance(ctx)
        )

        return ctx

    @staticmethod
    def _derive_narrative_guidance(ctx: dict) -> str:
        """Derive narrative tone guidance from game metrics.

        Returns a short directive the LLM can use to adjust its writing
        style and thematic focus.
        """
        parts: list[str] = []

        sim_health = ctx.get("simulation_health", 0.5)
        if sim_health < 0.3:
            parts.append(
                "The simulation is in crisis. "
                "Write with urgency, desperation, and a sense of collapse."
            )
        elif sim_health < 0.5:
            parts.append(
                "The simulation is struggling. "
                "Reflect tension, scarcity, and growing unease."
            )
        elif sim_health > 0.8:
            parts.append(
                "The simulation is thriving. "
                "Show confidence, ambition, and the quiet tension of prosperity."
            )

        zone_stability = ctx.get("zone_stability")
        if zone_stability is not None:
            if zone_stability < 0.3:
                parts.append(
                    "This zone is failing — infrastructure crumbling, "
                    "security collapsing, cascading crises likely."
                )
            elif zone_stability < 0.5:
                parts.append(
                    "This zone is unstable — one more shock could tip it."
                )
            elif zone_stability > 0.8:
                parts.append(
                    "This zone is exemplary — a model district, "
                    "but stability breeds complacency."
                )

        critical = ctx.get("critical_buildings", 0)
        if critical >= 3:
            parts.append(
                f"{critical} critical buildings are understaffed. "
                "Institutions are failing. People notice."
            )

        return " ".join(parts) if parts else "The simulation is functional."

    @staticmethod
    async def get_bleed_status(
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Return aggregated bleed status for UI overlay rendering.

        Uses the ``get_bleed_status`` Postgres function (migration 099) which
        combines simulation health, active echoes, foreign themes, and lore
        in a single round-trip.
        """
        response = await supabase.rpc(
            "get_bleed_status",
            {"p_simulation_id": str(simulation_id)},
        ).execute()
        if response.data:
            return response.data
        return {
            "active_bleeds": [],
            "bleed_permeability": 0.0,
            "fracture_warning": False,
            "threshold_state": "normal",
            "overall_health": 0.5,
            "entropy_cycles_remaining": None,
        }

    @staticmethod
    async def get_health_effects_dashboard(
        admin_supabase: Client,
    ) -> dict:
        """Assemble health effects admin dashboard: global toggle + per-sim state.

        Combines platform setting, simulation list, health MVs, and per-sim
        settings into a single response dict for the admin panel.
        """
        from backend.services.platform_settings_service import PlatformSettingsService
        from backend.services.settings_service import SettingsService
        from backend.services.simulation_service import SimulationService

        # 1. Global setting
        try:
            row = await PlatformSettingsService.get(
                admin_supabase, "critical_health_effects_enabled",
            )
            global_enabled = str(row.get("setting_value", "true")).strip('"') != "false"
        except Exception:
            global_enabled = True

        # 2. All active simulations
        sims_data, _total = await SimulationService.list_all_simulations(
            admin_supabase, include_deleted=False, limit=200, offset=0,
        )
        sim_ids = [str(s["id"]) for s in sims_data]

        # 3. Health data from materialized view
        health_rows = await GameMechanicsService.list_simulation_health(admin_supabase)
        health_map: dict[str, dict] = {h["simulation_id"]: h for h in health_rows}

        # 4. Per-sim health effects settings
        effects_rows = await SettingsService.batch_get_by_key(
            admin_supabase, sim_ids, "game", "critical_health_effects_enabled",
        )
        effects_map: dict[str, str] = {}
        for s in effects_rows:
            raw = s.get("setting_value", "true")
            effects_map[s["simulation_id"]] = str(raw).strip('"')

        # 5. Build per-sim entries with threshold state
        simulations = []
        for sim in sims_data:
            sid = str(sim["id"])
            health = health_map.get(sid, {})
            oh = health.get("overall_health", 0.5)
            if oh < 0.25:
                threshold_state = "critical"
            elif oh > 0.85:
                threshold_state = "ascendant"
            else:
                threshold_state = "normal"

            simulations.append({
                "id": sid,
                "name": sim.get("name", ""),
                "slug": sim.get("slug", ""),
                "overall_health": round(oh, 4),
                "threshold_state": threshold_state,
                "effects_enabled": effects_map.get(sid, "true") != "false",
            })

        return {
            "global_enabled": global_enabled,
            "simulations": simulations,
        }

    @staticmethod
    async def refresh_metrics(supabase: Client) -> None:
        """Trigger a full refresh of all game mechanics materialized views.

        Uses a Postgres RPC call to the refresh function.
        """
        await supabase.rpc("refresh_all_game_metrics", {}).execute()
