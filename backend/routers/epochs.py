"""Epoch CRUD, lifecycle, participation, and team management endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_supabase,
    require_epoch_creator,
    require_epoch_participant,
)
from backend.models.aptitude import DraftRequest
from backend.models.bot import AddBotToEpoch
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.epoch import (
    BattleLogEntry,
    BattleSummaryResponse,
    EpochCreate,
    EpochResponse,
    EpochUpdate,
    ParticipantJoin,
    ParticipantResponse,
    SitrepResponse,
    TeamCreate,
    TeamResponse,
)
from backend.models.epoch_chat import ReadySignal
from backend.services.academy_service import AcademyService
from backend.services.audit_service import AuditService
from backend.services.battle_log_service import BattleLogService
from backend.services.cycle_notification_service import CycleNotificationService
from backend.services.epoch_chat_service import EpochChatService
from backend.services.epoch_service import EpochService
from backend.services.game_instance_service import GameInstanceService
from backend.services.sitrep_service import SitrepService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/epochs", tags=["epochs"])


# ── Epoch CRUD ──────────────────────────────────────────


@router.get("", response_model=PaginatedResponse[EpochResponse])
async def list_epochs(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    status: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List all epochs with optional status filter."""
    data, total = await EpochService.list_epochs(
        supabase, status_filter=status, limit=limit, offset=offset
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/active", response_model=SuccessResponse[list[EpochResponse]])
async def get_active_epochs(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get all active epochs (lobby + running)."""
    data = await EpochService.get_active_epochs(supabase)
    return {"success": True, "data": data}


@router.get("/{epoch_id}", response_model=SuccessResponse[EpochResponse])
async def get_epoch(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single epoch by ID."""
    data = await EpochService.get(supabase, epoch_id)
    return {"success": True, "data": data}


@router.post("", response_model=SuccessResponse[EpochResponse], status_code=201)
async def create_epoch(
    body: EpochCreate,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new epoch (lobby phase)."""
    data = await EpochService.create(
        supabase,
        user.id,
        name=body.name,
        description=body.description,
        config=body.config.model_dump() if body.config else None,
        epoch_type=body.epoch_type,
    )
    await AuditService.safe_log(
        supabase, None, user.id, "game_epochs", data["id"], "create",
    )
    return {"success": True, "data": data}


@router.patch("/{epoch_id}", response_model=SuccessResponse[EpochResponse])
async def update_epoch(
    epoch_id: UUID,
    body: EpochUpdate,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update epoch configuration (lobby phase only)."""
    updates = body.model_dump(exclude_none=True)
    if "config" in updates and updates["config"]:
        cfg = updates["config"]
        updates["config"] = cfg.model_dump() if hasattr(cfg, "model_dump") else cfg
    data = await EpochService.update(supabase, epoch_id, updates)
    return {"success": True, "data": data}


@router.post("/quick-academy", response_model=SuccessResponse[EpochResponse], status_code=201)
async def create_quick_academy(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """One-click academy epoch creation with auto-configured bots.

    Creates a sprint-format academy epoch, selects platform template
    simulations for bots, creates temporary bot players, and adds them.
    """
    epoch = await AcademyService.create_academy_epoch(supabase, admin_supabase, user.id)
    await AuditService.safe_log(
        supabase, None, user.id, "game_epochs", epoch["id"], "create_academy",
    )
    return {"success": True, "data": epoch}


# ── Lifecycle ───────────────────────────────────────────


@router.post("/{epoch_id}/start", response_model=SuccessResponse[EpochResponse])
async def start_epoch(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Start an epoch (lobby -> foundation). Creator only.

    This clones all participating simulations into game instances
    with normalized gameplay values.
    """
    data = await EpochService.start_epoch(supabase, epoch_id, user.id, admin_supabase)
    await BattleLogService.log_phase_change(
        supabase, epoch_id, 1, "lobby", "foundation"
    )

    # Send epoch start notification (G1 — lobby → foundation)
    try:
        await CycleNotificationService.send_phase_change_notifications(
            admin_supabase, str(epoch_id), "lobby", "foundation",
        )
    except Exception:
        logger.warning("Epoch start notification failed for epoch %s", epoch_id, exc_info=True)

    await AuditService.safe_log(
        supabase, None, user.id, "game_epochs", epoch_id, "update",
        details={"action": "start", "new_status": "foundation"},
    )
    return {"success": True, "data": data}


@router.post("/{epoch_id}/advance", response_model=SuccessResponse[EpochResponse])
async def advance_phase(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Advance to next epoch phase. Creator only."""
    epoch = await EpochService.get(supabase, epoch_id)
    old_status = epoch["status"]
    data = await EpochService.advance_phase(supabase, epoch_id, admin_supabase)
    new_status = data["status"]
    await BattleLogService.log_phase_change(
        supabase, epoch_id, epoch.get("current_cycle", 1), old_status, new_status
    )

    # Send notification emails (best-effort, non-blocking)
    try:
        if new_status == "completed":
            await CycleNotificationService.send_epoch_completed_notifications(
                admin_supabase, str(epoch_id),
            )
        else:
            await CycleNotificationService.send_phase_change_notifications(
                admin_supabase, str(epoch_id), old_status, new_status,
            )
    except Exception:
        logger.warning("Phase notification failed for epoch %s", epoch_id, exc_info=True)

    await AuditService.safe_log(
        supabase, None, user.id, "game_epochs", epoch_id, "update",
        details={"action": "advance", "old_status": old_status, "new_status": new_status},
    )
    return {"success": True, "data": data}


@router.post("/{epoch_id}/cancel", response_model=SuccessResponse[EpochResponse])
async def cancel_epoch(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Cancel an epoch. Creator only."""
    epoch = await EpochService.get(supabase, epoch_id)
    data = await EpochService.cancel_epoch(supabase, epoch_id, admin_supabase)
    await BattleLogService.log_phase_change(
        supabase, epoch_id, epoch.get("current_cycle", 0), epoch["status"], "cancelled"
    )
    await AuditService.safe_log(
        supabase, None, user.id, "game_epochs", epoch_id, "update",
        details={"action": "cancel", "old_status": epoch["status"]},
    )
    return {"success": True, "data": data}


@router.delete("/{epoch_id}", response_model=SuccessResponse[EpochResponse])
async def delete_epoch(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Permanently delete an epoch. Creator only. Only lobby or cancelled epochs."""
    data = await EpochService.delete_epoch(admin_supabase, epoch_id)
    await AuditService.safe_log(
        supabase, None, user.id, "game_epochs", epoch_id, "delete",
        details={"name": data.get("name"), "status": data.get("status")},
    )
    return {"success": True, "data": data}


@router.get("/{epoch_id}/instances", response_model=SuccessResponse)
async def list_instances(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all game instances for an epoch."""
    data = await GameInstanceService.list_instances(supabase, epoch_id)
    return {"success": True, "data": data}


@router.get("/{epoch_id}/battle-log/summary", response_model=SuccessResponse[BattleSummaryResponse])
async def get_cycle_battle_summary(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    cycle: int = Query(..., ge=0, description="Cycle number"),
    simulation_id: UUID | None = Query(default=None),
) -> dict:
    """Get aggregated battle stats for a specific cycle (War Room)."""
    data = await SitrepService.get_cycle_summary(
        supabase, str(epoch_id), cycle,
        simulation_id=str(simulation_id) if simulation_id else None,
    )
    return {"success": True, "data": data}


@router.get("/{epoch_id}/sitrep/{cycle_number}", response_model=SuccessResponse[SitrepResponse])
async def get_cycle_sitrep(
    epoch_id: UUID,
    cycle_number: int,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    simulation_id: UUID | None = Query(default=None),
) -> dict:
    """Generate AI tactical situation report for a cycle (War Room)."""
    data = await SitrepService.generate_sitrep(
        supabase, str(epoch_id), cycle_number,
        simulation_id=str(simulation_id) if simulation_id else None,
    )
    return {"success": True, "data": data}


@router.get("/{epoch_id}/battle-log", response_model=PaginatedResponse[BattleLogEntry])
async def get_battle_log(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    event_type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """Get battle log entries (authenticated — includes private entries)."""
    data, total = await BattleLogService.list_entries(
        supabase, epoch_id,
        event_type=event_type,
        limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.post("/{epoch_id}/resolve-cycle", response_model=SuccessResponse[EpochResponse])
async def resolve_cycle(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Resolve the current cycle (allocate RP, execute bot turns, advance cycle counter). Creator only."""
    data = await EpochService.resolve_cycle_full(supabase, epoch_id, admin_supabase)

    await AuditService.safe_log(
        supabase, None, user.id, "game_epochs", epoch_id, "update",
        details={"action": "resolve_cycle", "cycle": data.get("current_cycle")},
    )
    return {"success": True, "data": data}


# ── Participants ────────────────────────────────────────


@router.get(
    "/{epoch_id}/participants",
    response_model=SuccessResponse[list[ParticipantResponse]],
)
async def list_participants(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all participants in an epoch."""
    data = await EpochService.list_participants(supabase, epoch_id)
    return {"success": True, "data": data}


@router.post(
    "/{epoch_id}/participants",
    response_model=SuccessResponse[ParticipantResponse],
    status_code=201,
)
async def join_epoch(
    epoch_id: UUID,
    body: ParticipantJoin,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Join an epoch with any template simulation.

    Any authenticated user can join. One simulation per epoch, one user per epoch.
    """
    data = await EpochService.join_epoch(supabase, epoch_id, body.simulation_id, user.id)
    await AuditService.safe_log(
        supabase, body.simulation_id, user.id, "epoch_participants", data.get("id"), "create",
        details={"epoch_id": str(epoch_id)},
    )
    return {"success": True, "data": data}


@router.delete("/{epoch_id}/participants/{simulation_id}")
async def leave_epoch(
    epoch_id: UUID,
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Leave an epoch (lobby phase only)."""
    await EpochService.leave_epoch(supabase, epoch_id, simulation_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "epoch_participants", None, "delete",
        details={"epoch_id": str(epoch_id)},
    )
    return {"success": True, "data": {"message": "Left epoch."}}


# ── Draft ──────────────────────────────────────────────


@router.post(
    "/{epoch_id}/participants/{simulation_id}/draft",
    response_model=SuccessResponse[ParticipantResponse],
)
async def draft_agents(
    epoch_id: UUID,
    simulation_id: UUID,
    body: DraftRequest,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Lock in a draft roster for a participant (lobby phase only)."""
    data = await EpochService.draft_agents(
        supabase, epoch_id, simulation_id, body.agent_ids
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "epoch_participants", data.get("id"), "update",
        details={"drafted_agent_ids": [str(a) for a in body.agent_ids]},
    )
    return {"success": True, "data": data}


# ── Bot Participants ───────────────────────────────────


@router.post(
    "/{epoch_id}/add-bot",
    response_model=SuccessResponse[ParticipantResponse],
    status_code=201,
)
async def add_bot_to_epoch(
    epoch_id: UUID,
    body: AddBotToEpoch,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
    _creator: None = Depends(require_epoch_creator()),
) -> dict:
    """Add a bot participant to an epoch lobby. Only the epoch creator."""
    data = await EpochService.add_bot(admin_supabase, epoch_id, body.simulation_id, body.bot_player_id)
    await AuditService.safe_log(
        supabase, body.simulation_id, user.id, "epoch_participants", data.get("id"), "create",
        details={"epoch_id": str(epoch_id), "bot_player_id": str(body.bot_player_id), "is_bot": True},
    )
    return {"success": True, "data": data}


@router.delete("/{epoch_id}/remove-bot/{participant_id}")
async def remove_bot_from_epoch(
    epoch_id: UUID,
    participant_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Remove a bot participant from epoch lobby. Creator only."""
    await EpochService.remove_bot(supabase, epoch_id, participant_id)
    await AuditService.safe_log(
        supabase, None, user.id, "epoch_participants", participant_id, "delete",
        details={"epoch_id": str(epoch_id), "is_bot": True},
    )
    return {"success": True, "data": {"message": "Bot removed."}}


# ── Teams / Alliances ──────────────────────────────────


@router.get(
    "/{epoch_id}/teams",
    response_model=SuccessResponse[list[TeamResponse]],
)
async def list_teams(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all teams in an epoch."""
    data = await EpochService.list_teams(supabase, epoch_id)
    return {"success": True, "data": data}


@router.post(
    "/{epoch_id}/teams",
    response_model=SuccessResponse[TeamResponse],
    status_code=201,
)
async def create_team(
    epoch_id: UUID,
    body: TeamCreate,
    simulation_id: UUID = Query(..., description="Your simulation ID"),
    user: CurrentUser = Depends(get_current_user),
    _participant: dict = Depends(require_epoch_participant()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new alliance/team. Must be a participant in the epoch."""
    data = await EpochService.create_team(supabase, epoch_id, simulation_id, body.name)
    epoch = await EpochService.get(supabase, epoch_id)
    await BattleLogService.log_alliance_formed(
        supabase, epoch_id, epoch.get("current_cycle", 0), body.name, [simulation_id]
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "epoch_teams", data.get("id"), "create",
        details={"epoch_id": str(epoch_id), "name": body.name},
    )
    return {"success": True, "data": data}


@router.post("/{epoch_id}/teams/{team_id}/join")
async def join_team(
    epoch_id: UUID,
    team_id: UUID,
    simulation_id: UUID = Query(..., description="Your simulation ID"),
    user: CurrentUser = Depends(get_current_user),
    _participant: dict = Depends(require_epoch_participant()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Join an existing team. Must be a participant in the epoch."""
    data = await EpochService.join_team(supabase, epoch_id, team_id, simulation_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "epoch_teams", team_id, "update",
        details={"action": "join", "epoch_id": str(epoch_id)},
    )
    return {"success": True, "data": data}


@router.post("/{epoch_id}/teams/leave")
async def leave_team(
    epoch_id: UUID,
    simulation_id: UUID = Query(..., description="Your simulation ID"),
    user: CurrentUser = Depends(get_current_user),
    _participant: dict = Depends(require_epoch_participant()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Leave your current team. Must be a participant in the epoch."""
    data = await EpochService.leave_team(supabase, epoch_id, simulation_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id, "epoch_teams", None, "update",
        details={"action": "leave", "epoch_id": str(epoch_id)},
    )
    return {"success": True, "data": data}


# ── Ready Signals ─────────────────────────────────────


@router.post("/{epoch_id}/ready", response_model=SuccessResponse)
async def toggle_ready(
    epoch_id: UUID,
    body: ReadySignal,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Toggle cycle_ready for a participant. Triggers realtime broadcast.

    When all human participants signal ready, the cycle auto-resolves.
    """
    data = await EpochChatService.toggle_ready(
        supabase, epoch_id, body.simulation_id, body.ready,
        admin_supabase=admin_supabase,
    )

    if data.get("auto_resolved"):
        await AuditService.safe_log(
            supabase, None, user.id, "game_epochs", epoch_id, "update",
            details={"action": "auto_resolve_cycle", "cycle": data.get("new_cycle")},
        )

    return {"success": True, "data": data}
