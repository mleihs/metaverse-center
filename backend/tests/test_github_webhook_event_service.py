"""Unit tests for GithubWebhookEventService (B1c router→service extraction).

The endpoint-level behavior (HMAC, dedup short-circuit, finalize-on-error)
is covered by test_webhooks_github.py; these tests pin the service's own
contract — especially the 23505-vs-other-error split.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.github_webhook_event_service import GithubWebhookEventService


def _admin(execute: AsyncMock) -> tuple[MagicMock, MagicMock]:
    admin = MagicMock()
    chain = MagicMock()
    for method in ("insert", "update", "eq"):
        getattr(chain, method).return_value = chain
    chain.execute = execute
    admin.table.return_value = chain
    return admin, chain


@pytest.mark.asyncio
async def test_record_delivery_inserts_and_returns_true() -> None:
    admin, chain = _admin(AsyncMock(return_value=MagicMock(data=[{}])))
    is_new = await GithubWebhookEventService.record_delivery(
        admin,
        delivery_id="d-1",
        event_type="pull_request",
        action="closed",
        payload={"action": "closed"},
    )
    assert is_new is True
    admin.table.assert_called_once_with("github_webhook_events")
    row = chain.insert.call_args.args[0]
    assert row == {
        "delivery_id": "d-1",
        "event_type": "pull_request",
        "action": "closed",
        "payload": {"action": "closed"},
    }


@pytest.mark.asyncio
async def test_record_delivery_returns_false_on_unique_violation() -> None:
    duplicate = PostgrestAPIError(
        {"code": "23505", "message": "duplicate key value violates unique constraint"}
    )
    admin, _chain = _admin(AsyncMock(side_effect=duplicate))
    is_new = await GithubWebhookEventService.record_delivery(
        admin, delivery_id="d-1", event_type="pull_request", action=None, payload={}
    )
    assert is_new is False


@pytest.mark.asyncio
async def test_record_delivery_propagates_other_db_errors() -> None:
    other = PostgrestAPIError({"code": "42P01", "message": "relation does not exist"})
    admin, _chain = _admin(AsyncMock(side_effect=other))
    with pytest.raises(PostgrestAPIError):
        await GithubWebhookEventService.record_delivery(
            admin, delivery_id="d-1", event_type="pull_request", action=None, payload={}
        )


@pytest.mark.asyncio
async def test_finalize_delivery_stamps_result_on_the_delivery_row() -> None:
    admin, chain = _admin(AsyncMock(return_value=MagicMock(data=[{}])))
    await GithubWebhookEventService.finalize_delivery(
        admin, delivery_id="d-9", result="error", error_message="boom"
    )
    payload = chain.update.call_args.args[0]
    assert payload["processing_result"] == "error"
    assert payload["error_message"] == "boom"
    assert payload["processed_at"]  # ISO timestamp present
    chain.eq.assert_called_once_with("delivery_id", "d-9")
