"""Operative deployment, recall, and mission query endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import (
    get_current_user,
    get_supabase,
    require_epoch_creator,
    require_simulation_member,
)
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.epoch import MissionResponse, OperativeDeploy
from backend.services.audit_service import AuditService
from backend.services.battle_log_service import BattleLogService
from backend.services.epoch_service import EpochService
from backend.services.operative_service import OperativeService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/epochs/{epoch_id}/operatives", tags=["operatives"])


# ── Deploy ──────────────────────────────────────────────


@router.post("", response_model=SuccessResponse[MissionResponse], status_code=201)
async def deploy_operative(
    epoch_id: UUID,
    body: OperativeDeploy,
    simulation_id: UUID = Query(..., description="Your simulation ID"),
    user: CurrentUser = Depends(get_current_user),
    _member_check: str = Depends(require_simulation_member("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Deploy an operative agent on a mission. Must be editor+ in source simulation."""
    mission = await OperativeService.deploy(supabase, epoch_id, simulation_id, body)

    # Log to battle log
    epoch = await EpochService.get(supabase, epoch_id)
    await BattleLogService.log_operative_deployed(
        supabase, epoch_id, epoch.get("current_cycle", 1), mission
    )

    await AuditService.log_action(
        supabase, simulation_id, user.id, "operative_missions", mission["id"], "create",
        details={"operative_type": body.operative_type, "epoch_id": str(epoch_id)},
    )
    return {"success": True, "data": mission}


# ── List / Get ──────────────────────────────────────────


@router.get("", response_model=PaginatedResponse[MissionResponse])
async def list_missions(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    simulation_id: UUID | None = Query(default=None, description="Filter by source simulation"),
    status: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List operative missions."""
    data, total = await OperativeService.list_missions(
        supabase, epoch_id,
        simulation_id=simulation_id,
        status_filter=status,
        limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/threats", response_model=SuccessResponse[list[MissionResponse]])
async def list_threats(
    epoch_id: UUID,
    simulation_id: UUID = Query(..., description="Your simulation ID"),
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List detected incoming operative threats for your simulation."""
    data = await OperativeService.list_threats(supabase, epoch_id, simulation_id)
    return {"success": True, "data": data}


@router.get("/{mission_id}", response_model=SuccessResponse[MissionResponse])
async def get_mission(
    epoch_id: UUID,
    mission_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single operative mission."""
    data = await OperativeService.get_mission(supabase, mission_id)
    return {"success": True, "data": data}


# ── Recall ──────────────────────────────────────────────


@router.post("/{mission_id}/recall", response_model=SuccessResponse[MissionResponse])
async def recall_operative(
    epoch_id: UUID,
    mission_id: UUID,
    simulation_id: UUID = Query(..., description="Your simulation ID"),
    user: CurrentUser = Depends(get_current_user),
    _member_check: str = Depends(require_simulation_member("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Recall an active operative. Must be editor+ in source simulation."""
    data = await OperativeService.recall(supabase, mission_id)
    await AuditService.log_action(
        supabase, simulation_id, user.id, "operative_missions", mission_id, "update",
        details={"action": "recall"},
    )
    return {"success": True, "data": data}


# ── Resolve ─────────────────────────────────────────────


@router.post("/resolve", response_model=SuccessResponse[list[MissionResponse]])
async def resolve_missions(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Resolve all pending missions that have reached their resolve time. Creator only."""
    results = await OperativeService.resolve_pending_missions(supabase, epoch_id)

    # Log results to battle log
    epoch = await EpochService.get(supabase, epoch_id)
    cycle = epoch.get("current_cycle", 1)
    for mission in results:
        await BattleLogService.log_mission_result(supabase, epoch_id, cycle, mission)
        await AuditService.log_action(
            supabase, None, user.id, "operative_missions", mission.get("id"), "update",
            details={"action": "resolve", "outcome": mission.get("mission_result", {}).get("outcome")},
        )

    return {"success": True, "data": results}


# ── Counter-Intelligence ────────────────────────────────


@router.post("/counter-intel", response_model=SuccessResponse[list[MissionResponse]])
async def counter_intel_sweep(
    epoch_id: UUID,
    simulation_id: UUID = Query(..., description="Your simulation ID"),
    user: CurrentUser = Depends(get_current_user),
    _member_check: str = Depends(require_simulation_member("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Run a counter-intelligence sweep (costs 3 RP). Must be editor+ in simulation."""
    detected = await OperativeService.counter_intel_sweep(
        supabase, epoch_id, simulation_id
    )
    await AuditService.log_action(
        supabase, simulation_id, user.id, "operative_missions", None, "update",
        details={"action": "counter_intel_sweep", "detected_count": len(detected)},
    )
    return {"success": True, "data": detected}
