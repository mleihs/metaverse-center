"""Epoch CRUD, lifecycle, participation, and team management endpoints."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_effective_supabase,
    require_epoch_creator,
    require_epoch_participant,
)
from backend.models.aptitude import DraftRequest
from backend.models.bot import AddBotToEpoch
from backend.models.common import CurrentUser, MessageResponse, PaginatedResponse, SuccessResponse
from backend.models.epoch import (
    AllianceInviteCreate,
    AllianceProposalCreate,
    AllianceProposalResponse,
    AllianceVoteCreate,
    AllianceVoteResponse,
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
from backend.services.alliance_service import AllianceService
from backend.services.audit_service import AuditService
from backend.services.battle_log_service import BattleLogService
from backend.services.cycle_resolution_service import CycleResolutionService
from backend.services.epoch_chat_service import EpochChatService
from backend.services.epoch_service import EpochService
from backend.services.game_instance_service import GameInstanceService
from backend.services.sitrep_service import SitrepService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/epochs", tags=["epochs"])


# ── Epoch CRUD ──────────────────────────────────────────


@router.get("")
async def list_epochs(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    status: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[EpochResponse]:
    """List all epochs with optional status filter."""
    data, total = await EpochService.list_epochs(supabase, status_filter=status, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


@router.get("/active")
async def get_active_epochs(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[EpochResponse]]:
    """Get all active epochs (lobby + running)."""
    data = await EpochService.get_active_epochs(supabase)
    return SuccessResponse(data=data)


@router.get("/{epoch_id}")
async def get_epoch(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EpochResponse]:
    """Get a single epoch by ID."""
    data = await EpochService.get(supabase, epoch_id)
    return SuccessResponse(data=data)


@router.post("", status_code=201)
async def create_epoch(
    body: EpochCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EpochResponse]:
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
        supabase,
        None,
        user.id,
        "game_epochs",
        data["id"],
        "create",
    )
    return SuccessResponse(data=data)


@router.patch("/{epoch_id}")
async def update_epoch(
    epoch_id: UUID,
    body: EpochUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _creator_check: Annotated[None, Depends(require_epoch_creator())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EpochResponse]:
    """Update epoch configuration (lobby phase only)."""
    updates = body.model_dump(exclude_none=True)
    if "config" in updates and updates["config"]:
        cfg = updates["config"]
        updates["config"] = cfg.model_dump() if hasattr(cfg, "model_dump") else cfg
    data = await EpochService.update(supabase, epoch_id, updates)
    return SuccessResponse(data=data)


@router.post("/quick-academy", status_code=201)
async def create_quick_academy(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[EpochResponse]:
    """One-click academy epoch creation with auto-configured bots.

    Creates a sprint-format academy epoch, selects platform template
    simulations for bots, creates temporary bot players, and adds them.
    """
    epoch = await AcademyService.create_academy_epoch(supabase, admin_supabase, user.id)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "game_epochs",
        epoch["id"],
        "create_academy",
    )
    return SuccessResponse(data=epoch)


# ── Lifecycle ───────────────────────────────────────────


@router.post("/{epoch_id}/start")
async def start_epoch(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _creator_check: Annotated[None, Depends(require_epoch_creator())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[EpochResponse]:
    """Start an epoch (lobby -> foundation). Creator only.

    This clones all participating simulations into game instances
    with normalized gameplay values.
    """
    data = await EpochService.start_epoch(supabase, epoch_id, user.id, admin_supabase)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "game_epochs",
        epoch_id,
        "update",
        details={"action": "start", "new_status": "foundation"},
    )
    return SuccessResponse(data=data)


@router.post("/{epoch_id}/advance")
async def advance_phase(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _creator_check: Annotated[None, Depends(require_epoch_creator())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[EpochResponse]:
    """Advance to next epoch phase. Creator only."""
    data = await EpochService.advance_phase(supabase, epoch_id, admin_supabase)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "game_epochs",
        epoch_id,
        "update",
        details={"action": "advance", "new_status": data["status"]},
    )
    return SuccessResponse(data=data)


@router.post("/{epoch_id}/cancel")
async def cancel_epoch(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _creator_check: Annotated[None, Depends(require_epoch_creator())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[EpochResponse]:
    """Cancel an epoch. Creator only."""
    epoch = await EpochService.get(supabase, epoch_id)
    data = await EpochService.cancel_epoch(supabase, epoch_id, admin_supabase)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "game_epochs",
        epoch_id,
        "update",
        details={"action": "cancel", "old_status": epoch["status"]},
    )
    return SuccessResponse(data=data)


@router.delete("/{epoch_id}")
async def delete_epoch(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _creator_check: Annotated[None, Depends(require_epoch_creator())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[EpochResponse]:
    """Permanently delete an epoch. Creator only. Only lobby or cancelled epochs."""
    data = await EpochService.delete_epoch(admin_supabase, epoch_id)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "game_epochs",
        epoch_id,
        "delete",
        details={"name": data.get("name"), "status": data.get("status")},
    )
    return SuccessResponse(data=data)


@router.get("/{epoch_id}/instances")
async def list_instances(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """List all game instances for an epoch."""
    data = await GameInstanceService.list_instances(supabase, epoch_id)
    return SuccessResponse(data=data)


@router.get("/{epoch_id}/battle-log/summary")
async def get_cycle_battle_summary(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    cycle: Annotated[int, Query(ge=0, description="Cycle number")],
    simulation_id: Annotated[UUID | None, Query()] = None,
) -> SuccessResponse[BattleSummaryResponse]:
    """Get aggregated battle stats for a specific cycle (War Room)."""
    data = await SitrepService.get_cycle_summary(
        supabase,
        str(epoch_id),
        cycle,
        simulation_id=str(simulation_id) if simulation_id else None,
    )
    return SuccessResponse(data=data)


@router.get("/{epoch_id}/sitrep/{cycle_number}")
async def get_cycle_sitrep(
    epoch_id: UUID,
    cycle_number: int,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    simulation_id: Annotated[UUID | None, Query()] = None,
) -> SuccessResponse[SitrepResponse]:
    """Generate AI tactical situation report for a cycle (War Room)."""
    data = await SitrepService.generate_sitrep(
        supabase,
        str(epoch_id),
        cycle_number,
        simulation_id=str(simulation_id) if simulation_id else None,
    )
    return SuccessResponse(data=data)


@router.get("/{epoch_id}/battle-log")
async def get_battle_log(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    event_type: Annotated[str | None, Query()] = None,
    simulation_id: Annotated[UUID | None, Query(description="Your simulation ID for allied intel tagging")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[BattleLogEntry]:
    """Get battle log entries (authenticated — includes private entries).

    Pass simulation_id to tag entries visible only via alliance as allied_intel.
    """
    data, total = await BattleLogService.list_entries(
        supabase,
        epoch_id,
        event_type=event_type,
        limit=limit,
        offset=offset,
    )

    # Tag allied intel entries (computed at read time, not stored)
    if simulation_id:
        sim_str = str(simulation_id)
        for entry in data:
            is_own_source = entry.get("source_simulation_id") == sim_str
            is_own_target = entry.get("target_simulation_id") == sim_str
            is_public = entry.get("is_public", False)
            if not is_own_source and not is_own_target and not is_public:
                entry["metadata"] = {
                    **(entry.get("metadata") or {}),
                    "allied_intel": True,
                }

    return paginated(data, total, limit, offset)


@router.get("/{epoch_id}/results-summary")
async def get_results_summary(
    epoch_id: UUID,
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Get comprehensive results summary for a completed epoch."""
    from backend.services.scoring_service import ScoringService

    data = await ScoringService.get_results_summary(supabase, epoch_id)
    return SuccessResponse(data=data)


@router.post("/{epoch_id}/resolve-cycle")
async def resolve_cycle(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _creator_check: Annotated[None, Depends(require_epoch_creator())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[EpochResponse]:
    """Resolve the current cycle (allocate RP, execute bot turns, advance cycle counter). Creator only."""
    data = await EpochService.resolve_cycle_full(supabase, epoch_id, admin_supabase)

    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "game_epochs",
        epoch_id,
        "update",
        details={"action": "resolve_cycle", "cycle": data.get("current_cycle")},
    )
    return SuccessResponse(data=data)


@router.post("/{epoch_id}/pass-cycle")
async def pass_cycle(
    epoch_id: UUID,
    simulation_id: Annotated[UUID, Query(description="Your simulation ID")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _participant: Annotated[dict, Depends(require_epoch_participant())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
    """Explicitly pass this cycle without taking action.

    Sets has_acted_this_cycle = true so the player can signal ready.
    Does not deploy any operatives or take any strategic action.
    """
    data = await CycleResolutionService.pass_cycle(supabase, admin_supabase, epoch_id, simulation_id)
    return SuccessResponse(data=data)


# ── Participants ────────────────────────────────────────


@router.get(
    "/{epoch_id}/participants",
)
async def list_participants(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[ParticipantResponse]]:
    """List all participants in an epoch."""
    data = await EpochService.list_participants(supabase, epoch_id)
    return SuccessResponse(data=data)


@router.post(
    "/{epoch_id}/participants",
    status_code=201,
)
async def join_epoch(
    epoch_id: UUID,
    body: ParticipantJoin,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ParticipantResponse]:
    """Join an epoch with any template simulation.

    Any authenticated user can join. One simulation per epoch, one user per epoch.
    """
    data = await EpochService.join_epoch(supabase, epoch_id, body.simulation_id, user.id)
    await AuditService.safe_log(
        supabase,
        body.simulation_id,
        user.id,
        "epoch_participants",
        data.get("id"),
        "create",
        details={"epoch_id": str(epoch_id)},
    )
    return SuccessResponse(data=data)


@router.delete("/{epoch_id}/participants/{simulation_id}")
async def leave_epoch(
    epoch_id: UUID,
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[MessageResponse]:
    """Leave an epoch (lobby phase only)."""
    await EpochService.leave_epoch(supabase, epoch_id, simulation_id)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "epoch_participants",
        None,
        "delete",
        details={"epoch_id": str(epoch_id)},
    )
    return SuccessResponse(data=MessageResponse(message="Left epoch."))


# ── Draft ──────────────────────────────────────────────


@router.post(
    "/{epoch_id}/participants/{simulation_id}/draft",
)
async def draft_agents(
    epoch_id: UUID,
    simulation_id: UUID,
    body: DraftRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ParticipantResponse]:
    """Lock in a draft roster for a participant (lobby phase only)."""
    data = await EpochService.draft_agents(supabase, epoch_id, simulation_id, body.agent_ids)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "epoch_participants",
        data.get("id"),
        "update",
        details={"drafted_agent_ids": [str(a) for a in body.agent_ids]},
    )
    return SuccessResponse(data=data)


# ── Bot Participants ───────────────────────────────────


@router.post(
    "/{epoch_id}/add-bot",
    status_code=201,
)
async def add_bot_to_epoch(
    epoch_id: UUID,
    body: AddBotToEpoch,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    _creator: Annotated[None, Depends(require_epoch_creator())],
) -> SuccessResponse[ParticipantResponse]:
    """Add a bot participant to an epoch lobby. Only the epoch creator."""
    data = await EpochService.add_bot(admin_supabase, epoch_id, body.simulation_id, body.bot_player_id)
    await AuditService.safe_log(
        supabase,
        body.simulation_id,
        user.id,
        "epoch_participants",
        data.get("id"),
        "create",
        details={"epoch_id": str(epoch_id), "bot_player_id": str(body.bot_player_id), "is_bot": True},
    )
    return SuccessResponse(data=data)


@router.delete("/{epoch_id}/remove-bot/{participant_id}")
async def remove_bot_from_epoch(
    epoch_id: UUID,
    participant_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _creator_check: Annotated[None, Depends(require_epoch_creator())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[MessageResponse]:
    """Remove a bot participant from epoch lobby. Creator only."""
    await EpochService.remove_bot(supabase, epoch_id, participant_id)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "epoch_participants",
        participant_id,
        "delete",
        details={"epoch_id": str(epoch_id), "is_bot": True},
    )
    return SuccessResponse(data=MessageResponse(message="Bot removed."))


# ── Teams / Alliances ──────────────────────────────────


@router.get(
    "/{epoch_id}/teams",
)
async def list_teams(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[TeamResponse]]:
    """List all teams in an epoch."""
    data = await EpochService.list_teams(supabase, epoch_id)
    return SuccessResponse(data=data)


@router.post(
    "/{epoch_id}/teams",
    status_code=201,
)
async def create_team(
    epoch_id: UUID,
    body: TeamCreate,
    simulation_id: Annotated[UUID, Query(description="Your simulation ID")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _participant: Annotated[dict, Depends(require_epoch_participant())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[TeamResponse]:
    """Create a new alliance/team. Must be a participant in the epoch."""
    data = await EpochService.create_team(supabase, epoch_id, simulation_id, body.name)
    epoch = await EpochService.get(supabase, epoch_id)
    await BattleLogService.log_alliance_formed(
        supabase, epoch_id, epoch.get("current_cycle", 0), body.name, [simulation_id]
    )
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "epoch_teams",
        data.get("id"),
        "create",
        details={"epoch_id": str(epoch_id), "name": body.name},
    )
    return SuccessResponse(data=data)


@router.post("/{epoch_id}/teams/{team_id}/join")
async def join_team(
    epoch_id: UUID,
    team_id: UUID,
    simulation_id: Annotated[UUID, Query(description="Your simulation ID")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _participant: Annotated[dict, Depends(require_epoch_participant())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Join an existing team. Must be a participant in the epoch."""
    data = await EpochService.join_team(supabase, epoch_id, team_id, simulation_id)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "epoch_teams",
        team_id,
        "update",
        details={"action": "join", "epoch_id": str(epoch_id)},
    )
    return SuccessResponse(data=data)


@router.post("/{epoch_id}/teams/leave")
async def leave_team(
    epoch_id: UUID,
    simulation_id: Annotated[UUID, Query(description="Your simulation ID")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _participant: Annotated[dict, Depends(require_epoch_participant())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Leave your current team. Must be a participant in the epoch."""
    data = await EpochService.leave_team(supabase, epoch_id, simulation_id)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "epoch_teams",
        None,
        "update",
        details={"action": "leave", "epoch_id": str(epoch_id)},
    )
    return SuccessResponse(data=data)


# ── Alliance Proposals ─────────────────────────────────


@router.get(
    "/{epoch_id}/proposals",
)
async def list_proposals(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    team_id: Annotated[UUID | None, Query()] = None,
    status: Annotated[str | None, Query(alias="proposal_status")] = None,
) -> SuccessResponse[list[AllianceProposalResponse]]:
    """List alliance proposals for an epoch."""
    data = await AllianceService.list_proposals(
        supabase,
        epoch_id,
        team_id=team_id,
        status_filter=status,
    )
    return SuccessResponse(data=data)


@router.post(
    "/{epoch_id}/proposals",
    status_code=201,
)
async def create_proposal(
    epoch_id: UUID,
    body: AllianceProposalCreate,
    simulation_id: Annotated[UUID, Query(description="Your simulation ID")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _participant: Annotated[dict, Depends(require_epoch_participant())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[AllianceProposalResponse]:
    """Request to join a team. Requires unanimous member approval."""
    data = await AllianceService.create_proposal(
        supabase,
        epoch_id,
        body.team_id,
        simulation_id,
    )

    await CycleResolutionService.mark_acted(admin_supabase, epoch_id, simulation_id)

    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "epoch_alliance_proposals",
        data.get("id"),
        "create",
        details={"epoch_id": str(epoch_id), "team_id": str(body.team_id)},
    )
    return SuccessResponse(data=data)


@router.post(
    "/{epoch_id}/teams/{team_id}/invite",
    status_code=201,
)
async def invite_to_team(
    epoch_id: UUID,
    team_id: UUID,
    body: AllianceInviteCreate,
    simulation_id: Annotated[UUID, Query(description="Your simulation ID")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _participant: Annotated[dict, Depends(require_epoch_participant())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[AllianceProposalResponse]:
    """Invite a player to your team. Caller must be a team member."""
    data = await AllianceService.invite_to_team(
        supabase,
        epoch_id,
        team_id,
        simulation_id,
        body.target_simulation_id,
    )
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "epoch_alliance_proposals",
        data.get("id"),
        "create",
        details={
            "epoch_id": str(epoch_id),
            "team_id": str(team_id),
            "target": str(body.target_simulation_id),
            "action": "invite",
        },
    )
    return SuccessResponse(data=data)


@router.post(
    "/{epoch_id}/proposals/{proposal_id}/vote",
)
async def vote_on_proposal(
    epoch_id: UUID,
    proposal_id: UUID,
    body: AllianceVoteCreate,
    simulation_id: Annotated[UUID, Query(description="Your simulation ID")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _participant: Annotated[dict, Depends(require_epoch_participant())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[AllianceVoteResponse]:
    """Vote accept/reject on an alliance proposal. Team members only."""
    data = await AllianceService.vote_on_proposal(
        supabase,
        proposal_id,
        simulation_id,
        body.vote,
    )

    await CycleResolutionService.mark_acted(admin_supabase, epoch_id, simulation_id)

    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "epoch_alliance_votes",
        data.get("id"),
        "create",
        details={"proposal_id": str(proposal_id), "vote": body.vote},
    )
    return SuccessResponse(data=data)


# ── Ready Signals ─────────────────────────────────────


@router.post("/{epoch_id}/ready")
async def toggle_ready(
    epoch_id: UUID,
    body: ReadySignal,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
    """Toggle cycle_ready for a participant. Triggers realtime broadcast.

    When all human participants signal ready, the cycle auto-resolves.
    """
    data = await EpochChatService.toggle_ready(
        supabase,
        epoch_id,
        body.simulation_id,
        body.ready,
        admin_supabase=admin_supabase,
    )

    if data.get("auto_resolved"):
        await AuditService.safe_log(
            supabase,
            None,
            user.id,
            "game_epochs",
            epoch_id,
            "update",
            details={"action": "auto_resolve_cycle", "cycle": data.get("new_cycle")},
        )

    return SuccessResponse(data=data)
