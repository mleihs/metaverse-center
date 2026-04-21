"""Periodic background task that publishes scheduled Bluesky posts.

Runs as an asyncio task started from the FastAPI lifespan. Uses the same
service_role (admin) client pattern as InstagramScheduler.

Simpler than Instagram: Bluesky publishing is synchronous (no container polling).

Loop:
  1. Check platform_settings for enabled state and config
  2. Find pending bluesky_posts with scheduled_at <= now()
  3. Adapt captions (from trigger placeholder)
  4. Download image, recompress if needed, upload blob
  5. Publish via AT Protocol createRecord
  6. Collect engagement metrics at intervals
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.bluesky_content_service import BlueskyContentService
from backend.services.external.bluesky import (
    BlueskyAPIError,
    BlueskyAuthError,
    BlueskyBlobTooLargeError,
    BlueskyRateLimitError,
    BlueskyService,
)
from backend.services.social.constants import (
    DEFAULT_CHECK_INTERVAL,
    MAX_PUBLISH_RETRIES,
    METRICS_COLLECT_DELAYS,
)
from backend.services.social.scheduler_base import BaseSchedulerMixin
from backend.services.social.types import AdaptedContent
from backend.utils.responses import extract_list
from backend.utils.settings import (
    decrypt_setting,
    load_platform_settings,
    parse_setting_bool,
    upsert_platform_setting,
)
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Defaults (overridable via platform_settings)
_DEFAULT_ENABLED = False


class BlueskyScheduler(BaseSchedulerMixin):
    """Periodic background task that publishes scheduled Bluesky posts."""

    _scheduler_name = "bluesky"

    @classmethod
    async def _process_tick(cls, admin: Client, config: dict) -> None:
        """One tick: publish due posts and collect metrics."""
        await cls._process_due_posts(admin, config)
        await cls._collect_pending_metrics(admin, config)

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        """Read Bluesky scheduler config from platform_settings."""
        config: dict = {
            "enabled": _DEFAULT_ENABLED,
            "interval": DEFAULT_CHECK_INTERVAL,
            "posting_enabled": False,
            "handle": "",
            "app_password": "",
            "pds_url": "https://bsky.social",
        }

        try:
            sm = await load_platform_settings(admin, [
                "bluesky_enabled",
                "bluesky_posting_enabled",
                "bluesky_handle",
                "bluesky_app_password",
                "bluesky_pds_url",
                "bluesky_scheduler_interval_seconds",
            ])

            config["enabled"] = parse_setting_bool(sm.get("bluesky_enabled", "false"))
            config["posting_enabled"] = parse_setting_bool(sm.get("bluesky_posting_enabled", "false"))
            config["handle"] = str(sm.get("bluesky_handle", "")).strip().strip('"')
            config["pds_url"] = str(sm.get("bluesky_pds_url", "https://bsky.social")).strip().strip('"') or "https://bsky.social"
            config["app_password"] = decrypt_setting(sm.get("bluesky_app_password", ""))

            try:
                config["interval"] = max(60, int(sm.get("bluesky_scheduler_interval_seconds", "300")))
            except (ValueError, TypeError):
                pass

        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning(
                "Failed to load Bluesky scheduler config, using defaults",
                extra={"iteration": cls._iteration_count},
            )

        return config

    @classmethod
    async def _process_due_posts(cls, admin: Client, config: dict) -> None:
        """Find and publish all pending posts with scheduled_at <= now()."""
        now = datetime.now(UTC).isoformat()
        response = await (
            admin.table("bluesky_posts")
            .select("id, caption, facets, alt_text, image_urls, retry_count, instagram_post_id")
            .eq("status", "pending")
            .lte("scheduled_at", now)
            .order("scheduled_at")
            .limit(5)  # Process max 5 per cycle
            .execute()
        )

        due = extract_list(response)
        if not due:
            return

        logger.info(
            "Found due Bluesky posts to publish",
            extra={
                "post_count": len(due),
                "iteration": cls._iteration_count,
                "config_enabled": config["posting_enabled"],
            },
        )

        if not config["posting_enabled"]:
            logger.info(
                "Bluesky posting disabled (dry-run mode) — skipping publish",
                extra={
                    "post_count": len(due),
                    "iteration": cls._iteration_count,
                },
            )
            return

        if not config["handle"] or not config["app_password"]:
            logger.warning(
                "Bluesky credentials not configured — cannot publish",
                extra={
                    "iteration": cls._iteration_count,
                    "handle": config["handle"] or "EMPTY",
                },
            )
            return

        bsky = BlueskyService(
            handle=config["handle"],
            app_password=config["app_password"],
            pds_url=config["pds_url"],
        )

        for post in due:
            post_id = UUID(post["id"])
            try:
                await cls._publish_single_post(admin, bsky, post)
            except BlueskyAuthError as exc:
                logger.error(
                    "Bluesky authentication failed — disabling posting. Check app password in Admin Panel → Bluesky.",
                    extra={
                        "post_id": str(post_id),
                        "iteration": cls._iteration_count,
                        "handle": config["handle"],
                        "error": str(exc)[:200],
                        "action_required": "Check bluesky_app_password in platform_settings",
                    },
                )
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("bluesky_phase", "auth_failed")
                    scope.set_tag("action_required", "check_credentials")
                    scope.set_context(
                        "bluesky",
                        {
                            "post_id": str(post_id),
                            "handle": config["handle"],
                        },
                    )
                    sentry_sdk.capture_exception(exc)
                # Disable posting
                await upsert_platform_setting(
                    admin, "bluesky_posting_enabled", '"false"',
                )
                return
            except BlueskyRateLimitError:
                logger.warning(
                    "Bluesky rate limit reached — stopping publish cycle",
                    extra={
                        "post_id": str(post_id),
                        "iteration": cls._iteration_count,
                    },
                )
                return
            except BlueskyBlobTooLargeError as exc:
                await (
                    admin.table("bluesky_posts")
                    .update(
                        {
                            "status": "failed",
                            "failure_reason": f"Image too large for Bluesky: {str(exc)[:300]}",
                        }
                    )
                    .eq("id", str(post_id))
                    .execute()
                )
                logger.error(
                    "Bluesky blob too large",
                    extra={
                        "post_id": str(post_id),
                        "iteration": cls._iteration_count,
                    },
                )
            except BlueskyAPIError as exc:
                retry_count = post.get("retry_count", 0)
                if retry_count < MAX_PUBLISH_RETRIES:
                    await (
                        admin.table("bluesky_posts")
                        .update(
                            {
                                "status": "pending",
                                "retry_count": retry_count + 1,
                                "failure_reason": str(exc)[:500],
                            }
                        )
                        .eq("id", str(post_id))
                        .execute()
                    )
                    logger.warning(
                        "Bluesky API error, will retry",
                        extra={
                            "post_id": str(post_id),
                            "retry_count": retry_count + 1,
                            "max_retries": MAX_PUBLISH_RETRIES,
                            "iteration": cls._iteration_count,
                        },
                    )
                else:
                    await (
                        admin.table("bluesky_posts")
                        .update(
                            {
                                "status": "failed",
                                "failure_reason": str(exc)[:500],
                            }
                        )
                        .eq("id", str(post_id))
                        .execute()
                    )
                    logger.error(
                        "Bluesky post failed after max retries",
                        extra={
                            "post_id": str(post_id),
                            "retry_count": MAX_PUBLISH_RETRIES,
                            "iteration": cls._iteration_count,
                        },
                    )
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("bluesky_phase", "retries_exhausted")
                        scope.set_context(
                            "bluesky",
                            {
                                "post_id": str(post_id),
                                "retry_count": MAX_PUBLISH_RETRIES,
                            },
                        )
                        sentry_sdk.capture_exception(exc)
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                await (
                    admin.table("bluesky_posts")
                    .update(
                        {
                            "status": "failed",
                            "failure_reason": "Unexpected error during publishing",
                        }
                    )
                    .eq("id", str(post_id))
                    .execute()
                )
                logger.exception(
                    "Unexpected error publishing Bluesky post",
                    extra={
                        "post_id": str(post_id),
                        "iteration": cls._iteration_count,
                    },
                )
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("bluesky_phase", "publish_unexpected")
                    scope.set_context("bluesky", {"post_id": str(post_id)})
                    sentry_sdk.capture_exception(exc)

    @classmethod
    async def publish_post(
        cls,
        admin: Client,
        bsky: BlueskyService,
        post: dict,
    ) -> None:
        """Public interface for force-publishing a single post."""
        await cls._publish_single_post(admin, bsky, post)

    @classmethod
    async def _publish_single_post(
        cls,
        admin: Client,
        bsky: BlueskyService,
        post: dict,
    ) -> None:
        """Publish a single post via AT Protocol."""
        post_id = post["id"]
        caption = post.get("caption", "")
        alt_text = post.get("alt_text")
        image_urls = post.get("image_urls") or []

        # Mark as publishing
        await (
            admin.table("bluesky_posts")
            .update(
                {"status": "publishing"},
            )
            .eq("id", post_id)
            .execute()
        )

        # Adapt caption if this is a cross-posted Instagram post (trigger placeholder)
        if post.get("instagram_post_id"):
            try:
                await BlueskyContentService.adapt_instagram_post(admin, UUID(post_id))
                # Re-fetch the post to get the adapted caption
                refreshed = await (
                    admin.table("bluesky_posts")
                    .select("caption, facets, alt_text")
                    .eq("id", post_id)
                    .limit(1)
                    .execute()
                )
                if refreshed.data:
                    caption = refreshed.data[0].get("caption", caption)
                    alt_text = refreshed.data[0].get("alt_text", alt_text)
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.warning(
                    "Caption adaptation failed, using trigger placeholder",
                    extra={"post_id": post_id},
                )

        # Build facets
        facets = post.get("facets") or BlueskyService.build_facets(caption)

        # Download and upload images as blobs
        uploaded_media = []
        if image_urls:
            for url in image_urls[:4]:  # Bluesky max 4 images
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        img_resp = await client.get(url)
                        img_resp.raise_for_status()
                    img_data = img_resp.content
                    mime = img_resp.headers.get("content-type", "image/jpeg")

                    media = await bsky.upload_media(img_data, mime)
                    uploaded_media.append(media)
                except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                    logger.warning(
                        "Failed to download/upload image for Bluesky post",
                        extra={
                            "post_id": post_id,
                            "image_url": url[:100],
                            "error": str(exc)[:200],
                        },
                    )

        # Publish
        content = AdaptedContent(
            caption=caption,
            alt_text=alt_text,
            facets=facets,
        )
        result = await bsky.publish_post(content, uploaded_media)

        # Update post as published
        await (
            admin.table("bluesky_posts")
            .update(
                {
                    "status": "published",
                    "published_at": datetime.now(UTC).isoformat(),
                    "bsky_uri": result.platform_post_id,
                    "bsky_cid": result.cid,
                }
            )
            .eq("id", post_id)
            .execute()
        )

        logger.info(
            "Published Bluesky post",
            extra={
                "post_id": post_id,
                "bsky_uri": result.platform_post_id,
                "permalink": result.permalink,
                "media_count": len(uploaded_media),
                "iteration": cls._iteration_count,
            },
        )

    @classmethod
    async def _collect_pending_metrics(cls, admin: Client, config: dict) -> None:
        """Collect engagement metrics for recently published posts."""
        if not config["handle"] or not config["app_password"]:
            return

        # Find published posts needing metric updates
        now = datetime.now(UTC)
        response = await (
            admin.table("bluesky_posts")
            .select("id, bsky_uri, published_at, metrics_updated_at")
            .eq("status", "published")
            .not_.is_("bsky_uri", "null")
            .order("published_at", desc=True)
            .limit(20)
            .execute()
        )

        posts = extract_list(response)
        if not posts:
            return

        bsky = BlueskyService(
            handle=config["handle"],
            app_password=config["app_password"],
            pds_url=config["pds_url"],
        )

        for post in posts:
            published_at = datetime.fromisoformat(post["published_at"].replace("Z", "+00:00"))
            elapsed = (now - published_at).total_seconds()

            # Check if we should collect at this interval
            should_collect = False
            for delay in METRICS_COLLECT_DELAYS:
                window_start = delay - config["interval"]
                window_end = delay + config["interval"]
                if window_start <= elapsed <= window_end:
                    should_collect = True
                    break

            if not should_collect:
                continue

            try:
                metrics = await bsky.get_post_metrics(post["bsky_uri"])
                await BlueskyContentService.update_engagement_metrics(
                    admin,
                    UUID(post["id"]),
                    metrics,
                )
                logger.debug(
                    "Collected Bluesky metrics",
                    extra={
                        "post_id": post["id"],
                        "likes": metrics.get("likes", 0),
                        "reposts": metrics.get("reposts", 0),
                        "iteration": cls._iteration_count,
                    },
                )
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.warning(
                    "Failed to collect Bluesky metrics for post",
                    extra={
                        "post_id": post["id"],
                        "iteration": cls._iteration_count,
                    },
                )


