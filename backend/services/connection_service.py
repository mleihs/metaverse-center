"""Service layer for simulation connection operations.

Cross-simulation, uses admin client for writes — does NOT extend BaseService.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from cachetools import TTLCache
from fastapi import HTTPException, status

from backend.services.base_service import serialize_for_json
from backend.services.cache_config import get_ttl
from backend.services.embassy_service import EmbassyService
from supabase import Client

logger = logging.getLogger(__name__)


class ConnectionService:
    """Simulation connection operations."""

    table_name = "simulation_connections"

    # In-process TTL cache for get_map_data
    _map_data_cache: TTLCache = TTLCache(maxsize=1, ttl=get_ttl("cache_map_data_ttl"))

    @classmethod
    async def list_all(
        cls,
        supabase: Client,
        *,
        active_only: bool = True,
    ) -> list[dict]:
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

        response = query.execute()
        return response.data or []

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

        all_connections = await cls.list_all(supabase, active_only=True)

        # Filter connections: remove orphans (pointing to archived/deleted sims).
        sim_ids = {s["id"] for s in simulations}
        instance_ids = {s["id"] for s in simulations if s.get("simulation_type") == "game_instance"}
        connections = [
            c for c in all_connections
            if c["simulation_a_id"] in sim_ids and c["simulation_b_id"] in sim_ids
        ]

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

        instance_ids = [s["id"] for s in simulations if s.get("simulation_type") == "game_instance"]
        score_dimensions = await cls._fetch_score_dimensions(supabase, instance_ids)

        template_ids = [s["id"] for s in simulations if s.get("simulation_type") in (None, "template")]
        sparklines = await cls._fetch_sparklines(supabase, template_ids)

        echo_counts = await cls._fetch_echo_counts(supabase)

        result = {
            "simulations": simulations,
            "connections": connections,
            "echo_counts": echo_counts,
            "embassies": embassies,
            "active_instance_counts": active_instance_counts,
            "operative_flow": operative_flow,
            "score_dimensions": score_dimensions,
            "sparklines": sparklines,
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
        resp = (
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
        echo_resp = (
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
            op_resp = (
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
        except Exception:
            logger.debug("Operative flow query skipped (table may be empty)")
        return flow

    @classmethod
    async def _fetch_score_dimensions(cls, supabase: Client, instance_ids: list[str]) -> dict[str, dict]:
        """Fetch latest cycle score dimensions per game-instance simulation."""
        if not instance_ids:
            return {}
        dimensions: dict[str, dict] = {}
        try:
            score_resp = (
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
        except Exception:
            logger.debug("Score dimensions query skipped")
        return dimensions

    @classmethod
    async def _fetch_sparklines(cls, supabase: Client, template_ids: list[str]) -> dict[str, list[float]]:
        """Fetch last 10 composite scores per template (sparkline data)."""
        if not template_ids:
            return {}
        sparklines: dict[str, list[float]] = {}
        try:
            spark_resp = (
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
        except Exception:
            logger.debug("Sparkline data query skipped")
        return sparklines

    @classmethod
    async def create_connection(
        cls,
        admin_supabase: Client,
        data: dict,
    ) -> dict:
        """Create a simulation connection (admin only)."""
        response = (
            admin_supabase.table(cls.table_name)
            .insert(serialize_for_json(data))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create connection.",
            )
        return response.data[0]

    @classmethod
    async def update_connection(
        cls,
        admin_supabase: Client,
        connection_id: UUID,
        data: dict,
    ) -> dict:
        """Update a simulation connection (admin only)."""
        update_data = {**serialize_for_json(data), "updated_at": datetime.now(UTC).isoformat()}
        response = (
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
        return response.data[0]

    @classmethod
    async def delete_connection(
        cls,
        admin_supabase: Client,
        connection_id: UUID,
    ) -> dict:
        """Delete a simulation connection (admin only)."""
        response = (
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
        return response.data[0]
