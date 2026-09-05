"""Integration tests for race conditions in game mechanics.

These tests document and verify concurrent behavior using real threads
(not asyncio.gather, which serializes sync Supabase calls).
"""

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor

import pytest

from backend.config import settings
from backend.services.cycle_resolution_service import CycleResolutionService
from backend.tests.integration.conftest import EpochFixture, requires_supabase
from supabase import create_async_client

pytestmark = [requires_supabase, pytest.mark.gamedb]


async def _fresh_admin_client():
    """Create a new service-role client bound to the *current* event loop.

    Migration 258 (ADR-006 part 2) routes ``CycleResolutionService``'s RP-grant
    chokepoints through the process-global ``get_admin_supabase_client()`` cache
    instead of the caller-supplied client. That cache holds ONE client bound to
    the event loop that first populated it (see ``supabase_admin_cache`` — "NOT
    thread-safe / event-loop affinity"). This test deliberately drives
    ``resolve_cycle`` from two threads, each running its own ``asyncio.run``
    loop; sharing a single cached client across both loops wedges the second
    thread's loop in its selector forever. Routing the getter to this per-call
    factory hands each thread a client bound to its own loop — preserving real
    concurrency while honouring the cache's documented "a thread must construct
    its own client inside the thread's loop" contract.
    """
    return await create_async_client(settings.supabase_url, settings.supabase_service_role_key)


def _resolve_in_thread(epoch_id, barrier):
    """Run resolve_cycle in a separate thread with its own async Supabase client.

    THE BARRIER IS THE TEST.

    Without it this test asserted "exactly one increment" while doing nothing
    to make the two calls overlap. Building the async client is the expensive
    part -- an HTTP client, a connection, a fresh event loop -- and whichever
    thread wins the pool can finish its entire resolve before the other has
    read `current_cycle` at all. Two SEQUENTIAL resolves then move the epoch
    3 -> 4 -> 5 legitimately, the optimistic lock never gets a chance to
    refuse anything, and the assertion fails with `got 5` on a codebase that
    is perfectly correct.

    That is what happened in CI on 04.09.2026: green for months on fast
    runners where the threads happened to overlap, red under load. A test
    whose verdict depends on which thread wins a race it does not control
    proves nothing in EITHER direction -- a passing run only meant the
    scheduler cooperated.

    So: build the client first, then meet at the barrier, then resolve. Both
    threads are now inside the read-modify-write window at the same moment,
    which is the only situation the optimistic lock exists for. The timeout
    turns a thread that never arrives into a loud failure instead of a CI job
    that hangs until it is killed.
    """

    async def _run():
        client = await create_async_client(settings.supabase_url, settings.supabase_service_role_key)
        barrier.wait(timeout=30)
        return await CycleResolutionService.resolve_cycle(client, epoch_id)

    return asyncio.run(_run())


class TestConcurrentCycleResolve:
    def test_concurrent_resolve_does_not_double_increment(self, admin_client, epoch_factory, monkeypatch):
        """Two truly concurrent resolve_cycle calls must not double-increment.

        Uses separate threads + separate Supabase clients for real concurrency.
        The optimistic lock (WHERE current_cycle = expected) should cause
        exactly one call to succeed and the other to fail with 409.
        """
        # Migration 258 routes resolve_cycle's RP-grant through the process-global
        # admin-client cache. Point that getter at a per-loop factory so each
        # worker thread builds a client on its own event loop — otherwise the
        # second thread inherits the first thread's loop-bound cached client and
        # hangs forever in its selector. See _fresh_admin_client.
        monkeypatch.setattr(
            "backend.services.cycle_resolution_service.get_admin_supabase_client",
            _fresh_admin_client,
        )

        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=10, rp_cap=40)

        barrier = threading.Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [
                pool.submit(_resolve_in_thread, epoch.epoch_id, barrier),
                pool.submit(_resolve_in_thread, epoch.epoch_id, barrier),
            ]
            results = []
            for f in futures:
                try:
                    results.append(f.result())
                except Exception as exc:
                    results.append(exc)

        # At least one should succeed
        successes = [r for r in results if not isinstance(r, Exception)]
        assert len(successes) >= 1, f"Both calls failed: {results}"

        # Check final cycle in DB
        row = (
            admin_client.table("game_epochs").select("current_cycle").eq("id", str(epoch.epoch_id)).single().execute()
        ).data

        # Optimistic lock: only one increment should apply
        final_cycle = row["current_cycle"]
        assert final_cycle == 4, (
            f"Expected exactly 1 increment (3->4), got {final_cycle}. "
            "Optimistic lock on current_cycle should prevent double-increment."
        )
