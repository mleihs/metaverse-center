"""REST API router for Resonance Dungeons.

12 endpoints under /api/v1/dungeons.
Auth: simulation membership checked via require_simulation_member().
All mutations use admin_supabase (Review #16).
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_supabase,
    require_simulation_member,
)
from backend.models.common import (
    CurrentUser,
    PaginatedResponse,
    PaginationMeta,
    SuccessResponse,
)
from backend.models.resonance_dungeon import (
    AvailableDungeonResponse,
    CombatSubmission,
    DungeonAction,
    DungeonClientState,
    DungeonEventResponse,
    DungeonMoveRequest,
    DungeonRunCreate,
    DungeonRunResponse,
    RestRequest,
    ScoutRequest,
)
from backend.services.audit_service import AuditService
from backend.services.dungeon_engine_service import DungeonEngineService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dungeons", tags=["resonance-dungeons"])


# ── Available Dungeons ──────────────────────────────────────────────────────


@router.get("/available", response_model=SuccessResponse[list[AvailableDungeonResponse]])
async def list_available_dungeons(
    simulation_id: UUID = Query(...),
    user: CurrentUser = Depends(get_current_user),
    _member: str = Depends(require_simulation_member("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List archetypes with active resonances above dungeon threshold."""
    available = await DungeonEngineService.get_available_dungeons(supabase, simulation_id)
    return {"success": True, "data": [a.model_dump() for a in available]}


# ── Create Run ──────────────────────────────────────────────────────────────


@router.post("/runs", response_model=SuccessResponse, status_code=201)
async def create_run(
    body: DungeonRunCreate,
    simulation_id: UUID = Query(...),
    user: CurrentUser = Depends(get_current_user),
    _member: str = Depends(require_simulation_member("editor")),
    supabase: Client = Depends(get_supabase),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Start a new dungeon run."""
    result = await DungeonEngineService.create_run(admin, supabase, simulation_id, user.id, body)
    await AuditService.safe_log(
        admin,
        simulation_id,
        user.id,
        "resonance_dungeon_runs",
        result["run"]["id"],
        "create",
        {"archetype": body.archetype, "difficulty": body.difficulty},
    )
    return {"success": True, "data": result}


# ── Get Run ─────────────────────────────────────────────────────────────────


@router.get("/runs/{run_id}", response_model=SuccessResponse[DungeonRunResponse])
async def get_run(
    run_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get run metadata."""
    resp = (
        await supabase.table("resonance_dungeon_runs")
        .select(
            "*",
        )
        .eq("id", str(run_id))
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dungeon run not found")
    return {"success": True, "data": resp.data}


# ── Get Client State ────────────────────────────────────────────────────────


@router.get("/runs/{run_id}/state", response_model=SuccessResponse[DungeonClientState])
async def get_run_state(
    run_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Get full client state (fog-of-war filtered).

    Tries in-memory first, falls back to checkpoint recovery.
    """
    state = await DungeonEngineService.get_client_state(run_id, admin)
    return {"success": True, "data": state.model_dump()}


# ── Move ────────────────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/move", response_model=SuccessResponse)
async def move_to_room(
    run_id: UUID,
    body: DungeonMoveRequest,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Move party to an adjacent room."""
    result = await DungeonEngineService.move_to_room(admin, run_id, body.room_index)
    return {"success": True, "data": result}


# ── Encounter Action ────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/action", response_model=SuccessResponse)
async def submit_action(
    run_id: UUID,
    body: DungeonAction,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Submit an encounter choice or interaction."""
    result = await DungeonEngineService.handle_encounter_choice(admin, run_id, body)
    return {"success": True, "data": result}


# ── Combat Submission ───────────────────────────────────────────────────────


@router.post("/runs/{run_id}/combat/submit", response_model=SuccessResponse)
async def submit_combat_actions(
    run_id: UUID,
    body: CombatSubmission,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Submit combat actions for planning phase."""
    result = await DungeonEngineService.submit_combat_actions(admin, run_id, user.id, body)
    return {"success": True, "data": result}


# ── Scout ───────────────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/scout", response_model=SuccessResponse)
async def scout(
    run_id: UUID,
    body: ScoutRequest,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Spy: reveal adjacent rooms and restore visibility."""
    result = await DungeonEngineService.scout(admin, run_id, body.agent_id)
    return {"success": True, "data": result}


# ── Rest ────────────────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/rest", response_model=SuccessResponse)
async def rest(
    run_id: UUID,
    body: RestRequest,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Rest at a rest site."""
    result = await DungeonEngineService.rest(admin, run_id, body.agent_ids)
    return {"success": True, "data": result}


# ── Retreat ─────────────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/retreat", response_model=SuccessResponse)
async def retreat(
    run_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Abandon dungeon (keep partial loot)."""
    result = await DungeonEngineService.retreat(admin, run_id)
    await AuditService.safe_log(
        admin,
        None,
        user.id,
        "resonance_dungeon_runs",
        str(run_id),
        "abandon",
        {},
    )
    return {"success": True, "data": result}


# ── Event Log ───────────────────────────────────────────────────────────────


@router.get("/runs/{run_id}/events", response_model=PaginatedResponse[DungeonEventResponse])
async def list_events(
    run_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """Get dungeon event log (paginated)."""
    resp = (
        await supabase.table("resonance_dungeon_events")
        .select(
            "*",
            count="exact",
        )
        .eq("run_id", str(run_id))
        .order(
            "created_at",
            desc=False,
        )
        .range(offset, offset + limit - 1)
        .execute()
    )

    return {
        "success": True,
        "data": resp.data or [],
        "meta": PaginationMeta(
            count=len(resp.data or []),
            total=resp.count or 0,
            limit=limit,
            offset=offset,
        ),
    }


# ── History ─────────────────────────────────────────────────────────────────


@router.get("/history", response_model=PaginatedResponse[DungeonRunResponse])
async def list_history(
    simulation_id: UUID = Query(...),
    user: CurrentUser = Depends(get_current_user),
    _member: str = Depends(require_simulation_member("viewer")),
    supabase: Client = Depends(get_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List past dungeon runs for a simulation."""
    resp = (
        await supabase.table("resonance_dungeon_runs")
        .select(
            "*",
            count="exact",
        )
        .eq("simulation_id", str(simulation_id))
        .order(
            "created_at",
            desc=True,
        )
        .range(offset, offset + limit - 1)
        .execute()
    )

    return {
        "success": True,
        "data": resp.data or [],
        "meta": PaginationMeta(
            count=len(resp.data or []),
            total=resp.count or 0,
            limit=limit,
            offset=offset,
        ),
    }
