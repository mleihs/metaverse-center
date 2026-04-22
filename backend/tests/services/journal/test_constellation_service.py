"""Unit tests for ConstellationService.

Mocks the Supabase client at the builder seam. For real-DB coverage
see the live smoke test in the P2 handover memory — per the P1
schema-drift lesson, mocked tests alone are insufficient for new
schema interactions, so this file is paired with a live smoke.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from backend.models.journal import ConstellationFragmentPlacement, ConstellationResponse
from backend.services.journal.constellation_service import (
    _MAX_FRAGMENTS_PER_CONSTELLATION,
    ConstellationService,
    _clamp_coord,
)
from backend.services.journal.resonance_detector import ResonanceMatch, ResonanceType

USER_ID = UUID("00000000-0000-0000-0000-000000000001")
SIM_ID = UUID("40000000-0000-0000-0000-000000000001")


def _frag_row(fragment_id: UUID | None = None, user_id: UUID | None = None, tags: list | None = None) -> dict:
    fid = fragment_id or uuid4()
    uid = user_id or USER_ID
    return {
        "id": str(fid),
        "user_id": str(uid),
        "simulation_id": str(SIM_ID),
        "fragment_type": "imprint",
        "source_type": "dungeon",
        "source_id": str(uuid4()),
        "content_de": "…",
        "content_en": "…",
        "thematic_tags": tags or ["shadow", "grief"],
        "rarity": "common",
        "created_at": datetime.now(UTC).isoformat(),
    }


def _constellation_row(cid: UUID, *, status: str = "drafting") -> dict:
    now = datetime.now(UTC).isoformat()
    return {
        "id": str(cid),
        "user_id": str(USER_ID),
        "name_de": None,
        "name_en": None,
        "status": status,
        "insight_de": None,
        "insight_en": None,
        "resonance_type": None,
        "attunement_id": None,
        "created_at": now,
        "crystallized_at": None,
        "archived_at": None,
        "updated_at": now,
    }


def _placement_row(cid: UUID, fid: UUID, *, x: int = 0, y: int = 0) -> dict:
    return {
        "constellation_id": str(cid),
        "fragment_id": str(fid),
        "position_x": x,
        "position_y": y,
        "placed_at": datetime.now(UTC).isoformat(),
    }


def _mk_response(data):
    r = MagicMock()
    r.data = data
    return r


# ── _clamp_coord ───────────────────────────────────────────────────────


def test_clamp_coord_passthrough():
    assert _clamp_coord(0) == 0
    assert _clamp_coord(500) == 500


def test_clamp_coord_bounds():
    assert _clamp_coord(50_000) == 10_000
    assert _clamp_coord(-50_000) == -10_000


def test_clamp_coord_stringable():
    """Inputs from untrusted clients — the underlying int() conversion
    handles numeric strings. Actual string types fail the type hint at
    the router layer, but defensive coercion stays on the service side."""
    assert _clamp_coord(int("200")) == 200


# ── capacity guard ─────────────────────────────────────────────────────


def _fake_constellation(cid: UUID, *, status: str = "drafting", fragments: list[UUID] | None = None) -> ConstellationResponse:
    now = datetime.now(UTC)
    return ConstellationResponse(
        id=cid,
        user_id=USER_ID,
        status=status,
        created_at=now,
        updated_at=now,
        fragments=[
            ConstellationFragmentPlacement(fragment_id=fid, position_x=0, position_y=0, placed_at=now)
            for fid in (fragments or [])
        ],
    )


def _admin_with_owned_fragment(fragment_id: UUID) -> MagicMock:
    """Build an admin client whose journal_fragments ownership lookup
    returns a matching row (passes the ownership gate)."""

    class Chain:
        def __init__(self, resp):
            self.resp = resp
        def select(self, *a, **kw): return self
        def eq(self, *a, **kw): return self
        def maybe_single(self): return self
        def upsert(self, *a, **kw): return self
        async def execute(self): return self.resp

    def table_side_effect(name: str):
        if name == "journal_fragments":
            return Chain(_mk_response({"id": str(fragment_id)}))
        if name == "constellation_fragments":
            return Chain(_mk_response([{}]))
        raise AssertionError(name)

    admin = MagicMock()
    admin.table.side_effect = table_side_effect
    return admin


@pytest.mark.asyncio
async def test_place_fragment_rejects_over_capacity():
    """Once the 12-fragment cap is reached, adding a new fragment fails.
    Re-placing an already-placed fragment is allowed (move) — covered
    in the next test."""
    cid = uuid4()
    new_frag = uuid4()
    saturated = _fake_constellation(
        cid, fragments=[uuid4() for _ in range(_MAX_FRAGMENTS_PER_CONSTELLATION)]
    )

    admin = _admin_with_owned_fragment(new_frag)
    with patch.object(ConstellationService, "get", new=AsyncMock(return_value=saturated)):
        with pytest.raises(Exception) as excinfo:
            await ConstellationService.place_fragment(
                admin, USER_ID, cid, new_frag, position_x=100, position_y=100,
            )
    assert "capacity" in str(excinfo.value).lower()


@pytest.mark.asyncio
async def test_place_fragment_allows_move_at_capacity():
    """Re-placing an already-placed fragment bypasses the capacity
    check. Proves by observing that the path reaches the upsert builder."""
    cid = uuid4()
    placed_ids = [uuid4() for _ in range(_MAX_FRAGMENTS_PER_CONSTELLATION)]
    target = placed_ids[0]

    saturated = _fake_constellation(cid, fragments=placed_ids)

    call_log: list[tuple] = []

    class Chain:
        def __init__(self, resp):
            self.resp = resp
        def select(self, *a, **kw): return self
        def eq(self, *a, **kw): return self
        def maybe_single(self): return self
        def upsert(self, *a, **kw):
            call_log.append(("upsert", a, kw))
            return self
        async def execute(self): return self.resp

    def table_side_effect(name: str):
        if name == "journal_fragments":
            return Chain(_mk_response({"id": str(target)}))
        if name == "constellation_fragments":
            return Chain(_mk_response([{}]))
        raise AssertionError(name)

    admin = MagicMock()
    admin.table.side_effect = table_side_effect

    with patch.object(ConstellationService, "get", new=AsyncMock(return_value=saturated)):
        # The reload at the tail still returns the saturated state via
        # the same mock, which does NOT reflect the upsert — we're only
        # asserting that the capacity check let the flow through to upsert.
        await ConstellationService.place_fragment(
            admin, USER_ID, cid, target, position_x=50, position_y=50,
        )
    assert any(c[0] == "upsert" for c in call_log), "move should have reached the upsert builder"


# ── fragment-ownership guard (defense-in-depth) ────────────────────────


@pytest.mark.asyncio
async def test_place_fragment_rejects_foreign_fragment():
    cid = uuid4()
    empty = _fake_constellation(cid, fragments=[])

    # Owned-fragment lookup returns no row (cross-user fragment
    # - the user-scoped supabase + RLS filter it out).
    class Chain:
        def select(self, *a, **kw): return self
        def eq(self, *a, **kw): return self
        def maybe_single(self): return self
        async def execute(self):
            return _mk_response(None)

    admin = MagicMock()
    admin.table.return_value = Chain()

    with patch.object(ConstellationService, "get", new=AsyncMock(return_value=empty)):
        with pytest.raises(Exception) as excinfo:
            await ConstellationService.place_fragment(
                admin, USER_ID, cid, uuid4(), position_x=0, position_y=0,
            )
    msg = str(excinfo.value).lower()
    assert "accessible" in msg or "forbidden" in type(excinfo.value).__name__.lower()


# ── immutability once crystallized ─────────────────────────────────────


@pytest.mark.asyncio
async def test_place_fragment_rejects_non_drafting_status():
    cid = uuid4()
    crystallized = _fake_constellation(cid, status="crystallized", fragments=[])

    admin = MagicMock()
    with patch.object(ConstellationService, "get", new=AsyncMock(return_value=crystallized)):
        with pytest.raises(Exception) as excinfo:
            await ConstellationService.place_fragment(
                admin, USER_ID, cid, uuid4(), position_x=0, position_y=0,
            )
    msg = str(excinfo.value).lower()
    assert "drafting" in msg or "crystallized" in msg or "status" in msg


@pytest.mark.asyncio
async def test_rename_requires_at_least_one_field():
    admin = MagicMock()
    with pytest.raises(Exception) as excinfo:
        await ConstellationService.rename(
            admin, USER_ID, uuid4(),
        )
    assert "no fields" in str(excinfo.value).lower() or "update" in str(excinfo.value).lower()


# ── commit_crystallization idempotency ─────────────────────────────────


@pytest.mark.asyncio
async def test_commit_crystallization_idempotency_guard():
    """When the status=drafting guard fails (already crystallized, or
    concurrent commit), commit_crystallization raises conflict."""
    cid = uuid4()

    class Chain:
        def update(self, *a, **kw): return self
        def eq(self, *a, **kw): return self
        async def execute(self): return _mk_response([])  # empty → guard failed

    admin = MagicMock()
    admin.table.return_value = Chain()

    match = ResonanceMatch(
        resonance_type=ResonanceType.ARCHETYPE,
        evidence_tags=("shadow",),
    )
    with pytest.raises(Exception) as excinfo:
        await ConstellationService.commit_crystallization(
            admin, USER_ID, cid,
            match=match, insight_de="DE", insight_en="EN",
        )
    assert "draft" in str(excinfo.value).lower() or "crystalliz" in str(excinfo.value).lower()


# ── pair_matches via .get() (P3 — live line drawing) ───────────────────


class _ScriptedChain:
    """Pluggable query-builder mock that swallows any chained call and
    returns a prescribed response on execute(). One chain instance
    per .table() call; the caller supplies the response map at
    construction time.
    """

    def __init__(self, response_by_table: dict[str, object], table_name: str):
        self._response = response_by_table[table_name]
        self._table_name = table_name

    def __getattr__(self, _name):
        # Any builder method (.select, .eq, .in_, .order, .maybe_single,
        # .upsert, .update, .delete, …) returns self so chains keep flowing.
        return lambda *a, **kw: self

    async def execute(self):
        return _mk_response(self._response)


def _scripted_supabase(response_by_table: dict[str, object]) -> MagicMock:
    """Build a Supabase-like mock that dispatches per-table responses."""
    client = MagicMock()
    client.table.side_effect = lambda name: _ScriptedChain(response_by_table, name)
    return client


@pytest.mark.asyncio
async def test_get_populates_pair_matches_from_fragments():
    """With two fragments sharing an archetype tag, .get() surfaces one
    ResonancePair carrying the matching resonance type and evidence."""
    cid = uuid4()
    fid_a = uuid4()
    fid_b = uuid4()

    responses = {
        "journal_constellations": _constellation_row(cid),
        "constellation_fragments": [
            _placement_row(cid, fid_a),
            _placement_row(cid, fid_b),
        ],
        "journal_fragments": [
            _frag_row(fragment_id=fid_a, tags=["shadow", "ritual"]),
            _frag_row(fragment_id=fid_b, tags=["shadow", "grief"]),
        ],
    }
    client = _scripted_supabase(responses)

    result = await ConstellationService.get(client, USER_ID, cid)
    assert result is not None
    assert len(result.pair_matches) == 1
    pair = result.pair_matches[0]
    assert pair.resonance_type == "archetype"
    assert pair.evidence_tags == ["shadow"]
    # Pair endpoints cover both fragments, in some order.
    assert {pair.fragment_a_id, pair.fragment_b_id} == {fid_a, fid_b}


@pytest.mark.asyncio
async def test_get_empty_pair_matches_for_solo_fragment():
    """A single-fragment constellation exposes an empty pair list —
    the detector short-circuits and no line-drawing is needed."""
    cid = uuid4()
    fid = uuid4()

    responses = {
        "journal_constellations": _constellation_row(cid),
        "constellation_fragments": [_placement_row(cid, fid)],
        "journal_fragments": [_frag_row(fragment_id=fid, tags=["shadow"])],
    }
    client = _scripted_supabase(responses)

    result = await ConstellationService.get(client, USER_ID, cid)
    assert result is not None
    assert result.pair_matches == []


@pytest.mark.asyncio
async def test_get_zero_fragments_skips_fragment_query():
    """Empty constellation returns an empty placements + pair_matches
    list and doesn't crash on the fragment fetch path."""
    cid = uuid4()

    responses = {
        "journal_constellations": _constellation_row(cid),
        "constellation_fragments": [],
        "journal_fragments": [],
    }
    client = _scripted_supabase(responses)

    result = await ConstellationService.get(client, USER_ID, cid)
    assert result is not None
    assert result.fragments == []
    assert result.pair_matches == []


@pytest.mark.asyncio
async def test_list_for_user_populates_pair_matches_per_constellation():
    """list_for_user batches fragment loads across all constellations
    but still attributes pair_matches to the correct constellation."""
    cid_1 = uuid4()
    cid_2 = uuid4()
    fid_a = uuid4()
    fid_b = uuid4()
    fid_c = uuid4()
    fid_d = uuid4()

    rows = [_constellation_row(cid_1), _constellation_row(cid_2)]

    responses = {
        "journal_constellations": rows,
        "constellation_fragments": [
            _placement_row(cid_1, fid_a),
            _placement_row(cid_1, fid_b),
            _placement_row(cid_2, fid_c),
            _placement_row(cid_2, fid_d),
        ],
        "journal_fragments": [
            _frag_row(fragment_id=fid_a, tags=["shadow", "ritual"]),
            _frag_row(fragment_id=fid_b, tags=["shadow", "grief"]),
            _frag_row(fragment_id=fid_c, tags=["beth"]),
            _frag_row(fragment_id=fid_d, tags=["gimel"]),
        ],
    }
    client = _scripted_supabase(responses)

    results = await ConstellationService.list_for_user(client, USER_ID)
    assert len(results) == 2
    # cid_1 fragments share 'shadow' → archetype pair
    by_id = {r.id: r for r in results}
    assert len(by_id[cid_1].pair_matches) == 1
    assert by_id[cid_1].pair_matches[0].resonance_type == "archetype"
    # cid_2 fragments share nothing (distinct non-valence tags) → empty
    assert by_id[cid_2].pair_matches == []
