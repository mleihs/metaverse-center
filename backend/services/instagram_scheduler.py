"""Periodic background task that publishes scheduled Instagram posts.

Runs as an asyncio task started from the FastAPI lifespan. Uses the same
service_role (admin) client pattern as ResonanceScheduler and HeartbeatService.

Loop:
  1. Check platform_settings for enabled state and config
  2. Find posts with status='scheduled' and scheduled_at <= now()
  3. Publish each via Instagram Graph API (create container → poll → publish)
  4. Update post status and collect engagement metrics
  5. Optionally generate new draft content to fill the pipeline
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from uuid import UUID

from backend.dependencies import get_admin_supabase
from backend.services.external.instagram import (
    InstagramAPIError,
    InstagramContainerError,
    InstagramRateLimitError,
    InstagramService,
    InstagramTokenExpiredError,
)
from backend.services.instagram_content_service import InstagramContentService
from supabase import Client

logger = logging.getLogger(__name__)

# Defaults (overridable via platform_settings)
_DEFAULT_CHECK_INTERVAL = 300  # 5 minutes
_DEFAULT_ENABLED = False  # Off by default — must be explicitly enabled
_MAX_RETRIES = 3
_METRICS_COLLECT_DELAYS = [3600, 21600, 86400, 172800]  # +1h, +6h, +24h, +48h


class InstagramScheduler:
    """Periodic background task that publishes scheduled Instagram posts."""

    _task: asyncio.Task | None = None

    @classmethod
    async def start(cls) -> asyncio.Task:
        """Launch the scheduler loop. Called from app lifespan."""
        cls._task = asyncio.create_task(cls._run_loop())
        logger.info("Instagram scheduler started")
        return cls._task

    @classmethod
    async def _run_loop(cls) -> None:
        """Infinite loop: sleep → check for due posts → publish."""
        while True:
            interval = _DEFAULT_CHECK_INTERVAL
            try:
                admin = await get_admin_supabase()
                config = await cls._load_config(admin)
                interval = config["interval"]

                if config["enabled"]:
                    await cls._process_due_posts(admin, config)
                    await cls._collect_pending_metrics(admin, config)
            except asyncio.CancelledError:
                logger.info("Instagram scheduler shutting down")
                raise
            except Exception as exc:
                if type(exc).__name__ in ("ConnectError", "ConnectTimeout"):
                    logger.warning("Instagram scheduler: database unavailable, retrying in %ds", interval)
                else:
                    logger.exception("Instagram scheduler loop error")
            await asyncio.sleep(interval)

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        """Read Instagram scheduler config from platform_settings."""
        config = {
            "enabled": _DEFAULT_ENABLED,
            "interval": _DEFAULT_CHECK_INTERVAL,
            "posting_enabled": False,
            "access_token": "",
            "ig_user_id": "",
            "approval_required": True,
            "posts_per_day": 3,
            "posting_hours": [9, 13, 18],
        }

        try:
            rows = (
                admin.table("platform_settings")
                .select("setting_key, setting_value")
                .in_("setting_key", [
                    "instagram_enabled",
                    "instagram_posting_enabled",
                    "instagram_access_token",
                    "instagram_ig_user_id",
                    "instagram_approval_required",
                    "instagram_posts_per_day",
                    "instagram_posting_hours",
                    "instagram_scheduler_interval_seconds",
                ])
                .execute()
            ).data or []

            settings_map: dict[str, str] = {}
            for row in rows:
                settings_map[row["setting_key"]] = row["setting_value"]

            # Parse settings
            config["enabled"] = _parse_bool(settings_map.get("instagram_enabled", "false"))
            config["posting_enabled"] = _parse_bool(settings_map.get("instagram_posting_enabled", "false"))
            config["approval_required"] = _parse_bool(settings_map.get("instagram_approval_required", "true"))
            config["ig_user_id"] = settings_map.get("instagram_ig_user_id", "")

            # Access token — may be encrypted
            raw_token = settings_map.get("instagram_access_token", "")
            if raw_token and raw_token.startswith("gAAAAA"):
                try:
                    from backend.utils.encryption import decrypt
                    config["access_token"] = decrypt(raw_token)
                except (ValueError, Exception):
                    logger.warning("Failed to decrypt Instagram access token")
                    config["access_token"] = ""
            else:
                config["access_token"] = raw_token

            # Numeric settings
            try:
                config["posts_per_day"] = max(1, int(settings_map.get("instagram_posts_per_day", "3")))
            except (ValueError, TypeError):
                pass

            try:
                config["interval"] = max(60, int(settings_map.get("instagram_scheduler_interval_seconds", "300")))
            except (ValueError, TypeError):
                pass

            # Posting hours (JSON array)
            hours_raw = settings_map.get("instagram_posting_hours", "[9, 13, 18]")
            try:
                config["posting_hours"] = json.loads(hours_raw)
            except (json.JSONDecodeError, TypeError):
                pass

        except Exception:
            logger.warning("Failed to load Instagram scheduler config, using defaults")

        return config

    @classmethod
    async def _process_due_posts(cls, admin: Client, config: dict) -> None:
        """Find and publish all posts with scheduled_at <= now()."""
        now = datetime.now(UTC).isoformat()
        response = (
            admin.table("instagram_posts")
            .select("id, caption, image_urls, media_type, alt_text, ig_container_id, retry_count")
            .eq("status", "scheduled")
            .lte("scheduled_at", now)
            .order("scheduled_at")
            .limit(5)  # Process max 5 per cycle to avoid timeout
            .execute()
        )

        due = response.data or []
        if not due:
            return

        logger.info("Found %d due Instagram post(s) to publish", len(due))

        if not config["posting_enabled"]:
            logger.info("Posting disabled (dry-run mode) — skipping publish for %d post(s)", len(due))
            return

        if not config["access_token"] or not config["ig_user_id"]:
            logger.warning("Instagram credentials not configured — cannot publish")
            return

        ig = InstagramService(
            access_token=config["access_token"],
            ig_user_id=config["ig_user_id"],
        )

        for post in due:
            post_id = UUID(post["id"])
            try:
                await cls._publish_single_post(admin, ig, post)
            except InstagramTokenExpiredError:
                logger.error("Instagram access token expired — disabling scheduler")
                admin.table("platform_settings").update(
                    {"setting_value": "false"},
                ).eq("setting_key", "instagram_posting_enabled").execute()
                return
            except InstagramRateLimitError:
                logger.warning("Instagram rate limit reached — stopping publish cycle")
                return
            except InstagramContainerError:
                retry_count = post.get("retry_count", 0)
                if retry_count < _MAX_RETRIES:
                    admin.table("instagram_posts").update({
                        "retry_count": retry_count + 1,
                    }).eq("id", str(post_id)).execute()
                    logger.warning("Container error for post %s (retry %d/%d)", post_id, retry_count + 1, _MAX_RETRIES)
                else:
                    admin.table("instagram_posts").update({
                        "status": "failed",
                        "failure_reason": "Container processing failed after max retries",
                    }).eq("id", str(post_id)).execute()
                    logger.error("Post %s failed after %d retries", post_id, _MAX_RETRIES)
            except InstagramAPIError as exc:
                admin.table("instagram_posts").update({
                    "status": "failed",
                    "failure_reason": str(exc)[:500],
                }).eq("id", str(post_id)).execute()
                logger.exception("Instagram API error for post %s", post_id)
            except Exception:
                admin.table("instagram_posts").update({
                    "status": "failed",
                    "failure_reason": "Unexpected error during publishing",
                }).eq("id", str(post_id)).execute()
                logger.exception("Unexpected error publishing post %s", post_id)

    @classmethod
    async def _publish_single_post(
        cls,
        admin: Client,
        ig: InstagramService,
        post: dict,
    ) -> None:
        """Publish a single post via Instagram Graph API."""
        post_id = post["id"]
        media_type = post.get("media_type", "IMAGE")
        image_urls = post.get("image_urls", [])
        caption = post.get("caption", "")
        alt_text = post.get("alt_text")

        # Mark as publishing
        admin.table("instagram_posts").update(
            {"status": "publishing"},
        ).eq("id", post_id).execute()

        # Check for crash recovery — resume if container already created
        container_id = post.get("ig_container_id")

        if not image_urls:
            raise InstagramContainerError(f"Post {post['id']} has no image URLs")

        if media_type == "CAROUSEL" and len(image_urls) > 1:
            result = await ig.publish_carousel(
                image_urls=image_urls,
                caption=caption,
                alt_texts=[alt_text] + [None] * (len(image_urls) - 1),
            )
        elif media_type == "STORIES":
            result = await ig.publish_story(image_urls[0])
        else:
            if container_id:
                # Resume — wait for existing container and publish
                await ig.wait_for_container(container_id)
                result = await ig.publish_container(container_id)
            else:
                result = await ig.publish_image(
                    image_url=image_urls[0],
                    caption=caption,
                    alt_text=alt_text,
                )

        media_id = result.get("id", "")

        # Get permalink
        permalink = None
        if media_id:
            try:
                permalink = await ig.get_media_permalink(media_id)
            except Exception:
                logger.warning("Failed to fetch permalink for media %s", media_id)

        # Update post as published
        admin.table("instagram_posts").update({
            "status": "published",
            "published_at": datetime.now(UTC).isoformat(),
            "ig_media_id": media_id,
            "ig_permalink": permalink,
        }).eq("id", post_id).execute()

        logger.info(
            "Published Instagram post %s → media %s",
            post_id,
            media_id,
            extra={"post_id": post_id, "media_id": media_id, "permalink": permalink},
        )

    @classmethod
    async def _collect_pending_metrics(cls, admin: Client, config: dict) -> None:
        """Collect engagement metrics for recently published posts."""
        if not config["access_token"] or not config["ig_user_id"]:
            return

        # Find published posts that need metrics collection
        # Check at +1h, +6h, +24h, +48h after publishing
        now = datetime.now(UTC)
        response = (
            admin.table("instagram_posts")
            .select("id, ig_media_id, published_at, metrics_updated_at")
            .eq("status", "published")
            .not_.is_("ig_media_id", "null")
            .order("published_at", desc=True)
            .limit(20)
            .execute()
        )

        posts = response.data or []
        if not posts:
            return

        ig = InstagramService(
            access_token=config["access_token"],
            ig_user_id=config["ig_user_id"],
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
                metrics = await ig.get_media_insights(post["ig_media_id"])
                await InstagramContentService.update_engagement_metrics(
                    admin, UUID(post["id"]), metrics,
                )
                logger.debug(
                    "Collected metrics for post %s: reach=%s, saves=%s",
                    post["id"],
                    metrics.get("reach", 0),
                    metrics.get("saved", 0),
                )
            except Exception:
                logger.warning(
                    "Failed to collect metrics for post %s",
                    post["id"],
                    exc_info=True,
                )


def _parse_bool(value: str) -> bool:
    """Parse a string as a boolean."""
    return str(value).lower() not in ("false", "0", "no", "")
