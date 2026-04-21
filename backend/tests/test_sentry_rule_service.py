"""Unit tests for backend/services/sentry_rule_service.py.

Covers the CRUD contract: insert and update paths, cache reload side
effects, audit-log writes, not_found handling, and the deliberate
tolerance for cache-reload failures after a successful write.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from backend.models.bureau_ops import SentryRuleUpsertRequest
from backend.services.sentry_rule_service import SentryRuleService

_ACTOR_ID = UUID("00000000-0000-0000-0000-000000000001")


def _rule_row(rule_id: UUID | None = None, **overrides) -> dict:
    base = {
        "id": str(rule_id or uuid4()),
        "kind": "ignore",
        "match_exception_type": None,
        "match_message_regex": "(boom)",
        "match_logger": None,
        "fingerprint_template": None,
        "downgrade_to": None,
        "enabled": True,
        "note": "test rule rationale",
        "silenced_count_24h": 0,
        "updated_by_id": None,
        "updated_at": "2026-04-21T10:00:00+00:00",
        "created_at": "2026-04-21T10:00:00+00:00",
    }
    base.update(overrides)
    return base


def _admin_mock(result_data: list[dict] | dict | None) -> MagicMock:
    """Generic mock: admin.table('...').select/insert/update/delete.eq.execute → result."""
    admin = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.insert.return_value = chain
    chain.update.return_value = chain
    chain.delete.return_value = chain
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    execute_result = MagicMock(data=result_data)
    chain.execute = AsyncMock(return_value=execute_result)
    admin.table.return_value = chain
    return admin


def _body() -> SentryRuleUpsertRequest:
    return SentryRuleUpsertRequest(
        kind="ignore",
        match_message_regex="(boom)",
        note="test rule rationale",
    )


# ── list_rules ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_rules_returns_parsed_rows() -> None:
    admin = _admin_mock([_rule_row(), _rule_row()])
    rules = await SentryRuleService.list_rules(admin)
    assert len(rules) == 2
    admin.table.assert_called_once_with("sentry_rules")
    admin.table.return_value.order.assert_called_once_with("created_at", desc=False)


# ── upsert_rule: create path ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upsert_rule_create_invokes_insert_reload_audit() -> None:
    row = _rule_row()
    admin = _admin_mock([row])
    with (
        patch("backend.services.sentry_rule_service.sentry_rule_cache.reload",
              new_callable=AsyncMock) as reload_mock,
        patch("backend.services.sentry_rule_service.OpsLedgerService.log_action",
              new_callable=AsyncMock) as audit_mock,
    ):
        result = await SentryRuleService.upsert_rule(
            admin, actor_id=_ACTOR_ID, body=_body(),
        )
    assert str(result.id) == row["id"]
    reload_mock.assert_awaited_once_with(admin)
    audit_mock.assert_awaited_once()
    # Action should be the 'create' flavour.
    assert audit_mock.call_args.kwargs["action"] == "sentry.rule.create"


# ── upsert_rule: update path ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upsert_rule_update_targets_id_and_logs_update_action() -> None:
    rule_id = uuid4()
    row = _rule_row(rule_id=rule_id)
    admin = _admin_mock([row])
    with (
        patch("backend.services.sentry_rule_service.sentry_rule_cache.reload",
              new_callable=AsyncMock),
        patch("backend.services.sentry_rule_service.OpsLedgerService.log_action",
              new_callable=AsyncMock) as audit_mock,
    ):
        result = await SentryRuleService.upsert_rule(
            admin, actor_id=_ACTOR_ID, body=_body(), rule_id=rule_id,
        )
    assert str(result.id) == str(rule_id)
    admin.table.return_value.update.assert_called_once()
    admin.table.return_value.eq.assert_called_with("id", str(rule_id))
    assert audit_mock.call_args.kwargs["action"] == "sentry.rule.update"


@pytest.mark.asyncio
async def test_upsert_rule_update_raises_not_found_for_missing_id() -> None:
    admin = _admin_mock([])  # empty update result → not_found
    with (
        patch("backend.services.sentry_rule_service.sentry_rule_cache.reload",
              new_callable=AsyncMock),
        patch("backend.services.sentry_rule_service.OpsLedgerService.log_action",
              new_callable=AsyncMock),
        pytest.raises(HTTPException) as exc,
    ):
        await SentryRuleService.upsert_rule(
            admin, actor_id=_ACTOR_ID, body=_body(), rule_id=uuid4(),
        )
    assert exc.value.status_code == 404


# ── upsert_rule: cache-reload tolerance ──────────────────────────────────


@pytest.mark.asyncio
async def test_upsert_rule_tolerates_cache_reload_failure() -> None:
    # The write succeeds, the cache reload raises — service must return
    # the created row (not propagate the reload failure).
    row = _rule_row()
    admin = _admin_mock([row])
    with (
        patch("backend.services.sentry_rule_service.sentry_rule_cache.reload",
              new_callable=AsyncMock, side_effect=RuntimeError("pg down")),
        patch("backend.services.sentry_rule_service.OpsLedgerService.log_action",
              new_callable=AsyncMock) as audit_mock,
    ):
        result = await SentryRuleService.upsert_rule(
            admin, actor_id=_ACTOR_ID, body=_body(),
        )
    assert str(result.id) == row["id"]
    # Audit still fires — the write did land, an operator should see it.
    audit_mock.assert_awaited_once()


# ── delete_rule ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_rule_reloads_cache_and_audits() -> None:
    rule_id = uuid4()
    admin = _admin_mock([{"id": str(rule_id)}])  # delete returns affected row
    with (
        patch("backend.services.sentry_rule_service.sentry_rule_cache.reload",
              new_callable=AsyncMock) as reload_mock,
        patch("backend.services.sentry_rule_service.OpsLedgerService.log_action",
              new_callable=AsyncMock) as audit_mock,
    ):
        await SentryRuleService.delete_rule(
            admin, actor_id=_ACTOR_ID, rule_id=rule_id, reason="stale rule",
        )
    admin.table.return_value.delete.assert_called_once()
    admin.table.return_value.eq.assert_called_with("id", str(rule_id))
    reload_mock.assert_awaited_once_with(admin)
    assert audit_mock.call_args.kwargs["action"] == "sentry.rule.delete"
    assert audit_mock.call_args.kwargs["reason"] == "stale rule"


@pytest.mark.asyncio
async def test_delete_rule_raises_not_found_when_row_missing() -> None:
    admin = _admin_mock([])  # no rows affected
    with (
        patch("backend.services.sentry_rule_service.sentry_rule_cache.reload",
              new_callable=AsyncMock) as reload_mock,
        patch("backend.services.sentry_rule_service.OpsLedgerService.log_action",
              new_callable=AsyncMock) as audit_mock,
        pytest.raises(HTTPException) as exc,
    ):
        await SentryRuleService.delete_rule(
            admin, actor_id=_ACTOR_ID, rule_id=uuid4(), reason="nope",
        )
    assert exc.value.status_code == 404
    # No reload or audit on a missing row — nothing changed.
    reload_mock.assert_not_called()
    audit_mock.assert_not_called()
