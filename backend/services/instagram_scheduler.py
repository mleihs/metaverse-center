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

import httpx
import sentry_sdk
import structlog

from backend.dependencies import get_admin_supabase
from backend.services.external.instagram import (
    InstagramAPIError,
    InstagramContainerError,
    InstagramRateLimitError,
    InstagramService,
    InstagramTokenExpiredError,
)
from backend.services.instagram_content_service import InstagramContentService
from backend.services.social_story_service import SocialStoryService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Defaults (overridable via platform_settings)
_DEFAULT_CHECK_INTERVAL = 300  # 5 minutes
_DEFAULT_ENABLED = False  # Off by default — must be explicitly enabled
_MAX_RETRIES = 3
_METRICS_COLLECT_DELAYS = [3600, 21600, 86400, 172800]  # +1h, +6h, +24h, +48h


class InstagramScheduler:
    """Periodic background task that publishes scheduled Instagram posts."""

    _task: asyncio.Task | None = None
    _last_token_refresh: datetime | None = None
    _TOKEN_REFRESH_INTERVAL_DAYS = 50  # Refresh every 50 days (tokens last 60)
    _iteration_count: int = 0

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
            cls._iteration_count += 1
            try:
                structlog.contextvars.bind_contextvars(
                    scheduler="instagram",
                    iteration=cls._iteration_count,
                )
                admin = await get_admin_supabase()
                config = await cls._load_config(admin)
                interval = config["interval"]

                if config["enabled"]:
                    await cls._maybe_refresh_token(admin, config)
                    await cls._process_due_posts(admin, config)
                    await cls._compose_pending_stories(admin)
                    await cls._process_due_stories(admin, config)
                    await cls._collect_pending_metrics(admin, config)
            except asyncio.CancelledError:
                logger.info("Instagram scheduler shutting down")
                raise
            except (httpx.ConnectError, httpx.ConnectTimeout):
                logger.warning("Instagram scheduler: database unavailable, retrying", extra={
                    "iteration": cls._iteration_count,
                    "retry_in_s": interval,
                })
            except Exception as exc:
                logger.exception("Instagram scheduler loop error", extra={
                    "iteration": cls._iteration_count,
                })
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("instagram_phase", "scheduler_loop")
                    scope.set_context("instagram", {
                        "iteration": cls._iteration_count,
                    })
                    sentry_sdk.capture_exception(exc)
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
            rows = await (
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
                    logger.warning("Failed to decrypt Instagram access token", extra={
                        "iteration": cls._iteration_count,
                        "token_status": "decrypt_failed",
                    })
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
            logger.warning("Failed to load Instagram scheduler config, using defaults", extra={
                "iteration": cls._iteration_count,
            })

        return config

    @classmethod
    async def _process_due_posts(cls, admin: Client, config: dict) -> None:
        """Find and publish all posts with scheduled_at <= now()."""
        now = datetime.now(UTC).isoformat()
        response = await (
            admin.table("instagram_posts")
            .select("id, caption, hashtags, image_urls, media_type, alt_text, ig_container_id, retry_count")
            .eq("status", "scheduled")
            .lte("scheduled_at", now)
            .order("scheduled_at")
            .limit(5)  # Process max 5 per cycle to avoid timeout
            .execute()
        )

        due = response.data or []
        if not due:
            return

        logger.info("Found due Instagram posts to publish", extra={
            "post_count": len(due),
            "iteration": cls._iteration_count,
            "config_enabled": config["posting_enabled"],
        })

        if not config["posting_enabled"]:
            logger.info("Posting disabled (dry-run mode) — skipping publish", extra={
                "post_count": len(due),
                "iteration": cls._iteration_count,
            })
            return

        if not config["access_token"] or not config["ig_user_id"]:
            logger.warning("Instagram credentials not configured — cannot publish", extra={
                "iteration": cls._iteration_count,
                "token_status": "missing",
            })
            return

        ig = InstagramService(
            access_token=config["access_token"],
            ig_user_id=config["ig_user_id"],
        )

        for post in due:
            post_id = UUID(post["id"])
            try:
                await cls._publish_single_post(admin, ig, post)
            except InstagramTokenExpiredError as exc:
                token_prefix = config["access_token"][:12] + "…" if config["access_token"] else "EMPTY"
                last_refresh = cls._last_token_refresh.isoformat() if cls._last_token_refresh else "never"
                logger.error(
                    "Instagram access token expired — disabling posting. "
                    "Generate a new token at Meta Developer Dashboard and save it "
                    "via Admin Panel → Instagram → Configuration.",
                    extra={
                        "post_id": str(post_id),
                        "iteration": cls._iteration_count,
                        "token_status": "expired",
                        "token_prefix": token_prefix,
                        "last_token_refresh": last_refresh,
                        "meta_error": str(exc)[:200],
                        "action_required": "Replace token in platform_settings.instagram_access_token",
                    },
                )
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("instagram_phase", "token_expired")
                    scope.set_tag("action_required", "replace_token")
                    scope.set_context("instagram_token", {
                        "post_id": str(post_id),
                        "iteration": cls._iteration_count,
                        "token_prefix": token_prefix,
                        "last_refresh": last_refresh,
                        "meta_error": str(exc)[:300],
                    })
                    sentry_sdk.capture_exception(exc)
                # Disable posting (not the whole pipeline — drafts can still be generated)
                await admin.table("platform_settings").update(
                    {"setting_value": json.dumps(False)},
                ).eq("setting_key", "instagram_posting_enabled").execute()
                return
            except InstagramRateLimitError:
                logger.warning("Instagram rate limit reached — stopping publish cycle", extra={
                    "post_id": str(post_id),
                    "iteration": cls._iteration_count,
                })
                return
            except InstagramContainerError as exc:
                retry_count = post.get("retry_count", 0)
                if retry_count < _MAX_RETRIES:
                    await admin.table("instagram_posts").update({
                        "status": "scheduled",
                        "retry_count": retry_count + 1,
                    }).eq("id", str(post_id)).execute()
                    logger.warning("Container error for post, resetting to scheduled", extra={
                        "post_id": str(post_id),
                        "retry_count": retry_count + 1,
                        "max_retries": _MAX_RETRIES,
                        "iteration": cls._iteration_count,
                    })
                else:
                    await admin.table("instagram_posts").update({
                        "status": "failed",
                        "failure_reason": "Container processing failed after max retries",
                    }).eq("id", str(post_id)).execute()
                    logger.error("Post failed after max retries", extra={
                        "post_id": str(post_id),
                        "retry_count": _MAX_RETRIES,
                        "iteration": cls._iteration_count,
                    })
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("instagram_phase", "container_retries_exhausted")
                        scope.set_context("instagram", {
                            "post_id": str(post_id),
                            "retry_count": _MAX_RETRIES,
                        })
                        sentry_sdk.capture_exception(exc)
            except InstagramAPIError as exc:
                await admin.table("instagram_posts").update({
                    "status": "failed",
                    "failure_reason": str(exc)[:500],
                }).eq("id", str(post_id)).execute()
                logger.exception("Instagram API error for post", extra={
                    "post_id": str(post_id),
                    "iteration": cls._iteration_count,
                })
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("instagram_phase", "publish")
                    scope.set_context("instagram", {
                        "post_id": str(post_id),
                        "error": str(exc)[:500],
                    })
                    sentry_sdk.capture_exception(exc)
            except Exception as exc:
                await admin.table("instagram_posts").update({
                    "status": "failed",
                    "failure_reason": "Unexpected error during publishing",
                }).eq("id", str(post_id)).execute()
                logger.exception("Unexpected error publishing post", extra={
                    "post_id": str(post_id),
                    "iteration": cls._iteration_count,
                })
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("instagram_phase", "publish_unexpected")
                    scope.set_context("instagram", {
                        "post_id": str(post_id),
                    })
                    sentry_sdk.capture_exception(exc)

    @classmethod
    async def publish_post(
        cls, admin: Client, ig: InstagramService, post: dict,
    ) -> None:
        """Public interface for force-publishing a single post."""
        await cls._publish_single_post(admin, ig, post)

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

        # Append hashtags to caption (Instagram has no separate hashtag field)
        hashtags = post.get("hashtags") or []
        if hashtags:
            caption = caption.rstrip() + "\n\n" + " ".join(hashtags)

        # Mark as publishing
        await admin.table("instagram_posts").update(
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
                logger.warning("Failed to fetch permalink for media", extra={
                    "post_id": post_id,
                    "media_id": media_id,
                })

        # Update post as published
        await admin.table("instagram_posts").update({
            "status": "published",
            "published_at": datetime.now(UTC).isoformat(),
            "ig_media_id": media_id,
            "ig_permalink": permalink,
        }).eq("id", post_id).execute()

        logger.info("Published Instagram post", extra={
            "post_id": post_id,
            "media_id": media_id,
            "media_type": media_type,
            "permalink": permalink,
            "iteration": cls._iteration_count,
        })

    @classmethod
    async def _compose_pending_stories(cls, admin: Client) -> None:
        """Compose images for stories in 'pending' status with scheduled_at in the future.

        Composes images ahead of time so they're ready when the scheduled_at arrives.
        Only composes stories that don't yet have an image_url.
        """
        response = await (
            admin.table("social_stories")
            .select("id")
            .eq("status", "pending")
            .is_("image_url", "null")
            .order("scheduled_at")
            .limit(3)  # Compose max 3 per cycle to avoid blocking
            .execute()
        )
        pending = response.data or []
        if not pending:
            return

        for story in pending:
            story_id = UUID(story["id"])
            try:
                url = await SocialStoryService.compose_story_image(admin, story_id)
                if url:
                    logger.debug("Composed story image ahead of schedule", extra={
                        "story_id": str(story_id),
                        "iteration": cls._iteration_count,
                    })
            except Exception:
                logger.warning("Failed to compose story image", extra={
                    "story_id": str(story_id),
                    "iteration": cls._iteration_count,
                })

    @classmethod
    async def _process_due_stories(cls, admin: Client, config: dict) -> None:
        """Find and publish stories with status='ready' and scheduled_at <= now().

        Uses the same Instagram Graph API story container flow as feed posts.
        """
        now = datetime.now(UTC).isoformat()
        response = await (
            admin.table("social_stories")
            .select("id, image_url, caption, retry_count")
            .eq("status", "ready")
            .lte("scheduled_at", now)
            .not_.is_("image_url", "null")
            .order("scheduled_at")
            .limit(5)
            .execute()
        )

        due = response.data or []
        if not due:
            return

        logger.info("Found due Instagram stories to publish", extra={
            "story_count": len(due),
            "iteration": cls._iteration_count,
            "config_enabled": config["posting_enabled"],
        })

        if not config["posting_enabled"]:
            logger.info("Posting disabled (dry-run) — skipping story publish", extra={
                "story_count": len(due),
                "iteration": cls._iteration_count,
            })
            return

        if not config["access_token"] or not config["ig_user_id"]:
            logger.warning("Instagram credentials not configured — cannot publish stories", extra={
                "iteration": cls._iteration_count,
            })
            return

        ig = InstagramService(
            access_token=config["access_token"],
            ig_user_id=config["ig_user_id"],
        )

        for story in due:
            story_id = story["id"]
            image_url = story["image_url"]
            try:
                # Mark as publishing
                await admin.table("social_stories").update(
                    {"status": "publishing"},
                ).eq("id", story_id).execute()

                # Publish via Stories API
                result = await ig.publish_story(image_url)
                media_id = result.get("id", "")

                # Update as published
                await admin.table("social_stories").update({
                    "status": "published",
                    "published_at": datetime.now(UTC).isoformat(),
                    "ig_story_id": media_id,
                    "ig_posted_at": datetime.now(UTC).isoformat(),
                }).eq("id", story_id).execute()

                logger.info("Published Instagram story", extra={
                    "story_id": story_id,
                    "media_id": media_id,
                    "iteration": cls._iteration_count,
                })

            except InstagramTokenExpiredError:
                logger.error("Token expired during story publish — stopping", extra={
                    "story_id": story_id,
                    "iteration": cls._iteration_count,
                })
                return
            except InstagramRateLimitError:
                logger.warning("Rate limit hit during story publish — stopping", extra={
                    "story_id": story_id,
                    "iteration": cls._iteration_count,
                })
                return
            except (InstagramContainerError, InstagramAPIError) as exc:
                retry_count = story.get("retry_count", 0)
                if retry_count < _MAX_RETRIES:
                    await admin.table("social_stories").update({
                        "status": "ready",
                        "retry_count": retry_count + 1,
                    }).eq("id", story_id).execute()
                    logger.warning("Story publish failed — will retry", extra={
                        "story_id": story_id,
                        "retry_count": retry_count + 1,
                        "iteration": cls._iteration_count,
                    })
                else:
                    await admin.table("social_stories").update({
                        "status": "failed",
                        "failure_reason": str(exc)[:500],
                    }).eq("id", story_id).execute()
                    logger.error("Story failed after max retries", extra={
                        "story_id": story_id,
                        "iteration": cls._iteration_count,
                    })
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("instagram_phase", "story_publish")
                        scope.set_context("story", {"story_id": story_id})
                        sentry_sdk.capture_exception(exc)
            except Exception as exc:
                await admin.table("social_stories").update({
                    "status": "failed",
                    "failure_reason": "Unexpected error during story publishing",
                }).eq("id", story_id).execute()
                logger.exception("Unexpected error publishing story", extra={
                    "story_id": story_id,
                    "iteration": cls._iteration_count,
                })
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("instagram_phase", "story_publish_unexpected")
                    scope.set_context("story", {"story_id": story_id})
                    sentry_sdk.capture_exception(exc)

    @classmethod
    async def _maybe_refresh_token(cls, admin: Client, config: dict) -> None:
        """Refresh the Instagram access token if it's older than 50 days.

        Instagram Business Login tokens last 60 days. We refresh at 50 days
        to avoid expiration. The refresh endpoint returns a new 60-day token.
        """
        now = datetime.now(UTC)

        # Only check once per scheduler cycle (avoid hammering the API)
        if cls._last_token_refresh and (now - cls._last_token_refresh).days < 1:
            return

        access_token = config.get("access_token", "")
        if not access_token:
            return

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    "https://graph.instagram.com/refresh_access_token",
                    params={
                        "grant_type": "ig_refresh_token",
                        "access_token": access_token,
                    },
                )
                data = resp.json()

            if "access_token" in data:
                new_token = data["access_token"]
                expires_in = data.get("expires_in", 0)

                # Only update if we got a genuinely new token
                if new_token != access_token:
                    from backend.utils.encryption import encrypt
                    encrypted = encrypt(new_token)
                    await admin.table("platform_settings").update(
                        {"setting_value": encrypted},
                    ).eq("setting_key", "instagram_access_token").execute()

                    logger.info("Instagram token refreshed and saved", extra={
                        "expires_in_days": expires_in // 86400,
                        "old_token_prefix": access_token[:12] + "…",
                        "new_token_prefix": new_token[:12] + "…",
                        "iteration": cls._iteration_count,
                        "token_status": "refreshed",
                    })

                cls._last_token_refresh = now
            elif "error" in data:
                error_msg = data["error"].get("message", "Unknown")
                # Don't log as error if token is too new (<24h)
                if data["error"].get("code") == 190:
                    logger.debug("Token refresh skipped (too new)", extra={
                        "error_message": error_msg,
                        "iteration": cls._iteration_count,
                        "token_status": "too_new",
                    })
                else:
                    logger.warning("Token refresh failed", extra={
                        "error_message": error_msg,
                        "iteration": cls._iteration_count,
                        "token_status": "refresh_failed",
                    })
                cls._last_token_refresh = now  # Don't retry immediately

        except Exception as exc:
            logger.warning("Token refresh request failed", extra={
                "iteration": cls._iteration_count,
                "token_status": "request_failed",
            })
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("instagram_phase", "token_refresh")
                scope.set_context("instagram", {
                    "iteration": cls._iteration_count,
                })
                sentry_sdk.capture_exception(exc)
            cls._last_token_refresh = now

    @classmethod
    async def _collect_pending_metrics(cls, admin: Client, config: dict) -> None:
        """Collect engagement metrics for recently published posts."""
        if not config["access_token"] or not config["ig_user_id"]:
            return

        # Find published posts that need metrics collection
        # Check at +1h, +6h, +24h, +48h after publishing
        now = datetime.now(UTC)
        response = await (
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
                logger.debug("Collected metrics for post", extra={
                    "post_id": post["id"],
                    "reach": metrics.get("reach", 0),
                    "saves": metrics.get("saved", 0),
                    "iteration": cls._iteration_count,
                })
            except Exception:
                logger.warning("Failed to collect metrics for post", extra={
                    "post_id": post["id"],
                    "iteration": cls._iteration_count,
                })


def _parse_bool(value: str) -> bool:
    """Parse a string as a boolean."""
    return str(value).lower() not in ("false", "0", "no", "")
