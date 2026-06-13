"""DRIFT travel service (P0a vertical slice).

A thin façade over the run-lifecycle SQL RPCs (migration 246) + the shared chart
read (migration 240/247). Postgres-first: every mutation is a single atomic
SECURITY DEFINER RPC with a run_version CAS and an in-transaction travel_audit()
call — this service NEVER does a fetch-compute-update in Python (ADR-007). It only
calls the RPC, maps the SQLSTATE the RPC raises to an HTTP error, and validates the
returned shape.

Client contract (the auth.uid() ownership guard, migration 246 §4):
- The four player RPCs (open/move/complete/abandon) MUST be called with the USER's
  JWT client (`get_supabase`) so auth.uid() = the player. They are passed the
  user-scoped client by the router. `get_effective_supabase` would null auth.uid()
  for platform admins (service_role) and the in-RPC guard would (correctly) 403.
- The gate read hits platform_settings, which is service_role-only → admin client.
- The chart / current-run reads use whatever client the router injects (RLS-safe).
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.models.drift import (
    DriftChartEdgeResponse,
    DriftChartNodeResponse,
    DriftChartResponse,
    TravelRunResponse,
)
from backend.utils.errors import bad_request, conflict, forbidden, not_found, server_error
from backend.utils.settings import load_platform_settings, parse_setting_bool
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_P0_GATE_KEY = "drift_p0_enabled"

# SQLSTATE → HTTP error factory for the run-lifecycle RPCs (migration 246).
#   42501 caller-is-not-owner · P0002 not-found · 22023 bad-state
#   (NOT_ADJACENT / NOT_AT_HOME / not-active) · 40001 RUN_STALE (CAS miss).
_RPC_ERROR_FACTORIES = {
    "42501": forbidden,
    "P0002": not_found,
    "22023": bad_request,
    "40001": conflict,
}


class DriftService:
    """Run-lifecycle RPC façade + chart read. Stateless; client passed per call."""

    # ── gate ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def assert_p0_enabled(admin_supabase: Client) -> None:
        """Raise 404 unless the drift_p0_enabled phase gate is on (migration 239).

        Fail-closed via parse_setting_bool: a missing/null row reads as OFF. 404 (not
        403) because while the gate is down the whole feature is "not available" — a
        404 keeps it invisible rather than signalling a permission wall.
        """
        settings_map = await load_platform_settings(admin_supabase, [_P0_GATE_KEY])
        if not parse_setting_bool(settings_map.get(_P0_GATE_KEY)):
            raise not_found("DRIFT is not available.")

    # ── reads ─────────────────────────────────────────────────────────────────

    @staticmethod
    async def get_active_chart(supabase: Client) -> DriftChartResponse | None:
        """The active chart version's public topology (max(version) nodes + edges)."""
        cv_resp = await (
            supabase.table("chart_versions")
            .select("version")
            .order("version", desc=True)
            .limit(1)
            .execute()
        )
        versions = cv_resp.data or []
        if not versions:
            return None
        version = versions[0]["version"]

        nodes_resp = await (
            supabase.table("drift_chart_nodes")
            .select("id, stable_key, node_type, simulation_id, x, y, frequency_mask, distance_band, payload")
            .eq("chart_version", version)
            .execute()
        )
        edges_resp = await (
            supabase.table("drift_chart_edges")
            .select("id, from_node, to_node, weight, permeability, corridor")
            .eq("chart_version", version)
            .execute()
        )
        return DriftChartResponse(
            chart_version=version,
            nodes=[DriftChartNodeResponse(**n) for n in (nodes_resp.data or [])],
            edges=[DriftChartEdgeResponse(**e) for e in (edges_resp.data or [])],
        )

    @staticmethod
    async def get_current_run(supabase: Client, user_id: UUID) -> TravelRunResponse | None:
        """The caller's current open run (active / frozen / distress), or None."""
        resp = await (
            supabase.table("travel_runs")
            .select("*")
            .eq("user_id", str(user_id))
            .in_("status", ["active", "frozen", "distress"])
            .order("opened_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return TravelRunResponse(**rows[0]) if rows else None

    # ── mutations (player-class RPCs — user JWT client, auth.uid() = p_user) ────

    @staticmethod
    async def open_run(supabase: Client, user_id: UUID, anchor_simulation_id: UUID) -> TravelRunResponse:
        """Open or resume the single active run anchored to the traveler's home."""
        return await DriftService._call_run_rpc(
            supabase,
            "fn_travel_run_open",
            {"p_user": str(user_id), "p_anchor_sim": str(anchor_simulation_id)},
        )

    @staticmethod
    async def move_run(
        supabase: Client, user_id: UUID, run_id: UUID, run_version: int, to_node_id: UUID
    ) -> TravelRunResponse:
        """A single Drift move to an adjacent node (run_version CAS)."""
        return await DriftService._call_run_rpc(
            supabase,
            "fn_travel_move",
            {
                "p_user": str(user_id),
                "p_run": str(run_id),
                "p_run_version": run_version,
                "p_to_node": str(to_node_id),
            },
        )

    @staticmethod
    async def complete_run(
        supabase: Client, user_id: UUID, run_id: UUID, run_version: int
    ) -> TravelRunResponse:
        """Close the run at the home broadcast edge (Entladung)."""
        return await DriftService._call_run_rpc(
            supabase,
            "fn_travel_complete",
            {"p_user": str(user_id), "p_run": str(run_id), "p_run_version": run_version},
        )

    @staticmethod
    async def abandon_run(
        supabase: Client, user_id: UUID, run_id: UUID, run_version: int
    ) -> TravelRunResponse:
        """Rückzug — abandon the run (unanchored cargo forfeited)."""
        return await DriftService._call_run_rpc(
            supabase,
            "fn_travel_abandon",
            {"p_user": str(user_id), "p_run": str(run_id), "p_run_version": run_version},
        )

    # ── internal ────────────────────────────────────────────────────────────────

    @staticmethod
    async def _call_run_rpc(supabase: Client, rpc_name: str, params: dict) -> TravelRunResponse:
        """Call a run-lifecycle RPC, map its SQLSTATE to HTTP, validate the row shape.

        The RPC audits in-transaction (travel_audit), so no separate AuditService log
        is needed here — the audit is part of the same atomic write.
        """
        try:
            resp = await supabase.rpc(rpc_name, params).execute()
        except PostgrestAPIError as exc:
            raise DriftService._rpc_error(rpc_name, exc) from exc
        if not resp.data:
            raise server_error(f"{rpc_name} returned no run row.")
        return TravelRunResponse(**resp.data)

    @staticmethod
    def _rpc_error(rpc_name: str, exc: PostgrestAPIError) -> HTTPException:
        """Map a run-lifecycle RPC SQLSTATE to the matching HTTPException."""
        code = getattr(exc, "code", None) or ""
        message = getattr(exc, "message", None) or str(exc)
        factory = _RPC_ERROR_FACTORIES.get(code)
        if factory is None:
            logger.warning("DRIFT %s raised unmapped SQLSTATE %s: %s", rpc_name, code, message)
            return server_error(f"DRIFT run operation failed: {message}")
        return factory(message)
