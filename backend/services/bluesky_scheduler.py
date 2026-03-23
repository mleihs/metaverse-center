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

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

import httpx
import sentry_sdk
import structlog

from backend.dependencies import get_admin_supabase
from backend.services.bluesky_content_service import BlueskyContentService
from backend.services.external.bluesky import (
    BlueskyAPIError,
    BlueskyAuthError,
    BlueskyBlobTooLargeError,
    BlueskyRateLimitError,
    BlueskyService,
)
from backend.services.social.types import AdaptedContent
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Defaults (overridable via platform_settings)
_DEFAULT_CHECK_INTERVAL = 300  # 5 minutes
_DEFAULT_ENABLED = False
_MAX_RETRIES = 3
_METRICS_COLLECT_DELAYS = [3600, 21600, 86400, 172800]  # +1h, +6h, +24h, +48h


class BlueskyScheduler:
    """Periodic background task that publishes scheduled Bluesky posts."""

    _task: asyncio.Task | None = None
    _iteration_count: int = 0

    @classmethod
    async def start(cls) -> asyncio.Task:
        """Launch the scheduler loop. Called from app lifespan."""
        cls._task = asyncio.create_task(cls._run_loop())
        logger.info("Bluesky scheduler started")
        return cls._task

    @classmethod
    async def _run_loop(cls) -> None:
        """Infinite loop: sleep → check for due posts → publish."""
        while True:
            interval = _DEFAULT_CHECK_INTERVAL
            cls._iteration_count += 1
            try:
                structlog.contextvars.bind_contextvars(
                    scheduler="bluesky",
                    iteration=cls._iteration_count,
                )
                admin = await get_admin_supabase()
                config = await cls._load_config(admin)
                interval = config["interval"]

                if config["enabled"]:
                    await cls._process_due_posts(admin, config)
                    await cls._collect_pending_metrics(admin, config)
            except asyncio.CancelledError:
                logger.info("Bluesky scheduler shutting down")
                raise
            except (httpx.ConnectError, httpx.ConnectTimeout):
                logger.warning("Bluesky scheduler: database unavailable, retrying", extra={
                    "iteration": cls._iteration_count,
                    "retry_in_s": interval,
                })
            except Exception as exc:
                logger.exception("Bluesky scheduler loop error", extra={
                    "iteration": cls._iteration_count,
                })
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("bluesky_phase", "scheduler_loop")
                    scope.set_context("bluesky", {
                        "iteration": cls._iteration_count,
                    })
                    sentry_sdk.capture_exception(exc)
            await asyncio.sleep(interval)

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        """Read Bluesky scheduler config from platform_settings."""
        config: dict = {
            "enabled": _DEFAULT_ENABLED,
            "interval": _DEFAULT_CHECK_INTERVAL,
            "posting_enabled": False,
            "handle": "",
            "app_password": "",
            "pds_url": "https://bsky.social",
        }

        try:
            rows = await (
                admin.table("platform_settings")
                .select("setting_key, setting_value")
                .in_("setting_key", [
                    "bluesky_enabled",
                    "bluesky_posting_enabled",
                    "bluesky_handle",
                    "bluesky_app_password",
                    "bluesky_pds_url",
                    "bluesky_scheduler_interval_seconds",
                ])
                .execute()
            ).data or []

            settings_map: dict[str, str] = {}
            for row in rows:
                settings_map[row["setting_key"]] = row["setting_value"]

            config["enabled"] = _parse_bool(settings_map.get("bluesky_enabled", "false"))
            config["posting_enabled"] = _parse_bool(settings_map.get("bluesky_posting_enabled", "false"))

            handle_raw = settings_map.get("bluesky_handle", "")
            config["handle"] = str(handle_raw).strip().strip('"')

            pds_raw = settings_map.get("bluesky_pds_url", "https://bsky.social")
            config["pds_url"] = str(pds_raw).strip().strip('"') or "https://bsky.social"

            # App password — may be encrypted
            raw_password = settings_map.get("bluesky_app_password", "")
            if raw_password and raw_password.startswith("gAAAAA"):
                try:
                    from backend.utils.encryption import decrypt
                    config["app_password"] = decrypt(raw_password)
                except (ValueError, Exception):
                    logger.warning("Failed to decrypt Bluesky app password", extra={
                        "iteration": cls._iteration_count,
                        "password_status": "decrypt_failed",
                    })
                    config["app_password"] = ""
            else:
                pw = str(raw_password).strip().strip('"')
                config["app_password"] = pw

            try:
                config["interval"] = max(60, int(settings_map.get(
                    "bluesky_scheduler_interval_seconds", "300",
                )))
            except (ValueError, TypeError):
                pass

        except Exception:
            logger.warning("Failed to load Bluesky scheduler config, using defaults", extra={
                "iteration": cls._iteration_count,
            })

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

        due = response.data or []
        if not due:
            return

        logger.info("Found due Bluesky posts to publish", extra={
            "post_count": len(due),
            "iteration": cls._iteration_count,
            "config_enabled": config["posting_enabled"],
        })

        if not config["posting_enabled"]:
            logger.info("Bluesky posting disabled (dry-run mode) — skipping publish", extra={
                "post_count": len(due),
                "iteration": cls._iteration_count,
            })
            return

        if not config["handle"] or not config["app_password"]:
            logger.warning("Bluesky credentials not configured — cannot publish", extra={
                "iteration": cls._iteration_count,
                "handle": config["handle"] or "EMPTY",
            })
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
                    "Bluesky authentication failed — disabling posting. "
                    "Check app password in Admin Panel → Bluesky.",
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
                    scope.set_context("bluesky", {
                        "post_id": str(post_id),
                        "handle": config["handle"],
                    })
                    sentry_sdk.capture_exception(exc)
                # Disable posting
                await admin.table("platform_settings").update(
                    {"setting_value": '"false"'},
                ).eq("setting_key", "bluesky_posting_enabled").execute()
                return
            except BlueskyRateLimitError:
                logger.warning("Bluesky rate limit reached — stopping publish cycle", extra={
                    "post_id": str(post_id),
                    "iteration": cls._iteration_count,
                })
                return
            except BlueskyBlobTooLargeError as exc:
                await admin.table("bluesky_posts").update({
                    "status": "failed",
                    "failure_reason": f"Image too large for Bluesky: {str(exc)[:300]}",
                }).eq("id", str(post_id)).execute()
                logger.error("Bluesky blob too large", extra={
                    "post_id": str(post_id),
                    "iteration": cls._iteration_count,
                })
            except BlueskyAPIError as exc:
                retry_count = post.get("retry_count", 0)
                if retry_count < _MAX_RETRIES:
                    await admin.table("bluesky_posts").update({
                        "status": "pending",
                        "retry_count": retry_count + 1,
                        "failure_reason": str(exc)[:500],
                    }).eq("id", str(post_id)).execute()
                    logger.warning("Bluesky API error, will retry", extra={
                        "post_id": str(post_id),
                        "retry_count": retry_count + 1,
                        "max_retries": _MAX_RETRIES,
                        "iteration": cls._iteration_count,
                    })
                else:
                    await admin.table("bluesky_posts").update({
                        "status": "failed",
                        "failure_reason": str(exc)[:500],
                    }).eq("id", str(post_id)).execute()
                    logger.error("Bluesky post failed after max retries", extra={
                        "post_id": str(post_id),
                        "retry_count": _MAX_RETRIES,
                        "iteration": cls._iteration_count,
                    })
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("bluesky_phase", "retries_exhausted")
                        scope.set_context("bluesky", {
                            "post_id": str(post_id),
                            "retry_count": _MAX_RETRIES,
                        })
                        sentry_sdk.capture_exception(exc)
            except Exception as exc:
                await admin.table("bluesky_posts").update({
                    "status": "failed",
                    "failure_reason": "Unexpected error during publishing",
                }).eq("id", str(post_id)).execute()
                logger.exception("Unexpected error publishing Bluesky post", extra={
                    "post_id": str(post_id),
                    "iteration": cls._iteration_count,
                })
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("bluesky_phase", "publish_unexpected")
                    scope.set_context("bluesky", {"post_id": str(post_id)})
                    sentry_sdk.capture_exception(exc)

    @classmethod
    async def publish_post(
        cls, admin: Client, bsky: BlueskyService, post: dict,
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
        await admin.table("bluesky_posts").update(
            {"status": "publishing"},
        ).eq("id", post_id).execute()

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
            except Exception:
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
                except Exception as exc:
                    logger.warning("Failed to download/upload image for Bluesky post", extra={
                        "post_id": post_id,
                        "image_url": url[:100],
                        "error": str(exc)[:200],
                    })

        # Publish
        content = AdaptedContent(
            caption=caption,
            alt_text=alt_text,
            facets=facets,
        )
        result = await bsky.publish_post(content, uploaded_media)

        # Update post as published
        admin.table("bluesky_posts").update({
            "status": "published",
            "published_at": datetime.now(UTC).isoformat(),
            "bsky_uri": result.platform_post_id,
            "bsky_cid": result.cid,
        }).eq("id", post_id).execute()

        logger.info("Published Bluesky post", extra={
            "post_id": post_id,
            "bsky_uri": result.platform_post_id,
            "permalink": result.permalink,
            "media_count": len(uploaded_media),
            "iteration": cls._iteration_count,
        })

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

        posts = response.data or []
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
            for delay in _METRICS_COLLECT_DELAYS:
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
                    admin, UUID(post["id"]), metrics,
                )
                logger.debug("Collected Bluesky metrics", extra={
                    "post_id": post["id"],
                    "likes": metrics.get("likes", 0),
                    "reposts": metrics.get("reposts", 0),
                    "iteration": cls._iteration_count,
                })
            except Exception:
                logger.warning("Failed to collect Bluesky metrics for post", extra={
                    "post_id": post["id"],
                    "iteration": cls._iteration_count,
                })


def _parse_bool(value: str) -> bool:
    """Parse a string as a boolean."""
    return str(value).lower().strip('"') not in ("false", "0", "no", "")
