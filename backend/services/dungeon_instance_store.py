"""In-memory store for active dungeon instances with per-instance locking.

Encapsulates the module-level global dicts that were previously scattered
across dungeon_engine_service.py:
  - _active_instances   → store.get / store.put / store.remove
  - _instance_last_activity → store.touch (auto-called by get/put)
  - _combat_timers      → store.set_combat_timer / store.pop_combat_timer
  - _distribution_timers → store.set_distribution_timer / store.pop_distribution_timer
  - _instance_locks     → store.lock (per-run asyncio.Lock)

Every public DungeonEngineService entry point wraps its work in:

    async with store.lock(run_id):
        instance = store.get(run_id)
        ...
        await cls._checkpoint(supabase, instance)

This prevents concurrent requests (user submission vs. timer callback)
from racing on the same instance.

Design decisions:
  C1 — Per-instance asyncio.Lock prevents concurrent state mutation.
  C3 — Lock + phase check makes duplicate combat resolution impossible.
  C4 — Dirty flag on checkpoint failure, re-checkpoint enforced before
        next mutation, eviction if re-checkpoint also fails.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    from backend.models.resonance_dungeon import DungeonInstance

logger = logging.getLogger(__name__)


class InstanceStore:
    """Thread-safe in-memory store for active dungeon instances.

    Single-threaded (asyncio) so dict access is safe, but async entry
    points need per-instance locks to prevent interleaved coroutine
    execution within the same run.
    """

    def __init__(self) -> None:
        self._instances: dict[str, DungeonInstance] = {}
        self._last_activity: dict[str, float] = {}
        self._combat_timers: dict[str, asyncio.Task] = {}
        self._distribution_timers: dict[str, asyncio.Task] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._dirty: set[str] = set()

    # ── Lock ───────────────────────────────────────────────────────────────

    def lock(self, run_id: str | UUID) -> asyncio.Lock:
        """Get or create an asyncio.Lock for a specific run_id.

        Usage::

            async with store.lock(run_id):
                instance = store.get(run_id)
                ...
        """
        key = str(run_id)
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    # ── Instance CRUD ──────────────────────────────────────────────────────

    def get(self, run_id: str | UUID) -> DungeonInstance | None:
        """Get an active instance (does NOT touch activity timestamp)."""
        return self._instances.get(str(run_id))

    def put(self, run_id: str | UUID, instance: DungeonInstance) -> None:
        """Store an instance and update its activity timestamp."""
        key = str(run_id)
        self._instances[key] = instance
        self._last_activity[key] = time.monotonic()

    def touch(self, run_id: str | UUID) -> None:
        """Update activity timestamp without modifying the instance."""
        self._last_activity[str(run_id)] = time.monotonic()

    def remove(self, run_id: str | UUID) -> DungeonInstance | None:
        """Remove an instance and all associated timers/locks/dirty flags."""
        key = str(run_id)
        self._last_activity.pop(key, None)
        self._dirty.discard(key)
        # Cancel timers
        for timer in (
            self._combat_timers.pop(key, None),
            self._distribution_timers.pop(key, None),
        ):
            if timer and not timer.done():
                timer.cancel()
        # Keep lock alive briefly — a concurrent coroutine may be awaiting it.
        # It will be GC'd once no references remain.
        self._locks.pop(key, None)
        return self._instances.pop(key, None)

    # ── Dirty Flag (C4) ───────────────────────────────────────────────────

    def mark_dirty(self, run_id: str | UUID) -> None:
        """Mark an instance as having un-checkpointed state."""
        self._dirty.add(str(run_id))

    def clear_dirty(self, run_id: str | UUID) -> None:
        """Clear dirty flag after successful checkpoint."""
        self._dirty.discard(str(run_id))

    def is_dirty(self, run_id: str | UUID) -> bool:
        """Check if instance has un-checkpointed state."""
        return str(run_id) in self._dirty

    # ── Combat Timers ──────────────────────────────────────────────────────

    def set_combat_timer(self, run_id: str | UUID, task: asyncio.Task) -> None:
        """Set combat timer, cancelling any existing one."""
        key = str(run_id)
        existing = self._combat_timers.pop(key, None)
        if existing and not existing.done():
            existing.cancel()
        self._combat_timers[key] = task

    def pop_combat_timer(self, run_id: str | UUID) -> asyncio.Task | None:
        """Atomically pop combat timer (returns None if already popped)."""
        return self._combat_timers.pop(str(run_id), None)

    # ── Distribution Timers ────────────────────────────────────────────────

    def set_distribution_timer(self, run_id: str | UUID, task: asyncio.Task) -> None:
        """Set distribution timer, cancelling any existing one."""
        key = str(run_id)
        existing = self._distribution_timers.pop(key, None)
        if existing and not existing.done():
            existing.cancel()
        self._distribution_timers[key] = task

    def pop_distribution_timer(self, run_id: str | UUID) -> asyncio.Task | None:
        """Atomically pop distribution timer."""
        return self._distribution_timers.pop(str(run_id), None)

    # ── Cleanup ────────────────────────────────────────────────────────────

    def clear(self) -> None:
        """Remove all instances and cancel all timers. For test teardown only."""
        for key in list(self._instances):
            self.remove(key)
        self._instances.clear()
        self._last_activity.clear()
        self._locks.clear()
        self._dirty.clear()

    def evict_stale(self, ttl_seconds: int) -> int:
        """Remove instances inactive longer than ttl_seconds.

        Returns the number of evicted instances.
        """
        now = time.monotonic()
        stale = [rid for rid, ts in self._last_activity.items() if now - ts > ttl_seconds]
        for run_id in stale:
            self.remove(run_id)
            logger.info(
                "Evicted stale dungeon instance",
                extra={"run_id": run_id, "reason": "ttl_expired"},
            )
        return len(stale)


# Module-level singleton — shared across DungeonEngineService and cleanup loop
store = InstanceStore()
