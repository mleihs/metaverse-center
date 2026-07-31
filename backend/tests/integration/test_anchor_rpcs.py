"""Integration tests for migration 271 (atomic anchor join/leave RPCs).

P1-2 of the 2026-07-12 deep audit: ``collaborative_anchors`` join/leave was a
Python read-modify-write on the ``anchor_simulation_ids UUID[]`` snapshot with
no compare-and-swap, running on a user-JWT client against a table that never
had an authenticated write policy. Migration 271 replaces both writes with
service-role-only RPCs (``fn_anchor_join`` / ``fn_anchor_leave``) whose
membership guard, dedup and dissolve decisions all live in ONE statement.

These tests assert, against a live Supabase:

- the full outcome matrix of both RPCs through the service layer
  (join / duplicate join / join on dissolved / leave / duplicate leave /
  dissolve-on-last-leave / missing anchor);
- that a burst of concurrent joins loses no participant (the ADR-007
  lost-update the old Python path exhibited);
- that the RPC surface is closed to anon (SECDEF/RPC hygiene, cf. 257/258).

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

import asyncio
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException

from backend.config import settings
from backend.services.anchor_service import AnchorService
from backend.tests.integration.conftest import requires_supabase

pytestmark = [requires_supabase]


@pytest.fixture()
def anchor_factory(admin_client):
    """Create throwaway anchors; delete them after the test."""
    created: list[str] = []

    def _make(sim_ids: list[str] | None = None, status: str = "forming") -> str:
        anchor_id = str(uuid4())
        admin_client.table("collaborative_anchors").insert(
            {
                "id": anchor_id,
                "name": f"test-anchor-{anchor_id[:8]}",
                "resonance_signature": "test-signature",
                "anchor_simulation_ids": sim_ids or [str(uuid4())],
                "status": status,
            }
        ).execute()
        created.append(anchor_id)
        return anchor_id

    yield _make

    for anchor_id in created:
        admin_client.table("collaborative_anchors").delete().eq("id", anchor_id).execute()


class TestAnchorJoinLeaveOutcomes:
    """Outcome matrix of fn_anchor_join / fn_anchor_leave via the service."""

    async def test_join_appends_once_and_duplicate_conflicts(
        self, async_admin_client, anchor_factory
    ):
        founder = str(uuid4())
        joiner = uuid4()
        anchor_id = anchor_factory(sim_ids=[founder])

        row = await AnchorService.join_anchor(async_admin_client, anchor_id, joiner, uuid4())
        assert row["anchor_simulation_ids"] == [founder, str(joiner)]
        assert row["status"] == "forming"

        with pytest.raises(HTTPException) as exc:
            await AnchorService.join_anchor(async_admin_client, anchor_id, joiner, uuid4())
        assert exc.value.status_code == 409

    async def test_join_missing_and_dissolved_anchor_404(
        self, async_admin_client, anchor_factory
    ):
        with pytest.raises(HTTPException) as exc:
            await AnchorService.join_anchor(async_admin_client, uuid4(), uuid4(), uuid4())
        assert exc.value.status_code == 404

        dissolved = anchor_factory(status="dissolved")
        with pytest.raises(HTTPException) as exc:
            await AnchorService.join_anchor(async_admin_client, dissolved, uuid4(), uuid4())
        assert exc.value.status_code == 404

    async def test_leave_removes_and_last_leave_dissolves(
        self, async_admin_client, anchor_factory
    ):
        sim_a, sim_b = uuid4(), uuid4()
        anchor_id = anchor_factory(sim_ids=[str(sim_a), str(sim_b)], status="active")

        row = await AnchorService.leave_anchor(async_admin_client, anchor_id, sim_a)
        assert row["anchor_simulation_ids"] == [str(sim_b)]
        assert row["status"] == "active"

        # Leaving twice: the membership guard is in the UPDATE's WHERE clause.
        with pytest.raises(HTTPException) as exc:
            await AnchorService.leave_anchor(async_admin_client, anchor_id, sim_a)
        assert exc.value.status_code == 400

        row = await AnchorService.leave_anchor(async_admin_client, anchor_id, sim_b)
        assert row["anchor_simulation_ids"] == []
        assert row["status"] == "dissolved"

    async def test_leave_missing_anchor_404(self, async_admin_client):
        with pytest.raises(HTTPException) as exc:
            await AnchorService.leave_anchor(async_admin_client, uuid4(), uuid4())
        assert exc.value.status_code == 404


class TestAnchorJoinConcurrency:
    """The lost-update the old read-append-write path exhibited (ADR-007)."""

    async def test_concurrent_joins_lose_no_participant(
        self, async_admin_client, anchor_factory
    ):
        founder = str(uuid4())
        anchor_id = anchor_factory(sim_ids=[founder])
        joiners = [uuid4() for _ in range(8)]

        results = await asyncio.gather(
            *(
                AnchorService.join_anchor(async_admin_client, anchor_id, sim_id, uuid4())
                for sim_id in joiners
            ),
            return_exceptions=True,
        )
        errors = [r for r in results if isinstance(r, BaseException)]
        assert not errors, f"concurrent joins failed: {errors}"

        resp = await (
            async_admin_client.table("collaborative_anchors")
            .select("anchor_simulation_ids")
            .eq("id", anchor_id)
            .execute()
        )
        member_ids = set(resp.data[0]["anchor_simulation_ids"])
        assert member_ids == {founder, *(str(s) for s in joiners)}, (
            "a concurrent join was lost — the RPC must serialize on the row"
        )


class TestAnchorRpcSurface:
    """EXECUTE is service_role-only — anon must not reach the RPCs."""

    @pytest.mark.parametrize("fn", ["fn_anchor_join", "fn_anchor_leave"])
    def test_anon_cannot_call_anchor_rpcs(self, fn):
        resp = httpx.post(
            f"{settings.supabase_url}/rest/v1/rpc/{fn}",
            json={"p_anchor_id": str(uuid4()), "p_sim_id": str(uuid4())},
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {settings.supabase_anon_key}",
            },
            timeout=5.0,
        )
        assert resp.status_code in (401, 403, 404), (
            f"anon reached {fn}: {resp.status_code} {resp.text}"
        )
