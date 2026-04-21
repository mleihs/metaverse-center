"""Tests for CircuitBreakerService — in-process circuit breaker state machine.

Covers the 6 canonical scenarios from the Bureau-Ops plan §10:
    1. Open on threshold
    2. Half-open transition after timeout
    3. Re-open on half-open failure (exponential backoff)
    4. Reset clears state
    5. Exponential backoff capped at max_open_duration
    6. Success in closed state clears old failures
"""

from __future__ import annotations

import time

import pytest

from backend.services.circuit_breaker_service import (
    CircuitBreakerService,
    CircuitOpenError,
)

SCOPE = "provider"
KEY = "openrouter"


def _make_cb(**overrides) -> CircuitBreakerService:
    defaults = {
        "failure_threshold": 3,
        "window_seconds": 10.0,
        "open_duration": 1.0,
        "max_open_duration": 5.0,
    }
    defaults.update(overrides)
    return CircuitBreakerService(**defaults)


class TestThresholdAndStateMachine:
    def test_closed_allows_calls(self):
        cb = _make_cb()
        cb.check(SCOPE, KEY)  # no raise

    def test_opens_on_threshold(self):
        cb = _make_cb(failure_threshold=3)
        cb.record_failure(SCOPE, KEY)
        cb.record_failure(SCOPE, KEY)
        assert cb.get_state(SCOPE, KEY)["state"] == "closed"
        cb.record_failure(SCOPE, KEY)
        assert cb.get_state(SCOPE, KEY)["state"] == "open"

    def test_open_blocks_calls(self):
        cb = _make_cb(failure_threshold=2)
        cb.record_failure(SCOPE, KEY)
        cb.record_failure(SCOPE, KEY)
        with pytest.raises(CircuitOpenError):
            cb.check(SCOPE, KEY)

    def test_half_open_after_timeout(self):
        cb = _make_cb(failure_threshold=2, open_duration=0.05)
        cb.record_failure(SCOPE, KEY)
        cb.record_failure(SCOPE, KEY)
        time.sleep(0.08)
        cb.check(SCOPE, KEY)  # no raise — transitions to half_open
        assert cb.get_state(SCOPE, KEY)["state"] == "half_open"

    def test_half_open_failure_reopens_with_backoff(self):
        cb = _make_cb(failure_threshold=2, open_duration=0.05, max_open_duration=10.0)
        cb.record_failure(SCOPE, KEY)
        cb.record_failure(SCOPE, KEY)
        first = cb.get_state(SCOPE, KEY)["opens_until_s"]
        time.sleep(0.08)
        cb.check(SCOPE, KEY)  # half_open
        cb.record_failure(SCOPE, KEY)  # re-open with backoff ×2
        second = cb.get_state(SCOPE, KEY)["opens_until_s"]
        assert second > first, "backoff should double on re-open"
        assert cb.get_state(SCOPE, KEY)["consecutive_opens"] == 2

    def test_half_open_success_closes(self):
        cb = _make_cb(failure_threshold=2, open_duration=0.05)
        cb.record_failure(SCOPE, KEY)
        cb.record_failure(SCOPE, KEY)
        time.sleep(0.08)
        cb.check(SCOPE, KEY)  # half_open
        cb.record_success(SCOPE, KEY)
        state = cb.get_state(SCOPE, KEY)
        assert state["state"] == "closed"
        assert state["consecutive_opens"] == 0


class TestReset:
    def test_reset_clears_state(self):
        cb = _make_cb(failure_threshold=2)
        cb.record_failure(SCOPE, KEY)
        cb.record_failure(SCOPE, KEY)
        assert cb.get_state(SCOPE, KEY)["state"] == "open"
        cb.reset(SCOPE, KEY)
        assert cb.get_state(SCOPE, KEY)["state"] == "closed"
        cb.check(SCOPE, KEY)  # no raise


class TestBackoffCap:
    def test_backoff_capped_at_max(self):
        cb = _make_cb(failure_threshold=1, open_duration=1.0, max_open_duration=2.0)
        # 5 consecutive opens: 1, 2, 4, 8, 16 → capped at 2
        for _ in range(5):
            cb.record_failure(SCOPE, KEY)
        opens_until_s = cb.get_state(SCOPE, KEY)["opens_until_s"]
        assert opens_until_s <= 2.1, f"expected cap at 2.0, got {opens_until_s}"


class TestSuccessClearsFailures:
    def test_success_in_closed_clears_window(self):
        cb = _make_cb(failure_threshold=3)
        cb.record_failure(SCOPE, KEY)
        cb.record_failure(SCOPE, KEY)
        cb.record_success(SCOPE, KEY)
        assert cb.get_state(SCOPE, KEY)["failures_in_window"] == 0
        # Should now need 3 fresh failures to trip
        cb.record_failure(SCOPE, KEY)
        cb.record_failure(SCOPE, KEY)
        assert cb.get_state(SCOPE, KEY)["state"] == "closed"


class TestSnapshot:
    def test_snapshot_returns_all_known_scopes(self):
        cb = _make_cb(failure_threshold=2)
        cb.record_failure("provider", "openrouter")
        cb.record_failure("model", "deepseek/deepseek-chat")
        snap = cb.snapshot()
        keys = {(s["scope"], s["scope_key"]) for s in snap}
        assert ("provider", "openrouter") in keys
        assert ("model", "deepseek/deepseek-chat") in keys


class TestPurposeScope:
    def test_independent_scopes_dont_interfere(self):
        cb = _make_cb(failure_threshold=2)
        cb.record_failure("purpose", "heartbeat")
        cb.record_failure("purpose", "heartbeat")
        assert cb.get_state("purpose", "heartbeat")["state"] == "open"
        assert cb.get_state("purpose", "forge")["state"] == "closed"


class TestWindowExpiry:
    def test_old_failures_outside_window_dont_count(self):
        cb = _make_cb(failure_threshold=3, window_seconds=0.05)
        cb.record_failure(SCOPE, KEY)
        cb.record_failure(SCOPE, KEY)
        time.sleep(0.08)  # window expires
        cb.record_failure(SCOPE, KEY)
        # Should still be closed — only 1 failure in current window
        assert cb.get_state(SCOPE, KEY)["state"] == "closed"
