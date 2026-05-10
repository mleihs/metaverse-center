"""World Map router — public read + admin regenerate (Phase 4).

Two routers in one file (cipher-pattern):
  * public_router → GET /api/v1/public/simulations/{slug_or_id}/map
  * admin_router  → POST /api/v1/admin/simulations/{simulation_id}/map/regenerate

Per CLAUDE.md:
  * No business logic in routers — geometry assembly lives in WorldMapService;
    geometry generation lives in ForgeMapService.
  * Pydantic response wrappers via return-type annotation (no response_model=).
  * Public-first: anonymous users get the map without auth or 403s.

Per migration 235 + plan §6 + handover: the public endpoint uses
service_role + app-layer status guard, NOT anon RLS — same pattern as
bleed_gazette / broadsheets.
"""

import hashlib
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from backend.dependencies import (
    get_admin_supabase,
    require_owner_or_platform_admin,
    resolve_simulation_id,
)
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.world_map import (
    MapGenerationResult,
    MapRegenerateRequest,
    WorldMapResponse,
)
from backend.services.audit_service import AuditService
from backend.services.forge_map_service import ForgeMapService
from backend.services.world_map_service import WorldMapService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


public_router = APIRouter(prefix="/api/v1/public", tags=["World Map (Public)"])
admin_router = APIRouter(prefix="/api/v1/admin", tags=["World Map (Admin)"])

SimId = Annotated[UUID, Depends(resolve_simulation_id)]


def _etag_for(simulation_id: UUID, geometry_version: int) -> str:
    """Opaque cache token from (simulation id, geometry version).

    Hashed so the raw UUID never crosses the cache layer; truncated to 16
    hex chars (64 bits) — collision risk is irrelevant since the key space
    is per-simulation.
    """
    seed = f"{simulation_id}:{geometry_version}".encode()
    digest = hashlib.sha1(seed, usedforsecurity=False).hexdigest()[:16]
    return f'"{digest}"'


@public_router.get("/simulations/{simulation_id}/map")
@limiter.limit(RATE_LIMIT_STANDARD)
async def get_world_map(
    request: Request,
    response: Response,
    simulation_id: SimId,
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[WorldMapResponse]:
    """Single round-trip world map for the MapLibre frontend.

    Returns geometry from the Template (resolved via source_template_id) and
    live zone-stability overlay from the Instance. Theme hints are projected
    from the Instance's simulation_settings(category='design').

    Anonymous-friendly: uses the admin client + app-layer status guard per
    the bleed_gazette / broadsheets pattern.
    """
    payload = await WorldMapService.get_public_map(admin, simulation_id)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found.")

    response.headers["ETag"] = _etag_for(payload.simulation_id, payload.geometry_version)
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return SuccessResponse(data=payload)


@admin_router.post("/simulations/{simulation_id}/map/regenerate")
@limiter.limit(RATE_LIMIT_STANDARD)
async def regenerate_world_map(
    request: Request,
    simulation_id: UUID,
    body: MapRegenerateRequest,
    auth: Annotated[
        tuple[CurrentUser, bool],
        Depends(require_owner_or_platform_admin()),
    ],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[MapGenerationResult]:
    """Synchronously regenerate the world map for an active simulation.

    Calls ForgeMapService.generate_map (~30s for Velgarien-scale). The
    service refuses Game-Instances — geometry lives on Templates only.
    """
    user, _ = auth
    result = await ForgeMapService.generate_map(
        simulation_id,
        seed=body.seed,
        preset=body.preset,
        forge_draft_id=None,
    )
    await AuditService.safe_log(
        admin,
        simulation_id,
        user.id,
        "world_maps",
        None,
        "regenerate",
        details={
            "preset_used": result.preset_used,
            "seed_used": result.seed_used,
            "geometry_version": result.geometry_version,
            "duration_seconds": result.duration_seconds,
        },
    )
    return SuccessResponse(data=result)
