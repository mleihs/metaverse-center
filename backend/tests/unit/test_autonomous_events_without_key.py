"""A cost decision about narrative had switched off the mechanics under it.

Finding §2.2 of the 2026-08-30 system review. Heartbeat phase 9f ran only
``if owner_has_key`` — and nobody on the platform has a BYOK key, so the phase
was off on every world since the narrative layers were disabled in March.

What went off with it was not just prose. Autonomous events are what feeds zone
pressure, catharsis, building damage and relationships-from-opinions. Those
consequences were never a cost question; they only sat downstream of one.

``AutonomousEventService`` has carried a template path the whole time: at
``llm_budget=0`` the guard ``llm_calls_used >= llm_budget`` is true for the very
first event, so ``_create_event_template`` handles all of them and no model is
called. The texts are written and waiting.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.autonomous_event_service import AutonomousEventService

SIM_ID = "11111111-1111-1111-1111-111111111111"


def _events_to_create() -> list[dict]:
    return [
        {"trigger": "mood_breakdown", "event_type": "unrest", "severity": "moderate"},
        {"trigger": "opinion_shift", "event_type": "rumor", "severity": "minor"},
    ]


class TestTemplatePathCostsNothing:
    @pytest.mark.asyncio
    async def test_a_zero_budget_never_reaches_the_model(self):
        """Two events, budget zero: both go through the template path."""
        with (
            patch.object(
                AutonomousEventService,
                "_create_event_template",
                new=AsyncMock(return_value={"id": "e1", "title": "T"}),
            ) as template,
            patch.object(AutonomousEventService, "_create_event_with_narrative", new=AsyncMock()) as narrative,
            patch.object(AutonomousEventService, "_apply_trigger_effects", new=AsyncMock()),
            patch.object(AutonomousEventService, "_get_simulation_name", new=AsyncMock(return_value="V")),
        ):
            created = await _drive(llm_budget=0)

        assert narrative.await_count == 0, "no key means no model call, by construction"
        assert template.await_count == len(created)

    @pytest.mark.asyncio
    async def test_a_budget_is_still_spent_when_there_is_one(self):
        """The template path is the floor, not a replacement."""
        with (
            patch.object(
                AutonomousEventService,
                "_create_event_template",
                new=AsyncMock(return_value={"id": "e1", "title": "T"}),
            ) as template,
            patch.object(
                AutonomousEventService,
                "_create_event_with_narrative",
                new=AsyncMock(return_value={"id": "e2", "title": "N"}),
            ) as narrative,
            patch.object(AutonomousEventService, "_apply_trigger_effects", new=AsyncMock()),
            patch.object(AutonomousEventService, "_get_simulation_name", new=AsyncMock(return_value="V")),
        ):
            await _drive(llm_budget=1)

        assert narrative.await_count == 1
        assert template.await_count == 1


async def _drive(*, llm_budget: int) -> list[dict]:
    """Run the budget branch of ``check_and_generate`` over two candidates.

    Reproduces the loop rather than calling the public method, because the
    candidate collection ahead of it depends on live mood/opinion data and this
    test is about the budget rule alone.
    """
    created: list[dict] = []
    llm_calls_used = 0
    supabase = MagicMock()
    for event_data in _events_to_create():
        if llm_calls_used >= llm_budget:
            result = await AutonomousEventService._create_event_template(supabase, SIM_ID, event_data)
        else:
            result = await AutonomousEventService._create_event_with_narrative(
                supabase, SIM_ID, event_data, "V", openrouter_api_key=None
            )
            llm_calls_used += 1
        if result:
            created.append(result)
    return created


class TestHeartbeatAlwaysRunsThePhase:
    """The gate itself: phase 9f must run with or without a key."""

    def test_the_phase_is_no_longer_behind_the_key(self):
        """Read from the source: the `if owner_has_key:` wrapper is gone.

        Two things this test has to get right, both of them lessons from Paket J:

        * It reads the extracted phase-9f BLOCK, not the whole file. The file
          mentions `owner_has_key` several times for legitimate reasons
          (resolving the key, reporting it in stats), so a file-wide search
          would be green on a broken revision (J3).
        * It strips COMMENTS before looking. The comment above the phase quotes
          the old wrapper by name to explain the finding — and an assertion that
          reads the explanation instead of the code is green exactly when the
          documentation is good (J3b). This one passed at first only because the
          comment happens to write it without the trailing colon; that is luck,
          not a test.
        """
        import inspect

        from backend.services import heartbeat_service

        source = inspect.getsource(heartbeat_service)
        start = source.index("# 9f: Autonomous event generation")
        end = source.index('stats["byok_available"]', start)
        block = "\n".join(line for line in source[start:end].split("\n") if not line.lstrip().startswith("#"))

        assert "owner_has_key" in block, "the key must still decide the BUDGET"
        assert "if owner_has_key:" not in block
        assert "AutonomousEventService.check_and_generate" in block
        # The budget is derived from the key, so the two cannot drift apart.
        assert "if owner_has_key else 0" in block
