"""Integration tests for migration 239 (DRIFT travel_foundation).

Verifies the foundation schema invariants that later P0a packages rely on:

- ``uq_travel_runs_single_active`` — a user may hold at most one run in
  {active, frozen, distress}; a second collides. Terminal-status runs
  (completed / abandoned) are exempt, so a fresh run can open after one
  closes.
- ``travel_audit()`` — writes a ``travel_``-prefixed audit_log row; rejects
  non-travel actions (the namespace lock); reachable only by service_role
  (REVOKEd from authenticated, asserted at the catalog level in the
  migration verification, exercised here via a valid call).

All inserts go through the service_role client (travel_runs is RPC/
service-role-write only under RLS). Requires a live Supabase instance;
skipped automatically when unavailable.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from postgrest.exceptions import APIError

from backend.tests.integration.conftest import requires_supabase

pytestmark = [requires_supabase, pytest.mark.gamedb]


# ── Helpers ──────────────────────────────────────────────────────────


def _insert_run(client, user_id, status="active", **extra):
    """Insert one travel_run via service_role; returns the postgrest response."""
    row = {"user_id": str(user_id), "status": status, "frequency": "memory", **extra}
    return client.table("travel_runs").insert(row).execute()


def _cleanup_runs(client, user_id) -> None:
    """Best-effort removal of a user's travel_runs."""
    try:
        client.table("travel_runs").delete().eq("user_id", str(user_id)).execute()
    except Exception:  # noqa: S110 — best-effort teardown
        pass


# ── Single-active-run partial unique index ───────────────────────────


class TestSingleActiveRun:
    """uq_travel_runs_single_active enforces one live run per user."""

    def test_second_active_run_collides(self, admin_client, test_user_ids):
        """Two active runs for one user → the second violates the index."""
        user_id = test_user_ids[0]
        _cleanup_runs(admin_client, user_id)
        try:
            _insert_run(admin_client, user_id, status="active")
            with pytest.raises(APIError):
                _insert_run(admin_client, user_id, status="active")
        finally:
            _cleanup_runs(admin_client, user_id)

    def test_active_and_distress_collide(self, admin_client, test_user_ids):
        """active + distress are both in the partial predicate → collide."""
        user_id = test_user_ids[1]
        _cleanup_runs(admin_client, user_id)
        try:
            _insert_run(admin_client, user_id, status="active")
            with pytest.raises(APIError):
                _insert_run(admin_client, user_id, status="distress")
        finally:
            _cleanup_runs(admin_client, user_id)

    def test_terminal_runs_exempt(self, admin_client, test_user_ids):
        """completed/abandoned runs are outside the predicate; many may coexist
        alongside exactly one active run."""
        user_id = test_user_ids[2]
        _cleanup_runs(admin_client, user_id)
        try:
            _insert_run(admin_client, user_id, status="completed")
            _insert_run(admin_client, user_id, status="completed")
            _insert_run(admin_client, user_id, status="abandoned")
            _insert_run(admin_client, user_id, status="active")  # the single live run
            resp = admin_client.table("travel_runs").select("id", count="exact").eq("user_id", str(user_id)).execute()
            assert resp.count == 4, f"Expected 4 runs (3 terminal + 1 active), got {resp.count}"
        finally:
            _cleanup_runs(admin_client, user_id)


# ── travel_audit() namespace lock ────────────────────────────────────


class TestTravelAudit:
    """travel_audit writes truthful, travel-scoped audit rows and refuses
    anything else."""

    def test_valid_travel_action_writes_audit(self, admin_client, test_user_ids):
        """A travel_-prefixed action inserts exactly one audit_log row carrying
        the passed user as user_id."""
        user_id = test_user_ids[0]
        entity_id = uuid4()
        admin_client.rpc(
            "travel_audit",
            {
                "p_user": str(user_id),
                "p_action": "travel_run_open",
                "p_entity_type": "travel_run",
                "p_entity_id": str(entity_id),
                "p_simulation_id": None,
                "p_details": {"smoke": True},
            },
        ).execute()
        try:
            resp = (
                admin_client.table("audit_log")
                .select("user_id, action")
                .eq("entity_id", str(entity_id))
                .eq("action", "travel_run_open")
                .execute()
            )
            assert len(resp.data) == 1, f"Expected 1 audit row, got {len(resp.data)}"
            assert resp.data[0]["user_id"] == str(user_id)
        finally:
            admin_client.table("audit_log").delete().eq("entity_id", str(entity_id)).execute()

    def test_non_travel_action_rejected(self, admin_client, test_user_ids):
        """A non-travel action is rejected by the namespace lock (raises 22023)."""
        user_id = test_user_ids[0]
        with pytest.raises(APIError):
            admin_client.rpc(
                "travel_audit",
                {
                    "p_user": str(user_id),
                    "p_action": "sneaky_forged_action",
                    "p_entity_type": None,
                    "p_entity_id": None,
                    "p_simulation_id": None,
                    "p_details": {},
                },
            ).execute()
