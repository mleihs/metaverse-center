"""Constellation composition for the Resonance Journal (P2).

Owns the CRUD surface for ``journal_constellations`` + the
``constellation_fragments`` junction: create a draft, place / move /
remove fragments, rename, archive, and crystallize — the one-way
transition that locks the composition and stamps it with a resonance
type + LLM-generated Insight.

Authorization is defense-in-depth: both tables carry owner-scoped RLS
(migration 232) so a cross-user read or write is blocked at the DB
layer. On top of that, the place_fragment path explicitly checks the
fragment's user_id before inserting into the junction table — the
fragment-owner guard cannot be expressed in ``constellation_fragments``
RLS (that policy only reaches the parent constellation's owner), so
a caller who knew a foreign fragment_id could otherwise attach it.

The LLM Insight call lives in ``insight_service`` so the CRUD path
stays free of budget-context plumbing, and so the crystallize flow
can unit-test its DB writes independently from the LLM mock.
"""

from __future__ import annotations

import logging
from typing import Any, Literal
from uuid import UUID

from backend.models.journal import (
    ConstellationFragmentPlacement,
    ConstellationResponse,
    FragmentResponse,
)
from backend.services.journal.resonance_detector import (
    ResonanceMatch,
    detect_constellation,
)
from backend.utils.db import maybe_single_data
from backend.utils.errors import bad_request, conflict, forbidden, not_found
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


# Per AD-3: 12 fragments per constellation is the canvas density cap.
# Above this the Warburg-style spatial reading falls apart; also ties
# the pairwise detector's O(n²) to 66 comparisons at worst.
_MAX_FRAGMENTS_PER_CONSTELLATION = 12

# Canvas coordinate bounds — matches the Lit canvas component's
# viewport. Out-of-range values are clamped rather than rejected
# (a buggy client shouldn't dead-lock a placement; the user can
# still move the fragment afterwards).
_COORD_MIN = -10000
_COORD_MAX = 10000


def _clamp_coord(value: int) -> int:
    return max(_COORD_MIN, min(_COORD_MAX, int(value)))


def _fragment_from_row(row: dict) -> FragmentResponse:
    """Convert a journal_fragments row to the Pydantic model, normalising
    the thematic_tags jsonb column into a list of strings."""
    tags = row.get("thematic_tags") or []
    if not isinstance(tags, list):
        tags = []
    return FragmentResponse(
        id=row["id"],
        user_id=row["user_id"],
        simulation_id=row.get("simulation_id"),
        fragment_type=row["fragment_type"],
        source_type=row["source_type"],
        source_id=row.get("source_id"),
        content_de=row.get("content_de", ""),
        content_en=row.get("content_en", ""),
        thematic_tags=[str(t) for t in tags],
        rarity=row.get("rarity", "common"),
        created_at=row["created_at"],
    )


def _placement_from_row(row: dict) -> ConstellationFragmentPlacement:
    return ConstellationFragmentPlacement(
        fragment_id=row["fragment_id"],
        position_x=int(row.get("position_x", 0)),
        position_y=int(row.get("position_y", 0)),
        placed_at=row.get("placed_at"),
    )


def _constellation_from_row(row: dict, placements: list[dict] | None = None) -> ConstellationResponse:
    """Build the DTO from a constellation row + optional junction rows."""
    return ConstellationResponse(
        id=row["id"],
        user_id=row["user_id"],
        name_de=row.get("name_de"),
        name_en=row.get("name_en"),
        status=row["status"],
        insight_de=row.get("insight_de"),
        insight_en=row.get("insight_en"),
        resonance_type=row.get("resonance_type"),
        attunement_id=row.get("attunement_id"),
        created_at=row["created_at"],
        crystallized_at=row.get("crystallized_at"),
        archived_at=row.get("archived_at"),
        updated_at=row["updated_at"],
        fragments=[_placement_from_row(p) for p in (placements or [])],
    )


class ConstellationService:
    """CRUD + crystallization orchestration for journal constellations."""

    _TABLE = "journal_constellations"
    _JUNCTION = "constellation_fragments"
    _FRAGMENTS = "journal_fragments"

    # ── Public query API ──────────────────────────────────────────────

    @classmethod
    async def list_for_user(
        cls,
        supabase: Client,
        user_id: UUID,
        *,
        status: Literal["drafting", "crystallized", "archived"] | None = None,
    ) -> list[ConstellationResponse]:
        """Return constellations for the user, newest-first.

        RLS ensures the user_id filter matches the policy's ``auth.uid()
        = user_id`` check; we add the explicit ``.eq`` anyway for
        defense-in-depth and for clarity in query logs.
        """
        query = (
            supabase.table(cls._TABLE)
            .select("*")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
        )
        if status is not None:
            query = query.eq("status", status)
        resp = await query.execute()
        rows = extract_list(resp)
        if not rows:
            return []

        # Fan out a single junction query for all returned constellations
        # — O(1) round trips instead of O(n). Each row's placements are
        # filtered in Python.
        ids = [r["id"] for r in rows]
        junction_resp = await (
            supabase.table(cls._JUNCTION)
            .select("*")
            .in_("constellation_id", ids)
            .execute()
        )
        placements_by_id: dict[str, list[dict]] = {}
        for jrow in extract_list(junction_resp):
            placements_by_id.setdefault(str(jrow["constellation_id"]), []).append(jrow)

        return [
            _constellation_from_row(r, placements_by_id.get(str(r["id"]), []))
            for r in rows
        ]

    @classmethod
    async def get(
        cls,
        supabase: Client,
        user_id: UUID,
        constellation_id: UUID,
    ) -> ConstellationResponse | None:
        """Return a single constellation with its fragment placements, or
        ``None`` if not owned by the caller."""
        row = await maybe_single_data(
            supabase.table(cls._TABLE)
            .select("*")
            .eq("id", str(constellation_id))
            .eq("user_id", str(user_id))
            .maybe_single()
        )
        if row is None:
            return None
        junction_resp = await (
            supabase.table(cls._JUNCTION)
            .select("*")
            .eq("constellation_id", str(constellation_id))
            .execute()
        )
        return _constellation_from_row(row, extract_list(junction_resp))

    # ── Mutations ──────────────────────────────────────────────────────

    @classmethod
    async def create(
        cls,
        supabase: Client,
        user_id: UUID,
        *,
        name_de: str | None = None,
        name_en: str | None = None,
    ) -> ConstellationResponse:
        """Create a new drafting constellation.

        Names are optional — the UI lets the player name the
        constellation anytime between create and crystallize.
        """
        insert_row: dict[str, Any] = {"user_id": str(user_id)}
        if name_de is not None:
            insert_row["name_de"] = name_de.strip() or None
        if name_en is not None:
            insert_row["name_en"] = name_en.strip() or None

        resp = await supabase.table(cls._TABLE).insert(insert_row).execute()
        rows = extract_list(resp)
        if not rows:
            raise conflict("failed to create constellation")
        return _constellation_from_row(rows[0])

    @classmethod
    async def rename(
        cls,
        supabase: Client,
        user_id: UUID,
        constellation_id: UUID,
        *,
        name_de: str | None = None,
        name_en: str | None = None,
    ) -> ConstellationResponse:
        """Update one or both name fields. At least one must be provided."""
        updates: dict[str, Any] = {}
        if name_de is not None:
            updates["name_de"] = name_de.strip() or None
        if name_en is not None:
            updates["name_en"] = name_en.strip() or None
        if not updates:
            raise bad_request("no fields to update")

        resp = await (
            supabase.table(cls._TABLE)
            .update(updates)
            .eq("id", str(constellation_id))
            .eq("user_id", str(user_id))
            .execute()
        )
        rows = extract_list(resp)
        if not rows:
            raise not_found("constellation", str(constellation_id))
        # Reload with placements so the response shape stays consistent.
        reloaded = await cls.get(supabase, user_id, constellation_id)
        if reloaded is None:
            raise not_found("constellation", str(constellation_id))
        return reloaded

    @classmethod
    async def archive(
        cls,
        supabase: Client,
        user_id: UUID,
        constellation_id: UUID,
    ) -> ConstellationResponse:
        """Archive a constellation. Works on any status — archived
        constellations remain visible in the list with ``status=archived``
        but are removed from the canvas default view."""
        from datetime import UTC, datetime

        resp = await (
            supabase.table(cls._TABLE)
            .update(
                {
                    "status": "archived",
                    "archived_at": datetime.now(UTC).isoformat(),
                }
            )
            .eq("id", str(constellation_id))
            .eq("user_id", str(user_id))
            .execute()
        )
        rows = extract_list(resp)
        if not rows:
            raise not_found("constellation", str(constellation_id))
        reloaded = await cls.get(supabase, user_id, constellation_id)
        if reloaded is None:
            raise not_found("constellation", str(constellation_id))
        return reloaded

    # ── Fragment placement ─────────────────────────────────────────────

    @classmethod
    async def place_fragment(
        cls,
        supabase: Client,
        user_id: UUID,
        constellation_id: UUID,
        fragment_id: UUID,
        *,
        position_x: int,
        position_y: int,
    ) -> ConstellationResponse:
        """Add or move a fragment on the constellation's canvas.

        Preconditions:
          * the constellation exists, is owned, and is in ``drafting``
            status (placements on a crystallized constellation are
            rejected — the composition is meant to be sealed).
          * the fragment exists and is owned by the caller.
          * the fragment count after this operation is ≤ the AD-3 cap.

        Coordinates are clamped to the canvas viewport rather than
        rejected, to keep the UI responsive to drift from stale
        client state.
        """
        constellation = await cls.get(supabase, user_id, constellation_id)
        if constellation is None:
            raise not_found("constellation", str(constellation_id))
        if constellation.status != "drafting":
            raise conflict("constellation is not in drafting status; create a new draft to edit")

        # Fragment ownership — explicit service-layer check because
        # constellation_fragments RLS only reaches the parent's owner.
        owned = await maybe_single_data(
            supabase.table(cls._FRAGMENTS)
            .select("id")
            .eq("id", str(fragment_id))
            .eq("user_id", str(user_id))
            .maybe_single()
        )
        if owned is None:
            # Do not leak distinction between "not yours" and "does not
            # exist" — both collapse to forbidden for a user-scoped lookup.
            raise forbidden("fragment is not accessible to this user")

        is_already_placed = any(p.fragment_id == fragment_id for p in constellation.fragments)
        if not is_already_placed and len(constellation.fragments) >= _MAX_FRAGMENTS_PER_CONSTELLATION:
            raise conflict(
                f"constellation already at capacity ({_MAX_FRAGMENTS_PER_CONSTELLATION})"
            )

        x = _clamp_coord(position_x)
        y = _clamp_coord(position_y)

        # Upsert via the composite PK (constellation_id, fragment_id) —
        # postgrest's on_conflict parameter does the insert-or-update
        # dispatch in one round trip.
        await (
            supabase.table(cls._JUNCTION)
            .upsert(
                {
                    "constellation_id": str(constellation_id),
                    "fragment_id": str(fragment_id),
                    "position_x": x,
                    "position_y": y,
                },
                on_conflict="constellation_id,fragment_id",
            )
            .execute()
        )
        reloaded = await cls.get(supabase, user_id, constellation_id)
        if reloaded is None:
            raise not_found("constellation", str(constellation_id))
        return reloaded

    @classmethod
    async def remove_fragment(
        cls,
        supabase: Client,
        user_id: UUID,
        constellation_id: UUID,
        fragment_id: UUID,
    ) -> ConstellationResponse:
        """Remove a fragment from the canvas. Crystallized constellations
        are immutable; the caller must create a new draft to re-compose."""
        constellation = await cls.get(supabase, user_id, constellation_id)
        if constellation is None:
            raise not_found("constellation", str(constellation_id))
        if constellation.status != "drafting":
            raise conflict("constellation is not in drafting status")

        await (
            supabase.table(cls._JUNCTION)
            .delete()
            .eq("constellation_id", str(constellation_id))
            .eq("fragment_id", str(fragment_id))
            .execute()
        )
        reloaded = await cls.get(supabase, user_id, constellation_id)
        if reloaded is None:
            raise not_found("constellation", str(constellation_id))
        return reloaded

    # ── Crystallization orchestration ───────────────────────────────────

    @classmethod
    async def load_composed_fragments(
        cls,
        supabase: Client,
        user_id: UUID,
        constellation_id: UUID,
    ) -> list[FragmentResponse]:
        """Load the fragments referenced by the constellation as full
        DTO objects (the junction carries only IDs + positions; the
        detector and Insight prompt need content + tags)."""
        junction_resp = await (
            supabase.table(cls._JUNCTION)
            .select("fragment_id")
            .eq("constellation_id", str(constellation_id))
            .execute()
        )
        fragment_ids = [j["fragment_id"] for j in extract_list(junction_resp)]
        if not fragment_ids:
            return []

        frag_resp = await (
            supabase.table(cls._FRAGMENTS)
            .select("*")
            .in_("id", fragment_ids)
            .eq("user_id", str(user_id))
            .execute()
        )
        return [_fragment_from_row(r) for r in extract_list(frag_resp)]

    @classmethod
    async def commit_crystallization(
        cls,
        supabase: Client,
        user_id: UUID,
        constellation_id: UUID,
        *,
        match: ResonanceMatch,
        insight_de: str,
        insight_en: str,
        attunement_id: UUID | None = None,
    ) -> ConstellationResponse:
        """Persist the crystallized state. Called by ``insight_service``
        after the LLM generates the Insight text — keeps the DB write
        atomic across the four fields the CHECK constraint ties
        together (status + insight_* + crystallized_at)."""
        from datetime import UTC, datetime

        updates: dict[str, Any] = {
            "status": "crystallized",
            "resonance_type": str(match.resonance_type),
            "insight_de": insight_de,
            "insight_en": insight_en,
            "crystallized_at": datetime.now(UTC).isoformat(),
        }
        if attunement_id is not None:
            updates["attunement_id"] = str(attunement_id)

        resp = await (
            supabase.table(cls._TABLE)
            .update(updates)
            .eq("id", str(constellation_id))
            .eq("user_id", str(user_id))
            .eq("status", "drafting")  # idempotency guard
            .execute()
        )
        rows = extract_list(resp)
        if not rows:
            raise conflict("constellation is not a draft or was already crystallized")
        reloaded = await cls.get(supabase, user_id, constellation_id)
        if reloaded is None:
            raise not_found("constellation", str(constellation_id))
        return reloaded

    @classmethod
    async def prepare_crystallization(
        cls,
        supabase: Client,
        user_id: UUID,
        constellation_id: UUID,
    ) -> tuple[ConstellationResponse, list[FragmentResponse], ResonanceMatch]:
        """Shared preflight for the crystallize path.

        Resolves the constellation + its fragments, runs the detector,
        and validates that a resonance was found. Raises ``conflict`` if
        the constellation has too few fragments or no rule matched —
        the caller (``insight_service.crystallize``) uses this to decide
        whether to proceed with the LLM spend.
        """
        constellation = await cls.get(supabase, user_id, constellation_id)
        if constellation is None:
            raise not_found("constellation", str(constellation_id))
        if constellation.status != "drafting":
            raise conflict("constellation is already crystallized or archived")
        fragments = await cls.load_composed_fragments(supabase, user_id, constellation_id)
        if len(fragments) < 2:
            raise conflict("need at least two fragments to crystallize")

        match = detect_constellation(fragments)
        if match is None:
            raise conflict("no resonance detected among the composed fragments")
        return constellation, fragments, match
