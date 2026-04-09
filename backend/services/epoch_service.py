"""Epoch lifecycle management — create, join, transition, RP allocation.

This module is the public API facade. CRUD operations live here directly;
lifecycle, participation, and cycle resolution are delegated to focused
sub-services while keeping the EpochService interface stable for all callers.
"""

import logging
from uuid import UUID

from backend.models.epoch import EpochConfig
from backend.services.constants import OPERATIVE_RP_COSTS
from backend.utils.errors import bad_request, not_found, server_error
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Default epoch config (matches EpochConfig defaults)
DEFAULT_CONFIG = EpochConfig().model_dump()

# Re-export for backwards compatibility
__all__ = ["OPERATIVE_RP_COSTS", "DEFAULT_CONFIG", "EpochService"]


class EpochService:
    """Service for epoch CRUD and lifecycle management.

    CRUD methods live here directly. Lifecycle transitions, participation,
    and cycle resolution are delegated to focused sub-services via class
    attributes assigned after class definition (see bottom of module).
    """

    # ── Read ──────────────────────────────────────────────────

    @classmethod
    async def list_epochs(
        cls,
        supabase: Client,
        *,
        status_filter: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List epochs with optional status filter."""
        query = supabase.table("game_epochs").select("*", count="exact")
        if status_filter:
            query = query.eq("status", status_filter)
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        resp = await query.execute()
        return resp.data or [], resp.count or 0

    @classmethod
    async def get(cls, supabase: Client, epoch_id: UUID) -> dict:
        """Get a single epoch by ID."""
        resp = await supabase.table("game_epochs").select("*").eq("id", str(epoch_id)).single().execute()
        if not resp.data:
            raise not_found(detail="Epoch not found.")
        return resp.data

    @classmethod
    async def get_active_epochs(cls, supabase: Client) -> list[dict]:
        """Get all active epochs (lobby/foundation/competition/reckoning)."""
        resp = await (
            supabase.table("game_epochs")
            .select("*")
            .in_("status", ["lobby", "foundation", "competition", "reckoning"])
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data or []

    # ── Create / Update ──────────────────────────────────────

    @classmethod
    async def create(
        cls,
        supabase: Client,
        user_id: UUID,
        name: str,
        description: str | None = None,
        config: dict | None = None,
        epoch_type: str = "competitive",
    ) -> dict:
        """Create a new epoch in lobby status."""
        merged_config = {**DEFAULT_CONFIG, **(config or {})}

        data = {
            "name": name,
            "description": description,
            "created_by_id": str(user_id),
            "config": merged_config,
            "epoch_type": epoch_type,
        }
        resp = await supabase.table("game_epochs").insert(data).execute()
        if not resp.data:
            raise server_error("Failed to create epoch.")
        return resp.data[0]

    @classmethod
    async def update(
        cls,
        supabase: Client,
        epoch_id: UUID,
        updates: dict,
    ) -> dict:
        """Update epoch details (only in lobby phase)."""
        epoch = await cls.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise bad_request("Can only edit epoch configuration during lobby phase.")
        resp = await supabase.table("game_epochs").update(updates).eq("id", str(epoch_id)).execute()
        if not resp.data:
            raise server_error("Failed to update epoch.")
        return resp.data[0]

    # ── Delegated methods ────────────────────────────────────
    # Assigned after class definition (see bottom of module) to avoid
    # circular imports. All callers continue to use EpochService.method().

    # Lifecycle: start_epoch, advance_phase, cancel_epoch, delete_epoch
    # Participation: list_participants, join_epoch, leave_epoch, draft_agents,
    #   list_teams, create_team, join_team, leave_team, add_bot, remove_bot
    # Cycle resolution: resolve_cycle_full, resolve_cycle,
    #   _grant_rp_batch, spend_rp, grant_rp


# ── Delegate to sub-services ────────────────────────────────────
# These imports happen after EpochService is fully defined, breaking
# the circular import chain (sub-services import EpochService.get() etc.)

from backend.services.alliance_service import AllianceService  # noqa: E402
from backend.services.cycle_resolution_service import CycleResolutionService  # noqa: E402
from backend.services.epoch_lifecycle_service import EpochLifecycleService  # noqa: E402
from backend.services.epoch_participation_service import EpochParticipationService  # noqa: E402

# Lifecycle
EpochService.start_epoch = EpochLifecycleService.start_epoch  # type: ignore[attr-defined]
EpochService.advance_phase = EpochLifecycleService.advance_phase  # type: ignore[attr-defined]
EpochService.cancel_epoch = EpochLifecycleService.cancel_epoch  # type: ignore[attr-defined]
EpochService.delete_epoch = EpochLifecycleService.delete_epoch  # type: ignore[attr-defined]

# Participation
EpochService.list_participants = EpochParticipationService.list_participants  # type: ignore[attr-defined]
EpochService.join_epoch = EpochParticipationService.join_epoch  # type: ignore[attr-defined]
EpochService.leave_epoch = EpochParticipationService.leave_epoch  # type: ignore[attr-defined]
EpochService.draft_agents = EpochParticipationService.draft_agents  # type: ignore[attr-defined]
EpochService.list_teams = EpochParticipationService.list_teams  # type: ignore[attr-defined]
EpochService.create_team = EpochParticipationService.create_team  # type: ignore[attr-defined]
EpochService.join_team = EpochParticipationService.join_team  # type: ignore[attr-defined]
EpochService.leave_team = EpochParticipationService.leave_team  # type: ignore[attr-defined]
EpochService.add_bot = EpochParticipationService.add_bot  # type: ignore[attr-defined]
EpochService.remove_bot = EpochParticipationService.remove_bot  # type: ignore[attr-defined]

# Cycle resolution
# Alliance proposals
EpochService.create_proposal = AllianceService.create_proposal  # type: ignore[attr-defined]
EpochService.vote_on_proposal = AllianceService.vote_on_proposal  # type: ignore[attr-defined]
EpochService.list_proposals = AllianceService.list_proposals  # type: ignore[attr-defined]

# Cycle resolution
EpochService.resolve_cycle_full = CycleResolutionService.resolve_cycle_full  # type: ignore[attr-defined]
EpochService.resolve_cycle = CycleResolutionService.resolve_cycle  # type: ignore[attr-defined]
EpochService._grant_rp_batch = CycleResolutionService._grant_rp_batch  # type: ignore[attr-defined]
EpochService.spend_rp = CycleResolutionService.spend_rp  # type: ignore[attr-defined]
EpochService.grant_rp = CycleResolutionService.grant_rp  # type: ignore[attr-defined]
