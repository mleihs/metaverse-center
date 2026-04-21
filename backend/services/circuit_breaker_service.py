"""In-process circuit breaker for OpenRouter and other external LLM calls.

Prevents retry-storms when a provider is persistently failing: after N
consecutive failures within a time window, the circuit opens, and all
subsequent calls fail fast with ``CircuitOpenError`` instead of hitting
the network. Half-open state lets a single probe through to test recovery.

State progression:
    closed  -- success --> closed
    closed  -- N failures in window --> open
    open    -- timeout elapsed --> half_open
    half_open -- success --> closed (counters cleared)
    half_open -- failure --> open (backoff doubles, capped)

State is in-process only (ADR-style decision AD-1 in bureau-ops plan).
Each FastAPI worker has its own view — that is intentional: a worker-local
breaker prevents the retry cascade *inside a single request*, which is
the hot path. Cross-worker coordination would add Redis dependency for
marginal benefit.

Admin-triggered "killed" state is persisted separately in the
``ai_circuit_state`` table (Phase 1+); this module owns only the
automatic state machine. ``check()`` does not look at the DB.
"""

from __future__ import annotations

import logging
import time
from collections import deque
from dataclasses import dataclass, field
from threading import Lock
from typing import Literal

logger = logging.getLogger(__name__)

CircuitState = Literal["closed", "half_open", "open"]

# Defaults tuned for OpenRouter: 5 failures in 60s opens for 5min, then probe.
_DEFAULT_FAILURE_THRESHOLD = 5
_DEFAULT_WINDOW_SECONDS = 60.0
_DEFAULT_OPEN_DURATION = 300.0  # 5 min
_DEFAULT_MAX_OPEN_DURATION = 3600.0  # 1h cap on exponential backoff
_DEFAULT_MAX_COUNTERS = 1000  # LRU bound


class CircuitOpenError(Exception):
    """Raised by ``check()`` when the circuit is open and the call must fail fast."""

    def __init__(self, scope: str, scope_key: str, opens_until: float):
        self.scope = scope
        self.scope_key = scope_key
        self.opens_until = opens_until
        remaining_s = max(0.0, opens_until - time.monotonic())
        super().__init__(
            f"Circuit open for {scope}:{scope_key} — retry in {remaining_s:.0f}s",
        )


@dataclass
class _Counter:
    """Per (scope, scope_key) failure window + state."""

    state: CircuitState = "closed"
    failures: deque = field(default_factory=deque)
    opens_until: float = 0.0
    consecutive_opens: int = 0
    last_touched: float = field(default_factory=time.monotonic)


class CircuitBreakerService:
    """Process-wide circuit breaker registry. Thread-safe."""

    def __init__(
        self,
        *,
        failure_threshold: int = _DEFAULT_FAILURE_THRESHOLD,
        window_seconds: float = _DEFAULT_WINDOW_SECONDS,
        open_duration: float = _DEFAULT_OPEN_DURATION,
        max_open_duration: float = _DEFAULT_MAX_OPEN_DURATION,
        max_counters: int = _DEFAULT_MAX_COUNTERS,
    ) -> None:
        self._failure_threshold = failure_threshold
        self._window_seconds = window_seconds
        self._open_duration = open_duration
        self._max_open_duration = max_open_duration
        self._max_counters = max_counters
        self._counters: dict[tuple[str, str], _Counter] = {}
        self._lock = Lock()

    def _key(self, scope: str, scope_key: str) -> tuple[str, str]:
        return (scope, scope_key)

    def _get(self, scope: str, scope_key: str) -> _Counter:
        key = self._key(scope, scope_key)
        counter = self._counters.get(key)
        if counter is None:
            if len(self._counters) >= self._max_counters:
                # Evict the least-recently-touched closed counter to bound memory.
                evict_key = min(
                    (k for k, c in self._counters.items() if c.state == "closed"),
                    key=lambda k: self._counters[k].last_touched,
                    default=None,
                )
                if evict_key is not None:
                    del self._counters[evict_key]
            counter = _Counter()
            self._counters[key] = counter
        counter.last_touched = time.monotonic()
        return counter

    def check(self, scope: str, scope_key: str) -> None:
        """Raise ``CircuitOpenError`` if the circuit is open.

        Call before every outbound request. Transitions ``open -> half_open``
        automatically when the open-duration has elapsed.
        """
        now = time.monotonic()
        with self._lock:
            counter = self._get(scope, scope_key)
            if counter.state == "open":
                if now >= counter.opens_until:
                    counter.state = "half_open"
                    logger.info(
                        "Circuit half-open (probe allowed)",
                        extra={"scope": scope, "scope_key": scope_key},
                    )
                else:
                    raise CircuitOpenError(scope, scope_key, counter.opens_until)

    def record_failure(
        self,
        scope: str,
        scope_key: str,
        *,
        exception_type: str = "unknown",
    ) -> None:
        """Record a failed call. May transition the circuit to ``open``."""
        now = time.monotonic()
        with self._lock:
            counter = self._get(scope, scope_key)
            cutoff = now - self._window_seconds
            while counter.failures and counter.failures[0] < cutoff:
                counter.failures.popleft()
            counter.failures.append(now)

            # Half-open failure → re-open with exponential backoff
            if counter.state == "half_open":
                counter.consecutive_opens += 1
                open_for = min(
                    self._open_duration * (2 ** (counter.consecutive_opens - 1)),
                    self._max_open_duration,
                )
                counter.state = "open"
                counter.opens_until = now + open_for
                logger.warning(
                    "Circuit re-opened (half-open probe failed)",
                    extra={
                        "scope": scope,
                        "scope_key": scope_key,
                        "exception_type": exception_type,
                        "open_for_s": round(open_for, 1),
                        "consecutive_opens": counter.consecutive_opens,
                    },
                )
                return

            # Closed → open when threshold hit inside window
            if counter.state == "closed" and len(counter.failures) >= self._failure_threshold:
                counter.consecutive_opens += 1
                open_for = min(
                    self._open_duration * (2 ** (counter.consecutive_opens - 1)),
                    self._max_open_duration,
                )
                counter.state = "open"
                counter.opens_until = now + open_for
                logger.warning(
                    "Circuit opened (threshold reached)",
                    extra={
                        "scope": scope,
                        "scope_key": scope_key,
                        "exception_type": exception_type,
                        "failures_in_window": len(counter.failures),
                        "open_for_s": round(open_for, 1),
                    },
                )

    def record_success(self, scope: str, scope_key: str) -> None:
        """Record a successful call. Transitions ``half_open -> closed``."""
        with self._lock:
            counter = self._get(scope, scope_key)
            if counter.state == "half_open":
                counter.state = "closed"
                counter.failures.clear()
                counter.consecutive_opens = 0
                logger.info(
                    "Circuit closed (half-open probe succeeded)",
                    extra={"scope": scope, "scope_key": scope_key},
                )
            elif counter.state == "closed":
                counter.failures.clear()

    def get_state(self, scope: str, scope_key: str) -> dict:
        """Return the current state + diagnostics for UI/API exposure."""
        now = time.monotonic()
        with self._lock:
            counter = self._counters.get(self._key(scope, scope_key))
            if counter is None:
                return {
                    "state": "closed",
                    "failures_in_window": 0,
                    "opens_until_s": 0.0,
                    "consecutive_opens": 0,
                }
            cutoff = now - self._window_seconds
            active = sum(1 for t in counter.failures if t >= cutoff)
            opens_until_s = (
                max(0.0, counter.opens_until - now) if counter.state == "open" else 0.0
            )
            return {
                "state": counter.state,
                "failures_in_window": active,
                "opens_until_s": round(opens_until_s, 1),
                "consecutive_opens": counter.consecutive_opens,
            }

    def snapshot(self) -> list[dict]:
        """Return states for all known (scope, scope_key) tuples — admin UI feed."""
        now = time.monotonic()
        with self._lock:
            out: list[dict] = []
            cutoff = now - self._window_seconds
            for (scope, scope_key), counter in self._counters.items():
                active = sum(1 for t in counter.failures if t >= cutoff)
                opens_until_s = (
                    max(0.0, counter.opens_until - now) if counter.state == "open" else 0.0
                )
                out.append(
                    {
                        "scope": scope,
                        "scope_key": scope_key,
                        "state": counter.state,
                        "failures_in_window": active,
                        "opens_until_s": round(opens_until_s, 1),
                        "consecutive_opens": counter.consecutive_opens,
                    },
                )
            return out

    def reset(self, scope: str, scope_key: str) -> None:
        """Admin hook: force-reset a breaker to closed state."""
        with self._lock:
            counter = self._get(scope, scope_key)
            counter.state = "closed"
            counter.failures.clear()
            counter.opens_until = 0.0
            counter.consecutive_opens = 0
            logger.info(
                "Circuit manually reset to closed",
                extra={"scope": scope, "scope_key": scope_key},
            )

    def force_open(self, scope: str, scope_key: str, *, open_for_s: float) -> None:
        """Admin hook: force-open a breaker for ``open_for_s`` seconds.

        Used by the Bureau Ops kill-switch (AD-5). Unlike an automatic
        open transition, this does not count as a "consecutive open" so the
        next natural open after revert returns to the baseline backoff.
        The DB row in ``ai_circuit_state`` is the source of truth for
        durability; this call just mirrors the kill into in-process state
        so ``check()`` fails fast without a DB hit.
        """
        with self._lock:
            counter = self._get(scope, scope_key)
            counter.state = "open"
            counter.opens_until = time.monotonic() + max(open_for_s, 0.0)
            counter.failures.clear()
            logger.info(
                "Circuit force-opened (admin kill)",
                extra={
                    "scope": scope,
                    "scope_key": scope_key,
                    "open_for_s": round(open_for_s, 1),
                },
            )


# Process-wide singleton. Import this from callers.
circuit_breaker = CircuitBreakerService()
