"""Persistence for ``github_webhook_events`` (A1.7 publishing workflow).

Owns the event-row lifecycle the webhook router drives: idempotent
delivery recording (UNIQUE on ``delivery_id``) and the post-processing
finalize update. Event *processing* (draft transitions) stays in
``ContentDraftsService``; this module is storage only.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from postgrest.exceptions import APIError as PostgrestAPIError

from supabase import AsyncClient as Client

_EVENTS_TABLE = "github_webhook_events"
_UNIQUE_VIOLATION = "23505"


class GithubWebhookEventService:
    """Store + finalize GitHub webhook delivery rows."""

    @staticmethod
    async def record_delivery(
        admin_supabase: Client,
        *,
        delivery_id: str,
        event_type: str,
        action: str | None,
        payload: Any,
    ) -> bool:
        """Insert the delivery row. Returns False when ``delivery_id`` was
        already recorded (GitHub retried — UNIQUE violation 23505), True
        when the row is new. Other DB errors propagate."""
        try:
            await (
                admin_supabase.table(_EVENTS_TABLE)
                .insert(
                    {
                        "delivery_id": delivery_id,
                        "event_type": event_type,
                        "action": action,
                        "payload": payload,
                    }
                )
                .execute()
            )
        except PostgrestAPIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
                return False
            raise
        return True

    @staticmethod
    async def finalize_delivery(
        admin_supabase: Client,
        *,
        delivery_id: str,
        result: str,
        error_message: str | None = None,
    ) -> None:
        """Stamp processing outcome onto the delivery row."""
        await (
            admin_supabase.table(_EVENTS_TABLE)
            .update(
                {
                    "processed_at": datetime.now(UTC).isoformat(),
                    "processing_result": result,
                    "error_message": error_message,
                }
            )
            .eq("delivery_id", delivery_id)
            .execute()
        )
