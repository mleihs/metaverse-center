"""Tests for the shared force-publish workflow (BaseSchedulerMixin.force_publish_post).

Instagram and Bluesky previously each carried a ~50-line copy of this
publish-with-compensation flow in their router. It now lives once on the base
scheduler mixin, parameterised by ``_content_service``, ``_force_publish_statuses``
and ``_build_publish_client``. These tests pin the consolidated behaviour (it had
no router-level coverage before) plus the concrete subclass wiring.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from backend.services.social.scheduler_base import (
    BaseSchedulerMixin,
    PostNotPublishableError,
    PublishFailedError,
    SocialCredentialsError,
)

POST_ID = UUID("33333333-3333-3333-3333-333333333333")
ACTOR_ID = UUID("44444444-4444-4444-4444-444444444444")


def _make_scheduler(
    *,
    initial_post: dict,
    refetched_post: dict | None = None,
    publish_side_effect: Exception | None = None,
    credentials_error: bool = False,
):
    """Build a throwaway BaseSchedulerMixin subclass with mocked hooks."""
    content = MagicMock()
    content.get_post = AsyncMock(side_effect=[initial_post, refetched_post])
    content.reset_post_status = AsyncMock()
    client = MagicMock(name="platform_client")
    publish = AsyncMock(side_effect=publish_side_effect)

    class _Scheduler(BaseSchedulerMixin):
        _scheduler_name = "fake"
        _force_publish_statuses = ("draft", "scheduled")
        _content_service = content

        @classmethod
        async def _build_publish_client(cls, admin):
            if credentials_error:
                raise SocialCredentialsError("Fake credentials not configured.")
            return client

        @classmethod
        async def publish_post(cls, admin, c, p):
            await publish(admin, c, p)

    return _Scheduler, content, publish, client


async def test_happy_path_publishes_and_returns_refetched_post() -> None:
    admin = MagicMock(name="admin")
    updated = {"id": str(POST_ID), "status": "published"}
    scheduler, content, publish, client = _make_scheduler(
        initial_post={"id": str(POST_ID), "status": "scheduled"},
        refetched_post=updated,
    )

    result = await scheduler.force_publish_post(admin, POST_ID, actor_id=ACTOR_ID)

    assert result is updated
    publish.assert_awaited_once_with(admin, client, {"id": str(POST_ID), "status": "scheduled"})
    content.reset_post_status.assert_not_awaited()
    assert content.get_post.await_count == 2  # initial fetch + re-fetch


async def test_wrong_status_raises_not_publishable_without_publishing() -> None:
    admin = MagicMock(name="admin")
    scheduler, content, publish, _ = _make_scheduler(
        initial_post={"id": str(POST_ID), "status": "published"},
    )

    with pytest.raises(PostNotPublishableError) as exc_info:
        await scheduler.force_publish_post(admin, POST_ID, actor_id=ACTOR_ID)

    assert exc_info.value.current_status == "published"
    assert str(exc_info.value) == "Cannot publish post with status 'published'."
    publish.assert_not_awaited()
    content.reset_post_status.assert_not_awaited()


async def test_missing_credentials_propagates_before_publish() -> None:
    admin = MagicMock(name="admin")
    scheduler, content, publish, _ = _make_scheduler(
        initial_post={"id": str(POST_ID), "status": "draft"},
        credentials_error=True,
    )

    with pytest.raises(SocialCredentialsError):
        await scheduler.force_publish_post(admin, POST_ID, actor_id=ACTOR_ID)

    publish.assert_not_awaited()
    content.reset_post_status.assert_not_awaited()


async def test_publish_failure_resets_post_and_raises_publish_failed() -> None:
    admin = MagicMock(name="admin")
    scheduler, content, publish, _ = _make_scheduler(
        initial_post={"id": str(POST_ID), "status": "scheduled"},
        publish_side_effect=ValueError("ig 500"),
    )

    with patch("backend.services.social.scheduler_base.sentry_sdk") as mock_sentry:
        with pytest.raises(PublishFailedError) as exc_info:
            await scheduler.force_publish_post(admin, POST_ID, actor_id=ACTOR_ID)

    # Carries the underlying message verbatim (router maps to 502 with this text).
    assert str(exc_info.value) == "ig 500"
    # Post is reset to its queued state with the truncated failure reason.
    content.reset_post_status.assert_awaited_once_with(admin, str(POST_ID), "Force-publish failed: ig 500")
    # Failure is reported to Sentry exactly once.
    mock_sentry.capture_exception.assert_called_once()
    scope = mock_sentry.push_scope.return_value.__enter__.return_value
    scope.set_tag.assert_called_once_with("fake_phase", "force_publish")


def test_concrete_schedulers_wire_their_content_service_and_statuses() -> None:
    """Lock the platform-specific hooks (the only per-platform deltas)."""
    from backend.services.bluesky_content_service import BlueskyContentService
    from backend.services.bluesky_scheduler import BlueskyScheduler
    from backend.services.instagram_content_service import InstagramContentService
    from backend.services.instagram_scheduler import InstagramScheduler

    assert InstagramScheduler._content_service is InstagramContentService
    assert InstagramScheduler._force_publish_statuses == ("draft", "scheduled")
    assert BlueskyScheduler._content_service is BlueskyContentService
    assert BlueskyScheduler._force_publish_statuses == ("pending", "failed")
