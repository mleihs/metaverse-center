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
from typing import Annotated
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
    ArchetypeActionResponse,
    AvailableDungeonResponse,
    CombatSubmission,
    CombatSubmitResponse,
    CreateRunResponse,
    DistributeConfirmResponse,
    DungeonAction,
    DungeonClientState,
    DungeonEventResponse,
    DungeonMoveRequest,
    DungeonRunCreate,
    DungeonRunResponse,
    EncounterChoiceResponse,
    LootAssignment,
    LootAssignResponse,
    MoveResponse,
    RestRequest,
    RestResponse,
    RetreatResponse,
    SalvageRequest,
    SalvageResponse,
    ScoutRequest,
    ScoutResponse,
)
from backend.services.audit_service import AuditService
from backend.services.dungeon_engine_service import DungeonEngineService
from backend.services.dungeon_query_service import DungeonQueryService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dungeons", tags=["resonance-dungeons"])


# ── Available Dungeons ──────────────────────────────────────────────────────


@router.get("/available")
async def list_available_dungeons(
    simulation_id: Annotated[UUID, Query()],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _member: Annotated[str, Depends(require_simulation_member("viewer"))],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[list[AvailableDungeonResponse]]:
    """List archetypes with active resonances above dungeon threshold."""
    available = await DungeonEngineService.get_available_dungeons(admin_supabase, simulation_id)
    return SuccessResponse(data=available)


# ── Create Run ──────────────────────────────────────────────────────────────


@router.post("/runs", status_code=201)
@limiter.limit(RATE_LIMIT_STANDARD)
async def create_run(
    request: Request,
    body: DungeonRunCreate,
    simulation_id: Annotated[UUID, Query()],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _member: Annotated[str, Depends(require_simulation_member("editor"))],
    _supabase: Annotated[Client, Depends(get_supabase)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[CreateRunResponse]:
    """Start a new dungeon run."""
    result = await DungeonEngineService.create_run(admin, simulation_id, user.id, body)
    await AuditService.safe_log(
        admin,
        simulation_id,
        user.id,
        "resonance_dungeon_runs",
        str(result.run.id),
        "create",
        {"archetype": body.archetype, "difficulty": body.difficulty},
    )
    return SuccessResponse(data=result)


# ── Get Run ─────────────────────────────────────────────────────────────────


@router.get("/runs/{run_id}")
async def get_run(
    run_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[DungeonRunResponse]:
    """Get run metadata."""
    data = await DungeonQueryService.get_run(supabase, run_id)
    return SuccessResponse(data=data)


# ── Get Client State ────────────────────────────────────────────────────────


@router.get("/runs/{run_id}/state")
async def get_run_state(
    run_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[DungeonClientState]:
    """Get full client state (fog-of-war filtered).

    Tries in-memory first, falls back to checkpoint recovery.
    """
    state = await DungeonEngineService.get_client_state(run_id, admin, user_id=user.id)
    return SuccessResponse(data=state)


# ── Move ────────────────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/move")
@limiter.limit(RATE_LIMIT_STANDARD)
async def move_to_room(
    request: Request,
    run_id: UUID,
    body: DungeonMoveRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[MoveResponse]:
    """Move party to an adjacent room."""
    result = await DungeonEngineService.move_to_room(admin, run_id, body.room_index, user_id=user.id)
    return SuccessResponse(data=result)


# ── Encounter Action ────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/action")
@limiter.limit(RATE_LIMIT_STANDARD)
async def submit_action(
    request: Request,
    run_id: UUID,
    body: DungeonAction,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[EncounterChoiceResponse]:
    """Submit an encounter choice or interaction."""
    result = await DungeonEngineService.handle_encounter_choice(admin, run_id, body, user_id=user.id)
    return SuccessResponse(data=result)


# ── Combat Submission ───────────────────────────────────────────────────────


@router.post("/runs/{run_id}/combat/submit")
@limiter.limit(RATE_LIMIT_STANDARD)
async def submit_combat_actions(
    request: Request,
    run_id: UUID,
    body: CombatSubmission,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[CombatSubmitResponse]:
    """Submit combat actions for planning phase."""
    result = await DungeonEngineService.submit_combat_actions(admin, run_id, user.id, body)
    return SuccessResponse(data=result)


# ── Scout ───────────────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/scout")
@limiter.limit(RATE_LIMIT_STANDARD)
async def scout(
    request: Request,
    run_id: UUID,
    body: ScoutRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[ScoutResponse]:
    """Spy: reveal adjacent rooms and restore visibility."""
    result = await DungeonEngineService.scout(admin, run_id, body.agent_id, user_id=user.id)
    return SuccessResponse(data=result)


# ── Seal Breach (Deluge) ────────────────────────────────────────────────────


@router.post("/runs/{run_id}/seal")
@limiter.limit(RATE_LIMIT_STANDARD)
async def seal_breach(
    request: Request,
    run_id: UUID,
    body: ScoutRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[ArchetypeActionResponse]:
    """Guardian: Seal Breach — reduce water level, gain stress (Deluge only)."""
    result = await DungeonEngineService.seal_breach(admin, run_id, body.agent_id, user_id=user.id)
    return SuccessResponse(data=result)


# ── Ground (Awakening) ─────────────────────────────────────────────────────


@router.post("/runs/{run_id}/ground")
@limiter.limit(RATE_LIMIT_STANDARD)
async def ground(
    request: Request,
    run_id: UUID,
    body: ScoutRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[ArchetypeActionResponse]:
    """Spy: Ground — reduce awareness, gain stress (Awakening only)."""
    result = await DungeonEngineService.ground(admin, run_id, body.agent_id, user_id=user.id)
    return SuccessResponse(data=result)


# ── Rally (Overthrow) ──────────────────────────────────────────────────────


@router.post("/runs/{run_id}/rally")
@limiter.limit(RATE_LIMIT_STANDARD)
async def rally(
    request: Request,
    run_id: UUID,
    body: ScoutRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[ArchetypeActionResponse]:
    """Propagandist: Rally — reduce authority fracture, gain stress (Overthrow only)."""
    result = await DungeonEngineService.rally(admin, run_id, body.agent_id, user_id=user.id)
    return SuccessResponse(data=result)


# ── Salvage (Deluge) ───────────────────────────────────────────────────────


@router.post("/runs/{run_id}/salvage")
@limiter.limit(RATE_LIMIT_STANDARD)
async def salvage(
    request: Request,
    run_id: UUID,
    body: SalvageRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[SalvageResponse]:
    """Salvage submerged loot — Guardian aptitude check (Deluge only)."""
    result = await DungeonEngineService.salvage(admin, run_id, body.agent_id, body.room_index, user_id=user.id)
    return SuccessResponse(data=result)


# ── Rest ────────────────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/rest")
@limiter.limit(RATE_LIMIT_STANDARD)
async def rest(
    request: Request,
    run_id: UUID,
    body: RestRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[RestResponse]:
    """Rest at a rest site."""
    result = await DungeonEngineService.rest(admin, run_id, body.agent_ids, user_id=user.id)
    return SuccessResponse(data=result)


# ── Retreat ─────────────────────────────────────────────────────────────────


@router.post("/runs/{run_id}/retreat")
@limiter.limit(RATE_LIMIT_STANDARD)
async def retreat(
    request: Request,
    run_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[RetreatResponse]:
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
    return SuccessResponse(data=result)


# ── Loot Distribution ──────────────────────────────────────────────────────


@router.post("/runs/{run_id}/distribute")
@limiter.limit(RATE_LIMIT_STANDARD)
async def assign_loot(
    request: Request,
    run_id: UUID,
    body: LootAssignment,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[LootAssignResponse]:
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
    return SuccessResponse(data=result)


@router.post("/runs/{run_id}/distribute/confirm")
@limiter.limit(RATE_LIMIT_STANDARD)
async def confirm_distribution(
    request: Request,
    run_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[DistributeConfirmResponse]:
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
    return SuccessResponse(data=result)


# ── Event Log ───────────────────────────────────────────────────────────────


@router.get("/runs/{run_id}/events")
async def list_events(
    run_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[DungeonEventResponse]:
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
    return PaginatedResponse(data=data, meta=meta)


# ── History ─────────────────────────────────────────────────────────────────


@router.get("/history")
async def list_history(
    simulation_id: Annotated[UUID, Query()],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _member: Annotated[str, Depends(require_simulation_member("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[DungeonRunResponse]:
    """List past dungeon runs for a simulation."""
    data, meta = await DungeonQueryService.list_history(
        supabase,
        simulation_id,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse(data=data, meta=meta)


# ── Agent Loot Effects (Provenance) ─────────────────────────────────────────


@router.get("/agents/{agent_id}/loot-effects")
async def get_agent_loot_effects(
    agent_id: UUID,
    simulation_id: Annotated[UUID, Query()],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _member: Annotated[str, Depends(require_simulation_member("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[list[AgentLootEffectResponse]]:
    """Get all persistent dungeon loot effects for an agent.

    Joins with source run to provide provenance (archetype, difficulty, date).
    RLS enforced: user must be simulation member.
    """
    effects = await DungeonQueryService.get_agent_loot_effects(
        supabase,
        agent_id,
        simulation_id,
    )
    return SuccessResponse(data=effects)
