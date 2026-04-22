"""Unit tests for AttunementService (P3).

Mocks the Supabase builder chain at the per-table seam. The tests
target each public method (list_catalog, list_unlocks, evaluate,
unlock, has) in isolation — the orchestration across them is covered
by test_insight_service's crystallize integration tests.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest

from backend.services.journal.attunement_service import AttunementService

USER_ID = UUID("00000000-0000-0000-0000-000000000001")


def _mk_response(data):
    r = MagicMock()
    r.data = data
    return r


class _Chain:
    """Tolerates any builder call; returns a scripted response on
    execute(). One instance per .table() call."""

    def __init__(self, response):
        self._response = response

    def __getattr__(self, _name):
        return lambda *a, **kw: self

    async def execute(self):
        return _mk_response(self._response)


def _catalog_row(slug: str, rtype: str | None) -> dict:
    now = datetime.now(UTC).isoformat()
    return {
        "id": str(uuid4()),
        "slug": slug,
        "name_de": f"DE {slug}",
        "name_en": f"EN {slug}",
        "description_de": "DE desc",
        "description_en": "EN desc",
        "system_hook": "dungeon_option",
        "effect": {"hook": "x"},
        "required_resonance": {},
        "required_resonance_type": rtype,
        "enabled": True,
        "seeded_at": now,
        "updated_at": now,
    }


def _scripted(response) -> MagicMock:
    client = MagicMock()
    client.table.return_value = _Chain(response)
    return client


# ── list_catalog ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_catalog_returns_enabled_rows():
    rows = [
        _catalog_row("einstimmung_zoegern", "emotional"),
        _catalog_row("einstimmung_gnade", "archetype"),
        _catalog_row("einstimmung_beben", "temporal"),
    ]
    client = _scripted(rows)
    result = await AttunementService.list_catalog(client)
    assert len(result) == 3
    slugs = {a.slug for a in result}
    assert slugs == {"einstimmung_zoegern", "einstimmung_gnade", "einstimmung_beben"}


@pytest.mark.asyncio
async def test_list_catalog_empty():
    client = _scripted([])
    result = await AttunementService.list_catalog(client)
    assert result == []


# ── list_unlocks ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_unlocks_joins_slug_from_nested_select():
    """Postgrest's nested-select returns the catalog slug under the
    foreign table key; the service flattens it into attunement_slug."""
    att_id = uuid4()
    cid = uuid4()
    now = datetime.now(UTC).isoformat()
    rows = [
        {
            "user_id": str(USER_ID),
            "attunement_id": str(att_id),
            "constellation_id": str(cid),
            "unlocked_at": now,
            "journal_attunements": {"slug": "einstimmung_gnade"},
        }
    ]
    client = _scripted(rows)
    result = await AttunementService.list_unlocks(client, USER_ID)
    assert len(result) == 1
    assert result[0].attunement_id == att_id
    assert result[0].attunement_slug == "einstimmung_gnade"
    assert result[0].constellation_id == cid


@pytest.mark.asyncio
async def test_list_unlocks_tolerates_missing_nested_object():
    """If the nested join is absent (deleted catalog row, unlikely
    given ON DELETE CASCADE), slug falls back to empty string rather
    than raising."""
    now = datetime.now(UTC).isoformat()
    rows = [
        {
            "user_id": str(USER_ID),
            "attunement_id": str(uuid4()),
            "constellation_id": None,
            "unlocked_at": now,
        }
    ]
    client = _scripted(rows)
    result = await AttunementService.list_unlocks(client, USER_ID)
    assert len(result) == 1
    assert result[0].attunement_slug == ""


# ── evaluate ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_evaluate_emotional_returns_hesitation():
    row = _catalog_row("einstimmung_zoegern", "emotional")
    client = _scripted([row])
    result = await AttunementService.evaluate(client, "emotional")
    assert result is not None
    assert result.slug == "einstimmung_zoegern"


@pytest.mark.asyncio
async def test_evaluate_archetype_returns_mercy():
    row = _catalog_row("einstimmung_gnade", "archetype")
    client = _scripted([row])
    result = await AttunementService.evaluate(client, "archetype")
    assert result is not None
    assert result.slug == "einstimmung_gnade"


@pytest.mark.asyncio
async def test_evaluate_temporal_returns_tremor():
    row = _catalog_row("einstimmung_beben", "temporal")
    client = _scripted([row])
    result = await AttunementService.evaluate(client, "temporal")
    assert result is not None
    assert result.slug == "einstimmung_beben"


@pytest.mark.asyncio
async def test_evaluate_contradiction_returns_none():
    """The starter set has no contradiction-type attunement by design
    (migration 232 comment). The query filter is the authoritative
    check: zero rows → None."""
    client = _scripted([])
    result = await AttunementService.evaluate(client, "contradiction")
    assert result is None


# ── unlock ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unlock_returns_true_when_row_inserted():
    """PostgREST with ignore_duplicates=True returns the inserted row
    in the representation when the INSERT fires; empty list when
    ON CONFLICT DO NOTHING silenced it."""
    inserted_row = {
        "user_id": str(USER_ID),
        "attunement_id": str(uuid4()),
        "constellation_id": str(uuid4()),
    }
    admin = _scripted([inserted_row])
    newly = await AttunementService.unlock(
        admin, USER_ID, UUID(inserted_row["attunement_id"]), UUID(inserted_row["constellation_id"]),
    )
    assert newly is True


@pytest.mark.asyncio
async def test_unlock_returns_false_when_already_present():
    admin = _scripted([])  # conflict silenced → empty representation
    newly = await AttunementService.unlock(
        admin, USER_ID, uuid4(), uuid4(),
    )
    assert newly is False


# ── has ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_has_returns_true_when_unlock_row_exists():
    client = _scripted([{"attunement_id": str(uuid4())}])
    assert await AttunementService.has(client, USER_ID, "einstimmung_gnade") is True


@pytest.mark.asyncio
async def test_has_returns_false_when_no_row():
    client = _scripted([])
    assert await AttunementService.has(client, USER_ID, "einstimmung_gnade") is False
