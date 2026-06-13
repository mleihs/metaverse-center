"""DRIFT travel endpoints (P0a vertical slice) — HTTP only.

The first playable loop: read the shared Driftkarte, open a run, drift across the
chart, dock / complete / abandon. All business logic + RPC calls + error mapping
live in DriftService; this layer is dependency injection + SuccessResponse wrapping.

Client choice (CLAUDE.md documented exception): the four player mutations use
`get_supabase` (the user-JWT client), NOT `get_effective_supabase`. The run-
lifecycle RPCs are SECURITY DEFINER and guard ownership against auth.uid() = p_user
(migration 246 §4); `get_effective_supabase` auto-elevates platform admins to
service_role, where auth.uid() is NULL and the guard would (correctly) 403 every
admin move. The "never use get_supabase in routers" rule targets RLS-table access —
it does not fit an RPC whose own auth.uid() guard requires a real user identity.
Reads use get_effective_supabase as usual; the gate read needs the admin client
(platform_settings is service_role-only).
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_effective_supabase,
    get_supabase,
    require_platform_admin,
)
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.drift import (
    ChartGenerationResponse,
    DriftChartResponse,
    DriftDockResponse,
    DriftTuningResponse,
    TravelMoveRequest,
    TravelRunOpenRequest,
    TravelRunResponse,
    TravelRunVersionRequest,
)
from backend.services.drift_service import DriftService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/drift", tags=["drift"])


async def require_drift_p0(
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> None:
    """Phase gate: 404 unless drift_p0_enabled is on (migration 239)."""
    await DriftService.assert_p0_enabled(admin_supabase)


@router.get("/chart")
async def get_chart(
    _gate: Annotated[None, Depends(require_drift_p0)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[DriftChartResponse | None]:
    """The active chart version's public topology (nodes + edges); null if unseeded."""
    chart = await DriftService.get_active_chart(supabase)
    return SuccessResponse(data=chart)


@router.get("/tuning")
async def get_tuning(
    _gate: Annotated[None, Depends(require_drift_p0)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[DriftTuningResponse]:
    """HUD gauge scalars (window/Dissonanz cap/Bandbreite max) from drift_tuning."""
    tuning = await DriftService.get_tuning(supabase)
    return SuccessResponse(data=tuning)


@router.get("/dock/{simulation_id}")
async def get_dock(
    simulation_id: UUID,
    _gate: Annotated[None, Depends(require_drift_p0)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[DriftDockResponse | None]:
    """A world's identity for the dock panel (name + lore voice + a few Träger)."""
    dock = await DriftService.get_dock_info(supabase, simulation_id)
    return SuccessResponse(data=dock)


@router.post("/admin/regenerate")
async def regenerate_chart(
    _admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    _gate: Annotated[None, Depends(require_drift_p0)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[ChartGenerationResponse]:
    """Regenerate the chart from the current active worlds (platform-admin only).

    Emits a new chart_version so newly published worlds appear; in-flight runs keep
    their pinned version. The fn is service_role-only, hence the admin client.
    """
    result = await DriftService.regenerate_chart(admin_supabase)
    return SuccessResponse(data=result)


@router.get("/run")
async def get_run(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _gate: Annotated[None, Depends(require_drift_p0)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[TravelRunResponse | None]:
    """The caller's current open run, or null."""
    run = await DriftService.get_current_run(supabase, user.id)
    return SuccessResponse(data=run)


@router.post("/run", status_code=201)
async def open_run(
    body: TravelRunOpenRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _gate: Annotated[None, Depends(require_drift_p0)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[TravelRunResponse]:
    """Open (or resume) a run anchored to the traveler's home simulation."""
    run = await DriftService.open_run(supabase, user.id, body.anchor_simulation_id)
    return SuccessResponse(data=run)


@router.post("/run/{run_id}/move")
async def move_run(
    run_id: UUID,
    body: TravelMoveRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _gate: Annotated[None, Depends(require_drift_p0)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[TravelRunResponse]:
    """A single Drift move to an adjacent node (run_version CAS)."""
    run = await DriftService.move_run(supabase, user.id, run_id, body.run_version, body.to_node_id)
    return SuccessResponse(data=run)


@router.post("/run/{run_id}/complete")
async def complete_run(
    run_id: UUID,
    body: TravelRunVersionRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _gate: Annotated[None, Depends(require_drift_p0)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[TravelRunResponse]:
    """Close the run at the home broadcast edge (Entladung)."""
    run = await DriftService.complete_run(supabase, user.id, run_id, body.run_version)
    return SuccessResponse(data=run)


@router.post("/run/{run_id}/abandon")
async def abandon_run(
    run_id: UUID,
    body: TravelRunVersionRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _gate: Annotated[None, Depends(require_drift_p0)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[TravelRunResponse]:
    """Rückzug — abandon the run (unanchored cargo forfeited)."""
    run = await DriftService.abandon_run(supabase, user.id, run_id, body.run_version)
    return SuccessResponse(data=run)
