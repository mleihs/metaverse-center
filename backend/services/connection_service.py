"""Service layer for simulation connection operations.

Cross-simulation, uses admin client for writes — does NOT extend BaseService.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

import httpx
from cachetools import TTLCache
from fastapi import HTTPException, status
from postgrest.exceptions import APIError as PostgrestAPIError
from pydantic import TypeAdapter

from backend.models.echo import ConnectionResponse
from backend.services.base_service import serialize_for_json
from backend.services.cache_config import get_ttl
from backend.services.embassy_service import EmbassyService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class ConnectionService:
    """Simulation connection operations."""

    table_name = "simulation_connections"
    _connections_adapter = TypeAdapter(list[ConnectionResponse])

    # In-process TTL cache for get_map_data
    _map_data_cache: TTLCache = TTLCache(maxsize=1, ttl=get_ttl("cache_map_data_ttl"))

    @classmethod
    def invalidate_map_cache(cls) -> None:
        """Clear the in-process map data cache (called when TTL settings change)."""
        cls._map_data_cache.clear()

    @classmethod
    async def list_all(
        cls,
        supabase: Client,
        *,
        active_only: bool = True,
    ) -> list[ConnectionResponse]:
        """List all simulation connections."""
        query = (
            supabase.table(cls.table_name)
            .select(
                "*, simulation_a:simulations!simulation_a_id(id, name, slug, theme, banner_url, description),"
                " simulation_b:simulations!simulation_b_id(id, name, slug, theme, banner_url, description)"
            )
            .order("created_at", desc=False)
        )
        if active_only:
            query = query.eq("is_active", True)

        response = await query.execute()
        return cls._connections_adapter.validate_python(response.data or [])

    @classmethod
    async def get_map_data(
        cls,
        supabase: Client,
    ) -> dict:
        """Get aggregated data for the Cartographer's Map.

        Includes game instances (simulation_type, epoch_id, source_template_id)
        and epoch status for live map rendering. Excludes archived instances.
        Results are cached in-process for 15 seconds.
        """
        cached = cls._map_data_cache.get("map_data")
        if cached is not None:
            return cached

        simulations = await cls._fetch_map_simulations(supabase)

        sim_ids = {s["id"] for s in simulations}
        instance_ids = {s["id"] for s in simulations if s.get("simulation_type") == "game_instance"}
        template_ids = [s["id"] for s in simulations if s.get("simulation_type") in (None, "template")]

        # Connections: filter by sim_ids in SQL (no orphan fetch)
        sim_id_list = list(sim_ids)
        conn_resp = await (
            supabase.table(cls.table_name)
            .select(
                "*, simulation_a:simulations!simulation_a_id(id, name, slug, theme, banner_url, description),"
                " simulation_b:simulations!simulation_b_id(id, name, slug, theme, banner_url, description)"
            )
            .eq("is_active", True)
            .in_("simulation_a_id", sim_id_list)
            .in_("simulation_b_id", sim_id_list)
            .order("created_at", desc=False)
            .execute()
        )
        connections = conn_resp.data or []

        all_embassies = await EmbassyService.list_all_active(supabase)
        # Filter embassies: only show template-template embassy edges on the map.
        # Game instance cloning duplicates embassies, creating dozens of redundant
        # instance-instance embassy edges that overwhelm the visualization.
        embassies = [
            e for e in all_embassies
            if e.get("simulation_a_id") not in instance_ids
            and e.get("simulation_b_id") not in instance_ids
        ]

        active_instance_counts = cls._compute_active_instance_counts(simulations)
        operative_flow = await cls._fetch_operative_flow(supabase)

        instance_id_list = list(instance_ids)
        score_dimensions = await cls._fetch_score_dimensions(supabase, instance_id_list)

        sparklines = await cls._fetch_sparklines(supabase, template_ids)

        echo_counts = await cls._fetch_echo_counts(supabase)

        overlay = await cls._fetch_map_overlay_data(supabase, sim_ids)
        zone_topology = overlay.get("zone_topology", {})
        historical_events = overlay.get("historical_events", {})
        active_bleed_details = overlay.get("active_bleed_details", {})

        # ── Heartbeat integration: anchor lines + scar tissue ──
        anchors: list[dict] = []
        heartbeat_status: dict[str, dict] = {}
        try:
            anchor_resp = await (
                supabase.table("collaborative_anchors")
                .select("id, name, resonance_signature, anchor_simulation_ids, strength, status")
                .in_("status", ["forming", "active", "reinforcing"])
                .execute()
            )
            anchors = anchor_resp.data or []

            # Per-simulation heartbeat summary for map overlay
            hb_resp = await (
                supabase.table("simulations")
                .select("id, last_heartbeat_tick, next_heartbeat_at")
                .in_("id", sim_id_list)
                .execute()
            )
            for sim in (hb_resp.data or []):
                sid = sim["id"]
                # Get active arc count + total scar tissue
                _resp = await (
                    supabase.table("narrative_arcs")
                    .select("id, scar_tissue_deposited")
                    .eq("simulation_id", sid)
                    .in_("status", ["building", "active", "climax"])
                    .execute()
                )
                arc_data = _resp.data or []
                scar = sum(float(a.get("scar_tissue_deposited", 0)) for a in arc_data)
                heartbeat_status[sid] = {
                    "last_tick": sim.get("last_heartbeat_tick", 0),
                    "next_heartbeat_at": sim.get("next_heartbeat_at"),
                    "active_arcs": len(arc_data),
                    "scar_tissue": round(scar, 4),
                }
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.debug("Heartbeat map data unavailable (tables may not exist yet)")

        result = {
            "simulations": simulations,
            "connections": connections,
            "echo_counts": echo_counts,
            "embassies": embassies,
            "active_instance_counts": active_instance_counts,
            "operative_flow": operative_flow,
            "score_dimensions": score_dimensions,
            "sparklines": sparklines,
            "zone_topology": zone_topology,
            "historical_events": historical_events,
            "active_bleed_details": active_bleed_details,
            "anchors": anchors,
            "heartbeat_status": heartbeat_status,
        }

        cls._map_data_cache["map_data"] = result
        return result

    @classmethod
    async def _fetch_map_simulations(cls, supabase: Client) -> list[dict]:
        """Fetch simulations for the map via the ``map_simulations`` Postgres view.

        The view (migration 091) consolidates three former queries into a single
        SELECT and handles epoch-status filtering + dashboard-count joins in SQL:
        - Joins game_epochs for ``epoch_status``
        - Joins simulation_dashboard for agent/building/event counts
        - Excludes game instances from completed/cancelled epochs
        """
        resp = await (
            supabase.table("map_simulations")
            .select("*")
            .execute()
        )
        return resp.data or []

    @staticmethod
    def _compute_active_instance_counts(simulations: list[dict]) -> dict[str, int]:
        """Count active game instances per template simulation."""
        counts: dict[str, int] = {}
        for sim in simulations:
            if (
                sim.get("simulation_type") == "game_instance"
                and sim.get("source_template_id")
                and sim.get("epoch_status") in ("lobby", "foundation", "competition", "reckoning")
            ):
                tid = sim["source_template_id"]
                counts[tid] = counts.get(tid, 0) + 1
        return counts

    @classmethod
    async def _fetch_echo_counts(cls, supabase: Client) -> dict[str, int]:
        """Fetch incoming completed echo counts per simulation."""
        echo_resp = await (
            supabase.table("event_echoes")
            .select("target_simulation_id", count="exact")
            .eq("status", "completed")
            .execute()
        )
        counts: dict[str, int] = {}
        for row in echo_resp.data or []:
            sid = row["target_simulation_id"]
            counts[sid] = counts.get(sid, 0) + 1
        return counts

    @classmethod
    async def _fetch_operative_flow(cls, supabase: Client) -> dict[str, dict]:
        """Fetch active operative flow between simulations."""
        flow: dict[str, dict] = {}
        try:
            op_resp = await (
                supabase.table("operative_missions")
                .select("source_simulation_id, target_simulation_id, operative_type")
                .in_("status", ["deployed", "active", "en_route"])
                .execute()
            )
            for op in op_resp.data or []:
                src = op.get("source_simulation_id")
                tgt = op.get("target_simulation_id")
                if src and tgt:
                    key = f"{src}|{tgt}"
                    if key not in flow:
                        flow[key] = {"count": 0, "types": []}
                    flow[key]["count"] += 1
                    op_type = op.get("operative_type")
                    if op_type and op_type not in flow[key]["types"]:
                        flow[key]["types"].append(op_type)
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
            logger.debug("Operative flow query skipped (table may be empty)")
        return flow

    @classmethod
    async def _fetch_score_dimensions(cls, supabase: Client, instance_ids: list[str]) -> dict[str, dict]:
        """Fetch latest cycle score dimensions per game-instance simulation."""
        if not instance_ids:
            return {}
        dimensions: dict[str, dict] = {}
        try:
            score_resp = await (
                supabase.table("epoch_scores")
                .select(
                    "simulation_id, stability_score, influence_score,"
                    " sovereignty_score, diplomatic_score, military_score,"
                    " cycle_number"
                )
                .in_("simulation_id", instance_ids)
                .order("cycle_number", desc=True)
                .execute()
            )
            seen: set[str] = set()
            for row in score_resp.data or []:
                sid = row["simulation_id"]
                if sid in seen:
                    continue
                seen.add(sid)
                dimensions[sid] = {
                    "stability": row.get("stability_score", 0),
                    "influence": row.get("influence_score", 0),
                    "sovereignty": row.get("sovereignty_score", 0),
                    "diplomatic": row.get("diplomatic_score", 0),
                    "military": row.get("military_score", 0),
                }
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
            logger.debug("Score dimensions query skipped")
        return dimensions

    @classmethod
    async def _fetch_sparklines(cls, supabase: Client, template_ids: list[str]) -> dict[str, list[float]]:
        """Fetch last 10 composite scores per template (sparkline data)."""
        if not template_ids:
            return {}
        sparklines: dict[str, list[float]] = {}
        try:
            # INNER JOIN: scores without a parent simulation are orphans;
            # source_template_id required for grouping — LEFT JOIN would add unusable null rows
            spark_resp = await (
                supabase.table("epoch_scores")
                .select(
                    "simulation_id, composite_score, cycle_number,"
                    " simulations!inner(source_template_id)"
                )
                .order("cycle_number", desc=True)
                .limit(200)
                .execute()
            )
            template_scores: dict[str, list[float]] = {}
            for row in spark_resp.data or []:
                sim_data = row.get("simulations")
                if not sim_data:
                    continue
                tmpl_id = sim_data.get("source_template_id")
                if tmpl_id and tmpl_id in template_ids:
                    if tmpl_id not in template_scores:
                        template_scores[tmpl_id] = []
                    if len(template_scores[tmpl_id]) < 10:
                        template_scores[tmpl_id].append(float(row.get("composite_score", 0)))
            for tid, scores_list in template_scores.items():
                sparklines[tid] = list(reversed(scores_list))
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
            logger.debug("Sparkline data query skipped")
        return sparklines

    @classmethod
    async def _fetch_map_overlay_data(
        cls, supabase: Client, sim_ids: set[str]
    ) -> dict:
        """Fetch zone topology, historical events, and bleed details in one RPC.

        Uses the ``get_map_overlay_data`` Postgres function (migration 100).
        """
        empty = {"zone_topology": {}, "historical_events": {}, "active_bleed_details": {}}
        if not sim_ids:
            return empty
        try:
            response = await supabase.rpc(
                "get_map_overlay_data",
                {"p_simulation_ids": list(sim_ids)},
            ).execute()
            if response.data:
                return response.data
        except (PostgrestAPIError, httpx.HTTPError):
            logger.debug("Map overlay data RPC skipped")
        return empty

    @classmethod
    async def create_connection(
        cls,
        admin_supabase: Client,
        data: dict,
    ) -> ConnectionResponse:
        """Create a simulation connection (admin only)."""
        response = await (
            admin_supabase.table(cls.table_name)
            .insert(serialize_for_json(data))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create connection.",
            )
        return ConnectionResponse.model_validate(response.data[0])

    @classmethod
    async def update_connection(
        cls,
        admin_supabase: Client,
        connection_id: UUID,
        data: dict,
    ) -> ConnectionResponse:
        """Update a simulation connection (admin only)."""
        update_data = {**serialize_for_json(data), "updated_at": datetime.now(UTC).isoformat()}
        response = await (
            admin_supabase.table(cls.table_name)
            .update(update_data)
            .eq("id", str(connection_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connection '{connection_id}' not found.",
            )
        return ConnectionResponse.model_validate(response.data[0])

    @classmethod
    async def delete_connection(
        cls,
        admin_supabase: Client,
        connection_id: UUID,
    ) -> None:
        """Delete a simulation connection (admin only)."""
        response = await (
            admin_supabase.table(cls.table_name)
            .delete()
            .eq("id", str(connection_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connection '{connection_id}' not found.",
            )
