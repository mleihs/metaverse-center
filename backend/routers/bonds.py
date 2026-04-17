"""Agent Bonds endpoints -- bond formation, whisper feed, depth progression.

Query-param pattern: simulation_id via ?simulation_id= (like resonance_dungeons).
Bond-specific endpoints use bond_id in path, ownership enforced via RLS.
"""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import (
    get_current_user,
    get_effective_supabase,
    require_simulation_member,
)
from backend.models.bond import (
    AttentionTrackRequest,
    BondDetailResponse,
    BondFormRequest,
    BondResponse,
    RecognitionCandidate,
    WhisperResponse,
)
from backend.models.common import (
    CurrentUser,
    PaginatedResponse,
    SuccessResponse,
)
from backend.services.audit_service import AuditService
from backend.services.bond.bond_service import BondService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/bonds", tags=["agent-bonds"])


# ── Simulation-scoped (query param) ───────────────────────────────────────


@router.get("")
async def list_bonds(
    simulation_id: Annotated[UUID, Query()],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _member: Annotated[str, Depends(require_simulation_member("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[BondResponse]]:
    """List all bonds for the current user in a simulation."""
    data = await BondService.get_bonds(supabase, user.id, simulation_id)
    return SuccessResponse(data=data)


@router.get("/recognition-candidates")
async def get_recognition_candidates(
    simulation_id: Annotated[UUID, Query()],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _member: Annotated[str, Depends(require_simulation_member("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[RecognitionCandidate]]:
    """Check for agents that crossed the attention/observation threshold."""
    data = await BondService.get_recognition_candidates(
        supabase, user.id, simulation_id,
    )
    return SuccessResponse(data=data)


# ── Mutation endpoints (simulation membership required) ────────────────────


@router.post("/track-attention")
async def track_attention(
    simulation_id: Annotated[UUID, Query()],
    body: AttentionTrackRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _member: Annotated[str, Depends(require_simulation_member("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[dict]:
    """Track that the user viewed an agent's detail page.

    Frontend should debounce: max 1 call per agent per 5 minutes.
    """
    data = await BondService.track_attention(
        supabase, user.id, body.agent_id, simulation_id,
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "agent_bonds", data.get("id"), "track_attention",
    )
    return SuccessResponse(data=data)


@router.post("/form", status_code=201)
async def form_bond(
    simulation_id: Annotated[UUID, Query()],
    body: BondFormRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _member: Annotated[str, Depends(require_simulation_member("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[BondResponse]:
    """Accept a bond with an agent after recognition.

    Enforces the 5-bond-per-simulation limit.
    """
    data = await BondService.form_bond(
        supabase, user.id, body.agent_id, simulation_id,
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "agent_bonds", data.get("id"), "form_bond",
    )
    return SuccessResponse(data=data)


# ── Bond-scoped (path param, RLS enforces ownership) ──────────────────────


@router.get("/{bond_id}")
async def get_bond_detail(
    bond_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[BondDetailResponse]:
    """Get detailed bond info with recent whispers and agent mood."""
    data = await BondService.get_bond_detail(supabase, user.id, bond_id)
    return SuccessResponse(data=data)


@router.get("/{bond_id}/whispers")
async def list_whispers(
    bond_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[WhisperResponse]:
    """Get paginated whispers for a bond (newest first)."""
    data, total = await BondService.list_whispers(
        supabase, user.id, bond_id, limit=limit, offset=offset,
    )
    return paginated(data, total, limit, offset)


@router.post("/{bond_id}/whispers/{whisper_id}/read")
async def mark_whisper_read(
    bond_id: UUID,
    whisper_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[WhisperResponse]:
    """Mark a whisper as read. Triggers depth progression check."""
    data = await BondService.mark_whisper_read(
        supabase, user.id, bond_id, whisper_id,
    )
    await BondService.check_depth_progression(supabase, bond_id)
    return SuccessResponse(data=data)


@router.post("/{bond_id}/whispers/{whisper_id}/acted")
async def mark_whisper_acted(
    bond_id: UUID,
    whisper_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[WhisperResponse]:
    """Mark a whisper as acted upon. Creates an 'action' bond memory."""
    data = await BondService.mark_whisper_acted(
        supabase, user.id, bond_id, whisper_id,
    )
    await BondService.check_depth_progression(supabase, bond_id)
    return SuccessResponse(data=data)
