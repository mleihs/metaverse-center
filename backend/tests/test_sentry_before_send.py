"""Integration tests for the ``_ops_before_send`` wiring in backend/app.py.

Unit tests for the rule engine itself live in ``test_sentry_rule_cache``.
These tests exercise the Sentry hook path end-to-end: pre-populate the
module-level cache with the P0-equivalent rules seeded by migration 230
and verify the hook delegates correctly for the canonical cases.

Why keep this file alongside ``test_sentry_rule_cache``:
    The cache module can be exercised in isolation but the admin-panel
    CRUD path (P2.3) and Sentry's ``before_send`` hook both depend on the
    same ``apply_rules`` + snapshot plumbing. A tiny wiring test here
    guards against a future refactor accidentally decoupling them.
"""

from __future__ import annotations

import pytest

from backend.app import _ops_before_send
from backend.services import sentry_rule_cache as src
from backend.services.sentry_rule_cache import CompiledRule, Snapshot, reset_for_tests


@pytest.fixture(autouse=True)
def _seed_p0_equivalent_cache() -> None:
    """Load the 4 P0-equivalent rules from migration 230 into the cache."""
    reset_for_tests()
    ignore_rule = CompiledRule.from_row({
        "id": "seed-ignore",
        "kind": "ignore",
        "match_exception_type": None,
        "match_message_regex": "(Key limit exceeded|insufficient_quota)",
        "match_logger": None,
        "fingerprint_template": None,
        "downgrade_to": None,
    })
    fp_rate_limit = CompiledRule.from_row({
        "id": "seed-fp-ratelimit",
        "kind": "fingerprint",
        "match_exception_type": "RateLimitError",
        "match_message_regex": None,
        "match_logger": None,
        "fingerprint_template": "openrouter.{exc_type}.{model}",
        "downgrade_to": None,
    })
    fp_unavailable = CompiledRule.from_row({
        "id": "seed-fp-unavail",
        "kind": "fingerprint",
        "match_exception_type": "ModelUnavailableError",
        "match_message_regex": None,
        "match_logger": None,
        "fingerprint_template": "openrouter.{exc_type}.{model}",
        "downgrade_to": None,
    })
    downgrade_rule = CompiledRule.from_row({
        "id": "seed-downgrade",
        "kind": "downgrade",
        "match_exception_type": "ModelHTTPError",
        "match_message_regex": r"\b(402|403|503)\b",
        "match_logger": None,
        "fingerprint_template": None,
        "downgrade_to": "warning",
    })
    assert ignore_rule and fp_rate_limit and fp_unavailable and downgrade_rule
    src._replace_snapshot(Snapshot(
        ignore=(ignore_rule,),
        fingerprint=(fp_rate_limit, fp_unavailable),
        downgrade=(downgrade_rule,),
        loaded_at_monotonic=1.0,
    ))
    yield
    reset_for_tests()


class _FakeError(Exception):
    pass


class RateLimitError(Exception):
    pass


class ModelUnavailableError(Exception):
    pass


class ModelHTTPError(Exception):
    """Stand-in that mirrors pydantic-ai's str format for status_code tests."""

    def __init__(self, status_code: int, body: str = "mock"):
        super().__init__(f"status_code: {status_code}, model_name: test, body: {body}")
        self.status_code = status_code


def _hint(exc: BaseException) -> dict:
    return {"exc_info": (type(exc), exc, None)}


def test_ignore_rule_drops_key_limit_exceeded() -> None:
    exc = _FakeError("Key limit exceeded (total limit).")
    assert _ops_before_send({"level": "error"}, _hint(exc)) is None


def test_ignore_rule_drops_insufficient_quota() -> None:
    exc = _FakeError("openai: insufficient_quota")
    assert _ops_before_send({"level": "error"}, _hint(exc)) is None


def test_unrelated_error_passes_through() -> None:
    exc = _FakeError("Something else went wrong")
    event = {"level": "error", "tags": {}}
    assert _ops_before_send(event, _hint(exc)) is event


def test_missing_exc_info_passes_event_through() -> None:
    event = {"level": "error"}
    # Empty snapshot also passes through but here the cache is seeded;
    # the rules require an exception to fire, so the event stays unchanged.
    assert _ops_before_send(event, {}) is event


def test_rate_limit_fingerprinted_by_model() -> None:
    exc = RateLimitError("rate limited")
    event = {
        "level": "error",
        "tags": [{"key": "model", "value": "deepseek/deepseek-chat"}],
    }
    result = _ops_before_send(event, _hint(exc))
    assert result is not None
    assert result["fingerprint"] == [
        "openrouter",
        "RateLimitError",
        "deepseek/deepseek-chat",
    ]


def test_model_unavailable_fingerprinted_by_model() -> None:
    exc = ModelUnavailableError("down")
    event = {"level": "error", "tags": {"model": "anthropic/claude-sonnet-4-6"}}
    result = _ops_before_send(event, _hint(exc))
    assert result is not None
    assert result["fingerprint"] == [
        "openrouter",
        "ModelUnavailableError",
        "anthropic/claude-sonnet-4-6",
    ]


def test_fingerprint_uses_unknown_sentinel_without_model_tag() -> None:
    exc = RateLimitError("rate limited")
    result = _ops_before_send({"level": "error", "tags": []}, _hint(exc))
    assert result is not None
    assert result["fingerprint"] == ["openrouter", "RateLimitError", "unknown"]


def test_403_downgraded_to_warning() -> None:
    exc = ModelHTTPError(403, "key limit")
    result = _ops_before_send({"level": "error"}, _hint(exc))
    assert result is not None
    assert result["level"] == "warning"


def test_402_downgraded_to_warning() -> None:
    exc = ModelHTTPError(402, "payment required")
    result = _ops_before_send({"level": "error"}, _hint(exc))
    assert result is not None
    assert result["level"] == "warning"


def test_503_downgraded_to_warning() -> None:
    exc = ModelHTTPError(503, "unavailable")
    result = _ops_before_send({"level": "error"}, _hint(exc))
    assert result is not None
    assert result["level"] == "warning"


def test_500_not_downgraded() -> None:
    exc = ModelHTTPError(500, "server error")
    result = _ops_before_send({"level": "error"}, _hint(exc))
    assert result is not None
    assert result["level"] == "error"
