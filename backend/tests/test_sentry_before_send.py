"""Tests for the Bureau-Ops P0 Sentry before_send hook.

Verifies the three hardcoded dedup rules:
    1. Drop "Key limit exceeded" / "insufficient_quota" events
    2. Fingerprint RateLimitError / ModelUnavailableError by (type, model)
    3. Downgrade pydantic-ai ModelHTTPError 402/403/503 to warning
"""

from __future__ import annotations

from backend.app import _ops_before_send


class _FakeError(Exception):
    pass


class RateLimitError(Exception):
    pass


class ModelUnavailableError(Exception):
    pass


class ModelHTTPError(Exception):
    def __init__(self, status_code: int, message: str = "mock"):
        super().__init__(message)
        self.status_code = status_code


def _make_hint(exc: BaseException) -> dict:
    return {"exc_info": (type(exc), exc, None)}


class TestIgnoreRule:
    def test_key_limit_exceeded_dropped(self):
        exc = _FakeError("Key limit exceeded (total limit).")
        event = {"level": "error"}
        assert _ops_before_send(event, _make_hint(exc)) is None

    def test_insufficient_quota_dropped(self):
        exc = _FakeError("openai: insufficient_quota")
        event = {"level": "error"}
        assert _ops_before_send(event, _make_hint(exc)) is None

    def test_normal_error_passes_through(self):
        exc = _FakeError("Something else went wrong")
        event = {"level": "error", "tags": {}}
        result = _ops_before_send(event, _make_hint(exc))
        assert result is event

    def test_no_exc_info_passes_through(self):
        event = {"level": "error"}
        assert _ops_before_send(event, {}) is event


class TestFingerprintRule:
    def test_rate_limit_fingerprinted_by_model(self):
        exc = RateLimitError("rate limited")
        event = {
            "level": "error",
            "tags": [{"key": "model", "value": "deepseek/deepseek-chat"}],
        }
        result = _ops_before_send(event, _make_hint(exc))
        assert result is not None
        assert result["fingerprint"] == ["openrouter", "RateLimitError", "deepseek/deepseek-chat"]

    def test_model_unavailable_fingerprinted(self):
        exc = ModelUnavailableError("down")
        event = {"level": "error", "tags": {"model": "anthropic/claude-sonnet-4-6"}}
        result = _ops_before_send(event, _make_hint(exc))
        assert result["fingerprint"] == [
            "openrouter",
            "ModelUnavailableError",
            "anthropic/claude-sonnet-4-6",
        ]

    def test_fingerprint_unknown_when_model_tag_absent(self):
        exc = RateLimitError("rate limited")
        event = {"level": "error", "tags": []}
        result = _ops_before_send(event, _make_hint(exc))
        assert result["fingerprint"] == ["openrouter", "RateLimitError", "unknown"]


class TestDowngradeRule:
    def test_403_downgraded_to_warning(self):
        exc = ModelHTTPError(403, "key limit")
        event = {"level": "error"}
        result = _ops_before_send(event, _make_hint(exc))
        assert result["level"] == "warning"

    def test_402_downgraded_to_warning(self):
        exc = ModelHTTPError(402, "payment required")
        event = {"level": "error"}
        result = _ops_before_send(event, _make_hint(exc))
        assert result["level"] == "warning"

    def test_503_downgraded_to_warning(self):
        exc = ModelHTTPError(503, "unavailable")
        event = {"level": "error"}
        result = _ops_before_send(event, _make_hint(exc))
        assert result["level"] == "warning"

    def test_500_not_downgraded(self):
        exc = ModelHTTPError(500, "server error")
        event = {"level": "error"}
        result = _ops_before_send(event, _make_hint(exc))
        assert result["level"] == "error"
