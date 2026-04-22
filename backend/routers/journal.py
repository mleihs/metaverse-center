"""Resonance Journal endpoints -- fragments + constellations + attunements.

P0 shipped fragment list + detail. P2 added the constellation surface
(create, list, get, rename, archive, place / remove fragment,
crystallize). P3 extends crystallize to return ``CrystallizeResult``
(constellation + optional newly-unlocked attunement) and adds
``GET /attunements`` for the catalog + per-user unlock state.

The journal is USER-GLOBAL per AD-5 (plan §2): fragments carry an optional
simulation_id for narrative grounding, but the default list is the user's
full history across all simulations. Clients that want per-simulation
scoping pass ``?simulation_id=`` explicitly.

Auth: authenticated user only. No ``require_simulation_member`` gate --
the journal exists above simulations. RLS enforces owner scoping
(``user_id = (SELECT auth.uid())`` policy from migration 232), so
rows belonging to other users are invisible even without an extra
service-layer check.

Palimpsest endpoints ship in P4.
"""

from __future__ import annotations

import logging
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_effective_supabase,
)
from backend.models.common import (
    CurrentUser,
    PaginatedResponse,
    SuccessResponse,
)
from backend.models.journal import (
    AttunementCatalogEntry,
    ConstellationResponse,
    CrystallizeResult,
    FragmentResponse,
)
from backend.services.journal.attunement_service import AttunementService
from backend.services.journal.constellation_service import ConstellationService
from backend.services.journal.fragment_service import FragmentService
from backend.services.journal.insight_service import (
    InsightBlockedError,
    InsightGenerationError,
    InsightService,
)
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


# ── Constellations (P2) ────────────────────────────────────────────────


class ConstellationCreateRequest(BaseModel):
    name_de: str | None = Field(default=None, max_length=120)
    name_en: str | None = Field(default=None, max_length=120)


class ConstellationRenameRequest(BaseModel):
    name_de: str | None = Field(default=None, max_length=120)
    name_en: str | None = Field(default=None, max_length=120)


class ConstellationPlaceRequest(BaseModel):
    fragment_id: UUID
    position_x: int = 0
    position_y: int = 0


_VALID_CONSTELLATION_STATUS = {"drafting", "crystallized", "archived"}


@router.get("/constellations")
async def list_constellations(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    status: Annotated[str | None, Query()] = None,
) -> SuccessResponse[list[ConstellationResponse]]:
    """List the user's constellations newest-first, optionally filtered by status."""
    if status is not None and status not in _VALID_CONSTELLATION_STATUS:
        raise HTTPException(status_code=400, detail=f"invalid status: {status}")
    typed_status: Literal["drafting", "crystallized", "archived"] | None = (
        status if status in _VALID_CONSTELLATION_STATUS else None
    )  # type: ignore[assignment]
    data = await ConstellationService.list_for_user(supabase, user.id, status=typed_status)
    return SuccessResponse(data=data)


@router.get("/constellations/{constellation_id}")
async def get_constellation(
    constellation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ConstellationResponse]:
    data = await ConstellationService.get(supabase, user.id, constellation_id)
    if data is None:
        raise HTTPException(status_code=404, detail="constellation not found")
    return SuccessResponse(data=data)


@router.post("/constellations")
async def create_constellation(
    body: ConstellationCreateRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ConstellationResponse]:
    data = await ConstellationService.create(
        supabase,
        user.id,
        name_de=body.name_de,
        name_en=body.name_en,
    )
    return SuccessResponse(data=data)


@router.patch("/constellations/{constellation_id}")
async def rename_constellation(
    constellation_id: UUID,
    body: ConstellationRenameRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ConstellationResponse]:
    data = await ConstellationService.rename(
        supabase,
        user.id,
        constellation_id,
        name_de=body.name_de,
        name_en=body.name_en,
    )
    return SuccessResponse(data=data)


@router.post("/constellations/{constellation_id}/archive")
async def archive_constellation(
    constellation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ConstellationResponse]:
    data = await ConstellationService.archive(supabase, user.id, constellation_id)
    return SuccessResponse(data=data)


@router.post("/constellations/{constellation_id}/place")
async def place_fragment(
    constellation_id: UUID,
    body: ConstellationPlaceRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ConstellationResponse]:
    """Add or move a fragment on the constellation's canvas.

    Idempotent: re-placing an existing fragment updates its coordinates
    without creating a duplicate row. Rejects placements on a non-
    drafting constellation (conflict) and placements of fragments not
    owned by the caller (forbidden).
    """
    data = await ConstellationService.place_fragment(
        supabase,
        user.id,
        constellation_id,
        body.fragment_id,
        position_x=body.position_x,
        position_y=body.position_y,
    )
    return SuccessResponse(data=data)


@router.delete("/constellations/{constellation_id}/fragments/{fragment_id}")
async def remove_fragment(
    constellation_id: UUID,
    fragment_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ConstellationResponse]:
    data = await ConstellationService.remove_fragment(
        supabase,
        user.id,
        constellation_id,
        fragment_id,
    )
    return SuccessResponse(data=data)


@router.post("/constellations/{constellation_id}/crystallize")
async def crystallize_constellation(
    constellation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[CrystallizeResult]:
    """Crystallize a drafting constellation.

    Runs the rule-based resonance detector on the composed fragments,
    then the research-tier LLM for the Insight, then commits the
    crystallized state + Insight + resonance type in one atomic
    write. If the resonance type matches a starter attunement
    (emotional→Hesitation, archetype→Mercy, temporal→Tremor), the
    attunement is recorded on the constellation and idempotently
    unlocked for the user; ``newly_unlocked_attunement`` is populated
    only when THIS crystallization was the first to unlock it, so the
    frontend fires the unlock ceremony exactly once.

    Error surface:
      * 404 — constellation not found
      * 409 — composition has < 2 fragments, no rule matched, or the
              constellation is already crystallized/archived
      * 429 — budget or OpenRouter credit block (retryable later)
      * 502 — transient LLM failure (retry safe; draft preserved)
      * 500 — LLM returned unparseable JSON
    """
    try:
        data = await InsightService.crystallize(
            supabase=supabase,
            admin=admin,
            user_id=user.id,
            constellation_id=constellation_id,
        )
    except InsightBlockedError as err:
        # 429 Too Many Requests — retryable after budget resets / credits top up.
        raise HTTPException(status_code=429, detail=f"insight blocked: {err}") from err
    except InsightGenerationError as err:
        # 502 Bad Gateway — the upstream LLM failed transiently.
        raise HTTPException(status_code=502, detail=f"insight generation failed: {err}") from err
    return SuccessResponse(data=data)


# ── Attunements (P3 — catalog + per-user unlock status) ────────────────


@router.get("/attunements")
async def list_attunements(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[AttunementCatalogEntry]]:
    """Return the attunement catalog enriched with the caller's unlock
    status in one round trip.

    Locked attunements appear with ``unlocked=False`` and no unlock
    metadata; unlocked ones carry ``unlocked_at`` + ``constellation_id``
    (the crystallization that triggered the unlock, if still present).
    Order: catalog order by ``seeded_at``, regardless of unlock
    state — the frontend sorts unlocked-first for display. Catalog
    order first mirrors the Principle 9 stance (no progress bars; no
    "3/3 complete" framing), keeping the locked entries visible as
    invitations rather than chores.
    """
    entries = await AttunementService.list_catalog_with_status(supabase, user.id)
    return SuccessResponse(data=entries)
