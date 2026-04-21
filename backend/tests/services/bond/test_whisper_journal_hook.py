"""Tests for the WhisperService -> Resonance Journal hook (AD-8).

Verifies that Depth 2+ whispers enqueue an Impression fragment and that
shallower bonds, missing IDs, and malformed UUIDs no-op cleanly.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.bond.whisper_service import WhisperService


def _make_bond(*, depth: int, user_id: str | None = None, sim_id: str | None = None) -> dict:
    """Build a bond dict matching the shape WhisperService iterates over."""
    return {
        "id": str(uuid4()),
        "user_id": user_id if user_id is not None else str(uuid4()),
        "simulation_id": sim_id if sim_id is not None else str(uuid4()),
        "agent_id": str(uuid4()),
        "depth": depth,
        "agents": {
            "name": "Maren",
            "primary_profession": "archivist",
        },
    }


def _make_whisper(whisper_id: str | None = None) -> dict:
    return {
        "id": whisper_id if whisper_id is not None else str(uuid4()),
        "content_de": "Ein leiser Moment.",
        "content_en": "A quiet moment.",
    }


@pytest.mark.asyncio
async def test_depth_below_2_does_not_enqueue():
    """AD-8: only Depth >= 2 whispers deposit a journal fragment.

    Depth 1 (Bekanntschaft / Acquaintance) is the formation stage; the
    journal stays silent until the Trust threshold is crossed.
    """
    admin = MagicMock()
    bond = _make_bond(depth=1)

    with patch(
        "backend.services.journal.fragment_service.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await WhisperService._enqueue_journal_impression(
            admin,
            bond,
            _make_whisper(),
            "state",
            {"content_de": "x", "content_en": "y"},
        )
        enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_depth_2_enqueues_impression():
    """Depth 2 (Vertrauen / Trust) is the activation threshold."""
    admin = MagicMock()
    bond = _make_bond(depth=2)
    whisper = _make_whisper()

    with patch(
        "backend.services.journal.fragment_service.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await WhisperService._enqueue_journal_impression(
            admin,
            bond,
            whisper,
            "memory",
            {"content_de": "a", "content_en": "You returned."},
        )
        enqueue.assert_called_once()
        kwargs = enqueue.call_args.kwargs
        assert kwargs["source_type"] == "bond"
        assert kwargs["fragment_type"] == "impression"
        assert str(kwargs["source_id"]) == whisper["id"]
        assert str(kwargs["user_id"]) == bond["user_id"]
        assert str(kwargs["simulation_id"]) == bond["simulation_id"]
        ctx = kwargs["context"]
        assert ctx["agent_name"] == "Maren"
        assert ctx["whisper_type"] == "memory"
        assert ctx["bond_depth"] == 2
        assert ctx["whisper_content_en"] == "You returned."


@pytest.mark.asyncio
async def test_depth_5_enqueues_impression():
    """All upper depth tiers also enqueue (Depth 5 = Resonanz, the peak)."""
    admin = MagicMock()
    bond = _make_bond(depth=5)

    with patch(
        "backend.services.journal.fragment_service.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await WhisperService._enqueue_journal_impression(
            admin,
            bond,
            _make_whisper(),
            "reflection",
            {"content_de": "x", "content_en": "y"},
        )
        enqueue.assert_called_once()


@pytest.mark.asyncio
async def test_missing_user_id_noops():
    """A bond row without user_id must not enqueue (data integrity guard)."""
    admin = MagicMock()
    bond = _make_bond(depth=3, user_id="")

    with patch(
        "backend.services.journal.fragment_service.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await WhisperService._enqueue_journal_impression(
            admin,
            bond,
            _make_whisper(),
            "state",
            {"content_de": "x", "content_en": "y"},
        )
        enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_missing_whisper_id_noops():
    """A stored whisper without id (shouldn't happen but defend)."""
    admin = MagicMock()
    bond = _make_bond(depth=3)

    with patch(
        "backend.services.journal.fragment_service.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await WhisperService._enqueue_journal_impression(
            admin,
            bond,
            {"id": "", "content_en": "y"},
            "state",
            {"content_de": "x", "content_en": "y"},
        )
        enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_invalid_uuid_noops():
    """Malformed UUIDs are logged and skipped, not propagated."""
    admin = MagicMock()
    bond = _make_bond(depth=3, user_id="not-a-uuid")

    with patch(
        "backend.services.journal.fragment_service.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await WhisperService._enqueue_journal_impression(
            admin,
            bond,
            _make_whisper(),
            "state",
            {"content_de": "x", "content_en": "y"},
        )
        enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_missing_simulation_id_still_enqueues():
    """simulation_id is nullable (user-global journal, AD-5). Hook must not
    require it — a bond whisper without a simulation association still
    produces a fragment, just without simulation scoping.
    """
    admin = MagicMock()
    bond = _make_bond(depth=2, sim_id="")

    with patch(
        "backend.services.journal.fragment_service.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await WhisperService._enqueue_journal_impression(
            admin,
            bond,
            _make_whisper(),
            "state",
            {"content_de": "x", "content_en": "y"},
        )
        enqueue.assert_called_once()
        kwargs = enqueue.call_args.kwargs
        assert kwargs["simulation_id"] is None
