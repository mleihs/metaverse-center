"""Integration tests for race conditions in game mechanics.

These tests document and verify concurrent behavior using real threads
(not asyncio.gather, which serializes sync Supabase calls).
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor

import pytest

from backend.config import settings
from backend.services.cycle_resolution_service import CycleResolutionService
from backend.tests.integration.conftest import EpochFixture, requires_supabase
from supabase import create_client

pytestmark = [requires_supabase, pytest.mark.gamedb]


def _resolve_in_thread(epoch_id):
    """Run resolve_cycle in a separate thread with its own Supabase client."""
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return asyncio.run(CycleResolutionService.resolve_cycle(client, epoch_id))


class TestConcurrentCycleResolve:
    def test_concurrent_resolve_does_not_double_increment(self, admin_client, epoch_factory):
        """Two truly concurrent resolve_cycle calls must not double-increment.

        Uses separate threads + separate Supabase clients for real concurrency.
        The optimistic lock (WHERE current_cycle = expected) should cause
        exactly one call to succeed and the other to fail with 409.
        """
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=10, rp_cap=40)

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [
                pool.submit(_resolve_in_thread, epoch.epoch_id),
                pool.submit(_resolve_in_thread, epoch.epoch_id),
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
            admin_client.table("game_epochs")
            .select("current_cycle")
            .eq("id", str(epoch.epoch_id))
            .single()
            .execute()
        ).data

        # Optimistic lock: only one increment should apply
        final_cycle = row["current_cycle"]
        assert final_cycle == 4, (
            f"Expected exactly 1 increment (3->4), got {final_cycle}. "
            "Optimistic lock on current_cycle should prevent double-increment."
        )
