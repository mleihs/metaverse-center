"""GitHub webhook receiver for the A1.7 content-publishing workflow.

Endpoint: `POST /api/v1/webhooks/github`

Security:
    - HMAC-SHA256 verification on the raw request body against
      `GITHUB_WEBHOOK_SECRET`. Constant-time compare via `hmac.compare_digest`.
    - HMAC failure → 401. This deviates from the conventional "always 200 to
      GitHub" advice deliberately: HMAC failure is a permanent misconfiguration
      (wrong secret), not a transient processing error. A 401 surfaces the
      problem in GitHub's webhook delivery UI so the admin notices; a silent
      200 would mask the misconfig until the next legitimate delivery never
      arrives. GitHub's retry budget for 4xx is bounded (≈3 attempts).

Idempotency:
    - `X-GitHub-Delivery` (UUID) is stored in `github_webhook_events` with
      a UNIQUE constraint. Duplicate delivery → INSERT raises 23505 → we
      return 200 immediately (already processed).

Processing:
    - Only `pull_request` events with `action='closed'` are actionable.
      `merged=true` → mark_merged_bulk. `merged=false` → revert_to_draft_bulk
      (decision A from Phase-2 handover: admin's work isn't wasted on PR close).
    - `action='reopened'` is logged but not auto-transitioned (handover #28).
    - All other events / actions are stored + ignored (200 + processing_result='ignored').

Failure handling:
    - Once HMAC + dedup pass, processing errors return 200 with
      `processing_result='error'` + `error_message` populated. Sentry capture
      includes `delivery_id` + `pr_number` tags. GitHub has no dead-letter
      concept, so 5xx-on-processing-error would multiply retries unhelpfully.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from datetime import UTC, datetime
from typing import Annotated, Any

import sentry_sdk
from fastapi import APIRouter, Depends, Header, Request, Response
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_admin_supabase
from backend.services.content_drafts_service import ContentDraftsService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])

_SIGNATURE_PREFIX = "sha256="
_EVENTS_TABLE = "github_webhook_events"
_PROCESSING_RESULT_SUCCESS = "success"
_PROCESSING_RESULT_IGNORED = "ignored"
_PROCESSING_RESULT_ERROR = "error"


@router.post("/github")
async def receive_github_webhook(
    request: Request,
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    x_hub_signature_256: Annotated[str | None, Header()] = None,
    x_github_delivery: Annotated[str | None, Header()] = None,
    x_github_event: Annotated[str | None, Header()] = None,
) -> Response:
    """Verify, dedup, store, and process a GitHub webhook delivery."""
    raw_body = await request.body()

    if not _verify_signature(raw_body, x_hub_signature_256):
        logger.warning(
            "GitHub webhook HMAC verification failed (delivery=%s, event=%s)",
            x_github_delivery, x_github_event,
        )
        return Response(status_code=401, content="signature mismatch")

    if not x_github_delivery or not x_github_event:
        logger.warning(
            "GitHub webhook missing required headers (delivery=%r, event=%r)",
            x_github_delivery, x_github_event,
        )
        return Response(status_code=400, content="missing required headers")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        logger.warning(
            "GitHub webhook payload is not valid JSON (delivery=%s)",
            x_github_delivery,
        )
        return Response(status_code=400, content="invalid JSON payload")

    action = payload.get("action") if isinstance(payload, dict) else None

    # Idempotency dedup: INSERT with UNIQUE on delivery_id. A 23505 means
    # we've already seen this delivery (GitHub retried) — short-circuit 200.
    try:
        await (
            admin_supabase.table(_EVENTS_TABLE)
            .insert(
                {
                    "delivery_id": x_github_delivery,
                    "event_type": x_github_event,
                    "action": action,
                    "payload": payload,
                }
            )
            .execute()
        )
    except PostgrestAPIError as exc:
        if getattr(exc, "code", None) == "23505":
            logger.info(
                "Duplicate GitHub webhook delivery %s — ignored",
                x_github_delivery,
            )
            return Response(status_code=200, content="duplicate, ignored")
        raise

    # From here on every error path returns 200 + records error context on
    # the event row. GitHub doesn't dead-letter, so 5xx would just multiply
    # retries (and the row already captured the payload for offline triage).
    error_message: str | None = None
    try:
        result = await _process_event(
            admin_supabase, x_github_event, action, payload,
        )
    except Exception as exc:  # noqa: BLE001 — webhook handler swallows + reports
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("github_delivery_id", x_github_delivery)
            scope.set_tag("github_event", x_github_event)
            if isinstance(payload, dict):
                pr = payload.get("pull_request")
                if isinstance(pr, dict):
                    scope.set_tag("pr_number", pr.get("number"))
            sentry_sdk.capture_exception(exc)
        logger.exception(
            "GitHub webhook processing failed (delivery=%s)", x_github_delivery,
        )
        result = _PROCESSING_RESULT_ERROR
        error_message = str(exc)[:500]

    await (
        admin_supabase.table(_EVENTS_TABLE)
        .update(
            {
                "processed_at": datetime.now(UTC).isoformat(),
                "processing_result": result,
                "error_message": error_message,
            }
        )
        .eq("delivery_id", x_github_delivery)
        .execute()
    )

    return Response(status_code=200, content=f"processed: {result}")


# ── Internals ─────────────────────────────────────────────────────────────


def _verify_signature(body: bytes, header_value: str | None) -> bool:
    """Verify GitHub's X-Hub-Signature-256 header against the raw body.

    Returns False on:
      - missing GITHUB_WEBHOOK_SECRET env var (fail-closed)
      - missing or malformed header
      - HMAC mismatch
    """
    secret = os.environ.get("GITHUB_WEBHOOK_SECRET")
    if not secret or not header_value:
        return False
    if not header_value.startswith(_SIGNATURE_PREFIX):
        return False
    expected = hmac.new(
        secret.encode("utf-8"), body, hashlib.sha256,
    ).hexdigest()
    actual = header_value.removeprefix(_SIGNATURE_PREFIX)
    return hmac.compare_digest(expected, actual)


async def _process_event(
    supabase: Client,
    event_type: str,
    action: str | None,
    payload: Any,
) -> str:
    """Dispatch a verified+deduped webhook event.

    Returns one of: 'success' | 'ignored'. Raises on processing failure
    (caller catches + records).
    """
    if event_type != "pull_request":
        logger.info("Ignored webhook event type %s", event_type)
        return _PROCESSING_RESULT_IGNORED

    if not isinstance(payload, dict):
        logger.warning("pull_request webhook payload is not a JSON object")
        return _PROCESSING_RESULT_IGNORED

    pr = payload.get("pull_request") or {}
    pr_number = pr.get("number")
    merged = bool(pr.get("merged"))

    if not isinstance(pr_number, int) or pr_number <= 0:
        logger.warning("pull_request webhook missing valid pr_number")
        return _PROCESSING_RESULT_IGNORED

    drafts = await ContentDraftsService.list_by_pr_number(
        supabase, pr_number=pr_number,
    )
    if not drafts:
        logger.info(
            "No content drafts attached to PR #%d — ignored", pr_number,
        )
        return _PROCESSING_RESULT_IGNORED

    draft_ids = [d.id for d in drafts]

    if action == "closed":
        if merged:
            await ContentDraftsService.mark_merged_bulk(
                supabase, draft_ids=draft_ids,
            )
            logger.info(
                "Marked %d draft(s) as merged for PR #%d",
                len(draft_ids), pr_number,
            )
        else:
            await ContentDraftsService.revert_to_draft_bulk(
                supabase, draft_ids=draft_ids,
            )
            logger.info(
                "Reverted %d draft(s) to 'draft' for PR #%d (closed without merge)",
                len(draft_ids), pr_number,
            )
        return _PROCESSING_RESULT_SUCCESS

    if action == "reopened":
        # Per Phase-2 handover gotcha #28: log only, don't auto-transition.
        # A reopened PR may move from merged → not-merged at GitHub's level
        # but we don't undo a merge from our side — admin handles manually.
        logger.info(
            "PR #%d reopened (action='reopened'); no draft transitions applied",
            pr_number,
        )
        return _PROCESSING_RESULT_IGNORED

    logger.info(
        "Ignored pull_request action=%r for PR #%d", action, pr_number,
    )
    return _PROCESSING_RESULT_IGNORED
