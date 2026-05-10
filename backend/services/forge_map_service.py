"""ForgeMapService — generates the per-simulation world map.

Sibling to forge_lore_service / forge_theme_service / forge_image_service.
Called by forge_orchestrator_service as a post-materialization step during
ignition, and by the admin regen endpoint.

Per the project Postgres-first principle (memory `feedback_postgres_first.md`):
this service ONLY builds geometry via shapely. ALL persistence happens inside
fn_apply_map_geometry (migration 236), called as a single RPC. The Python side
never issues UPDATE/INSERT/DELETE against the geometry tables directly.

Per the project Template-vs-Instance decision (memory
`project_per_sim_map_template_geometry.md`): map_seed/map_generator_preset
are read from the simulation row; if the simulation is a Game-Instance, the
caller is expected to invoke this service against its source_template_id
instead, NOT the instance — geometry lives at the Template.
"""

from __future__ import annotations

import logging
import time
from uuid import UUID

import sentry_sdk
import structlog

from backend.dependencies import get_admin_supabase
from backend.models.world_map import MapGenerationResult, MapGeneratorPreset
from backend.services.forge_map_generators import (
    BuildingInput,
    CityInput,
    ZoneInput,
    generate_medieval_walled,
    serialize_payload_for_rpc,
)
from backend.utils.db import maybe_single_data

logger = logging.getLogger(__name__)
slog = structlog.get_logger(__name__)

# ── theme → default preset map ───────────────────────────────────────────────
# When simulations.map_generator_preset is NULL, derive a default from the
# simulation's theme. New entries here ship without a database migration.
_THEME_DEFAULT_PRESET: dict[str, MapGeneratorPreset] = {
    "velgarien": "medieval_walled",
    "capybara_kingdom": "medieval_walled",
    "cite_des_dames": "medieval_walled",
    "speranza": "coastal_port",
    "station_null": "underground_station",
    "gaslit_reach": "modern_grid",
}
_FALLBACK_PRESET: MapGeneratorPreset = "medieval_walled"


# ── Preset registry ──────────────────────────────────────────────────────────
# Maps preset name to the generator function. Adding a preset = add an entry
# here AND extend MapGeneratorPreset Literal in models/world_map.py.
# NotImplementedError stubs document what's coming without crashing imports.


def _gen_modern_grid(*args, **kwargs):
    raise NotImplementedError("modern_grid preset not yet implemented (Phase 2 MVP ships only medieval_walled)")


def _gen_radial_capital(*args, **kwargs):
    raise NotImplementedError("radial_capital preset not yet implemented")


def _gen_coastal_port(*args, **kwargs):
    raise NotImplementedError("coastal_port preset not yet implemented")


def _gen_underground_station(*args, **kwargs):
    raise NotImplementedError("underground_station preset not yet implemented")


_PRESET_REGISTRY = {
    "medieval_walled": generate_medieval_walled,
    "modern_grid": _gen_modern_grid,
    "radial_capital": _gen_radial_capital,
    "coastal_port": _gen_coastal_port,
    "underground_station": _gen_underground_station,
}


class ForgeMapService:
    """Builds and persists per-simulation map geometry."""

    @classmethod
    async def generate_map(
        cls,
        simulation_id: UUID,
        *,
        seed: str | None = None,
        preset: MapGeneratorPreset | None = None,
        forge_draft_id: UUID | None = None,
    ) -> MapGenerationResult:
        """Generate and persist the world map for a simulation.

        Args:
            simulation_id: The simulation to generate for. Must be a Template
                (or a sim without source_template_id) — see module docstring.
            seed: Override deterministic seed. Defaults to simulations.id::str.
            preset: Override generator preset. Defaults to the simulation's
                stored preset, then to a theme-based default.
            forge_draft_id: If set (orchestrator path), the draft's map_status
                is set to 'succeeded' on success inside the SQL function.

        Returns:
            MapGenerationResult with counts and the new map_geometry_version.

        Raises:
            ValueError: invariant violation (e.g. building outside its zone).
            RuntimeError: simulation not found, or RPC failure.
        """
        start = time.monotonic()
        admin = await get_admin_supabase()

        with sentry_sdk.push_scope() as scope:
            scope.set_tag("simulation_id", str(simulation_id))
            scope.set_tag("service", "ForgeMapService")

            # 1. Resolve seed + preset against the simulation row
            sim = await cls._fetch_simulation(admin, simulation_id)
            resolved_seed = seed or sim.get("map_seed") or str(simulation_id)
            resolved_preset = cls._resolve_preset(preset, sim)
            scope.set_tag("preset", resolved_preset)
            scope.set_tag("seed", resolved_seed)

            # 2. Read source rows (cities, zones, buildings)
            cities = await cls._fetch_cities(admin, simulation_id)
            zones = await cls._fetch_zones(admin, simulation_id)
            buildings = await cls._fetch_buildings(admin, simulation_id)

            slog.info(
                "forge_map.generate.start",
                simulation_id=str(simulation_id),
                preset=resolved_preset,
                cities=len(cities),
                zones=len(zones),
                buildings=len(buildings),
            )

            # 3. Build geometry (pure Python, shapely)
            generator = _PRESET_REGISTRY[resolved_preset]
            payload = generator(
                seed=resolved_seed,
                cities=cities,
                zones=zones,
                buildings=buildings,
            )

            # 4. Persist atomically via the SQL function
            rpc_args = {
                "p_simulation_id": str(simulation_id),
                "p_seed": resolved_seed,
                "p_geometry": serialize_payload_for_rpc(payload),
                "p_forge_draft_id": str(forge_draft_id) if forge_draft_id else None,
            }
            resp = await admin.rpc("fn_apply_map_geometry", rpc_args).execute()

            if not resp.data or not isinstance(resp.data, dict):
                raise RuntimeError(f"fn_apply_map_geometry returned unexpected payload: {resp.data!r}")

            counts = resp.data
            duration = time.monotonic() - start

            slog.info(
                "forge_map.generate.complete",
                simulation_id=str(simulation_id),
                preset=resolved_preset,
                duration_seconds=round(duration, 3),
                **counts,
            )

            return MapGenerationResult(
                simulation_id=simulation_id,
                preset_used=resolved_preset,
                seed_used=resolved_seed,
                geometry_version=counts["geometry_version"],
                cities_updated=counts["cities_updated"],
                zones_updated=counts["zones_updated"],
                streets_inserted=counts["streets_inserted"],
                buildings_updated=counts["buildings_updated"],
                lives_at_inserted=counts["lives_at_inserted"],
                duration_seconds=round(duration, 3),
            )

    # ── Internal helpers ────────────────────────────────────────────────────

    @staticmethod
    def _resolve_preset(
        explicit: MapGeneratorPreset | None,
        sim: dict,
    ) -> MapGeneratorPreset:
        if explicit:
            return explicit
        stored = sim.get("map_generator_preset")
        if stored and stored in _PRESET_REGISTRY:
            return stored  # type: ignore[return-value]
        theme = sim.get("theme") or ""
        return _THEME_DEFAULT_PRESET.get(theme, _FALLBACK_PRESET)

    @staticmethod
    async def _fetch_simulation(admin, simulation_id: UUID) -> dict:
        sim = await maybe_single_data(
            admin.table("simulations")
            .select("id, theme, map_seed, map_generator_preset, simulation_type, source_template_id")
            .eq("id", str(simulation_id))
            .is_("deleted_at", "null")
            .maybe_single()
        )
        if sim is None:
            raise RuntimeError(f"Simulation {simulation_id} not found or deleted")
        # Sanity guard: refuse to run on Game-Instances per Decision A.
        if sim.get("simulation_type") == "game_instance":
            raise RuntimeError(
                f"Simulation {simulation_id} is a game_instance — generate against "
                f"source_template_id={sim.get('source_template_id')} instead."
            )
        return sim

    @staticmethod
    async def _fetch_cities(admin, simulation_id: UUID) -> list[CityInput]:
        resp = await (
            admin.table("cities")
            .select("id, name, population, layout_type")
            .eq("simulation_id", str(simulation_id))
            .order("id")
            .execute()
        )
        rows = resp.data or []
        return [
            CityInput(
                id=UUID(r["id"]),
                name=r["name"],
                population=r.get("population") or 0,
                layout_type=r.get("layout_type"),
            )
            for r in rows
        ]

    @staticmethod
    async def _fetch_zones(admin, simulation_id: UUID) -> list[ZoneInput]:
        resp = await (
            admin.table("zones")
            .select("id, city_id, name, zone_type, population_estimate")
            .eq("simulation_id", str(simulation_id))
            .order("id")
            .execute()
        )
        rows = resp.data or []
        return [
            ZoneInput(
                id=UUID(r["id"]),
                city_id=UUID(r["city_id"]),
                name=r["name"],
                zone_type=r.get("zone_type") or "residential",
                population_estimate=r.get("population_estimate") or 0,
            )
            for r in rows
        ]

    @staticmethod
    async def _fetch_buildings(admin, simulation_id: UUID) -> list[BuildingInput]:
        resp = await (
            admin.table("buildings")
            .select("id, zone_id, name, building_type")
            .eq("simulation_id", str(simulation_id))
            .is_("deleted_at", "null")
            .order("id")
            .execute()
        )
        rows = resp.data or []
        return [
            BuildingInput(
                id=UUID(r["id"]),
                zone_id=UUID(r["zone_id"]) if r.get("zone_id") else None,
                name=r["name"],
                building_type=r.get("building_type") or "residential",
            )
            for r in rows
        ]
