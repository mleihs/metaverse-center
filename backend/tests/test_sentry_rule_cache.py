"""Unit tests for backend/services/sentry_rule_cache.py.

Covers:
    - reload() pulls enabled rows, sorts by created_at ASC, groups by kind.
    - Malformed regex rows drop silently, do not poison the snapshot.
    - apply_rules: empty cache passes events through unchanged.
    - apply_rules: ignore matches short-circuit to None.
    - apply_rules: fingerprint template substitutes canonical and custom
      tag placeholders; missing placeholders produce empty strings (no crash).
    - apply_rules: downgrade sets event['level'].
    - apply_rules: first match wins within a kind (rules sorted by
      created_at ASC per D-1).
    - apply_rules: match_logger prefix matches the event 'logger' field.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.services import sentry_rule_cache as src
from backend.services.sentry_rule_cache import (
    CompiledRule,
    Snapshot,
    apply_rules,
    reset_for_tests,
)


@pytest.fixture(autouse=True)
def _reset_cache() -> None:
    """Every test starts with an empty module-level snapshot."""
    reset_for_tests()
    yield
    reset_for_tests()


def _rule_row(
    rule_id: str,
    kind: str,
    **overrides: Any,
) -> dict[str, Any]:
    """Builder for a minimal sentry_rules row dict."""
    row: dict[str, Any] = {
        "id": rule_id,
        "kind": kind,
        "match_exception_type": None,
        "match_message_regex": None,
        "match_logger": None,
        "fingerprint_template": None,
        "downgrade_to": None,
    }
    row.update(overrides)
    return row


def _admin_with_rules(rows: list[dict]) -> MagicMock:
    admin = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.execute = AsyncMock(return_value=MagicMock(data=rows))
    admin.table.return_value = chain
    return admin


# ── CompiledRule.from_row ────────────────────────────────────────────────


def test_compiled_rule_drops_bad_regex() -> None:
    # Invalid Python regex must be logged + dropped, not raise.
    rule = CompiledRule.from_row(
        _rule_row("r1", "ignore", match_message_regex="["),
    )
    assert rule is None


def test_compiled_rule_accepts_valid_regex() -> None:
    rule = CompiledRule.from_row(
        _rule_row("r1", "ignore", match_message_regex="(?i)quota"),
    )
    assert rule is not None
    assert rule.match_message_pattern is not None
    assert rule.match_message_pattern.search("Out of Quota now") is not None


def test_compiled_rule_rejects_unknown_kind() -> None:
    assert CompiledRule.from_row(_rule_row("r1", "bogus")) is None


# ── reload() ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reload_groups_and_orders_rules() -> None:
    admin = _admin_with_rules([
        _rule_row("i1", "ignore", match_message_regex="quota"),
        _rule_row("f1", "fingerprint", match_exception_type="RateLimitError",
                  fingerprint_template="openrouter.{exc_type}.{model}"),
        _rule_row("d1", "downgrade", match_exception_type="ModelHTTPError",
                  downgrade_to="warning"),
    ])
    snapshot = await src.reload(admin)
    assert [r.id for r in snapshot.ignore] == ["i1"]
    assert [r.id for r in snapshot.fingerprint] == ["f1"]
    assert [r.id for r in snapshot.downgrade] == ["d1"]
    # Sort key must be created_at ASC — the supabase client call chain
    # should carry that ordering. Verify the .order() call happened.
    admin.table.assert_called_once_with("sentry_rules")
    admin.table.return_value.order.assert_called_once_with("created_at", desc=False)


@pytest.mark.asyncio
async def test_reload_skips_bad_regex_rows() -> None:
    admin = _admin_with_rules([
        _rule_row("ok", "ignore", match_message_regex="quota"),
        _rule_row("bad", "ignore", match_message_regex="(unclosed"),
    ])
    snapshot = await src.reload(admin)
    assert [r.id for r in snapshot.ignore] == ["ok"]


# ── apply_rules: pass-through ────────────────────────────────────────────


def test_apply_rules_empty_cache_returns_event_unchanged() -> None:
    event: dict = {"message": "whatever"}
    exc = ValueError("test")
    out = apply_rules(event, {"exc_info": (ValueError, exc, None)}, Snapshot.empty())
    assert out is event
    assert "fingerprint" not in out
    assert "level" not in out


# ── apply_rules: ignore ──────────────────────────────────────────────────


def test_apply_rules_ignore_by_message_regex() -> None:
    rule = CompiledRule.from_row(
        _rule_row("r", "ignore", match_message_regex="(Key limit exceeded)"),
    )
    assert rule is not None
    snapshot = Snapshot(
        ignore=(rule,), fingerprint=(), downgrade=(), loaded_at_monotonic=1.0,
    )
    exc = RuntimeError("OpenRouter: Key limit exceeded for today")
    out = apply_rules({}, {"exc_info": (RuntimeError, exc, None)}, snapshot)
    assert out is None


def test_apply_rules_ignore_by_exception_type() -> None:
    rule = CompiledRule.from_row(
        _rule_row("r", "ignore", match_exception_type="RateLimitError"),
    )
    assert rule is not None
    snapshot = Snapshot(
        ignore=(rule,), fingerprint=(), downgrade=(), loaded_at_monotonic=1.0,
    )

    class RateLimitError(Exception):
        pass

    exc = RateLimitError("429")
    out = apply_rules({}, {"exc_info": (RateLimitError, exc, None)}, snapshot)
    assert out is None


def test_apply_rules_ignore_requires_all_match_fields_to_hit() -> None:
    # exception_type mismatches → ignore rule does not fire.
    rule = CompiledRule.from_row(
        _rule_row("r", "ignore",
                  match_exception_type="RateLimitError",
                  match_message_regex="quota"),
    )
    assert rule is not None
    snapshot = Snapshot(
        ignore=(rule,), fingerprint=(), downgrade=(), loaded_at_monotonic=1.0,
    )
    exc = RuntimeError("quota exceeded")  # type does not match
    out = apply_rules({}, {"exc_info": (RuntimeError, exc, None)}, snapshot)
    assert out is not None  # event preserved


# ── apply_rules: fingerprint ─────────────────────────────────────────────


def test_apply_rules_fingerprint_substitutes_template() -> None:
    rule = CompiledRule.from_row(
        _rule_row("r", "fingerprint",
                  match_exception_type="RateLimitError",
                  fingerprint_template="openrouter.{exc_type}.{model}"),
    )
    assert rule is not None
    snapshot = Snapshot(
        ignore=(), fingerprint=(rule,), downgrade=(), loaded_at_monotonic=1.0,
    )

    class RateLimitError(Exception):
        pass

    exc = RateLimitError("429")
    event: dict = {"tags": {"model": "deepseek/deepseek-chat"}}
    out = apply_rules(event, {"exc_info": (RateLimitError, exc, None)}, snapshot)
    assert out is not None
    assert out["fingerprint"] == [
        "openrouter",
        "RateLimitError",
        "deepseek/deepseek-chat",
    ]


def test_apply_rules_fingerprint_missing_tag_uses_unknown_sentinel() -> None:
    # No 'model' tag on the event → the known placeholder resolves to
    # the 'unknown' sentinel (not empty string) so fingerprints stay
    # human-readable in Sentry's issue list.
    rule = CompiledRule.from_row(
        _rule_row("r", "fingerprint",
                  match_exception_type="RateLimitError",
                  fingerprint_template="openrouter.{exc_type}.{model}"),
    )
    assert rule is not None
    snapshot = Snapshot(
        ignore=(), fingerprint=(rule,), downgrade=(), loaded_at_monotonic=1.0,
    )

    class RateLimitError(Exception):
        pass

    out = apply_rules({}, {"exc_info": (RateLimitError, RateLimitError(), None)}, snapshot)
    assert out is not None
    assert out["fingerprint"] == ["openrouter", "RateLimitError", "unknown"]


def test_apply_rules_fingerprint_unknown_placeholder_falls_back_to_blank() -> None:
    # A template that references an unknown placeholder name (e.g.
    # {custom_tag}) must not raise — _DefaultDict yields ''.
    rule = CompiledRule.from_row(
        _rule_row("r", "fingerprint",
                  match_exception_type="RateLimitError",
                  fingerprint_template="openrouter.{custom_tag}"),
    )
    assert rule is not None
    snapshot = Snapshot(
        ignore=(), fingerprint=(rule,), downgrade=(), loaded_at_monotonic=1.0,
    )

    class RateLimitError(Exception):
        pass

    out = apply_rules({}, {"exc_info": (RateLimitError, RateLimitError(), None)}, snapshot)
    assert out is not None
    # {custom_tag} → '' ; the resulting template is "openrouter." which
    # splits into ["openrouter", ""].
    assert out["fingerprint"] == ["openrouter", ""]


def test_apply_rules_fingerprint_tag_list_form_is_also_accepted() -> None:
    # Sentry events sometimes carry tags as [{"key": ..., "value": ...}].
    rule = CompiledRule.from_row(
        _rule_row("r", "fingerprint",
                  match_exception_type="RateLimitError",
                  fingerprint_template="{model}"),
    )
    assert rule is not None
    snapshot = Snapshot(
        ignore=(), fingerprint=(rule,), downgrade=(), loaded_at_monotonic=1.0,
    )

    class RateLimitError(Exception):
        pass

    event: dict = {"tags": [{"key": "model", "value": "claude-haiku"}]}
    out = apply_rules(event, {"exc_info": (RateLimitError, RateLimitError(), None)}, snapshot)
    assert out is not None
    assert out["fingerprint"] == ["claude-haiku"]


# ── apply_rules: downgrade ───────────────────────────────────────────────


def test_apply_rules_downgrade_sets_level() -> None:
    rule = CompiledRule.from_row(
        _rule_row("r", "downgrade",
                  match_exception_type="ModelHTTPError",
                  match_message_regex=r"\b(402|403|503)\b",
                  downgrade_to="warning"),
    )
    assert rule is not None
    snapshot = Snapshot(
        ignore=(), fingerprint=(), downgrade=(rule,), loaded_at_monotonic=1.0,
    )

    class ModelHTTPError(Exception):
        pass

    exc = ModelHTTPError("status_code: 403, body: rate-limit")
    out = apply_rules({}, {"exc_info": (ModelHTTPError, exc, None)}, snapshot)
    assert out is not None
    assert out["level"] == "warning"


def test_apply_rules_downgrade_skips_when_status_does_not_match() -> None:
    rule = CompiledRule.from_row(
        _rule_row("r", "downgrade",
                  match_exception_type="ModelHTTPError",
                  match_message_regex=r"\b(402|403|503)\b",
                  downgrade_to="warning"),
    )
    assert rule is not None
    snapshot = Snapshot(
        ignore=(), fingerprint=(), downgrade=(rule,), loaded_at_monotonic=1.0,
    )

    class ModelHTTPError(Exception):
        pass

    exc = ModelHTTPError("status_code: 500, body: server error")
    out = apply_rules({}, {"exc_info": (ModelHTTPError, exc, None)}, snapshot)
    assert out is not None
    assert "level" not in out


# ── apply_rules: first-match-wins ────────────────────────────────────────


def test_apply_rules_fingerprint_first_match_wins() -> None:
    # Two rules match, only the first (by cache order) applies.
    first = CompiledRule.from_row(
        _rule_row("first", "fingerprint",
                  match_exception_type="RateLimitError",
                  fingerprint_template="first.{exc_type}"),
    )
    second = CompiledRule.from_row(
        _rule_row("second", "fingerprint",
                  match_exception_type="RateLimitError",
                  fingerprint_template="second.{exc_type}"),
    )
    assert first is not None and second is not None
    snapshot = Snapshot(
        ignore=(), fingerprint=(first, second), downgrade=(),
        loaded_at_monotonic=1.0,
    )

    class RateLimitError(Exception):
        pass

    out = apply_rules({}, {"exc_info": (RateLimitError, RateLimitError(), None)}, snapshot)
    assert out is not None
    assert out["fingerprint"] == ["first", "RateLimitError"]


# ── apply_rules: logger prefix ───────────────────────────────────────────


def test_apply_rules_logger_prefix_requires_hit() -> None:
    rule = CompiledRule.from_row(
        _rule_row("r", "ignore",
                  match_logger="backend.services.openrouter"),
    )
    assert rule is not None
    snapshot = Snapshot(
        ignore=(rule,), fingerprint=(), downgrade=(), loaded_at_monotonic=1.0,
    )
    exc = RuntimeError("x")
    # Non-matching logger → rule does not fire.
    other = apply_rules(
        {"logger": "backend.routers.health"},
        {"exc_info": (RuntimeError, exc, None)},
        snapshot,
    )
    assert other is not None
    # Matching prefix → rule fires → event dropped.
    match = apply_rules(
        {"logger": "backend.services.openrouter.call"},
        {"exc_info": (RuntimeError, exc, None)},
        snapshot,
    )
    assert match is None


# ── fingerprint tag spread (F8) ──────────────────────────────────────────


def test_apply_rules_fingerprint_exposes_custom_tags() -> None:
    # Templates can reference any tag name, not only the three canonical
    # axes (model / provider / purpose).
    rule = CompiledRule.from_row(
        _rule_row(
            "r",
            "fingerprint",
            match_exception_type="RateLimitError",
            fingerprint_template="sim-{simulation_id}",
        ),
    )
    assert rule is not None
    snapshot = Snapshot(
        ignore=(), fingerprint=(rule,), downgrade=(), loaded_at_monotonic=1.0,
    )

    class RateLimitError(Exception):
        pass

    event: dict = {"tags": {"simulation_id": "sim-alpha"}}
    out = apply_rules(event, {"exc_info": (RateLimitError, RateLimitError(), None)}, snapshot)
    assert out is not None
    assert out["fingerprint"] == ["sim-sim-alpha"]


def test_apply_rules_fingerprint_explicit_keys_beat_same_named_tags() -> None:
    # If an event tag happens to be named "exc_type", the canonical
    # exception type must still win — prevents tag-forged fingerprints.
    rule = CompiledRule.from_row(
        _rule_row(
            "r",
            "fingerprint",
            match_exception_type="RateLimitError",
            fingerprint_template="{exc_type}",
        ),
    )
    assert rule is not None
    snapshot = Snapshot(
        ignore=(), fingerprint=(rule,), downgrade=(), loaded_at_monotonic=1.0,
    )

    class RateLimitError(Exception):
        pass

    event: dict = {"tags": {"exc_type": "Forged"}}
    out = apply_rules(event, {"exc_info": (RateLimitError, RateLimitError(), None)}, snapshot)
    assert out is not None
    assert out["fingerprint"] == ["RateLimitError"]
