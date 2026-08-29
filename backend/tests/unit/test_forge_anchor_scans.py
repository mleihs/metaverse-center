"""The Astrolabe may be read a limited number of times per draft.

Re-reading replaces the three philosophical anchors, so a worldbuilder can
reject an unlucky set and ask again. Each read is an AI call, which is why
there is a ceiling — and why the ceiling lives on the server: the count is kept
on the draft, so it survives the page reload that would reset any client-side
counter.

These tests pin the rule itself and the two things around it that are easy to
break by accident: that the count actually increments, and that a re-read drops
the previous selection rather than leaving it pointing at an anchor that no
longer exists.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from backend.services.forge_orchestrator_service import (
    MAX_ANCHOR_SCANS,
    ForgeOrchestratorService,
)

SEED = "A city that remembers being a forest."


def _draft(scans: int | None, scanned_seed: str | None = SEED) -> dict:
    anchor: dict = {"options": [], "selected": {"title": "An earlier choice"}}
    if scans is not None:
        anchor["scans"] = scans
    if scanned_seed is not None:
        anchor["seed"] = scanned_seed
    return {
        "id": str(uuid4()),
        "seed_prompt": SEED,
        "philosophical_anchor": anchor,
    }


async def _run(draft: dict):
    """Run the research phase against a stubbed draft service, in mock mode."""
    with (
        patch(
            "backend.services.forge_orchestrator_service.ForgeDraftService.get_draft",
            AsyncMock(return_value=draft),
        ),
        patch(
            "backend.services.forge_orchestrator_service.ForgeDraftService.update_draft",
            AsyncMock(),
        ) as update,
        patch("backend.services.forge_orchestrator_service.settings") as cfg,
    ):
        cfg.forge_mock_mode = True
        cfg.tavily_api_key = ""
        await ForgeOrchestratorService.run_astrolabe_research(
            supabase=object(), user_id=uuid4(), draft_id=uuid4()
        )
    return update


@pytest.mark.asyncio
async def test_first_read_of_an_untouched_draft_counts_as_one():
    """A draft with no `scans` key has spent none — not an unknown number."""
    update = await _run(_draft(scans=None))

    payload = update.await_args.args[3]
    assert payload.philosophical_anchor["scans"] == 1


@pytest.mark.asyncio
async def test_each_read_increments_the_count():
    update = await _run(_draft(scans=1))

    payload = update.await_args.args[3]
    assert payload.philosophical_anchor["scans"] == 2


@pytest.mark.asyncio
async def test_a_reread_drops_the_previous_selection():
    """The old selection names an anchor this read has just replaced."""
    update = await _run(_draft(scans=0))

    payload = update.await_args.args[3]
    assert "selected" not in payload.philosophical_anchor


@pytest.mark.asyncio
async def test_the_ceiling_is_refused_rather_than_silently_ignored():
    """Past the limit the request fails loudly; it must not return stale anchors."""
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as excinfo:
        await _run(_draft(scans=MAX_ANCHOR_SCANS))

    assert excinfo.value.status_code == 400
    assert str(MAX_ANCHOR_SCANS) in excinfo.value.detail


@pytest.mark.asyncio
async def test_a_count_past_the_ceiling_still_refuses():
    """Defensive: a draft whose count somehow ran over is not handed a fresh read."""
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        await _run(_draft(scans=MAX_ANCHOR_SCANS + 5))


@pytest.mark.asyncio
async def test_rewriting_the_seed_restores_the_full_budget():
    """The budget answers a question; a new question gets a new budget.

    Without this the refusal message ("rewrite the seed to ask it something
    else") would be advice the code does not honour — the count would follow
    the draft forever and rewriting the seed would change nothing.
    """
    spent = _draft(scans=MAX_ANCHOR_SCANS, scanned_seed="An entirely different world.")

    update = await _run(spent)

    payload = update.await_args.args[3]
    assert payload.philosophical_anchor["scans"] == 1
    assert payload.philosophical_anchor["seed"] == SEED


@pytest.mark.asyncio
async def test_a_draft_from_before_the_budget_existed_is_not_locked_out():
    """Older drafts carry a count but no seed; they must not read as spent."""
    legacy = _draft(scans=MAX_ANCHOR_SCANS, scanned_seed=None)

    update = await _run(legacy)

    payload = update.await_args.args[3]
    assert payload.philosophical_anchor["scans"] == 1


@pytest.mark.asyncio
async def test_a_partial_anchor_update_keeps_the_reading_budget():
    """Choosing an anchor must not hand the budget back.

    `philosophical_anchor` is one JSON column with two owners, and a column
    update replaces the whole value. The client used to rebuild the object from
    `options` + `selected`, which dropped `scans` and `seed` — so selecting an
    anchor silently reset the count to zero and offered three fresh readings.
    The client was fixed; this pins the server so it does not depend on that.
    """
    from backend.models.forge import ForgeDraftUpdate
    from backend.services.forge_draft_service import ForgeDraftService

    stored = {
        "philosophical_anchor": {
            "options": [{"title": "One"}],
            "scans": 2,
            "seed": SEED,
        }
    }

    captured: dict = {}

    class _Table:
        def update(self, payload):
            captured.update(payload)
            return self

        def eq(self, *_a, **_k):
            return self

        async def execute(self):
            return type("R", (), {"data": [{"id": "x"}]})()

    supabase = type("S", (), {"table": lambda _self, _n: _Table()})()

    with patch.object(
        ForgeDraftService, "get_draft", AsyncMock(return_value=stored)
    ):
        await ForgeDraftService.update_draft(
            supabase,
            uuid4(),
            uuid4(),
            ForgeDraftUpdate(
                philosophical_anchor={"options": [{"title": "One"}], "selected": {"title": "One"}}
            ),
        )

    anchor = captured["philosophical_anchor"]
    assert anchor["selected"] == {"title": "One"}
    assert anchor["scans"] == 2, "the reading count was dropped by a partial write"
    assert anchor["seed"] == SEED


@pytest.mark.asyncio
async def test_a_full_anchor_write_is_left_alone():
    """A write that carries the budget itself is authoritative — no merge."""
    from backend.models.forge import ForgeDraftUpdate
    from backend.services.forge_draft_service import ForgeDraftService

    captured: dict = {}

    class _Table:
        def update(self, payload):
            captured.update(payload)
            return self

        def eq(self, *_a, **_k):
            return self

        async def execute(self):
            return type("R", (), {"data": [{"id": "x"}]})()

    supabase = type("S", (), {"table": lambda _self, _n: _Table()})()

    with patch.object(ForgeDraftService, "get_draft", AsyncMock()) as get_draft:
        await ForgeDraftService.update_draft(
            supabase,
            uuid4(),
            uuid4(),
            ForgeDraftUpdate(philosophical_anchor={"options": [], "scans": 1, "seed": "new"}),
        )

    get_draft.assert_not_awaited()
    assert captured["philosophical_anchor"]["scans"] == 1
