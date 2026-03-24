"""Service for admin data cleanup operations.

Provides preview-before-delete safety for accumulated epoch data,
audit logs, and bot decision records. Uses admin (service_role) client
to bypass RLS for cross-table cleanup operations.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from backend.models.cleanup import (
    CleanupCategoryStats,
    CleanupExecuteResult,
    CleanupPreviewItem,
    CleanupPreviewResult,
    CleanupStats,
    CleanupType,
)
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Child tables that CASCADE from game_epochs
_EPOCH_CASCADE_TABLES = [
    "epoch_teams",
    "epoch_participants",
    "operative_missions",
    "epoch_scores",
    "battle_log",
    "epoch_chat_messages",
    "epoch_invitations",
    "bot_decision_log",
]


class CleanupService:
    """Admin data cleanup — stats, preview, and execute."""

    @classmethod
    async def get_stats(cls, admin_supabase: Client) -> CleanupStats:
        """Count records per cleanup category with oldest timestamp."""
        return CleanupStats(
            completed_epochs=await cls._count_epochs(admin_supabase, "completed"),
            cancelled_epochs=await cls._count_epochs(admin_supabase, "cancelled"),
            stale_lobbies=await cls._count_epochs(admin_supabase, "lobby"),
            archived_instances=await cls._count_archived_instances(admin_supabase),
            audit_log_entries=await cls._count_table(admin_supabase, "audit_log", "created_at"),
            bot_decision_entries=await cls._count_table(
                admin_supabase, "bot_decision_log", "created_at",
            ),
        )

    @classmethod
    async def preview(
        cls,
        admin_supabase: Client,
        cleanup_type: CleanupType,
        min_age_days: int,
        epoch_ids: list[str] | None = None,
    ) -> CleanupPreviewResult:
        """Count what would be deleted without actually deleting."""
        cutoff = datetime.now(UTC) - timedelta(days=min_age_days)

        if cleanup_type in ("completed_epochs", "cancelled_epochs", "stale_lobbies"):
            return await cls._preview_epochs(
                admin_supabase, cleanup_type, cutoff, min_age_days,
                epoch_ids=epoch_ids,
            )
        if cleanup_type == "archived_instances":
            return await cls._preview_archived_instances(
                admin_supabase, cutoff, min_age_days,
                instance_ids=epoch_ids,
            )
        if cleanup_type == "audit_log":
            return await cls._preview_simple(
                admin_supabase, "audit_log", "created_at", cutoff, cleanup_type, min_age_days,
            )
        # bot_decision_log
        return await cls._preview_simple(
            admin_supabase, "bot_decision_log", "created_at", cutoff, cleanup_type, min_age_days,
        )

    @classmethod
    async def execute(
        cls,
        admin_supabase: Client,
        cleanup_type: CleanupType,
        min_age_days: int,
        user_id: UUID,
        epoch_ids: list[str] | None = None,
    ) -> CleanupExecuteResult:
        """Execute cleanup and return summary."""
        cutoff = datetime.now(UTC) - timedelta(days=min_age_days)

        if cleanup_type in ("completed_epochs", "cancelled_epochs", "stale_lobbies"):
            result = await cls._execute_epochs(
                admin_supabase, cleanup_type, cutoff, min_age_days,
                epoch_ids=epoch_ids,
            )
        elif cleanup_type == "archived_instances":
            result = await cls._execute_archived_instances(
                admin_supabase, cutoff, min_age_days,
                instance_ids=epoch_ids,
            )
        elif cleanup_type == "audit_log":
            result = await cls._execute_simple(
                admin_supabase, "audit_log", "created_at", cutoff, cleanup_type, min_age_days,
            )
        else:
            result = await cls._execute_simple(
                admin_supabase, "bot_decision_log", "created_at",
                cutoff, cleanup_type, min_age_days,
            )

        # Best-effort audit log entry
        try:
            await admin_supabase.table("audit_log").insert({
                "entity_type": "cleanup",
                "entity_id": None,
                "action": "delete",
                "user_id": str(user_id),
                "changes": {
                    "cleanup_type": cleanup_type,
                    "min_age_days": min_age_days,
                    "deleted_count": result.deleted_count,
                    "cascade_counts": result.cascade_counts,
                },
            }).execute()
        except Exception:  # noqa: BLE001 — best-effort audit, must not block cleanup
            logger.warning("Failed to audit cleanup operation", exc_info=True)

        return result

    # ── Epoch helpers ──────────────────────────────────────────────

    @classmethod
    def _epoch_status_for_type(cls, cleanup_type: CleanupType) -> str:
        return {
            "completed_epochs": "completed",
            "cancelled_epochs": "cancelled",
            "stale_lobbies": "lobby",
        }[cleanup_type]

    @classmethod
    async def _get_matching_epochs(
        cls,
        admin_supabase: Client,
        status: str,
        cutoff: datetime,
        epoch_ids: list[str] | None = None,
    ) -> list[CleanupPreviewItem]:
        """Get epochs matching status + age cutoff (or explicit IDs)."""
        query = (
            admin_supabase.table("game_epochs")
            .select("id, name, updated_at")
            .eq("status", status)
        )
        if epoch_ids:
            query = query.in_("id", epoch_ids)
        else:
            query = query.lt("updated_at", cutoff.isoformat())
        resp = await query.order("updated_at", desc=False).execute()
        return [
            CleanupPreviewItem(
                id=row["id"], name=row["name"], updated_at=row.get("updated_at"),
            )
            for row in (resp.data or [])
        ]

    @classmethod
    async def _count_cascade_targets(
        cls, admin_supabase: Client, epoch_ids: list[str],
    ) -> dict[str, int]:
        """Count records in cascade child tables for given epoch IDs."""
        if not epoch_ids:
            return {}

        cascade_counts: dict[str, int] = {}
        for table in _EPOCH_CASCADE_TABLES:
            resp = await (
                admin_supabase.table(table)
                .select("id", count="exact")
                .in_("epoch_id", epoch_ids)
                .limit(0)
                .execute()
            )
            count = resp.count or 0
            if count > 0:
                cascade_counts[table] = count

        # Game instance simulations
        resp = await (
            admin_supabase.table("simulations")
            .select("id", count="exact")
            .in_("epoch_id", epoch_ids)
            .in_("simulation_type", ["game_instance", "archived"])
            .limit(0)
            .execute()
        )
        instance_count = resp.count or 0
        if instance_count > 0:
            cascade_counts["game_instances"] = instance_count

        return cascade_counts

    @classmethod
    async def _preview_epochs(
        cls,
        admin_supabase: Client,
        cleanup_type: CleanupType,
        cutoff: datetime,
        min_age_days: int,
        epoch_ids: list[str] | None = None,
    ) -> CleanupPreviewResult:
        status = cls._epoch_status_for_type(cleanup_type)
        items = await cls._get_matching_epochs(
            admin_supabase, status, cutoff, epoch_ids=epoch_ids,
        )
        matched_ids = [item.id for item in items]
        cascade_counts = await cls._count_cascade_targets(admin_supabase, matched_ids)
        return CleanupPreviewResult(
            cleanup_type=cleanup_type,
            min_age_days=min_age_days,
            primary_count=len(items),
            cascade_counts=cascade_counts,
            items=items,
        )

    @classmethod
    async def _execute_epochs(
        cls,
        admin_supabase: Client,
        cleanup_type: CleanupType,
        cutoff: datetime,
        min_age_days: int,
        epoch_ids: list[str] | None = None,
    ) -> CleanupExecuteResult:
        status = cls._epoch_status_for_type(cleanup_type)
        items = await cls._get_matching_epochs(
            admin_supabase, status, cutoff, epoch_ids=epoch_ids,
        )
        matched_ids = [item.id for item in items]

        if not matched_ids:
            return CleanupExecuteResult(
                cleanup_type=cleanup_type,
                min_age_days=min_age_days,
                deleted_count=0,
            )

        # Count cascade targets before deletion (for reporting)
        cascade_counts = await cls._count_cascade_targets(admin_supabase, matched_ids)

        # Step 1: Delete game instance simulations first (ON DELETE SET NULL on epoch_id)
        await admin_supabase.table("simulations").delete().in_(
            "epoch_id", matched_ids,
        ).in_(
            "simulation_type", ["game_instance", "archived"],
        ).execute()

        # Step 2: Delete epoch rows — child tables cascade automatically
        await admin_supabase.table("game_epochs").delete().in_("id", matched_ids).execute()

        logger.info(
            "Cleanup completed",
            extra={"cleanup_type": cleanup_type, "deleted_count": len(matched_ids)},
        )

        return CleanupExecuteResult(
            cleanup_type=cleanup_type,
            min_age_days=min_age_days,
            deleted_count=len(matched_ids),
            cascade_counts=cascade_counts,
        )

    # ── Archived instances ─────────────────────────────────────────

    @classmethod
    async def _get_matching_archived(
        cls,
        admin_supabase: Client,
        cutoff: datetime,
        instance_ids: list[str] | None = None,
    ) -> list[CleanupPreviewItem]:
        """Get archived instances matching age cutoff (or explicit IDs)."""
        query = (
            admin_supabase.table("simulations")
            .select("id, name, updated_at")
            .eq("simulation_type", "archived")
        )
        if instance_ids:
            query = query.in_("id", instance_ids)
        else:
            query = query.lt("updated_at", cutoff.isoformat())
        resp = await query.order("updated_at", desc=False).execute()
        return [
            CleanupPreviewItem(
                id=row["id"], name=row["name"], updated_at=row.get("updated_at"),
            )
            for row in (resp.data or [])
        ]

    @classmethod
    async def _preview_archived_instances(
        cls,
        admin_supabase: Client,
        cutoff: datetime,
        min_age_days: int,
        instance_ids: list[str] | None = None,
    ) -> CleanupPreviewResult:
        items = await cls._get_matching_archived(
            admin_supabase, cutoff, instance_ids=instance_ids,
        )
        return CleanupPreviewResult(
            cleanup_type="archived_instances",
            min_age_days=min_age_days,
            primary_count=len(items),
            items=items,
        )

    @classmethod
    async def _execute_archived_instances(
        cls,
        admin_supabase: Client,
        cutoff: datetime,
        min_age_days: int,
        instance_ids: list[str] | None = None,
    ) -> CleanupExecuteResult:
        items = await cls._get_matching_archived(
            admin_supabase, cutoff, instance_ids=instance_ids,
        )
        matched_ids = [item.id for item in items]

        if matched_ids:
            await admin_supabase.table("simulations").delete().in_(
                "id", matched_ids,
            ).execute()

        return CleanupExecuteResult(
            cleanup_type="archived_instances",
            min_age_days=min_age_days,
            deleted_count=len(matched_ids),
        )

    # ── Simple table helpers ───────────────────────────────────────

    @classmethod
    async def _preview_simple(
        cls,
        admin_supabase: Client,
        table: str,
        date_column: str,
        cutoff: datetime,
        cleanup_type: CleanupType,
        min_age_days: int,
    ) -> CleanupPreviewResult:
        resp = await (
            admin_supabase.table(table)
            .select("id", count="exact")
            .lt(date_column, cutoff.isoformat())
            .limit(0)
            .execute()
        )
        return CleanupPreviewResult(
            cleanup_type=cleanup_type,
            min_age_days=min_age_days,
            primary_count=resp.count or 0,
        )

    @classmethod
    async def _execute_simple(
        cls,
        admin_supabase: Client,
        table: str,
        date_column: str,
        cutoff: datetime,
        cleanup_type: CleanupType,
        min_age_days: int,
    ) -> CleanupExecuteResult:
        resp = await (
            admin_supabase.table(table)
            .select("id", count="exact")
            .lt(date_column, cutoff.isoformat())
            .execute()
        )
        count = len(resp.data or [])

        if count > 0:
            await admin_supabase.table(table).delete().lt(
                date_column, cutoff.isoformat(),
            ).execute()

        return CleanupExecuteResult(
            cleanup_type=cleanup_type,
            min_age_days=min_age_days,
            deleted_count=count,
        )

    # ── Stats helpers ──────────────────────────────────────────────

    @classmethod
    async def _count_epochs(
        cls, admin_supabase: Client, status: str,
    ) -> CleanupCategoryStats:
        resp = await (
            admin_supabase.table("game_epochs")
            .select("id,updated_at", count="exact")
            .eq("status", status)
            .order("updated_at", desc=False)
            .limit(1)
            .execute()
        )
        count = resp.count or 0
        oldest = resp.data[0]["updated_at"] if resp.data else None
        return CleanupCategoryStats(count=count, oldest_at=oldest)

    @classmethod
    async def _count_archived_instances(
        cls, admin_supabase: Client,
    ) -> CleanupCategoryStats:
        resp = await (
            admin_supabase.table("simulations")
            .select("id,updated_at", count="exact")
            .eq("simulation_type", "archived")
            .order("updated_at", desc=False)
            .limit(1)
            .execute()
        )
        count = resp.count or 0
        oldest = resp.data[0]["updated_at"] if resp.data else None
        return CleanupCategoryStats(count=count, oldest_at=oldest)

    @classmethod
    async def _count_table(
        cls, admin_supabase: Client, table: str, date_column: str,
    ) -> CleanupCategoryStats:
        resp = await (
            admin_supabase.table(table)
            .select("id," + date_column, count="exact")
            .order(date_column, desc=False)
            .limit(1)
            .execute()
        )
        count = resp.count or 0
        oldest = resp.data[0][date_column] if resp.data else None
        return CleanupCategoryStats(count=count, oldest_at=oldest)
