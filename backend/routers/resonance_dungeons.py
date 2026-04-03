"""REST API router for Resonance Dungeons.

15 endpoints under /api/v1/dungeons.
Auth: Two layers —
  1. Simulation-scoped endpoints (available, create, history, loot-effects):
     require_simulation_member() dependency (needs simulation_id query param).
  2. Run-scoped endpoints (all /runs/{run_id}/* mutations + state read):
     user_id passed to service → _get_instance(require_player=user_id)
     verifies user is in instance.player_ids (dungeon participant check).
All mutations use admin_supabase (Review #16).
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_supabase,
    require_simulation_member,
)
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.common import (
    CurrentUser,
    PaginatedResponse,
    SuccessResponse,
)
from backend.models.resonance_dungeon import (
    AgentLootEffectResponse,
    AvailableDungeonResponse,
    CombatSubmission,
    DungeonAction,
    DungeonClientState,
    DungeonEventResponse,
    DungeonMoveRequest,
    DungeonRunCreate,
    DungeonRunResponse,
    LootAssignment,
    RestRequest,
    SalvageRequest,
    ScoutRequest,
)
from backend.services.audit_service import AuditService
from backend.services.dungeon_engine_service import DungeonEngineService
from backend.services.dungeon_query_service import DungeonQueryService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dungeons", tags=["resonance-dungeons"])


# ── Available Dungeons ──────────────────────────────────────────────────────


@router.get("/available", response_model=SuccessResponse[list[AvailableDungeonResponse]])
async def list_available_dungeons(
    simulation_id: UUID = Query(...),
    user: CurrentUser = Depends(get_current_user),
    _member: str = Depends(require_simulation_member("viewer")),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """List archetypes with active resonances above dungeon threshold."""
    available = await DungeonEngineService.get_available_dungeons(admin_supabase, simulation_id)
    return {"success": True, "data": [a.model_dump() for a in available]}


# ── Create Run ──────────────────────────────────────────────────────────────


@router.post("/runs", response_model=SuccessResponse, status_code=201)
@limiter.limit(RATE_LIMIT_STANDARD)
async def create_run(
    request: Request,
    body: DungeonRunCreate,
    simulation_id: UUID = Query(...),
    user: CurrentUser = Depends(get_current_user),
    _member: str = Depends(require_simulation_member("editor")),
    _supabase: Client = Depends(get_supabase),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Start a new dungeon run."""
    result = await DungeonEngineService.create_run(admin, simulation_id, user.id, body)
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
    data = await DungeonQueryService.get_run(supabase, run_id)
    return {"success": True, "data": data}


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
    state = await DungeonEngineService.get_client_state(run_id, admin, user_id=user.id)
    return {"success": True, "data": state.model_dump()}


# ── Move ────────────────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/move", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def move_to_room(
    request: Request,
    run_id: UUID,
    body: DungeonMoveRequest,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Move party to an adjacent room."""
    result = await DungeonEngineService.move_to_room(admin, run_id, body.room_index, user_id=user.id)
    return {"success": True, "data": result}


# ── Encounter Action ────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/action", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def submit_action(
    request: Request,
    run_id: UUID,
    body: DungeonAction,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Submit an encounter choice or interaction."""
    result = await DungeonEngineService.handle_encounter_choice(admin, run_id, body, user_id=user.id)
    return {"success": True, "data": result}


# ── Combat Submission ───────────────────────────────────────────────────────


@router.post("/runs/{run_id}/combat/submit", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def submit_combat_actions(
    request: Request,
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
@limiter.limit(RATE_LIMIT_STANDARD)
async def scout(
    request: Request,
    run_id: UUID,
    body: ScoutRequest,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Spy: reveal adjacent rooms and restore visibility."""
    result = await DungeonEngineService.scout(admin, run_id, body.agent_id, user_id=user.id)
    return {"success": True, "data": result}


# ── Seal Breach (Deluge) ────────────────────────────────────────────────────


@router.post("/runs/{run_id}/seal", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def seal_breach(
    request: Request,
    run_id: UUID,
    body: ScoutRequest,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Guardian: Seal Breach — reduce water level, gain stress (Deluge only)."""
    result = await DungeonEngineService.seal_breach(admin, run_id, body.agent_id, user_id=user.id)
    return {"success": True, "data": result}


# ── Ground (Awakening) ─────────────────────────────────────────────────────


@router.post("/runs/{run_id}/ground", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def ground(
    request: Request,
    run_id: UUID,
    body: ScoutRequest,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Spy: Ground — reduce awareness, gain stress (Awakening only)."""
    result = await DungeonEngineService.ground(admin, run_id, body.agent_id, user_id=user.id)
    return {"success": True, "data": result}


# ── Rally (Overthrow) ──────────────────────────────────────────────────────


@router.post("/runs/{run_id}/rally", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def rally(
    request: Request,
    run_id: UUID,
    body: ScoutRequest,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Propagandist: Rally — reduce authority fracture, gain stress (Overthrow only)."""
    result = await DungeonEngineService.rally(admin, run_id, body.agent_id, user_id=user.id)
    return {"success": True, "data": result}


# ── Salvage (Deluge) ───────────────────────────────────────────────────────


@router.post("/runs/{run_id}/salvage", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def salvage(
    request: Request,
    run_id: UUID,
    body: SalvageRequest,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Salvage submerged loot — Guardian aptitude check (Deluge only)."""
    result = await DungeonEngineService.salvage(admin, run_id, body.agent_id, body.room_index, user_id=user.id)
    return {"success": True, "data": result}


# ── Rest ────────────────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/rest", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def rest(
    request: Request,
    run_id: UUID,
    body: RestRequest,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Rest at a rest site."""
    result = await DungeonEngineService.rest(admin, run_id, body.agent_ids, user_id=user.id)
    return {"success": True, "data": result}


# ── Retreat ─────────────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/retreat", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def retreat(
    request: Request,
    run_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Abandon dungeon (keep partial loot)."""
    result = await DungeonEngineService.retreat(admin, run_id, user_id=user.id)
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


# ── Loot Distribution ──────────────────────────────────────────────────────


@router.post("/runs/{run_id}/distribute", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def assign_loot(
    request: Request,
    run_id: UUID,
    body: LootAssignment,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Assign a distributable loot item to an agent during the debrief phase."""
    result = await DungeonEngineService.assign_loot(
        admin,
        run_id,
        body.loot_id,
        body.agent_id,
        dimension=body.dimension,
        user_id=user.id,
    )
    await AuditService.safe_log(
        admin,
        None,
        user.id,
        "resonance_dungeon_runs",
        str(run_id),
        "assign_loot",
        {"loot_id": body.loot_id, "agent_id": str(body.agent_id), "dimension": body.dimension},
    )
    return {"success": True, "data": result}


@router.post("/runs/{run_id}/distribute/confirm", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def confirm_distribution(
    request: Request,
    run_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Finalize loot distribution and complete the dungeon run."""
    result = await DungeonEngineService.confirm_distribution(admin, run_id, user_id=user.id)
    await AuditService.safe_log(
        admin,
        None,
        user.id,
        "resonance_dungeon_runs",
        str(run_id),
        "finalize_distribution",
        {},
    )
    return {"success": True, "data": result}


# ── Event Log ───────────────────────────────────────────────────────────────


@router.get("/runs/{run_id}/events", response_model=PaginatedResponse[DungeonEventResponse])
async def list_events(
    run_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """Get dungeon event log (paginated).

    Requires dungeon participant — verifies user is in run's party_player_ids.
    """
    run = await DungeonQueryService.get_run(admin, run_id)
    if str(user.id) not in (run.get("party_player_ids") or []):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a participant in this dungeon run")
    data, meta = await DungeonQueryService.list_events(
        admin,
        run_id,
        limit=limit,
        offset=offset,
    )
    return {"success": True, "data": data, "meta": meta}


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
    data, meta = await DungeonQueryService.list_history(
        supabase,
        simulation_id,
        limit=limit,
        offset=offset,
    )
    return {"success": True, "data": data, "meta": meta}


# ── Agent Loot Effects (Provenance) ─────────────────────────────────────────


@router.get(
    "/agents/{agent_id}/loot-effects",
    response_model=SuccessResponse[list[AgentLootEffectResponse]],
)
async def get_agent_loot_effects(
    agent_id: UUID,
    simulation_id: UUID = Query(...),
    user: CurrentUser = Depends(get_current_user),
    _member: str = Depends(require_simulation_member("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get all persistent dungeon loot effects for an agent.

    Joins with source run to provide provenance (archetype, difficulty, date).
    RLS enforced: user must be simulation member.
    """
    effects = await DungeonQueryService.get_agent_loot_effects(
        supabase,
        agent_id,
        simulation_id,
    )
    return {"success": True, "data": effects}
