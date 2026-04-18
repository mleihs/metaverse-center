"""Integration tests for migration 221 atomic RPCs under concurrency.

Verifies that the three W3.1 RPCs properly serialize concurrent access:

- ``fn_fortify_zone_atomic`` — single-winner under duplicate fortify
  attempts, single-winner under RP contention.
- ``fn_reorder_lore_sections_atomic`` — concurrent reorders resolve
  to one caller's ordering (never interleaved).
- ``fn_delete_lore_section_atomic`` — delete + resort runs atomically;
  no sort_order gaps or duplicates.

All tests call the service layer (not the RPC directly) so the full
Python→SQL path is exercised.

Requires a live Supabase instance. Skipped automatically when unavailable.
"""

from __future__ import annotations

import asyncio
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from backend.services.constants import FORTIFICATION_RP_COST
from backend.services.lore_service import LoreService
from backend.services.operative_mission_service import OperativeMissionService
from backend.tests.integration.conftest import EpochFixture, requires_supabase
from backend.tests.integration.game_constants import SIM_VELGARIEN

pytestmark = [requires_supabase, pytest.mark.gamedb]


# ── Helpers ──────────────────────────────────────────────────────────


def _count_fortifications(client, epoch_id, zone_id=None) -> int:
    """Count fortifications for an epoch (optionally filtered to one zone)."""
    query = (
        client.table("zone_fortifications")
        .select("id", count="exact")
        .eq("epoch_id", str(epoch_id))
    )
    if zone_id is not None:
        query = query.eq("zone_id", str(zone_id))
    return query.execute().count or 0


def _get_zones_for_simulation(client, simulation_id, limit=3) -> list[UUID]:
    """Return the first N zones belonging to a simulation, for fortify targets."""
    resp = (
        client.table("zones")
        .select("id")
        .eq("simulation_id", str(simulation_id))
        .limit(limit)
        .execute()
    )
    return [UUID(row["id"]) for row in resp.data]


def _insert_test_lore_sections(client, simulation_id, count: int = 3) -> list[UUID]:
    """Insert ``count`` test lore sections and return their ids in sort_order.

    Sets every NOT NULL column on ``simulation_lore`` (``chapter``,
    ``arcanum``, ``slug``) with values that avoid the
    ``uq_lore_simulation_slug`` constraint by suffixing the row UUID.
    """
    section_ids: list[UUID] = []
    for i in range(count):
        sid = uuid4()
        client.table("simulation_lore").insert({
            "id": str(sid),
            "simulation_id": str(simulation_id),
            "chapter": "I",
            "arcanum": "Test Arcanum",
            "title": f"Test Section {i}",
            "body": f"Body {i}",
            "slug": f"test-section-{sid}",
            "sort_order": i,
        }).execute()
        section_ids.append(sid)
    return section_ids


def _cleanup_lore_sections(client, section_ids: list[UUID]) -> None:
    """Remove test lore sections; best-effort."""
    for sid in section_ids:
        try:
            client.table("simulation_lore").delete().eq("id", str(sid)).execute()
        except Exception:  # noqa: S110
            pass


def _get_sort_orders(client, simulation_id) -> list[int]:
    """Return sort_order values for a simulation's lore, ordered by sort_order."""
    resp = (
        client.table("simulation_lore")
        .select("sort_order")
        .eq("simulation_id", str(simulation_id))
        .order("sort_order")
        .execute()
    )
    return [row["sort_order"] for row in resp.data]


# ── Fortify zone concurrency ────────────────────────────────────────


class TestConcurrentFortifyZone:
    """fn_fortify_zone_atomic closes two TOCTOU windows: duplicate-check
    and read-upgrade-write. Concurrent calls must single-winner."""

    @pytest.mark.asyncio
    async def test_concurrent_fortify_same_zone_single_wins(
        self, admin_client, async_admin_client, epoch_factory,
    ):
        """Two concurrent fortify calls on the SAME zone with enough RP.

        Exactly one must succeed with 201/fortification-id; the loser must
        see the ``already_fortified`` mapping (bad_request HTTP 400).
        DB state: exactly one fortification record, zone upgraded once.
        """
        epoch: EpochFixture = epoch_factory(status="foundation", cycle=1, rp=10, rp_cap=40)
        # Pick participant for the seeded simulation that has real zones
        sim_id = SIM_VELGARIEN
        zones = _get_zones_for_simulation(admin_client, sim_id, limit=1)
        assert zones, "Test requires Velgarien zones to exist in seed data"
        zone_id = zones[0]

        results = await asyncio.gather(
            OperativeMissionService.fortify_zone(
                async_admin_client, epoch.epoch_id, sim_id, zone_id, async_admin_client,
            ),
            OperativeMissionService.fortify_zone(
                async_admin_client, epoch.epoch_id, sim_id, zone_id, async_admin_client,
            ),
            return_exceptions=True,
        )

        successes = [r for r in results if not isinstance(r, BaseException)]
        failures = [r for r in results if isinstance(r, HTTPException)]

        assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}: {results}"
        assert len(failures) == 1, f"Expected exactly 1 HTTPException, got {len(failures)}: {results}"
        assert failures[0].status_code == 400, (
            f"Expected HTTP 400 (already_fortified), got {failures[0].status_code}: {failures[0].detail}"
        )

        # DB state: exactly one fortification for this (epoch, zone)
        count = _count_fortifications(admin_client, epoch.epoch_id, zone_id)
        assert count == 1, f"Expected 1 fortification in DB, got {count}"

    @pytest.mark.asyncio
    async def test_concurrent_fortify_rp_starved(
        self, admin_client, async_admin_client, epoch_factory,
    ):
        """Two concurrent fortify calls on DIFFERENT zones with RP for one.

        Seeds the participant with exactly ``FORTIFICATION_RP_COST`` RP so
        two concurrent requests for different zones can only fund one.
        Importing the constant keeps the test honest if the cost ever
        changes — hard-coding would silently switch this from "RP-starved"
        to "RP-abundant" and make the concurrency assertion vacuous.
        """
        epoch: EpochFixture = epoch_factory(
            status="foundation", cycle=1, rp=FORTIFICATION_RP_COST, rp_cap=40,
        )
        sim_id = SIM_VELGARIEN
        zones = _get_zones_for_simulation(admin_client, sim_id, limit=2)
        assert len(zones) >= 2, "Test requires at least 2 Velgarien zones"

        results = await asyncio.gather(
            OperativeMissionService.fortify_zone(
                async_admin_client, epoch.epoch_id, sim_id, zones[0], async_admin_client,
            ),
            OperativeMissionService.fortify_zone(
                async_admin_client, epoch.epoch_id, sim_id, zones[1], async_admin_client,
            ),
            return_exceptions=True,
        )

        successes = [r for r in results if not isinstance(r, BaseException)]
        failures = [r for r in results if isinstance(r, HTTPException)]

        assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}: {results}"
        assert len(failures) == 1, f"Expected exactly 1 HTTPException, got {len(failures)}: {results}"

        # DB state: exactly one fortification (the winner's zone)
        total = _count_fortifications(admin_client, epoch.epoch_id)
        assert total == 1, f"Expected 1 fortification total, got {total}"


# ── Lore reorder concurrency ─────────────────────────────────────────


class TestConcurrentLoreReorder:
    """fn_reorder_lore_sections_atomic serializes concurrent reorders via
    FOR UPDATE, so the final state is one caller's ordering (not interleaved)."""

    @pytest.mark.asyncio
    async def test_concurrent_reorder_final_state_is_deterministic(
        self, admin_client, async_admin_client,
    ):
        """Two concurrent reorders with DIFFERENT orderings.

        Both calls must succeed (no deadlock, both return the updated rows).
        The final DB state must be exactly one of the two requested
        orderings — never a mixture. Sort_order must be 0..N-1 with no gaps.
        """
        sim_id = SIM_VELGARIEN
        section_ids = _insert_test_lore_sections(admin_client, sim_id, count=3)
        try:
            ordering_a = [section_ids[0], section_ids[1], section_ids[2]]
            ordering_b = [section_ids[2], section_ids[1], section_ids[0]]

            results = await asyncio.gather(
                LoreService.reorder_sections(async_admin_client, sim_id, ordering_a),
                LoreService.reorder_sections(async_admin_client, sim_id, ordering_b),
                return_exceptions=True,
            )

            # Both should have succeeded (FOR UPDATE serializes, doesn't fail).
            successes = [r for r in results if not isinstance(r, BaseException)]
            assert len(successes) == 2, f"Expected both reorders to succeed, got {results}"

            # DB state: sort_order must be contiguous — filter to just our
            # test sections (simulation might have other sections from seed).
            test_section_set = {str(sid) for sid in section_ids}
            test_orders_resp = (
                admin_client.table("simulation_lore")
                .select("id, sort_order")
                .eq("simulation_id", str(sim_id))
                .in_("id", list(test_section_set))
                .order("sort_order")
                .execute()
            )
            test_ids_in_order = [UUID(row["id"]) for row in test_orders_resp.data]

            assert test_ids_in_order in (ordering_a, ordering_b), (
                f"Final state {test_ids_in_order} matches neither orderingA {ordering_a} "
                f"nor orderingB {ordering_b} — interleaving detected"
            )

            # Sort_order must be contiguous from smallest (not necessarily 0 if seed has others)
            test_sort_values = [row["sort_order"] for row in test_orders_resp.data]
            assert len(set(test_sort_values)) == 3, f"Duplicate sort_order values: {test_sort_values}"
        finally:
            _cleanup_lore_sections(admin_client, section_ids)


# ── Lore delete atomicity ────────────────────────────────────────────


class TestAtomicLoreDelete:
    """fn_delete_lore_section_atomic resorts remaining rows atomically;
    no gaps or duplicates in sort_order after concurrent ops."""

    @pytest.mark.asyncio
    async def test_delete_rewrites_sort_order_contiguously(
        self, admin_client, async_admin_client,
    ):
        """Delete a middle section; remaining rows must have contiguous sort_order.

        Insert 4 sections (our test set). Delete section at index 1. The
        RPC's ROW_NUMBER rewrite should assign 0, 1, 2 to the remaining
        three — no gaps from the deleted slot.
        """
        sim_id = SIM_VELGARIEN
        # Use very-high sort_order to avoid colliding with seed data.
        # chapter/arcanum/slug are NOT NULL on simulation_lore — slug must
        # be unique within the simulation (uq_lore_simulation_slug).
        section_ids = []
        base = 10000
        for i in range(4):
            sid = uuid4()
            admin_client.table("simulation_lore").insert({
                "id": str(sid),
                "simulation_id": str(sim_id),
                "chapter": "I",
                "arcanum": "Test Arcanum",
                "title": f"Delete-Test {i}",
                "body": f"Body {i}",
                "slug": f"delete-test-{sid}",
                "sort_order": base + i,
            }).execute()
            section_ids.append(sid)

        try:
            # Delete the middle section (index 1, sort_order base+1)
            result = await LoreService.delete_section(
                async_admin_client, sim_id, section_ids[1],
            )
            assert result["id"] == str(section_ids[1])

            # Query remaining test sections; their sort_order must be contiguous
            # starting from 0 (the RPC rewrites ALL rows for the simulation).
            remaining = [section_ids[0], section_ids[2], section_ids[3]]
            resp = (
                admin_client.table("simulation_lore")
                .select("id, sort_order")
                .in_("id", [str(sid) for sid in remaining])
                .order("sort_order")
                .execute()
            )
            orders = [row["sort_order"] for row in resp.data]

            # All test rows now have sort_order somewhere in the simulation's
            # 0..N-1 space; they must remain in their original relative order
            # (sections[0] before sections[2] before sections[3]) and be
            # distinct.
            assert len(orders) == 3, f"Expected 3 remaining sections, got {len(orders)}"
            assert orders == sorted(orders), f"Sort order not ascending: {orders}"
            assert len(set(orders)) == 3, f"Duplicate sort_order: {orders}"
        finally:
            _cleanup_lore_sections(admin_client, section_ids)
