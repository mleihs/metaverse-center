"""Achievement/badge service — read-only queries for badge catalog and user progress.

All badge awards happen via PostgreSQL triggers (migration 190). This service
provides query endpoints only. No write methods exist because badge evaluation
is entirely DB-driven.

Architecture:
  - achievement_definitions → public catalog (all authenticated users)
  - user_achievements → earned badges (immutable once awarded)
  - achievement_progress → incremental progress toward thresholds
  - fn_award_achievement() → idempotent award RPC (called by triggers)
  - fn_increment_progress() → atomic progress + auto-award (called by triggers)
"""

import logging

import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class AchievementService:
    """Read-only achievement queries. All writes happen via PostgreSQL triggers."""

    # ── Catalog ──────────────────────────────────────────

    @classmethod
    async def list_definitions(cls, supabase: Client) -> list[dict]:
        """List all active achievement definitions (public catalog).

        Returns definitions sorted by sort_order. Secret achievements are
        included but with name/description redacted client-side.
        """
        try:
            resp = await (
                supabase.table("achievement_definitions")
                .select("*")
                .eq("is_active", True)
                .order("sort_order")
                .execute()
            )
            return extract_list(resp)
        except PostgrestAPIError:
            logger.exception("Failed to fetch achievement definitions")
            sentry_sdk.capture_exception()
            return []

    # ── User Achievements ────────────────────────────────

    @classmethod
    async def list_for_user(cls, supabase: Client, user_id: str) -> list[dict]:
        """List all earned achievements for a user with definitions joined.

        Uses a single query with PostgREST embedded join to avoid N+1.
        """
        try:
            resp = await (
                supabase.table("user_achievements")
                .select("*, achievement_definitions(*)")
                .eq("user_id", user_id)
                .order("earned_at", desc=True)
                .execute()
            )
            achievements = extract_list(resp)
            # Flatten the join for cleaner response
            for ach in achievements:
                ach["definition"] = ach.pop("achievement_definitions", None)
            return achievements
        except PostgrestAPIError:
            logger.exception(
                "Failed to fetch user achievements",
                extra={"user_id": user_id},
            )
            sentry_sdk.capture_exception()
            return []

    # ── Progress ─────────────────────────────────────────

    @classmethod
    async def get_progress(cls, supabase: Client, user_id: str) -> list[dict]:
        """Get progress toward all in-flight threshold achievements.

        Only returns progress entries where current_count < target_count
        (i.e., not yet earned). Includes definition join for display.
        """
        try:
            resp = await (
                supabase.table("achievement_progress")
                .select("*, achievement_definitions(*)")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .execute()
            )
            progress = extract_list(resp)
            # Filter out completed (already awarded as user_achievement)
            # and flatten join
            result = []
            for p in progress:
                p["definition"] = p.pop("achievement_definitions", None)
                if p["current_count"] < p["target_count"]:
                    result.append(p)
            return result
        except PostgrestAPIError:
            logger.exception(
                "Failed to fetch achievement progress",
                extra={"user_id": user_id},
            )
            sentry_sdk.capture_exception()
            return []

    # ── Summary ──────────────────────────────────────────

    @classmethod
    async def get_summary(cls, supabase: Client, user_id: str) -> dict:
        """Aggregated achievement stats for dashboard display.

        Returns total available, total earned, breakdown by rarity,
        and the 3 most recent unlocks.
        """
        try:
            # Total available (active, non-secret for display count)
            defs_resp = await (
                supabase.table("achievement_definitions")
                .select("id, rarity", count="exact")
                .eq("is_active", True)
                .execute()
            )
            total_available = defs_resp.count or 0
            definitions = extract_list(defs_resp)

            # Count by rarity
            rarity_counts: dict[str, int] = {}
            for d in definitions:
                r = d.get("rarity", "common")
                rarity_counts[r] = rarity_counts.get(r, 0) + 1

            # Earned count
            earned_resp = await (
                supabase.table("user_achievements")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .execute()
            )
            total_earned = earned_resp.count or 0

            # Earned by rarity
            earned_by_rarity_resp = await (
                supabase.table("user_achievements")
                .select("achievement_definitions(rarity)")
                .eq("user_id", user_id)
                .execute()
            )
            earned_rarity: dict[str, int] = {}
            for e in extract_list(earned_by_rarity_resp):
                defn = e.get("achievement_definitions")
                if defn:
                    r = defn.get("rarity", "common")
                    earned_rarity[r] = earned_rarity.get(r, 0) + 1

            # Recent 3 unlocks
            recent_resp = await (
                supabase.table("user_achievements")
                .select("*, achievement_definitions(*)")
                .eq("user_id", user_id)
                .order("earned_at", desc=True)
                .limit(3)
                .execute()
            )
            recent = extract_list(recent_resp)
            for r in recent:
                r["definition"] = r.pop("achievement_definitions", None)

            return {
                "total_available": total_available,
                "total_earned": total_earned,
                "by_rarity": {
                    rarity: {
                        "total": rarity_counts.get(rarity, 0),
                        "earned": earned_rarity.get(rarity, 0),
                    }
                    for rarity in ("common", "uncommon", "rare", "epic", "legendary")
                },
                "recent": recent,
            }
        except PostgrestAPIError:
            logger.exception(
                "Failed to compute achievement summary",
                extra={"user_id": user_id},
            )
            sentry_sdk.capture_exception()
            return {
                "total_available": 0,
                "total_earned": 0,
                "by_rarity": {},
                "recent": [],
            }
