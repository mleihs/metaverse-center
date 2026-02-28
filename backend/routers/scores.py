"""Epoch scoring, leaderboard, and history endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_supabase, require_epoch_creator
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.epoch import LeaderboardEntry, ScoreResponse
from backend.services.audit_service import AuditService
from backend.services.scoring_service import ScoringService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/epochs/{epoch_id}/scores", tags=["scores"])


# ── Leaderboard ─────────────────────────────────────────


@router.get("/leaderboard", response_model=SuccessResponse[list[LeaderboardEntry]])
async def get_leaderboard(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    cycle: int | None = Query(default=None, description="Specific cycle (default: latest)"),
) -> dict:
    """Get the epoch leaderboard."""
    data = await ScoringService.get_leaderboard(supabase, epoch_id, cycle_number=cycle)
    return {"success": True, "data": data}


@router.get("/standings", response_model=SuccessResponse[list[LeaderboardEntry]])
async def get_final_standings(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get final standings for a completed epoch (includes dimension titles)."""
    data = await ScoringService.get_final_standings(supabase, epoch_id)
    return {"success": True, "data": data}


# ── Score History ───────────────────────────────────────


@router.get(
    "/simulations/{simulation_id}",
    response_model=SuccessResponse[list[ScoreResponse]],
)
async def get_score_history(
    epoch_id: UUID,
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get all cycle scores for a simulation in an epoch."""
    data = await ScoringService.get_score_history(supabase, epoch_id, simulation_id)
    return {"success": True, "data": data}


# ── Compute (Admin) ────────────────────────────────────


@router.post("/compute", response_model=SuccessResponse[list[ScoreResponse]])
async def compute_scores(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
    cycle: int | None = Query(default=None, description="Cycle number (default: current)"),
) -> dict:
    """Compute and store scores for the current or specified cycle. Creator only."""
    from backend.services.epoch_service import EpochService

    epoch = await EpochService.get(supabase, epoch_id)
    cycle_number = cycle or epoch.get("current_cycle", 1)
    data = await ScoringService.compute_cycle_scores(supabase, epoch_id, cycle_number)
    await AuditService.log_action(
        supabase, None, user.id, "epoch_scores", None, "create",
        details={"epoch_id": str(epoch_id), "cycle": cycle_number, "scores_computed": len(data)},
    )
    return {"success": True, "data": data}
