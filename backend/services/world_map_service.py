"""WorldMapService — assembles the public world map response (Phase 4).

Read-only sibling to ForgeMapService (which generates the geometry). This
service serves the GET /api/v1/public/simulations/{slug_or_id}/map endpoint
in a single round-trip.

Per the Template/Instance decision (memory `project_per_sim_map_template_geometry.md`):
geometry rows live on the Template — Game-Instances inherit them via the
JOIN on `source_template_id`. Live overlays (zone stability) and theme hints
come from the Instance itself.

Per CLAUDE.md ("no business logic in routers"): the router layer just
forwards the result of `get_public_map` and translates `None` to a 404.

Fetches are issued in parallel via `asyncio.gather` — first failure
short-circuits the whole response (FastAPI's error handler observes via
Sentry).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any
from uuid import UUID

from backend.models.world_map import (
    WorldMapAgentMarker,
    WorldMapBuilding,
    WorldMapCity,
    WorldMapResponse,
    WorldMapStreet,
    WorldMapThemeHints,
    WorldMapZone,
)
from backend.utils.db import maybe_single_data
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Theme hints projected from simulation_settings(category='design'). Keep this
# narrow — frontend uses these as MapLibre paint-property defaults; broader
# theme tokens are loaded separately by the design-tokens layer.
_THEME_HINT_KEYS: tuple[str, ...] = (
    "color_primary",
    "color_surface",
    "color_border",
    "color_danger",
    "color_success",
    "color_text",
    "font_heading",
    "font_body",
)


class WorldMapService:
    """Read-only assembly of the public world map payload."""

    @staticmethod
    async def get_public_map(
        admin: Client,
        simulation_id: UUID,
    ) -> WorldMapResponse | None:
        """Return the assembled map payload, or None if the sim is unavailable.

        None is returned when the simulation is missing, soft-deleted, or
        not in `status='active'` — the router translates this into 404.
        """
        sim = await maybe_single_data(
            admin.table("simulations")
            .select("id, slug, source_template_id, simulation_type, map_geometry_version, status, deleted_at")
            .eq("id", str(simulation_id))
            .maybe_single()
        )
        if sim is None or sim.get("status") != "active" or sim.get("deleted_at") is not None:
            return None

        instance_sim_id = UUID(sim["id"])
        source_template_id = sim.get("source_template_id")
        geometry_sim_id = UUID(source_template_id) if source_template_id else instance_sim_id
        is_game_instance = source_template_id is not None

        (
            cities_rows,
            zones_rows,
            streets_rows,
            buildings_rows,
            relations_rows,
            agents_rows,
            stability_rows,
            theme_settings,
            geometry_version,
        ) = await asyncio.gather(
            WorldMapService._fetch_cities(admin, geometry_sim_id),
            WorldMapService._fetch_zones(admin, geometry_sim_id),
            WorldMapService._fetch_streets(admin, geometry_sim_id),
            WorldMapService._fetch_buildings(admin, geometry_sim_id),
            WorldMapService._fetch_lives_at_relations(admin, geometry_sim_id),
            WorldMapService._fetch_agents(admin, geometry_sim_id),
            WorldMapService._fetch_zone_stability(admin, instance_sim_id),
            WorldMapService._fetch_theme_settings(admin, instance_sim_id),
            WorldMapService._resolve_geometry_version(admin, sim, geometry_sim_id),
        )

        stability_by_zone: dict[str, dict[str, Any]] = {r["zone_id"]: r for r in stability_rows if r.get("zone_id")}

        cities = [
            WorldMapCity(
                id=UUID(c["id"]),
                name=c["name"],
                map_center_lat=c.get("map_center_lat"),
                map_center_lng=c.get("map_center_lng"),
                map_default_zoom=c.get("map_default_zoom"),
            )
            for c in cities_rows
        ]

        zones = [
            WorldMapZone(
                id=UUID(z["id"]),
                name=z["name"],
                zone_type=z.get("zone_type"),
                geojson=z.get("geojson"),
                stability=stability_by_zone.get(z["id"], {}).get("stability"),
                stability_label=stability_by_zone.get(z["id"], {}).get("stability_label"),
            )
            for z in zones_rows
        ]

        streets = [
            WorldMapStreet(
                id=UUID(s["id"]),
                name=s.get("name"),
                street_type=s.get("street_type"),
                length_km=float(s["length_km"]) if s.get("length_km") is not None else None,
                geojson=s.get("geojson"),
            )
            for s in streets_rows
        ]

        buildings = [
            WorldMapBuilding(
                id=UUID(b["id"]),
                name=b["name"],
                building_type=b.get("building_type"),
                geojson=b.get("geojson"),
                street_id=UUID(b["street_id"]) if b.get("street_id") else None,
                zone_id=UUID(b["zone_id"]) if b.get("zone_id") else None,
            )
            for b in buildings_rows
        ]

        agent_name_by_id: dict[str, str] = {a["id"]: a["name"] for a in agents_rows}
        agent_markers = [
            WorldMapAgentMarker(
                agent_id=UUID(r["agent_id"]),
                name=agent_name_by_id[r["agent_id"]],
                home_building_id=UUID(r["building_id"]) if r.get("building_id") else None,
            )
            for r in relations_rows
            if r.get("agent_id") in agent_name_by_id
        ]

        theme_hints = WorldMapThemeHints(
            **{k: theme_settings.get(k) for k in _THEME_HINT_KEYS},
        )

        return WorldMapResponse(
            simulation_id=instance_sim_id,
            simulation_slug=sim["slug"],
            is_game_instance=is_game_instance,
            geometry_source_id=geometry_sim_id,
            geometry_version=geometry_version,
            cities=cities,
            zones=zones,
            streets=streets,
            buildings=buildings,
            agent_markers=agent_markers,
            theme_hints=theme_hints,
        )

    # ── Internal fetch helpers ──────────────────────────────────────────────

    @staticmethod
    async def _fetch_cities(admin: Client, sim_id: UUID) -> list[dict]:
        resp = await (
            admin.table("cities")
            .select("id, name, map_center_lat, map_center_lng, map_default_zoom")
            .eq("simulation_id", str(sim_id))
            .order("name")
            .execute()
        )
        return resp.data or []

    @staticmethod
    async def _fetch_zones(admin: Client, sim_id: UUID) -> list[dict]:
        resp = await (
            admin.table("zones")
            .select("id, name, zone_type, geojson")
            .eq("simulation_id", str(sim_id))
            .order("name")
            .execute()
        )
        return resp.data or []

    @staticmethod
    async def _fetch_streets(admin: Client, sim_id: UUID) -> list[dict]:
        resp = await (
            admin.table("city_streets")
            .select("id, name, street_type, length_km, geojson")
            .eq("simulation_id", str(sim_id))
            .execute()
        )
        return resp.data or []

    @staticmethod
    async def _fetch_buildings(admin: Client, sim_id: UUID) -> list[dict]:
        resp = await (
            admin.table("buildings")
            .select("id, name, building_type, geojson, street_id, zone_id")
            .eq("simulation_id", str(sim_id))
            .is_("deleted_at", "null")
            .order("name")
            .execute()
        )
        return resp.data or []

    @staticmethod
    async def _fetch_lives_at_relations(admin: Client, sim_id: UUID) -> list[dict]:
        resp = await (
            admin.table("building_agent_relations")
            .select("agent_id, building_id")
            .eq("simulation_id", str(sim_id))
            .eq("relation_type", "lives_at")
            .execute()
        )
        return resp.data or []

    @staticmethod
    async def _fetch_agents(admin: Client, sim_id: UUID) -> list[dict]:
        resp = await (
            admin.table("agents")
            .select("id, name")
            .eq("simulation_id", str(sim_id))
            .is_("deleted_at", "null")
            .execute()
        )
        return resp.data or []

    @staticmethod
    async def _fetch_zone_stability(admin: Client, sim_id: UUID) -> list[dict]:
        resp = await (
            admin.table("mv_zone_stability")
            .select("zone_id, stability, stability_label")
            .eq("simulation_id", str(sim_id))
            .execute()
        )
        return resp.data or []

    @staticmethod
    async def _fetch_theme_settings(admin: Client, sim_id: UUID) -> dict[str, Any]:
        """Read the narrow theme-hint subset from simulation_settings.

        Returns a flat key→value dict. Missing keys are simply absent — the
        caller defaults them to None via Pydantic.
        """
        resp = await (
            admin.table("simulation_settings")
            .select("setting_key, setting_value")
            .eq("simulation_id", str(sim_id))
            .eq("category", "design")
            .in_("setting_key", list(_THEME_HINT_KEYS))
            .execute()
        )
        return {r["setting_key"]: r["setting_value"] for r in (resp.data or [])}

    @staticmethod
    async def _resolve_geometry_version(
        admin: Client,
        sim: dict[str, Any],
        geometry_sim_id: UUID,
    ) -> int:
        """Return the version of the row that owns the geometry.

        For Templates, that's the sim row already in hand. For Game-Instances,
        the geometry lives on the Template (`source_template_id`); the
        Instance's own `map_geometry_version` is permanently 0 because
        ForgeMapService.generate_map refuses to run on Game-Instances. Without
        this resolution, the Instance's ETag would never change after a
        Template regen, serving stale geometry indefinitely.
        """
        if str(geometry_sim_id) == sim["id"]:
            return int(sim.get("map_geometry_version") or 0)
        template_row = await maybe_single_data(
            admin.table("simulations").select("map_geometry_version").eq("id", str(geometry_sim_id)).maybe_single()
        )
        return int((template_row or {}).get("map_geometry_version") or 0)
