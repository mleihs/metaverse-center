"""Epoch scoring, leaderboard, and history endpoints."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_effective_supabase, require_epoch_creator
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.epoch import LeaderboardEntry, ScoreResponse
from backend.services.audit_service import AuditService
from backend.services.scoring_service import ScoringService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/epochs/{epoch_id}/scores", tags=["scores"])


# ── Leaderboard ─────────────────────────────────────────


@router.get("/leaderboard")
async def get_leaderboard(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    cycle: Annotated[int | None, Query(description="Specific cycle (default: latest)")] = None,
) -> SuccessResponse[list[LeaderboardEntry]]:
    """Get the epoch leaderboard."""
    data = await ScoringService.get_leaderboard(supabase, epoch_id, cycle_number=cycle)
    return SuccessResponse(data=data)


@router.get("/standings")
async def get_final_standings(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[LeaderboardEntry]]:
    """Get final standings for a completed epoch (includes dimension titles)."""
    data = await ScoringService.get_final_standings(supabase, epoch_id)
    return SuccessResponse(data=data)


# ── Score History ───────────────────────────────────────


@router.get("/simulations/{simulation_id}")
async def get_score_history(
    epoch_id: UUID,
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[ScoreResponse]]:
    """Get all cycle scores for a simulation in an epoch."""
    data = await ScoringService.get_score_history(supabase, epoch_id, simulation_id)
    return SuccessResponse(data=data)


# ── Intel Dossiers ─────────────────────────────────────


@router.get("/intel-dossiers")
async def get_intel_dossiers(
    epoch_id: UUID,
    simulation_id: Annotated[UUID, Query(description="Requesting simulation's ID")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Get pre-aggregated intel dossiers for a simulation's spy reports."""
    data = await ScoringService.get_intel_dossiers(supabase, epoch_id, simulation_id)
    return SuccessResponse(data=data)


# ── Compute (Admin) ────────────────────────────────────


@router.post("/compute")
async def compute_scores(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _creator_check: Annotated[None, Depends(require_epoch_creator())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    cycle: Annotated[int | None, Query(description="Cycle number (default: current)")] = None,
) -> SuccessResponse[list[ScoreResponse]]:
    """Compute and store scores for the current or specified cycle. Creator only."""
    from backend.services.epoch_service import EpochService

    epoch = await EpochService.get(supabase, epoch_id)
    cycle_number = cycle or epoch.get("current_cycle", 1)
    data = await ScoringService.compute_cycle_scores(supabase, epoch_id, cycle_number)
    try:
        await AuditService.log_action(
            supabase, None, user.id, "epoch_scores", None, "create",
            details={"epoch_id": str(epoch_id), "cycle": cycle_number, "scores_computed": len(data)},
        )
    except Exception:
        logger.warning("Audit log failed for score compute", exc_info=True)
    return SuccessResponse(data=data)
