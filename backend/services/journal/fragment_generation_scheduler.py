"""Background scheduler for async fragment generation (AD-1).

Pops pending rows from fragment_generation_requests every ~60s, generates
fragments via FragmentService.process_tick, and inserts them into
journal_fragments. Gated by platform_settings.journal_enabled (plan §8
feature flag, defaults to false until the P5 flip).

Structure mirrors the existing BaseSchedulerMixin pattern used by the
social schedulers + orphan-sweeper. Lifecycle is managed from
backend/app.py::lifespan.
"""

from __future__ import annotations

import logging

from backend.services.journal.fragment_service import FragmentService
from backend.services.social.scheduler_base import BaseSchedulerMixin
from backend.utils.settings import load_platform_settings, parse_setting_bool
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_SETTING_ENABLED = "journal_enabled"

# Per plan §3: "every ~60s". Tight enough that active players see fragments
# arrive within 1-2 minutes of the triggering event; loose enough to keep
# DB + LLM load bounded.
_TICK_INTERVAL_S = 60


class FragmentGenerationScheduler(BaseSchedulerMixin):
    """Processes queued fragment generation requests.

    Launched from FastAPI lifespan. The tick is a no-op while
    ``platform_settings.journal_enabled`` is false (default until P5).
    """

    _scheduler_name = "fragment_generation"

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        settings = await load_platform_settings(admin, [_SETTING_ENABLED])
        return {
            "enabled": parse_setting_bool(settings.get(_SETTING_ENABLED)),
            "interval": _TICK_INTERVAL_S,
        }

    @classmethod
    async def _process_tick(cls, admin: Client, config: dict) -> None:  # noqa: ARG003
        count = await FragmentService.process_tick(admin)
        if count > 0:
            logger.info("Processed %d journal fragment(s)", count)
