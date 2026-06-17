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
from typing import Any, ClassVar
from uuid import UUID

import httpx
import sentry_sdk
import structlog
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_admin_supabase
from backend.services.social.constants import DEFAULT_CHECK_INTERVAL
from backend.services.social.types import SocialPlatformClient
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class ForcePublishError(Exception):
    """Base class for force-publish workflow failures.

    Raised by ``BaseSchedulerMixin.force_publish_post`` so the HTTP layer can map
    each cause to a status code without re-implementing the publish-with-
    compensation workflow once per platform.
    """


class SocialCredentialsError(ForcePublishError):
    """Platform credentials are not configured (HTTP layer maps to 400)."""


class PostNotPublishableError(ForcePublishError):
    """Post is not in a status it can be force-published from (maps to 400).

    The message reproduces the legacy router detail verbatim so the API response
    is unchanged.
    """

    def __init__(self, current_status: str) -> None:
        self.current_status = current_status
        super().__init__(f"Cannot publish post with status '{current_status}'.")


class PublishFailedError(ForcePublishError):
    """The platform publish call failed; the post has been reset to its queued
    state (maps to 502). Carries the underlying error message."""


class BaseSchedulerMixin:
    """Mixin providing the common scheduler loop structure.

    Subclasses must define:
        _scheduler_name: str  — e.g. "instagram", "bluesky"
        _load_config(admin) -> dict  — platform-specific config parsing
        _process_tick(admin, config) -> None  — one iteration of work

    Publishing subclasses (those exposing ``force_publish_post``) additionally set:
        _content_service  — class with ``get_post`` + ``reset_post_status`` classmethods
        _force_publish_statuses: tuple[str, ...]  — statuses a post may publish from
        _build_publish_client(admin) -> SocialPlatformClient  — credential loader
        publish_post(admin, client, post)  — single-post publish entry point
    """

    _task: asyncio.Task | None = None
    _iteration_count: int = 0
    _scheduler_name: str = "unknown"
    # Force-publish hooks. ``_content_service`` must expose ``get_post`` +
    # ``reset_post_status`` classmethods; ``_force_publish_statuses`` lists the
    # statuses a post may be force-published from. Both stay unset on
    # non-publishing schedulers.
    _content_service: ClassVar[Any] = None
    _force_publish_statuses: ClassVar[tuple[str, ...]] = ()

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
            except Exception as exc:
                # Last-resort guard: any exception type NOT matched above must not escape the
                # loop. A propagating exception ends the task permanently, so the scheduler
                # stops ticking while /health still returns 200 (silent tick-death). Report and
                # keep looping — a per-tick poison pill therefore re-alerts each interval rather
                # than dying once and going dark.
                logger.exception(
                    "%s scheduler loop: unexpected error, continuing",
                    cls._scheduler_name.capitalize(),
                    extra={"iteration": cls._iteration_count},
                )
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag(f"{cls._scheduler_name}_phase", "scheduler_loop_unexpected")
                    scope.set_context(cls._scheduler_name, {"iteration": cls._iteration_count})
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

    @classmethod
    async def _build_publish_client(cls, admin: Client) -> SocialPlatformClient:
        """Build the platform publishing client from stored credentials.

        Override in publishing subclasses. Raise ``SocialCredentialsError`` when
        the platform is not configured.
        """
        raise NotImplementedError

    @classmethod
    async def force_publish_post(cls, admin: Client, post_id: UUID, *, actor_id: UUID) -> dict:
        """Force-publish one queued post immediately, bypassing the scheduler.

        Shared workflow for every social publishing scheduler: fetch the post,
        verify it is in a publishable status, build the platform client, publish,
        and on failure reset the post to its queued state + report to Sentry.
        Returns the freshly re-fetched post dict.

        Raises (for the HTTP layer to map to status codes):
            PostNotPublishableError — wrong status (400)
            SocialCredentialsError — platform not configured (400)
            PublishFailedError — publish call failed, post already reset (502)
        A missing post propagates the content service's not-found error unchanged.
        """
        post = await cls._content_service.get_post(admin, post_id)

        if post["status"] not in cls._force_publish_statuses:
            raise PostNotPublishableError(post["status"])

        client = await cls._build_publish_client(admin)

        try:
            await cls.publish_post(admin, client, post)
        except Exception as exc:
            logger.exception(
                "%s force-publish failed",
                cls._scheduler_name.capitalize(),
                extra={"post_id": str(post_id), "user_id": str(actor_id)},
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag(f"{cls._scheduler_name}_phase", "force_publish")
                scope.set_context(
                    cls._scheduler_name,
                    {"post_id": str(post_id), "user_id": str(actor_id)},
                )
                sentry_sdk.capture_exception(exc)
            await cls._content_service.reset_post_status(
                admin,
                str(post_id),
                f"Force-publish failed: {str(exc)[:300]}",
            )
            raise PublishFailedError(str(exc)) from exc

        return await cls._content_service.get_post(admin, post_id)
