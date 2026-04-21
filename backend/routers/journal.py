"""Resonance Journal endpoints -- fragment list + detail.

P0 ships two endpoints:
  GET /api/v1/journal/fragments        -- paginated list with filters
  GET /api/v1/journal/fragments/{id}   -- single-fragment detail

The journal is USER-GLOBAL per AD-5 (plan §2): fragments carry an optional
simulation_id for narrative grounding, but the default list is the user's
full history across all simulations. Clients that want per-simulation
scoping pass ``?simulation_id=`` explicitly.

Auth: authenticated user only. No ``require_simulation_member`` gate --
the journal exists above simulations. RLS enforces owner scoping
(``user_id = (SELECT auth.uid())`` policy from migration 232), so
fragments belonging to other users are invisible even without an extra
service-layer check.

Constellation / attunement / palimpsest endpoints ship in P2-P4.
"""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.dependencies import get_current_user, get_effective_supabase
from backend.models.common import (
    CurrentUser,
    PaginatedResponse,
    SuccessResponse,
)
from backend.models.journal import FragmentResponse
from backend.services.journal.fragment_service import FragmentService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/journal", tags=["resonance-journal"])


_VALID_SOURCE_TYPES = {
    "dungeon", "epoch", "simulation", "bond", "achievement", "bleed",
}
_VALID_FRAGMENT_TYPES = {
    "imprint", "signature", "echo", "impression", "mark", "tremor",
}
_VALID_RARITIES = {"common", "uncommon", "rare", "singular"}


@router.get("/fragments")
async def list_fragments(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    simulation_id: Annotated[UUID | None, Query()] = None,
    source_type: Annotated[str | None, Query()] = None,
    fragment_type: Annotated[str | None, Query()] = None,
    rarity: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[FragmentResponse]:
    """List fragments for the authenticated user.

    All filters are optional. Fragments return newest-first. The response
    includes pagination metadata (count / total / limit / offset) so the
    client can paginate without re-issuing counted queries.
    """
    if source_type is not None and source_type not in _VALID_SOURCE_TYPES:
        raise HTTPException(status_code=400, detail=f"invalid source_type: {source_type}")
    if fragment_type is not None and fragment_type not in _VALID_FRAGMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"invalid fragment_type: {fragment_type}")
    if rarity is not None and rarity not in _VALID_RARITIES:
        raise HTTPException(status_code=400, detail=f"invalid rarity: {rarity}")

    rows, total = await FragmentService.list_fragments(
        supabase,
        user.id,
        simulation_id=simulation_id,
        source_type=source_type,
        fragment_type=fragment_type,
        rarity=rarity,
        limit=limit,
        offset=offset,
    )
    return paginated(rows, total, limit, offset)


@router.get("/fragments/{fragment_id}")
async def get_fragment(
    fragment_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[FragmentResponse]:
    """Get a single fragment by id. 404 if not owned by the caller.

    Ownership is enforced twice -- once in the service layer via the
    ``eq('user_id', ...)`` filter, once in Postgres via the RLS policy
    from migration 232. Either alone is sufficient; together they are
    defense-in-depth against a service-layer regression.
    """
    data = await FragmentService.get_fragment(supabase, user.id, fragment_id)
    if data is None:
        raise HTTPException(status_code=404, detail="fragment not found")
    return SuccessResponse(data=data)
