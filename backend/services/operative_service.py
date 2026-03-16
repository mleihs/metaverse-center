"""Operative CRUD, query operations, and delegated mission execution."""

import logging
from uuid import UUID

from fastapi import HTTPException, status

from backend.services.constants import (
    DETECTION_PENALTY,
    FORTIFICATION_DURATION_CYCLES,
    FORTIFICATION_RP_COST,
    MISSION_SCORE_VALUES,
    OPERATIVE_DEPLOY_CYCLES,
    OPERATIVE_MISSION_CYCLES,
    OPERATIVE_RP_COSTS,
    SECURITY_DOWNGRADE,
    SECURITY_LEVEL_MAP,
    SECURITY_TIER_ORDER,
    _downgrade_security,
    _upgrade_security,
)
from supabase import Client

logger = logging.getLogger(__name__)

# Re-export constants for backwards compatibility (import from constants.py for new code)
__all__ = [
    "SECURITY_LEVEL_MAP",
    "SECURITY_TIER_ORDER",
    "SECURITY_DOWNGRADE",
    "MISSION_SCORE_VALUES",
    "DETECTION_PENALTY",
    "OPERATIVE_RP_COSTS",
    "OPERATIVE_DEPLOY_CYCLES",
    "OPERATIVE_MISSION_CYCLES",
    "FORTIFICATION_RP_COST",
    "FORTIFICATION_DURATION_CYCLES",
    "_downgrade_security",
    "_upgrade_security",
    "OperativeService",
]


class OperativeService:
    """Service for operative CRUD/queries with delegated mission execution."""

    # ── List / Get ────────────────────────────────────────

    @classmethod
    async def list_missions(
        cls,
        supabase: Client,
        epoch_id: UUID,
        *,
        simulation_id: UUID | None = None,
        status_filter: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List operative missions with optional filters."""
        select_fields = (
            "*, agents(name, portrait_image_url),"
            " target_sim:simulations!target_simulation_id(name)"
        )
        query = (
            supabase.table("operative_missions")
            .select(select_fields, count="exact")
            .eq("epoch_id", str(epoch_id))
        )
        if simulation_id:
            query = query.eq("source_simulation_id", str(simulation_id))
        if status_filter:
            query = query.eq("status", status_filter)
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        resp = query.execute()
        return resp.data or [], resp.count or 0

    @classmethod
    async def get_mission(cls, supabase: Client, mission_id: UUID) -> dict:
        """Get a single mission by ID."""
        select_fields = (
            "*, agents(name, portrait_image_url),"
            " target_sim:simulations!target_simulation_id(name)"
        )
        resp = (
            supabase.table("operative_missions")
            .select(select_fields)
            .eq("id", str(mission_id))
            .single()
            .execute()
        )
        if not resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Mission not found.")
        return resp.data

    @classmethod
    async def list_threats(
        cls,
        supabase: Client,
        epoch_id: UUID,
        target_simulation_id: UUID,
    ) -> list[dict]:
        """List detected incoming operative threats for a simulation."""
        resp = (
            supabase.table("operative_missions")
            .select("*")
            .eq("epoch_id", str(epoch_id))
            .eq("target_simulation_id", str(target_simulation_id))
            .in_("status", ["detected", "captured"])
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data or []


# ── Delegate to mission sub-service ────────────────────────────────
# These imports happen after OperativeService is fully defined, breaking
# the circular import chain (operative_mission_service imports EpochService
# which eventually imports OperativeService via cycle_resolution_service).

from backend.services.operative_mission_service import (  # noqa: E402
    OperativeMissionService,
)

# Mission execution operations
OperativeService.deploy = OperativeMissionService.deploy  # type: ignore[attr-defined]
OperativeService.resolve_pending_missions = OperativeMissionService.resolve_pending_missions  # type: ignore[attr-defined]
OperativeService.recall = OperativeMissionService.recall  # type: ignore[attr-defined]
OperativeService.counter_intel_sweep = OperativeMissionService.counter_intel_sweep  # type: ignore[attr-defined]
OperativeService.fortify_zone = OperativeMissionService.fortify_zone  # type: ignore[attr-defined]

# Re-export private helpers used by tests
OperativeService._calculate_success_probability = OperativeMissionService._calculate_success_probability  # type: ignore[attr-defined]
OperativeService._apply_spy_effect = OperativeMissionService._apply_spy_effect  # type: ignore[attr-defined]
OperativeService._apply_saboteur_effect = OperativeMissionService._apply_saboteur_effect  # type: ignore[attr-defined]
OperativeService._apply_propagandist_effect = OperativeMissionService._apply_propagandist_effect  # type: ignore[attr-defined]
OperativeService._apply_assassin_effect = OperativeMissionService._apply_assassin_effect  # type: ignore[attr-defined]
OperativeService._apply_infiltrator_effect = OperativeMissionService._apply_infiltrator_effect  # type: ignore[attr-defined]

