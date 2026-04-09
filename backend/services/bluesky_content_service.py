"""Bluesky content pipeline — adapts Instagram content and manages the Bluesky queue.

Classmethod-based, stateless — same pattern as InstagramContentService.
Bluesky content rides along from Instagram via the Postgres trigger
(fn_crosspost_to_bluesky). This service handles caption adaptation,
queue management, and analytics.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from uuid import UUID

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.external.bluesky import BlueskyService
from backend.utils.errors import not_found
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Bluesky post limit is 300 graphemes; leave room for hashtags
_GRAPHEME_LIMIT = 260  # Leave ~40 chars for 2-3 hashtags
_HASHTAG_BUDGET = 3  # Max hashtags to append

# Brand/simulation-specific tags — zero search volume, skip for Bluesky
_SKIP_TAG_PATTERNS = {
    "bureauofimpossiblegeography",
    "substratedispatch",
    # Simulation slugs become CamelCase tags — detect by checking if
    # the lowered tag matches no known community hashtag
}

# Community tags worth keeping on Bluesky (high discoverability)
_BLUESKY_WORTHY_TAGS = {
    "#worldbuilding",
    "#aiart",
    "#speculativefiction",
    "#scifi",
    "#digitalart",
    "#conceptart",
    "#storytelling",
    "#alternatehistory",
    "#creativewriting",
    "#fantasyworldbuilding",
    "#scifiart",
    "#ttrpg",
    "#fantasy",
    "#characterdesign",
    "#oc",
    "#aicharacter",
    "#characterart",
    "#aiportrait",
    "#rpg",
    "#fictionalcharacter",
    "#portraitart",
    "#ttrpgcommunity",
    "#aiarchitecture",
    "#fantasyarchitecture",
    "#environmentdesign",
    "#urbanfantasy",
    "#proceduralgeneration",
    "#microfiction",
    "#flashfiction",
    "#lorebuilding",
    "#narrativedesign",
    "#emergentnarrative",
    "#indiedev",
}


class BlueskyContentService:
    """Adapts Instagram content for Bluesky and manages the Bluesky queue."""

    PIPELINE_SETTINGS_KEYS = [
        "bluesky_enabled",
        "bluesky_posting_enabled",
        "bluesky_handle",
        "bluesky_pds_url",
        "bluesky_auto_crosspost",
        "bluesky_scheduler_interval_seconds",
    ]

    # ── Caption Adaptation ─────────────────────────────────────────────

    @classmethod
    async def adapt_instagram_post(
        cls,
        admin_supabase: Client,
        bluesky_post_id: UUID,
    ) -> dict:
        """Adapt the placeholder caption from the trigger into a proper Bluesky caption.

        The Postgres trigger creates rows with a truncated caption placeholder;
        this method does the real adaptation:
        1. Load the full Instagram source caption
        2. Deterministic adaptation to ~280 graphemes
        3. Build facets for hashtags/links
        4. Update the bluesky_posts row
        """
        # Load the Bluesky post
        bp_resp = await (
            admin_supabase.table("bluesky_posts")
            .select("*, instagram_posts!bluesky_posts_instagram_post_id_fkey(caption, hashtags, simulation_id)")
            .eq("id", str(bluesky_post_id))
            .limit(1)
            .execute()
        )
        if not bp_resp.data:
            raise not_found(detail="Bluesky post not found.")

        bp = bp_resp.data[0]
        ig_data = bp.get("instagram_posts") or {}
        full_caption = ig_data.get("caption", bp.get("caption", ""))
        ig_hashtags = ig_data.get("hashtags") or []

        # Adapt caption
        adapted = cls._adapt_caption(full_caption, bp.get("simulation_id"))

        # Append discoverable hashtags (filtered from IG tags)
        adapted = cls._append_bluesky_hashtags(adapted, ig_hashtags)

        # Build facets
        facets = BlueskyService.build_facets(adapted)

        # Update
        update_data = {"caption": adapted, "facets": facets}
        resp = await admin_supabase.table("bluesky_posts").update(update_data).eq("id", str(bluesky_post_id)).execute()
        return resp.data[0] if resp.data else update_data

    @classmethod
    def _adapt_caption(cls, full_caption: str, simulation_id: str | None = None) -> str:
        """Deterministic caption adaptation for Bluesky's 300-grapheme limit.

        Strategy: strip hashtags + footer, keep header + first 2 sentences of body.
        """
        lines = full_caption.strip().split("\n")
        adapted_parts: list[str] = []

        for line in lines:
            stripped = line.strip()

            # Skip empty lines at start
            if not stripped and not adapted_parts:
                continue

            # Stop at footer markers
            if stripped.startswith("ADDENDUM:") or stripped.startswith("—"):
                break

            # Skip hashtag-only lines
            if stripped and all(word.startswith("#") for word in stripped.split()):
                continue

            # Skip AI disclosure
            if "AI-generated content" in stripped or "metaverse.center" in stripped:
                continue

            # Collect BUREAU header and RE: line
            if stripped.startswith(("BUREAU", "DISPATCH", "CLASSIFICATION", "RE:")):
                adapted_parts.append(stripped)
                continue

            # Body text
            if stripped:
                adapted_parts.append(stripped)

        text = "\n".join(adapted_parts)

        # Truncate to grapheme limit
        text = cls.truncate_to_graphemes(text, _GRAPHEME_LIMIT)
        return text

    @classmethod
    def _append_bluesky_hashtags(cls, text: str, ig_hashtags: list[str]) -> str:
        """Append 2-3 discoverable hashtags from the Instagram post's tag list.

        Filters out brand/simulation-specific tags (zero search volume) and
        keeps only community tags that drive Bluesky discoverability.
        """
        if not ig_hashtags:
            return text

        worthy = []
        for tag in ig_hashtags:
            lower = tag.lstrip("#").lower()
            # Skip known brand/simulation patterns
            if lower in _SKIP_TAG_PATTERNS:
                continue
            # Keep only tags in the community-worthy set
            if f"#{lower}" in _BLUESKY_WORTHY_TAGS:
                worthy.append(tag)

        if not worthy:
            return text

        # Take up to _HASHTAG_BUDGET tags
        selected = worthy[:_HASHTAG_BUDGET]
        suffix = "\n\n" + " ".join(selected)

        # Only append if we have room (stay under 300 graphemes total)
        if len(text) + len(suffix) <= 300:
            return text + suffix

        # If tight on space, try with fewer tags
        for count in range(len(selected) - 1, 0, -1):
            suffix = "\n\n" + " ".join(selected[:count])
            if len(text) + len(suffix) <= 300:
                return text + suffix

        return text

    @classmethod
    def truncate_to_graphemes(cls, text: str, max_graphemes: int = 280) -> str:
        """Truncate text to max graphemes, breaking at sentence boundary."""
        if len(text) <= max_graphemes:
            return text

        # Try to break at sentence boundary
        truncated = text[:max_graphemes]
        # Find last sentence-ending punctuation
        for i in range(len(truncated) - 1, max(0, len(truncated) - 80), -1):
            if truncated[i] in ".!?":
                return truncated[: i + 1]

        # No sentence boundary found — break at word boundary
        last_space = truncated.rfind(" ", max(0, len(truncated) - 40))
        if last_space > 0:
            return truncated[:last_space] + "…"

        return truncated[: max_graphemes - 1] + "…"

    # ── Queue Management ───────────────────────────────────────────────

    @classmethod
    async def list_queue(
        cls,
        admin_supabase: Client,
        status_filter: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list, int]:
        """List Bluesky queue items from v_bluesky_queue."""
        query = admin_supabase.table("v_bluesky_queue").select("*", count="exact")
        if status_filter:
            query = query.eq("status", status_filter)

        query = query.range(offset, offset + limit - 1)
        response = await query.execute()
        data = response.data or []
        total = response.count if response.count is not None else len(data)
        return data, total

    @classmethod
    async def get_post(
        cls,
        admin_supabase: Client,
        post_id: UUID,
    ) -> dict:
        """Get a single Bluesky post."""
        resp = await admin_supabase.table("bluesky_posts").select("*").eq("id", str(post_id)).limit(1).execute()
        if not resp.data:
            raise not_found(detail="Bluesky post not found.")
        return resp.data[0]

    @classmethod
    async def skip_post(
        cls,
        admin_supabase: Client,
        post_id: UUID,
    ) -> dict:
        """Admin: skip this post (don't publish to Bluesky)."""
        resp = await (
            admin_supabase.table("bluesky_posts")
            .update({"status": "skipped"})
            .eq("id", str(post_id))
            .in_("status", ["pending", "failed"])
            .execute()
        )
        if not resp.data:
            raise not_found(detail="Post not found or not in skippable status.")
        return resp.data[0]

    @classmethod
    async def unskip_post(
        cls,
        admin_supabase: Client,
        post_id: UUID,
    ) -> dict:
        """Admin: re-enable a skipped post."""
        resp = await (
            admin_supabase.table("bluesky_posts")
            .update({"status": "pending"})
            .eq("id", str(post_id))
            .eq("status", "skipped")
            .execute()
        )
        if not resp.data:
            raise not_found(detail="Post not found or not in skipped status.")
        return resp.data[0]

    @classmethod
    async def reset_post_status(
        cls,
        admin_supabase: Client,
        post_id: str,
        failure_reason: str,
    ) -> None:
        """Reset a post back to pending after a publish failure."""
        await (
            admin_supabase.table("bluesky_posts")
            .update(
                {
                    "status": "pending",
                    "failure_reason": failure_reason[:500],
                }
            )
            .eq("id", post_id)
            .execute()
        )

    @classmethod
    async def update_engagement_metrics(
        cls,
        admin_supabase: Client,
        post_id: UUID,
        metrics: dict,
    ) -> dict:
        """Update engagement metrics for a published post."""
        update = {
            "likes_count": metrics.get("likes", 0) or 0,
            "reposts_count": metrics.get("reposts", 0) or 0,
            "replies_count": metrics.get("replies", 0) or 0,
            "quotes_count": metrics.get("quotes", 0) or 0,
            "metrics_updated_at": datetime.now(UTC).isoformat(),
        }
        resp = await admin_supabase.table("bluesky_posts").update(update).eq("id", str(post_id)).execute()
        return resp.data[0] if resp.data else update

    # ── Analytics ──────────────────────────────────────────────────────

    @classmethod
    async def get_analytics(
        cls,
        admin_supabase: Client,
        days: int = 30,
    ) -> dict:
        """Get aggregated Bluesky analytics via Postgres RPC."""
        try:
            response = await admin_supabase.rpc(
                "fn_bluesky_analytics",
                {"p_days": days},
            ).execute()
            return response.data if response.data else {}
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.warning(
                "Bluesky analytics RPC failed — returning empty stats",
                exc_info=True,
                extra={"days": days},
            )
            sentry_sdk.capture_exception(exc)
            return {"period_days": days, "total_posts": 0, "total_pending": 0}

    # ── Settings ───────────────────────────────────────────────────────

    @classmethod
    async def get_pipeline_settings(cls, admin_supabase: Client) -> dict:
        """Get all Bluesky pipeline configuration settings as a flat dict."""
        resp = await (
            admin_supabase.table("platform_settings")
            .select("setting_key, setting_value, description")
            .in_("setting_key", cls.PIPELINE_SETTINGS_KEYS)
            .execute()
        )
        settings_map = {}
        for row in resp.data or []:
            raw = row["setting_value"]
            if isinstance(raw, dict | list):
                value = json.dumps(raw)
            elif isinstance(raw, bool):
                value = "true" if raw else "false"
            elif raw is not None:
                value = str(raw)
            else:
                value = ""
            settings_map[row["setting_key"]] = {
                "value": value,
                "description": row.get("description", ""),
            }
        return settings_map

    @classmethod
    async def load_bluesky_credentials(cls, admin_supabase: Client) -> dict[str, str]:
        """Load Bluesky credentials from platform_settings.

        Returns dict with handle, app_password, pds_url.
        """
        _resp = await (
            admin_supabase.table("platform_settings")
            .select("setting_key, setting_value")
            .in_(
                "setting_key",
                [
                    "bluesky_handle",
                    "bluesky_app_password",
                    "bluesky_pds_url",
                ],
            )
            .execute()
        )
        rows = _resp.data or []

        result: dict[str, str] = {
            "handle": "",
            "app_password": "",
            "pds_url": "https://bsky.social",
        }

        for row in rows:
            key = row["setting_key"]
            raw = str(row["setting_value"] or "").strip().strip('"')

            if key == "bluesky_handle":
                result["handle"] = raw
            elif key == "bluesky_pds_url" and raw:
                result["pds_url"] = raw
            elif key == "bluesky_app_password":
                if raw.startswith("gAAAAA"):
                    try:
                        from backend.utils.encryption import decrypt

                        result["app_password"] = decrypt(raw)
                    except (ValueError, Exception):
                        logger.warning("Failed to decrypt Bluesky app password")
                else:
                    result["app_password"] = raw

        logger.info(
            "Bluesky credentials loaded",
            extra={
                "handle": result["handle"] or "EMPTY",
                "pds_url": result["pds_url"],
                "password_len": len(result["app_password"]),
                "password_prefix": result["app_password"][:4] + "…" if result["app_password"] else "EMPTY",
                "was_encrypted": any(
                    str(r["setting_value"] or "").startswith("gAAAAA")
                    for r in rows
                    if r["setting_key"] == "bluesky_app_password"
                ),
            },
        )
        return result
