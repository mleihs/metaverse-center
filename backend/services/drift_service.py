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
    CargoResponse,
    ChartGenerationResponse,
    DockAgentResponse,
    DockLoreResponse,
    DriftChartEdgeResponse,
    DriftChartNodeResponse,
    DriftChartResponse,
    DriftDockResponse,
    DriftHonorResponse,
    DriftPublicState,
    DriftTuningResponse,
    QuestAcceptResponse,
    QuestDeliverResponse,
    QuestEffectsResponse,
    QuestInstanceResponse,
    QuestOfferResponse,
    QuestStateResponse,
    TravelRunResponse,
)
from backend.services.travel.chart_generator import ChartGeneratorService
from backend.utils.db import maybe_single_data
from backend.utils.errors import bad_request, conflict, forbidden, not_found, server_error
from backend.utils.settings import load_platform_settings, parse_setting_bool
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_P0_GATE_KEY = "drift_p0_enabled"

# SQLSTATE → HTTP error factory for the run-lifecycle RPCs (migration 246).
#   42501 caller-is-not-owner · P0002 not-found · 22023 bad-state
#   (NOT_ADJACENT / NOT_AT_HOME / not-active). RUN_STALE is matched by message, not
#   code: the RPC raises it as P0001, NOT 40001 — PostgREST auto-retries
#   serialization_failure (40001), which hangs a deterministic optimistic-lock miss.
_RPC_ERROR_FACTORIES = {
    "42501": forbidden,
    "P0002": not_found,
    "22023": bad_request,
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

    @staticmethod
    async def get_public_state(admin_supabase: Client) -> DriftPublicState:
        """The public phase-gate snapshot (drift_p0_enabled), always 200.

        Unlike assert_p0_enabled, this never raises: the frontend polls it to decide
        whether to surface the DRIFT nav-tab + view at all, so a closed gate must
        report enabled=False rather than 404. Reuses the same fail-closed read so the
        public snapshot and the gate can never disagree. platform_settings is
        service_role-only → admin client.
        """
        settings_map = await load_platform_settings(admin_supabase, [_P0_GATE_KEY])
        return DriftPublicState(enabled=parse_setting_bool(settings_map.get(_P0_GATE_KEY)))

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

        # Embed the world name (LEFT JOIN simulations.name) so broadcast_rand homes
        # carry their display label for the on-board labels. simulations is public-read,
        # so the embed resolves on the user/anon client; interstitials → null embed.
        nodes_resp = await (
            supabase.table("drift_chart_nodes")
            .select(
                "id, stable_key, node_type, simulation_id, x, y, "
                "frequency_mask, distance_band, payload, simulations(name)"
            )
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
            nodes=[DriftChartNodeResponse(**DriftService._flatten_node(n)) for n in (nodes_resp.data or [])],
            edges=[DriftChartEdgeResponse(**e) for e in (edges_resp.data or [])],
        )

    @staticmethod
    def _flatten_node(node: dict) -> dict:
        """Lift the embedded simulations(name) onto simulation_name (None for non-homes)."""
        embed = node.pop("simulations", None)
        node["simulation_name"] = embed.get("name") if isinstance(embed, dict) else None
        return node

    @staticmethod
    async def get_tuning(supabase: Client) -> DriftTuningResponse:
        """HUD-relevant tuning scalars (drift_tuning is public-read). Defaults mirror 248."""
        resp = await (
            supabase.table("drift_tuning")
            .select("setting_key, value")
            .in_("setting_key", ["window_base", "dz_p0_cap", "bandwidth_class_bb_max"])
            .execute()
        )
        values = {row["setting_key"]: row["value"] for row in (resp.data or [])}
        bb_max = values.get("bandwidth_class_bb_max") or {}
        return DriftTuningResponse(
            window_base=int(values.get("window_base", 8)),
            dz_cap=int(values.get("dz_p0_cap", 20)),
            bandwidth_class_bb_max={str(k): int(v) for k, v in bb_max.items()},
        )

    @staticmethod
    async def get_chart_honors(supabase: Client, user_id: UUID) -> list[DriftHonorResponse]:
        """Erstvermessung claims on the shared chart. The chart overlays a seal on each
        claimed node, keyed by node_stable_key; is_self marks the caller's own claims.

        chart_honors carries public-read RLS, but this read is member-gated today: it needs
        a caller to resolve is_self, and the whole /drift/* surface is still member-only
        (the anon-capable /api/v1/public/drift/* path is a separate deferred package). Holder
        names stay anonymous in P0 (callsign surfacing is P1b), so user_id never leaves the
        service — it collapses to the is_self bit here."""
        resp = await (
            supabase.table("chart_honors")
            .select("node_stable_key, kind, user_id, claimed_at")
            .eq("kind", "erstvermessung")
            .execute()
        )
        uid = str(user_id)
        return [
            DriftHonorResponse(
                node_stable_key=row["node_stable_key"],
                kind=row["kind"],
                claimed_at=row["claimed_at"],
                is_self=row.get("user_id") == uid,
            )
            for row in (resp.data or [])
        ]

    @staticmethod
    async def regenerate_chart(admin_supabase: Client) -> ChartGenerationResponse:
        """Regenerate the chart from the CURRENT active worlds + their real
        relationships (simulation_connections + embassies). The topology is DERIVED in
        Python (ChartGeneratorService.regenerate, force-directed layout) and written
        atomically via fn_apply_drift_chart; emits a new chart_version (newly published
        worlds/connections appear). service_role only (the writer is backend-class)."""
        summary = await ChartGeneratorService.regenerate(admin_supabase)
        if not summary:
            raise server_error("fn_apply_drift_chart returned no summary.")
        return ChartGenerationResponse(**summary)

    @staticmethod
    async def get_dock_info(supabase: Client, simulation_id: UUID) -> DriftDockResponse | None:
        """A world's identity for the dock panel: name + blurb + a lore epigraph + a
        few Träger. All public sim data (public-first); None if the sim is absent."""
        sim = await maybe_single_data(
            supabase.table("simulations")
            .select("id, name, description, theme")
            .eq("id", str(simulation_id))
            .maybe_single()
        )
        if not sim:
            return None

        lore_resp = await (
            supabase.table("simulation_lore")
            .select("title, epigraph")
            .eq("simulation_id", str(simulation_id))
            .order("sort_order")
            .limit(3)
            .execute()
        )
        # active_agents (not agents): the public-read view — anon/authenticated granted,
        # so the dock surfaces a FOREIGN world's Träger even when the traveller isn't a
        # member (the agents table itself is membership-gated). Public-first.
        agents_resp = await (
            supabase.table("active_agents")
            .select("id, name, primary_profession, portrait_image_url")
            .eq("simulation_id", str(simulation_id))
            .order("created_at")
            .limit(4)
            .execute()
        )
        # Keep only lore rows that actually carry a voice (some chapters are body-only).
        lore = [
            DockLoreResponse(title=row.get("title"), epigraph=row.get("epigraph"))
            for row in (lore_resp.data or [])
            if row.get("title") or row.get("epigraph")
        ][:2]
        return DriftDockResponse(
            simulation_id=sim["id"],
            name=sim["name"],
            description=sim.get("description"),
            theme=sim.get("theme"),
            lore=lore,
            agents=[DockAgentResponse(**a) for a in (agents_resp.data or [])],
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

    # ── quest reads (owner-RLS; offers computed, no writes) ─────────────────────

    @staticmethod
    async def get_quest_state(supabase: Client, user_id: UUID) -> QuestStateResponse:
        """The HUD's quest snapshot: acceptable offers here + the carried Depesche + the
        manifest. Pure reads + offer assembly (no fetch-compute-WRITE — ADR-007 is about
        concurrent writes, which all go through the RPCs)."""
        run = await DriftService.get_current_run(supabase, user_id)

        inst_resp = await (
            supabase.table("travel_quest_instances")
            .select("*")
            .eq("owner_user_id", str(user_id))
            .eq("status", "active")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        inst_rows = inst_resp.data or []
        active = await DriftService._enrich_instance(supabase, inst_rows[0]) if inst_rows else None

        cargo: list[CargoResponse] = []
        if run is not None:
            cargo_resp = await (
                supabase.table("travel_cargo")
                .select("id, family, vector, twists, quest_instance_id, run_id")
                .eq("owner_user_id", str(user_id))
                .eq("run_id", str(run.id))
                .execute()
            )
            cargo = [CargoResponse(**c) for c in (cargo_resp.data or [])]

        offers = await DriftService._compute_offers(supabase, run, active)
        return QuestStateResponse(offers=offers, active=active, cargo=cargo)

    @staticmethod
    async def _enrich_instance(supabase: Client, row: dict) -> QuestInstanceResponse:
        """Add HUD dressing to a raw instance row: the template's title + the target
        world's display name (from the resolved slots)."""
        tmpl = await maybe_single_data(
            supabase.table("travel_quest_templates")
            .select("definition")
            .eq("template_key", row["template_key"])
            .maybe_single()
        )
        prose = (tmpl.get("definition") or {}).get("prose", {}) if tmpl else {}
        target_sim = (row.get("slots") or {}).get("target_sim")
        target_name = None
        if target_sim:
            sim = await maybe_single_data(
                supabase.table("simulations").select("name").eq("id", target_sim).maybe_single()
            )
            target_name = sim.get("name") if sim else None
        return QuestInstanceResponse(
            **row, title=prose.get("title_de"), target_simulation_name=target_name
        )

    @staticmethod
    async def _compute_offers(
        supabase: Client, run: TravelRunResponse | None, active: QuestInstanceResponse | None
    ) -> list[QuestOfferResponse]:
        """Deliver Depeschen the traveler can accept right now: only while on an active
        run, carrying no quest yet (P0 one-at-a-time), standing on a world edge — one
        offer per deliver template × each foreign broadcast world on the chart.

        P0c-mechanical: the offered set is template × worlds. WHICH Depeschen a world
        actually issues (the storylet/selector layer, §9) is later content work."""
        # Only an ACTIVE run can accept a Depesche (fn_quest_accept rejects frozen/distress
        # with QUEST_ACTIVE/22023 → 400); don't offer what the click would reject.
        if (
            run is None
            or run.status != "active"
            or active is not None
            or run.position_node_id is None
        ):
            return []
        node = await maybe_single_data(
            supabase.table("drift_chart_nodes")
            .select("simulation_id")
            .eq("id", str(run.position_node_id))
            .eq("chart_version", run.chart_version)
            .maybe_single()
        )
        origin_sim = node.get("simulation_id") if node else None
        if not origin_sim:
            return []  # mid-Drift (no sim) — Depeschen are taken at world edges only

        tmpl_resp = await (
            supabase.table("travel_quest_templates")
            .select("template_key, family, definition")
            .eq("family", "deliver")
            .execute()
        )
        templates = tmpl_resp.data or []
        if not templates:
            return []

        worlds_resp = await (
            supabase.table("drift_chart_nodes")
            .select("simulation_id, simulations(name)")
            .eq("chart_version", run.chart_version)
            .eq("node_type", "broadcast_rand")
            .neq("simulation_id", origin_sim)
            .execute()
        )
        offers: list[QuestOfferResponse] = []
        for tmpl in templates:
            definition = tmpl.get("definition") or {}
            prose = definition.get("prose", {})
            cargo = definition.get("cargo", {})
            for world in worlds_resp.data or []:
                sim_id = world.get("simulation_id")
                if not sim_id:
                    continue
                embed = world.get("simulations")
                world_name = embed.get("name") if isinstance(embed, dict) else None
                offers.append(
                    QuestOfferResponse(
                        template_key=tmpl["template_key"],
                        family=tmpl["family"],
                        title=prose.get("title_de") or tmpl["template_key"],
                        brief=prose.get("brief_de") or "",
                        cargo_family=cargo.get("family", "erinnerungsstuecke"),
                        cargo_vector=cargo.get("vector", "memory"),
                        target_simulation_id=sim_id,
                        target_simulation_name=world_name or "Unbenannt",
                    )
                )
        return offers

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

    @staticmethod
    async def accept_quest(
        supabase: Client,
        user_id: UUID,
        run_id: UUID,
        run_version: int,
        template_key: str,
        target_simulation_id: UUID,
    ) -> QuestAcceptResponse:
        """Take a deliver Depesche: instantiate it + bind the cargo to the run (CAS)."""
        data = await DriftService._call_quest_rpc(
            supabase,
            "fn_quest_accept",
            {
                "p_user": str(user_id),
                "p_run": str(run_id),
                "p_run_version": run_version,
                "p_template_key": template_key,
                "p_target_sim": str(target_simulation_id),
            },
        )
        return QuestAcceptResponse(
            run=TravelRunResponse(**data["run"]),
            instance=QuestInstanceResponse(**data["instance"]),
            cargo=CargoResponse(**data["cargo"]),
        )

    @staticmethod
    async def deliver_quest(
        supabase: Client, user_id: UUID, run_id: UUID, run_version: int, instance_id: UUID
    ) -> QuestDeliverResponse:
        """Deliver a Depesche at the target edge: fires the effects through the gate (CAS)."""
        data = await DriftService._call_quest_rpc(
            supabase,
            "fn_quest_advance",
            {
                "p_user": str(user_id),
                "p_run": str(run_id),
                "p_run_version": run_version,
                "p_instance": str(instance_id),
            },
        )
        return QuestDeliverResponse(
            run=TravelRunResponse(**data["run"]),
            instance=QuestInstanceResponse(**data["instance"]),
            effects=QuestEffectsResponse(**data["effects"]),
        )

    # ── internal ────────────────────────────────────────────────────────────────

    @staticmethod
    async def _call_quest_rpc(supabase: Client, rpc_name: str, params: dict) -> dict:
        """Call a quest RPC (composite jsonb return), mapping its SQLSTATE to HTTP. Shares
        _rpc_error with the run RPCs: RUN_STALE→409, 42501→403, P0002→404, 22023→400
        (QUEST_ACTIVE / NOT_AT_TARGET / CARGO_MISSING / not-active). The RPC audits in-txn."""
        try:
            resp = await supabase.rpc(rpc_name, params).execute()
        except PostgrestAPIError as exc:
            raise DriftService._rpc_error(rpc_name, exc) from exc
        if not resp.data:
            raise server_error(f"{rpc_name} returned no payload.")
        return resp.data

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
        # The optimistic-lock CAS miss surfaces by message (raised as P0001 to dodge
        # PostgREST's 40001 retry) → 409 Conflict: the client refetches + retries.
        if message == "RUN_STALE":
            return conflict(message)
        factory = _RPC_ERROR_FACTORIES.get(code)
        if factory is None:
            logger.warning("DRIFT %s raised unmapped SQLSTATE %s: %s", rpc_name, code, message)
            return server_error(f"DRIFT run operation failed: {message}")
        return factory(message)
