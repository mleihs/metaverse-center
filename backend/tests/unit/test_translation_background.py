"""Regression tests for deep-audit P1-1 (use-after-close in background tasks).

The FD-leak hotfix closes every request-scoped Supabase client at request
teardown (``get_supabase``'s ``finally``). Fire-and-forget work that outlives
the request — entity auto-translation, chat memory extraction — must therefore
never hold a request client: by the time the LLM round-trip returns, that
client is closed and every call raises ``RuntimeError``. These tests pin the
repaired contract: the background persist goes through the admin singleton,
and scheduled tasks are strongly referenced until done.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from backend.models.translation import TranslationContext
from backend.services import translation_service as ts

_CONTEXT = TranslationContext(
    simulation_name="Velgarien",
    simulation_theme="dystopian",
    entity_type="agent",
    entity_name="Testagent",
)


async def test_run_auto_translate_persists_via_admin_client():
    """The background persist must use the admin singleton, never a caller client."""
    admin = MagicMock()
    execute = AsyncMock()
    admin.table.return_value.update.return_value.eq.return_value.execute = execute

    with (
        patch.object(ts, "get_admin_supabase", AsyncMock(return_value=admin)),
        patch.object(
            ts.TranslationService,
            "translate_fields",
            AsyncMock(return_value={"character": "Übersetzung"}),
        ),
    ):
        await ts._run_auto_translate(
            "agents",
            "00000000-0000-0000-0000-000000000001",
            {"character": "Original text"},
            _CONTEXT,
        )

    admin.table.assert_called_once_with("agents")
    execute.assert_awaited_once()


async def test_schedule_auto_translation_holds_strong_reference_until_done():
    """asyncio only weak-refs running tasks — the scheduler must keep them alive."""
    with patch.object(ts, "_run_auto_translate", AsyncMock()):
        ts.schedule_auto_translation(
            "agents",
            "00000000-0000-0000-0000-000000000001",
            {"character": "Original text"},
            simulation_name="Velgarien",
            simulation_theme="dystopian",
        )
        assert len(ts._TRANSLATE_TASKS) == 1
        await asyncio.gather(*ts._TRANSLATE_TASKS)
        await asyncio.sleep(0)  # let done-callbacks run

    assert not ts._TRANSLATE_TASKS
