"""Base scheduler mixin for periodic social media publishing tasks.

Extracts the common run-loop, error handling, and lifecycle management
shared by InstagramScheduler and BlueskyScheduler. Platform-specific
schedulers override ``_scheduler_name``, ``_load_config``, and
``_process_tick`` to define their behavior.

Pattern: classmethod-based (no instances), started from FastAPI lifespan.
"""

from __future__ import annotations

import asyncio
import logging

import httpx
import sentry_sdk
import structlog
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_admin_supabase
from backend.services.social.constants import DEFAULT_CHECK_INTERVAL
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class BaseSchedulerMixin:
    """Mixin providing the common scheduler loop structure.

    Subclasses must define:
        _scheduler_name: str  — e.g. "instagram", "bluesky"
        _load_config(admin) -> dict  — platform-specific config parsing
        _process_tick(admin, config) -> None  — one iteration of work
    """

    _task: asyncio.Task | None = None
    _iteration_count: int = 0
    _scheduler_name: str = "unknown"

    @classmethod
    async def start(cls) -> asyncio.Task:
        """Launch the scheduler loop. Called from app lifespan."""
        cls._task = asyncio.create_task(cls._run_loop())
        logger.info("%s scheduler started", cls._scheduler_name.capitalize())
        return cls._task

    @classmethod
    async def _run_loop(cls) -> None:
        """Infinite loop: sleep -> load config -> process tick."""
        while True:
            interval = DEFAULT_CHECK_INTERVAL
            cls._iteration_count += 1
            try:
                structlog.contextvars.bind_contextvars(
                    scheduler=cls._scheduler_name,
                    iteration=cls._iteration_count,
                )
                admin = await get_admin_supabase()
                config = await cls._load_config(admin)
                interval = config.get("interval", DEFAULT_CHECK_INTERVAL)

                if config.get("enabled", False):
                    await cls._process_tick(admin, config)
            except asyncio.CancelledError:
                logger.info("%s scheduler shutting down", cls._scheduler_name.capitalize())
                raise
            except (httpx.ConnectError, httpx.ConnectTimeout):
                logger.warning(
                    "%s scheduler: database unavailable, retrying",
                    cls._scheduler_name.capitalize(),
                    extra={
                        "iteration": cls._iteration_count,
                        "retry_in_s": interval,
                    },
                )
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                logger.exception(
                    "%s scheduler loop error",
                    cls._scheduler_name.capitalize(),
                    extra={"iteration": cls._iteration_count},
                )
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag(f"{cls._scheduler_name}_phase", "scheduler_loop")
                    scope.set_context(
                        cls._scheduler_name,
                        {"iteration": cls._iteration_count},
                    )
                    sentry_sdk.capture_exception(exc)
            await asyncio.sleep(interval)

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        """Load scheduler config from platform_settings. Override in subclass."""
        raise NotImplementedError

    @classmethod
    async def _process_tick(cls, admin: Client, config: dict) -> None:
        """Execute one tick of the scheduler. Override in subclass."""
        raise NotImplementedError
